"""SQLite access: same schema as former Node server (server/src/db.ts)."""

from __future__ import annotations

import csv
import sqlite3
import threading
from contextlib import contextmanager
from typing import Any, Literal, TypedDict

from .settings import DATA_DIR, DB_FILE, SEED_QUESTIONS_CSV

ChoiceLetter = Literal["A", "B", "C", "D"]


class QuestionRow(TypedDict):
    id: str
    dimension: str
    question_text: str
    choice_a: str
    choice_b: str
    choice_c: str
    choice_d: str
    score_a: int
    score_b: int
    score_c: int
    score_d: int
    sort_order: int
    is_active: int


_db_lock = threading.Lock()
_conn: sqlite3.Connection | None = None

DEFAULT_SCORES = (0, 3, 6, 9)


def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def get_db() -> sqlite3.Connection:
    """Return singleton connection. Fast path avoids lock after init (safe with transaction lock)."""
    global _conn
    if _conn is not None:
        return _conn
    with _db_lock:
        if _conn is not None:
            return _conn
        _ensure_data_dir()
        _conn = sqlite3.connect(str(DB_FILE), check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.execute("PRAGMA journal_mode=WAL")
        _migrate(_conn)
        _seed_if_empty(_conn)
        return _conn


def _migrate(db: sqlite3.Connection) -> None:
    db.executescript(
        """
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      dimension TEXT NOT NULL,
      question_text TEXT NOT NULL,
      choice_a TEXT NOT NULL,
      choice_b TEXT NOT NULL,
      choice_c TEXT NOT NULL,
      choice_d TEXT NOT NULL,
      score_a INTEGER NOT NULL,
      score_b INTEGER NOT NULL,
      score_c INTEGER NOT NULL,
      score_d INTEGER NOT NULL,
      sort_order INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS response_batches (
      id TEXT PRIMARY KEY,
      submitted_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS response_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      response_id TEXT NOT NULL,
      submitted_at TEXT NOT NULL,
      question_id TEXT NOT NULL,
      choice_letter TEXT NOT NULL,
      score INTEGER NOT NULL,
      FOREIGN KEY (response_id) REFERENCES response_batches(id)
    );

    CREATE INDEX IF NOT EXISTS idx_answers_response ON response_answers(response_id);
    CREATE INDEX IF NOT EXISTS idx_answers_question ON response_answers(question_id);
    """
    )
    db.commit()
    _migrate_response_batch_metadata(db)


def _migrate_response_batch_metadata(db: sqlite3.Connection) -> None:
    cur = db.execute("PRAGMA table_info(response_batches)")
    cols = {str(row[1]) for row in cur.fetchall()}
    if "respondent_name" not in cols:
        db.execute(
            "ALTER TABLE response_batches ADD COLUMN respondent_name TEXT NOT NULL DEFAULT ''"
        )
    if "account_name" not in cols:
        db.execute("ALTER TABLE response_batches ADD COLUMN account_name TEXT NOT NULL DEFAULT ''")
    db.commit()


def _seed_if_empty(db: sqlite3.Connection) -> None:
    cur = db.execute("SELECT COUNT(*) AS c FROM questions")
    row = cur.fetchone()
    if row and row[0] > 0:
        return
    if not SEED_QUESTIONS_CSV.is_file():
        return

    raw = SEED_QUESTIONS_CSV.read_text(encoding="utf-8")
    reader = csv.DictReader(raw.splitlines())
    rows = list(reader)
    insert_sql = """
    INSERT INTO questions (
      id, dimension, question_text,
      choice_a, choice_b, choice_c, choice_d,
      score_a, score_b, score_c, score_d,
      sort_order, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    """
    for i, r in enumerate(rows):
        qid = f"sdlc-{i + 1:03d}"
        db.execute(
            insert_sql,
            (
                qid,
                r.get("Dimension") or "",
                r.get("Question") or "",
                r.get("Choice_A") or "",
                r.get("Choice_B") or "",
                r.get("Choice_C") or "",
                r.get("Choice_D") or "",
                DEFAULT_SCORES[0],
                DEFAULT_SCORES[1],
                DEFAULT_SCORES[2],
                DEFAULT_SCORES[3],
                i + 1,
            ),
        )
    db.commit()


def _row_to_question(row: sqlite3.Row) -> QuestionRow:
    return QuestionRow(
        id=row["id"],
        dimension=row["dimension"],
        question_text=row["question_text"],
        choice_a=row["choice_a"],
        choice_b=row["choice_b"],
        choice_c=row["choice_c"],
        choice_d=row["choice_d"],
        score_a=int(row["score_a"]),
        score_b=int(row["score_b"]),
        score_c=int(row["score_c"]),
        score_d=int(row["score_d"]),
        sort_order=int(row["sort_order"]),
        is_active=int(row["is_active"]),
    )


def list_active_questions() -> list[QuestionRow]:
    db = get_db()
    cur = db.execute(
        "SELECT * FROM questions WHERE is_active = 1 ORDER BY sort_order ASC, id ASC"
    )
    return [_row_to_question(r) for r in cur.fetchall()]


def list_all_questions_admin() -> list[QuestionRow]:
    db = get_db()
    cur = db.execute("SELECT * FROM questions ORDER BY sort_order ASC, id ASC")
    return [_row_to_question(r) for r in cur.fetchall()]


def get_question_by_id(qid: str) -> QuestionRow | None:
    db = get_db()
    cur = db.execute("SELECT * FROM questions WHERE id = ?", (qid,))
    row = cur.fetchone()
    return _row_to_question(row) if row else None


def get_score_for_choice(q: QuestionRow, letter: ChoiceLetter) -> int:
    if letter == "A":
        return q["score_a"]
    if letter == "B":
        return q["score_b"]
    if letter == "C":
        return q["score_c"]
    return q["score_d"]


@contextmanager
def transaction():
    """Serialized write transaction (SQLite + FastAPI threads)."""
    db = get_db()
    with _db_lock:
        db.execute("BEGIN")
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise


def dict_to_question_row(d: dict[str, Any]) -> QuestionRow:
    return QuestionRow(
        id=str(d["id"]),
        dimension=str(d["dimension"]),
        question_text=str(d["question_text"]),
        choice_a=str(d["choice_a"]),
        choice_b=str(d["choice_b"]),
        choice_c=str(d["choice_c"]),
        choice_d=str(d["choice_d"]),
        score_a=int(d["score_a"]),
        score_b=int(d["score_b"]),
        score_c=int(d["score_c"]),
        score_d=int(d["score_d"]),
        sort_order=int(d["sort_order"]),
        is_active=int(d["is_active"]),
    )
