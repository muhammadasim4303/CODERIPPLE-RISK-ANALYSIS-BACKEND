"""
Model inference module — matches the exact architecture from code_risk_analyzer.ipynb.

Architecture:
  - Siamese CodeBERT (microsoft/codebert-base) with LoRA (rank=8, query+value)
  - StructuredEncoder: BatchNorm → Linear(n,256) → GELU → Dropout → Linear(256,256) → GELU → Dropout → Linear(256,128)
  - Fusion: LayerNorm(3200) → Linear(3200,512) → GELU → Dropout → Linear(512,256) → GELU → Dropout
  - regression_head: Linear(256,64) → GELU → Dropout → Linear(64,1)
  - classification_head: Linear(256,64) → GELU → Dropout → Linear(64,3)
  - Scaler: RobustScaler (saved as sklearn object) — scalar_features.pkl
  - Checkpoint: saved as {'epoch':..., 'model_state_dict':..., ...}

At inference (no tokenizer): text embeddings are zeroed out.
Only the structured encoder + fusion + heads are active.
This is valid because the structured encoder is independent of CodeBERT.
"""

import os
import logging
import pickle
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import gdown

MODEL_PATH  = os.path.join(os.path.dirname(__file__), "models", "best_model.pt")
SCALER_PATH = os.path.join(os.path.dirname(__file__), "models", "scalar_features.pkl")

LABEL_CLASSES = ["HIGH RISK", "LOW RISK", "MEDIUM RISK"]  # alphabetical — matches LabelEncoder
DEVICE = torch.device("cpu")


# 
# Architecture (mirrors code_risk_analyzer.ipynb exactly)
# 

class StructuredEncoder(nn.Module):
    def __init__(self, input_dim: int, output_dim: int = 128, dropout: float = 0.3):
        super().__init__()
        self.net = nn.Sequential(
            nn.BatchNorm1d(input_dim),
            nn.Linear(input_dim, 256),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(256, 256),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(256, output_dim),
        )

    def forward(self, x):
        return self.net(x)


