# CodeRipple — Flask Backend

## Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Add your trained model files
mkdir -p models
cp /path/to/best_model.pt      models/
cp /path/to/scalar_features.pkl models/

# Run
python app.py
# or production:
gunicorn -w 2 -b 0.0.0.0:5000 app:app
```

The backend will start on **http://localhost:5000**.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/health` | Health check + model status |
| POST   | `/api/analyze` | Analyze a single commit file |
| POST   | `/api/analyze/batch` | Analyze all files in a commit |
| GET    | `/api/commit/:sha/risk` | Get cached result for SHA |
| POST   | `/api/commit/:sha/risk` | Store/cache result for SHA |

---

## `/api/analyze` — Request Body

```json
{
  "sha":          "abc123def456...",
  "repo":         "owner/repo",
  "description":  "feat: add user auth",
  "patch":        "@@ -1,5 +1,10 @@\n...",
  "file":         "src/auth.py",
  "old_contents": "def login(): pass",
  "new_contents": "def login(user, pw): ..."
}
```

## `/api/analyze` — Response

```json
{
  "sha": "abc123...",
  "repo": "owner/repo",
  "risk_score": 0.72,
  "risk_label": "HIGH RISK",
  "confidence": 0.84,
  "probabilities": {
    "HIGH RISK": 0.84,
    "MEDIUM RISK": 0.12,
    "LOW RISK": 0.04
  },
  "risk_categories": {
    "correctness": 0.65,
    "security": 0.82,
    "maintainability": 0.45,
    "integration": 0.71
  },
  "risk_reasons": [
    "Security-sensitive keywords detected (auth/token/password patterns: 3 hits)",
    "Production code changed with no corresponding test file modifications"
  ],
  "features": { ... },
  "analyzed_at": "2025-03-07T12:00:00Z"
}
```

---

## Model Files

Place the following in `backend/models/`:

- `best_model.pt` — trained HybridCodeRiskModel checkpoint
- `scalar_features.pkl` — fitted RobustScaler for structured features

If model files are absent, the backend runs in **heuristic mode** using
rule-based scoring (still functional, just less accurate than the trained model).

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `5000`  | Server port |
