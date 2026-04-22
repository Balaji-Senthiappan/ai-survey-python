"""API tests: isolated DB via DATA_DIR (must be set before importing app)."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
import uuid
from pathlib import Path

# Package imports in main (app.*) require the backend/ directory on sys.path.
_backend_dir = Path(__file__).resolve().parent.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

_tmp = tempfile.mkdtemp()
os.environ["DATA_DIR"] = _tmp

from fastapi.testclient import TestClient

from app.main import app
from app.database import get_db


def _reset_and_seed_one_question() -> str:
    """One question in dimension D1; two submissions (A=0, C=6) for that question."""
    db = get_db()
    db.execute("DELETE FROM response_answers")
    db.execute("DELETE FROM response_batches")
    db.execute("DELETE FROM questions")
    qid = "t-q1"
    db.execute(
        """
    INSERT INTO questions (
      id, dimension, question_text,
      choice_a, choice_b, choice_c, choice_d,
      score_a, score_b, score_c, score_d,
      sort_order, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    """,
        (
            qid,
            "D1",
            "Test question?",
            "Label A",
            "Label B",
            "Label C",
            "Label D",
            0,
            3,
            6,
            9,
            1,
        ),
    )
    ts = "2025-01-01T00:00:00.000Z"
    for letter, sc in (("A", 0), ("C", 6)):
        rid = str(uuid.uuid4())
        db.execute(
            """
            INSERT INTO response_batches (id, submitted_at, respondent_name, account_name)
            VALUES (?, ?, ?, ?)
            """,
            (rid, ts, "R", "Acct"),
        )
        db.execute(
            """
            INSERT INTO response_answers (response_id, submitted_at, question_id, choice_letter, score)
            VALUES (?, ?, ?, ?, ?)
            """,
            (rid, ts, qid, letter, sc),
        )
    db.commit()
    return qid


class TestResultsSummary(unittest.TestCase):
    def test_results_summary_spectrum_shape(self) -> None:
        _reset_and_seed_one_question()
        client = TestClient(app)
        r = client.get("/api/results/summary")
        self.assertEqual(r.status_code, 200)
        j = r.json()

        self.assertEqual(j["submission_count"], 2)
        self.assertEqual(len(j["submissions"]), 2)
        self.assertEqual(len(j["question_summary"]), 1)
        q = j["question_summary"][0]
        self.assertEqual(q["question_id"], "t-q1")
        self.assertEqual(q["n"], 2)
        self.assertEqual(q["average_score"], 3.0)
        self.assertEqual(q["choice_a"], "Label A")
        self.assertEqual(q["choice_d"], "Label D")
        self.assertEqual(q["choice_counts"], {"A": 1, "B": 0, "C": 1, "D": 0})
        self.assertEqual(
            q["score_distribution"],
            [{"score": 0, "count": 1}, {"score": 6, "count": 1}],
        )

        d = j["dimension_summary"]
        self.assertEqual(len(d), 1)
        row = d[0]
        self.assertEqual(row["dimension"], "D1")
        self.assertEqual(row["answer_count"], 2)
        self.assertEqual(row["average_score"], 3.0)
        self.assertEqual(row["respondent_n"], 2)
        self.assertEqual(row["respondent_mean_min"], 0.0)
        self.assertEqual(row["respondent_mean_max"], 6.0)
        self.assertEqual(row["respondent_mean_median"], 3.0)
        self.assertEqual(row["respondent_means"], [0.0, 6.0])

    def test_respondent_mean_aggregates_multiple_answers(self) -> None:
        """One respondent, two questions in D1: per-respondent mean is (0+3)/2 = 1.5."""
        db = get_db()
        db.execute("DELETE FROM response_answers")
        db.execute("DELETE FROM response_batches")
        db.execute("DELETE FROM questions")
        for i, (qid, sa) in enumerate((("q-a", 0), ("q-b", 3))):
            db.execute(
                """
    INSERT INTO questions (
      id, dimension, question_text, choice_a, choice_b, choice_c, choice_d,
      score_a, score_b, score_c, score_d, sort_order, is_active
    ) VALUES (?, ?, 'x', 'a', 'b', 'c', 'd', ?, 0, 0, 0, ?, 1)
    """,
                (qid, "D1", sa, i + 1),
            )
        rid = str(uuid.uuid4())
        ts = "2025-01-01T00:00:00.000Z"
        db.execute(
            "INSERT INTO response_batches (id, submitted_at, respondent_name, account_name) VALUES (?, ?, ?, ?)",
            (rid, ts, "Solo", "A"),
        )
        db.execute(
            """
    INSERT INTO response_answers (response_id, submitted_at, question_id, choice_letter, score)
    VALUES (?, ?, 'q-a', 'A', 0)
    """,
            (rid, ts),
        )
        db.execute(
            """
    INSERT INTO response_answers (response_id, submitted_at, question_id, choice_letter, score)
    VALUES (?, ?, 'q-b', 'A', 3)
    """,
            (rid, ts),
        )
        db.commit()

        client = TestClient(app)
        j = client.get("/api/results/summary").json()
        d = next(x for x in j["dimension_summary"] if x["dimension"] == "D1")
        self.assertEqual(d["respondent_n"], 1)
        self.assertEqual(d["respondent_means"], [1.5])
        self.assertEqual(d["respondent_mean_median"], 1.5)
        self.assertEqual(d["answer_count"], 2)
        self.assertEqual(d["average_score"], 1.5)


if __name__ == "__main__":
    unittest.main()
