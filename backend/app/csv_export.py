"""Append response rows to data/responses.csv (same as server/src/responsesCsv.ts)."""

from __future__ import annotations

from settings import DATA_DIR, RESPONSES_CSV

HEADER = "response_id,submitted_at,question_id,choice_letter,score"


def _escape_csv(s: str) -> str:
    if any(c in s for c in '",\n\r'):
        return '"' + s.replace('"', '""') + '"'
    return s


def _ensure_file_with_header() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not RESPONSES_CSV.is_file():
        RESPONSES_CSV.write_text(HEADER + "\n", encoding="utf-8")
    else:
        head = RESPONSES_CSV.read_text(encoding="utf-8")[:80]
        if not head.startswith("response_id,"):
            raise RuntimeError(
                f"responses.csv exists but header is unexpected; path: {RESPONSES_CSV}"
            )


def append_response_rows(
    rows: list[dict[str, str | int]],
) -> None:
    _ensure_file_with_header()
    lines: list[str] = []
    for r in rows:
        line = ",".join(
            [
                _escape_csv(str(r["response_id"])),
                _escape_csv(str(r["submitted_at"])),
                _escape_csv(str(r["question_id"])),
                _escape_csv(str(r["choice_letter"])),
                str(int(r["score"])),
            ]
        )
        lines.append(line)
    with RESPONSES_CSV.open("a", encoding="utf-8", newline="") as f:
        f.write("\n".join(lines) + "\n")
