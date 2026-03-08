# CodeRipple — AI Code Change Risk Analyzer

Full-stack project: React/TypeScript frontend + Flask/PyTorch backend.

## Quick Start

### 1. Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Add your trained model files:
cp /path/to/best_model.pt      models/
cp /path/to/scalar_features.pkl models/

python app.py          # starts on http://localhost:5000
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev            # starts on http://localhost:5173
```

## How Risk Analysis Works

1. User opens a repo page — commits list from GitHub (via Supabase edge function).
2. Each commit card shows a **"Compute Risk"** button.
3. On click → frontend sends the commit's `patch`, `old_contents`, `new_contents`, `file`, `description` to Flask `/api/analyze/batch`.
4. Flask **extracts 54 engineered features** (cyclomatic complexity, security patterns, API changes, test coverage, etc.) — same pipeline as `dataPreprocessing.ipynb`.
5. Features are scaled with `scalar_features.pkl` (RobustScaler) and fed to `best_model.pt` (HybridCodeRiskModel with CodeBERT + structured MLP fusion).
6. Result: risk score (0–1), label (LOW/MEDIUM/HIGH RISK), sub-scores + reasons.
7. Result is cached in backend memory and displayed on the commit card.

## Architecture

```
frontend/               ← React + TypeScript + Tailwind (Vite)
  src/
    api/riskApi.ts      ← Typed Flask API calls
    hooks/
      useRiskAnalysis.ts  ← Per-commit state machine
    components/common/
      CommitRiskCard.tsx  ← Compute Risk button + result display
    pages/
      Repositories/
        RepoDetails.tsx   ← Commit list with inline risk badges
      Commits/
        CommitDetails.tsx ← Full risk breakdown view

backend/                ← Flask + PyTorch
  app.py                ← REST API (Flask)
  feature_extractor.py  ← All 54 features (mirrors dataPreprocessing.ipynb)
  model_inference.py    ← HybridCodeRiskModel loader & predict()
  risk_reasoning.py     ← Human-readable risk reasons
  models/
    best_model.pt        ← trained weights (add manually)
    scalar_features.pkl  ← fitted RobustScaler (add manually)
```
