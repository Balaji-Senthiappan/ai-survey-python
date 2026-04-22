"""FastAPI app — mirrors former Express API (server/src/index.ts)."""

from __future__ import annotations

import uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone
from statistics import median
from typing import Any, cast

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from csv_export import append_response_rows
from database import (
    ChoiceLetter,
    QuestionRow,
    get_db,
    get_question_by_id,
    get_score_for_choice,
    list_active_questions,
    list_all_questions_admin,
    transaction,
)

app = FastAPI(title="Survey API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _is_choice_letter(x: Any) -> bool:
    return x in ("A", "B", "C", "D")

@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/survey/questions")
def survey_questions():
    get_db()
    rows = list_active_questions()
    return {
        "questions": [
            {
                "id": q["id"],
                "dimension": q["dimension"],
                "question_text": q["question_text"],
                "choices": [
                    {"letter": "A", "text": q["choice_a"]},
                    {"letter": "B", "text": q["choice_b"]},
                    {"letter": "C", "text": q["choice_c"]},
                    {"letter": "D", "text": q["choice_d"]},
                ],
            }
            for q in rows
        ]
    }


class SubmitBody(BaseModel):
    answers: dict[str, str] | None = None
    respondent_name: str | None = None
    account_name: str | None = None


@app.post("/api/survey/responses", status_code=201)
def submit_responses(body: SubmitBody):
    if body.answers is None or not isinstance(body.answers, dict):
        raise HTTPException(status_code=400, detail={"error": "Missing answers object"})

    respondent_name = (body.respondent_name or "").strip()
    account_name = (body.account_name or "").strip()
    if not respondent_name or not account_name:
        raise HTTPException(
            status_code=400,
            detail={"error": "respondent_name and account_name are required"},
        )
    if len(respondent_name) > 200 or len(account_name) > 200:
        raise HTTPException(
            status_code=400,
            detail={"error": "respondent_name and account_name must be at most 200 characters"},
        )

    active = list_active_questions()
    active_ids = {q["id"] for q in active}

    for q in active:
        a = body.answers.get(q["id"])
        if not _is_choice_letter(a):
            raise HTTPException(
                status_code=400,
                detail={"error": f"Missing or invalid choice for question {q['id']}"},
            )

    for k in body.answers:
        if k not in active_ids:
            raise HTTPException(status_code=400, detail={"error": f"Unknown question id: {k}"})

    response_id = str(uuid.uuid4())
    # Match JS Date.toISOString() (ms precision, Z suffix)
    submitted_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

    csv_rows: list[dict[str, str | int]] = []

    with transaction() as db:
        db.execute(
            """
            INSERT INTO response_batches (id, submitted_at, respondent_name, account_name)
            VALUES (?, ?, ?, ?)
            """,
            (response_id, submitted_at, respondent_name, account_name),
        )
        for q in active:
            letter: ChoiceLetter = body.answers[q["id"]]  # type: ignore[assignment]
            score = get_score_for_choice(q, letter)
            db.execute(
                """
                INSERT INTO response_answers (response_id, submitted_at, question_id, choice_letter, score)
                VALUES (?, ?, ?, ?, ?)
                """,
                (response_id, submitted_at, q["id"], letter, score),
            )
            csv_rows.append(
                {
                    "response_id": response_id,
                    "submitted_at": submitted_at,
                    "respondent_name": respondent_name,
                    "account_name": account_name,
                    "question_id": q["id"],
                    "choice_letter": letter,
                    "score": score,
                }
            )

    append_response_rows(csv_rows)

    return {"response_id": response_id, "submitted_at": submitted_at}


@app.get("/api/admin/questions")
def admin_questions():
    get_db()
    return {"questions": list_all_questions_admin()}


class AdminCreateBody(BaseModel):
    dimension: str | None = None
    question_text: str | None = None
    choice_a: str | None = None
    choice_b: str | None = None
    choice_c: str | None = None
    choice_d: str | None = None
    score_a: float | None = None
    score_b: float | None = None
    score_c: float | None = None
    score_d: float | None = None


@app.post("/api/admin/questions", status_code=201)
def admin_create(b: AdminCreateBody):
    if not (
        b.dimension
        and b.question_text
        and b.choice_a
        and b.choice_b
        and b.choice_c
        and b.choice_d
    ):
        raise HTTPException(status_code=400, detail={"error": "Missing required fields"})

    new_id = f"q-{uuid.uuid4()}"
    db = get_db()
    row = db.execute("SELECT COALESCE(MAX(sort_order), 0) AS m FROM questions").fetchone()
    sort_order = int(row[0]) + 1
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
            new_id,
            b.dimension,
            b.question_text,
            b.choice_a,
            b.choice_b,
            b.choice_c,
            b.choice_d,
            int(b.score_a if b.score_a is not None else 0),
            int(b.score_b if b.score_b is not None else 3),
            int(b.score_c if b.score_c is not None else 6),
            int(b.score_d if b.score_d is not None else 9),
            sort_order,
        ),
    )
    db.commit()
    return {"id": new_id}


class AdminPatchBody(BaseModel):
    dimension: str | None = None
    question_text: str | None = None
    choice_a: str | None = None
    choice_b: str | None = None
    choice_c: str | None = None
    choice_d: str | None = None
    score_a: float | int | None = None
    score_b: float | int | None = None
    score_c: float | int | None = None
    score_d: float | int | None = None
    sort_order: float | int | None = None
    is_active: float | int | None = None


def _merge_question(existing: QuestionRow, patch: AdminPatchBody) -> QuestionRow:
    o = dict(existing)
    for k in (
        "dimension",
        "question_text",
        "choice_a",
        "choice_b",
        "choice_c",
        "choice_d",
    ):
        v = getattr(patch, k)
        if v is not None:
            o[k] = v
    for k in ("score_a", "score_b", "score_c", "score_d", "sort_order", "is_active"):
        v = getattr(patch, k)
        if v is not None:
            o[k] = int(v)
    return cast(QuestionRow, cast(object, o))


@app.put("/api/admin/questions/{qid}")
def admin_put(qid: str, body: AdminPatchBody):
    existing = get_question_by_id(qid)
    if not existing:
        raise HTTPException(status_code=404, detail={"error": "Not found"})
    merged = _merge_question(existing, body)
    db = get_db()
    db.execute(
        """
    UPDATE questions SET
      dimension = ?, question_text = ?,
      choice_a = ?, choice_b = ?, choice_c = ?, choice_d = ?,
      score_a = ?, score_b = ?, score_c = ?, score_d = ?,
      sort_order = ?, is_active = ?
    WHERE id = ?
    """,
        (
            merged["dimension"],
            merged["question_text"],
            merged["choice_a"],
            merged["choice_b"],
            merged["choice_c"],
            merged["choice_d"],
            merged["score_a"],
            merged["score_b"],
            merged["score_c"],
            merged["score_d"],
            merged["sort_order"],
            merged["is_active"],
            qid,
        ),
    )
    db.commit()
    return {"ok": True}


@app.delete("/api/admin/questions/{qid}")
def admin_delete(qid: str):
    existing = get_question_by_id(qid)
    if not existing:
        raise HTTPException(status_code=404, detail={"error": "Not found"})
    db = get_db()
    db.execute("UPDATE questions SET is_active = 0 WHERE id = ?", (qid,))
    db.commit()
    return {"ok": True}