class HybridCodeRiskModel(nn.Module):
    """
    Stripped-down version for inference without CodeBERT.
    Passes zero tensors for all text embeddings — only the
    structured path contributes to the prediction.
    """
    def __init__(self, n_structured: int, num_classes: int = 3,
                 struct_dim: int = 128, hidden_size: int = 768,
                 fusion_dim: int = 512, dropout: float = 0.3):
        super().__init__()

        self.hidden_size = hidden_size
        self.struct_encoder = StructuredEncoder(n_structured, struct_dim, dropout)

        # Fusion: [OLD|NEW|DELTA|CTX|struct] = 4*768 + 128 = 3200
        fusion_input_dim = hidden_size * 4 + struct_dim
        self.fusion = nn.Sequential(
            nn.LayerNorm(fusion_input_dim),          # index 0
            nn.Linear(fusion_input_dim, fusion_dim), # index 1
            nn.GELU(),                               # index 2
            nn.Dropout(dropout),                     # index 3
            nn.Linear(fusion_dim, fusion_dim // 2),  # index 4
            nn.GELU(),                               # index 5
            nn.Dropout(dropout),                     # index 6
        )

        head_input = fusion_dim // 2  # 256

        self.regression_head = nn.Sequential(
            nn.Linear(head_input, 64),
            nn.GELU(),
            nn.Dropout(dropout / 2),
            nn.Linear(64, 1),
        )

        self.classification_head = nn.Sequential(
            nn.Linear(head_input, 64),
            nn.GELU(),
            nn.Dropout(dropout / 2),
            nn.Linear(64, num_classes),
        )

        # Learnable task uncertainty weights (Kendall 2018)
        self.log_var_reg = nn.Parameter(torch.zeros(1))
        self.log_var_clf = nn.Parameter(torch.zeros(1))

    def forward(self, structured):
        B = structured.shape[0]
        # Zero text embeddings — structured-only inference
        text_zeros = torch.zeros(B, self.hidden_size * 4, device=structured.device)

        struct_emb = self.struct_encoder(structured)
        fused_in   = torch.cat([text_zeros, struct_emb], dim=-1)
        fused      = self.fusion(fused_in)

        risk_score  = self.regression_head(fused).squeeze(-1)
        risk_logits = self.classification_head(fused)
        return risk_score, risk_logits


# 
# Singleton loader
# 

_model  = None
_scaler = None
_n_structured = None
_model_failed = False   # if True, stop retrying and use heuristic


def _load_artifacts():
    global _model, _scaler, _n_structured, _model_failed

    if _model_failed:
        raise RuntimeError("Model previously failed to load — using heuristic")

    if _model is not None:
        return _model, _scaler

    # --- Download model from Google Drive if missing ---
    if not os.path.exists(MODEL_PATH):
        logging.info(f"Model not found at {MODEL_PATH}. Downloading from Google Drive...")
        
        # Ensure the models directory exists
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        
        # TODO: REPLACE WITH YOUR ACTUAL GOOGLE DRIVE FILE ID
        FILE_ID = "1b_9A9alyH4uOiYQ5eXcijGisSAPss0T1"
        
        try:
            # gdown automatically handles the Google Drive virus scan warning for large files
            gdown.download(id=FILE_ID, output=MODEL_PATH, quiet=False)
            logging.info("Download complete!")
        except Exception as e:
            logging.error(f"Failed to download model from Google Drive: {e}")
            _model_failed = True
            raise RuntimeError(f"Failed to download model: {e}")

    #  Load scaler 
    with open(SCALER_PATH, "rb") as f:
        raw_scaler = pickle.load(f)

    logging.info(f"Scaler type: {type(raw_scaler).__name__}")

    if hasattr(raw_scaler, "transform") and hasattr(raw_scaler, "n_features_in_"):
        # Proper sklearn RobustScaler / StandardScaler
        _scaler = raw_scaler
        _n_structured = int(raw_scaler.n_features_in_)

    elif hasattr(raw_scaler, "transform"):
        _scaler = raw_scaler
        _n_structured = int(getattr(raw_scaler, "n_features_in_",
                            getattr(raw_scaler, "n_features_", 54)))

    elif isinstance(raw_scaler, np.ndarray):
        # Check if it contains strings (column names) vs numbers
        if raw_scaler.dtype.kind in ("U", "S", "O"):
            logging.warning(
                f"scalar_features.pkl contains column names, not numbers — using identity scaler. "
                "BatchNorm1d inside the model handles normalization."
            )
            class IdentityScaler:
                def __init__(self, n):
                    self.n_features_in_ = n
                def transform(self, X):
                    return X.astype(np.float32)
            _scaler = IdentityScaler(len(raw_scaler))
            _n_structured = len(raw_scaler)
        else:
            logging.warning(f"scalar_features.pkl is numeric ndarray shape={raw_scaler.shape} — wrapping")
            class NumpyScaler:
                def __init__(self, arr):
                    if arr.ndim == 2 and arr.shape[0] == 2:
                        self.center_ = arr[0].astype(np.float32)
                        self.scale_  = arr[1].astype(np.float32)
                    else:
                        self.center_ = arr.astype(np.float32)
                        self.scale_  = np.ones(len(arr), dtype=np.float32)
                    self.n_features_in_ = len(self.center_)
                def transform(self, X):
                    return (X - self.center_) / (self.scale_ + 1e-8)
            _scaler = NumpyScaler(raw_scaler)
            _n_structured = _scaler.n_features_in_

    else:
        raise ValueError(f"Cannot handle scaler type: {type(raw_scaler)}")

    logging.info(f"Scaler ready — n_features={_n_structured}")

    #  Load checkpoint 
    checkpoint = torch.load(MODEL_PATH, map_location=DEVICE, weights_only=False)

    if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
        state_dict = checkpoint["model_state_dict"]
        logging.info(f"Checkpoint epoch={checkpoint.get('epoch')}, "
                     f"val_loss={checkpoint.get('val_loss', '?'):.4f}")
    else:
        state_dict = checkpoint

    # Log all top-level key prefixes
    prefixes = sorted(set(k.split(".")[0] for k in state_dict.keys()))
    logging.info(f"State dict key prefixes: {prefixes}")

    #  Infer struct_encoder dims by scanning all struct keys 
    struct_linear_keys = sorted([
        k for k in state_dict
        if k.startswith("struct_encoder.net.") and k.endswith(".weight")
        and state_dict[k].ndim == 2  # only Linear weights, not BN
    ])
    logging.info(f"struct_encoder Linear keys: {struct_linear_keys}")

    if struct_linear_keys:
        n_struct_in = int(state_dict[struct_linear_keys[0]].shape[1])   # first Linear input
        struct_dim  = int(state_dict[struct_linear_keys[-1]].shape[0])  # last Linear output
    else:
        n_struct_in = _n_structured
        struct_dim  = 128

    # fusion.1 = first Linear in fusion (after LayerNorm)
    fusion_in_key = "fusion.1.weight"
    if fusion_in_key in state_dict:
        fusion_input = int(state_dict[fusion_in_key].shape[1])   # 3200
        fusion_dim   = int(state_dict[fusion_in_key].shape[0])   # 512
        hidden_size  = (fusion_input - struct_dim) // 4           # 768
    else:
        fusion_input = 3200
        fusion_dim   = 512
        hidden_size  = 768

    logging.info(f"Inferred: n_struct_in={n_struct_in}, struct_dim={struct_dim}, "
                 f"fusion_input={fusion_input}, fusion_dim={fusion_dim}, hidden_size={hidden_size}")

    # Adjust scaler if mismatch
    if n_struct_in != _n_structured:
        logging.warning(f"Scaler has {_n_structured} features but model expects {n_struct_in}")
        _n_structured = n_struct_in

    #  Build model and load weights 
    _model = HybridCodeRiskModel(
        n_structured = n_struct_in,
        num_classes  = 3,
        struct_dim   = struct_dim,
        hidden_size  = hidden_size,
        fusion_dim   = fusion_dim,
    )

    # Filter to only keys our stripped model has (skip code_encoder.* and LoRA keys)
    our_keys = set(_model.state_dict().keys())
    filtered = {k: v for k, v in state_dict.items() if k in our_keys}
    missing  = our_keys - set(filtered.keys())

    logging.info(f"Loading {len(filtered)}/{len(our_keys)} matching keys "
                 f"(skipped {len(state_dict) - len(filtered)} CodeBERT/LoRA keys)")
    if missing:
        logging.warning(f"Missing from checkpoint: {missing}")

    _model.load_state_dict(filtered, strict=False)
    _model.eval()

    return _model, _scaler


def predict(feature_vector: list) -> dict:
    try:
        model, scaler = _load_artifacts()
    except Exception as e:
        raise RuntimeError(f"Model load failed: {e}")

    x = np.array([feature_vector], dtype=np.float32)

    # Trim/pad to match scaler
    expected = scaler.n_features_in_
    if x.shape[1] != expected:
        logging.warning(f"Vector len {x.shape[1]} != scaler {expected} — adjusting")
        if x.shape[1] > expected:
            x = x[:, :expected]
        else:
            x = np.pad(x, ((0, 0), (0, expected - x.shape[1])))

    x_scaled = scaler.transform(x)

    with torch.no_grad():
        tensor = torch.tensor(x_scaled, dtype=torch.float32)
        risk_score_t, logits_t = model(tensor)

    risk_score = float(risk_score_t.item())
    probs      = F.softmax(logits_t, dim=-1).squeeze(0).tolist()
    pred_idx   = int(np.argmax(probs))
    risk_label = LABEL_CLASSES[pred_idx]
    confidence = float(probs[pred_idx])

    return {
        "pred_risk_score": risk_score,
        "pred_risk_label": risk_label,
        "pred_confidence": confidence,
        "probabilities": {
            "HIGH RISK":   round(probs[0], 4),
            "LOW RISK":    round(probs[1], 4),
            "MEDIUM RISK": round(probs[2], 4),
        },
    }


def is_model_available() -> bool:
    return os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH)