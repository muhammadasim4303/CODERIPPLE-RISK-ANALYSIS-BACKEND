#!/bin/bash
# Start CodeRipple Flask backend

cd "$(dirname "$0")/backend"

# Activate venv if it exists
if [ -d "venv" ]; then
  source venv/bin/activate
fi

# Check model files
if [ ! -f "models/best_model.pt" ]; then
  echo "WARNING: models/best_model.pt not found — running in heuristic mode"
fi
if [ ! -f "models/scalar_features.pkl" ]; then
  echo "WARNING: models/scalar_features.pkl not found — running in heuristic mode"
fi

python app.py
