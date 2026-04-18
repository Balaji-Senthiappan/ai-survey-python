"""Paths: repo root and data directory (DATA_DIR override)."""

from __future__ import annotations

import os
from pathlib import Path

# backend/app/settings.py -> backend/app -> backend -> repo root
_BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = _BACKEND_DIR.parent

_data = os.environ.get("DATA_DIR")
if _data:
    DATA_DIR = Path(_data).resolve()
else:
    DATA_DIR = PROJECT_ROOT / "data"

DB_FILE = DATA_DIR / "app.db"
SEED_QUESTIONS_CSV = DATA_DIR / "seed_questions.csv"
RESPONSES_CSV = DATA_DIR / "responses.csv"