@app.get("/api/results/summary")
def results_summary():
    db = get_db()
    submissions = [
        {
            "id": r[0],
            "submitted_at": r[1],
            "respondent_name": r[2] or "",
            "account_name": r[3] or "",
        }
        for r in db.execute(
            """
            SELECT id, submitted_at, respondent_name, account_name
            FROM response_batches
            ORDER BY submitted_at DESC
            """
        ).fetchall()
    ]

    answers = db.execute(
        """
    SELECT ra.response_id, ra.question_id, ra.choice_letter, ra.score, q.dimension, q.question_text,
           q.choice_a, q.choice_b, q.choice_c, q.choice_d
    FROM response_answers ra
    JOIN questions q ON q.id = ra.question_id
    ORDER BY ra.submitted_at ASC
    """
    ).fetchall()

    per_dimension: dict[str, dict[str, float | int]] = {}
    per_resp_dim: dict[tuple[str, str], dict[str, float | int]] = {}
    for a in answers:
        dim = str(a[4])
        cur = per_dimension.get(dim) or {"sum": 0, "count": 0}
        cur["sum"] = float(cur["sum"]) + int(a[3])
        cur["count"] = int(cur["count"]) + 1
        per_dimension[dim] = cur

        rid = str(a[0])
        rdk = (rid, dim)
        rcur = per_resp_dim.get(rdk) or {"sum": 0, "count": 0}
        rcur["sum"] = float(rcur["sum"]) + int(a[3])
        rcur["count"] = int(rcur["count"]) + 1
        per_resp_dim[rdk] = rcur

    dim_to_respondent_means: dict[str, list[float]] = defaultdict(list)
    for (rid, dim), agg in per_resp_dim.items():
        c = int(agg["count"])
        if c:
            dim_to_respondent_means[dim].append(float(agg["sum"]) / c)

    def _dim_spread(respondent_means: list[float]) -> dict[str, Any]:
        if not respondent_means:
            return {
                "respondent_mean_min": 0.0,
                "respondent_mean_max": 0.0,
                "respondent_mean_median": 0.0,
                "respondent_n": 0,
                "respondent_means": [],
            }
        srt = sorted(respondent_means)
        return {
            "respondent_mean_min": srt[0],
            "respondent_mean_max": srt[-1],
            "respondent_mean_median": float(median(srt)),
            "respondent_n": len(srt),
            "respondent_means": srt,
        }

    dimension_summary = []
    for d, v in per_dimension.items():
        row: dict[str, Any] = {
            "dimension": d,
            "average_score": (v["sum"] / v["count"]) if v["count"] else 0,
            "answer_count": int(v["count"]),
        }
        row.update(_dim_spread(dim_to_respondent_means[d]))
        dimension_summary.append(row)

    by_question: dict[str, dict[str, Any]] = {}
    for a in answers:
        qid = str(a[1])
        if qid not in by_question:
            by_question[qid] = {
                "question_id": qid,
                "dimension": str(a[4]),
                "question_text": str(a[5]),
                "choice_a": str(a[6]),
                "choice_b": str(a[7]),
                "choice_c": str(a[8]),
                "choice_d": str(a[9]),
                "choice_counts": {"A": 0, "B": 0, "C": 0, "D": 0},
                "scores": [],
            }
        letter = str(a[2])
        if letter in by_question[qid]["choice_counts"]:
            by_question[qid]["choice_counts"][letter] = int(
                by_question[qid]["choice_counts"][letter]
            ) + 1
        by_question[qid]["scores"].append(int(a[3]))

    question_summary = []
    for q in by_question.values():
        scores: list[int] = q["scores"]
        avg = sum(scores) / len(scores) if scores else 0
        score_dist = [{"score": s, "count": c} for s, c in sorted(Counter(scores).items())]
        question_summary.append(
            {
                "question_id": q["question_id"],
                "dimension": q["dimension"],
                "question_text": q["question_text"],
                "choice_a": q["choice_a"],
                "choice_b": q["choice_b"],
                "choice_c": q["choice_c"],
                "choice_d": q["choice_d"],
                "choice_counts": q["choice_counts"],
                "score_distribution": score_dist,
                "average_score": avg,
                "n": len(scores),
            }
        )

    question_summary.sort(key=lambda row: str(row["question_id"]))

    return {
        "submission_count": len(submissions),
        "submissions": submissions[:500],
        "dimension_summary": dimension_summary,
        "question_summary": question_summary,
    }


# FastAPI returns HTTPException detail as JSON; Express used { error: "..." }.
# Add exception handler for consistent shape when detail is dict with "error".
@app.exception_handler(HTTPException)
async def http_error_handler(request: Request, exc: HTTPException):
    from fastapi.responses import JSONResponse

    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    if isinstance(exc.detail, str):
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
