"""Append response rows to data/responses.csv (same as server/src/responsesCsv.ts)."""

from __future__ import annotations

import csv
from pathlib import Path

from settings import DATA_DIR, RESPONSES_CSV

OLD_HEADER = "response_id,submitted_at,question_id,choice_letter,score"
NEW_HEADER = "response_id,submitted_at,respondent_name,account_name,question_id,choice_letter,score"


def _escape_csv(s: str) -> str:
    if any(c in s for c in '",\n\r'):
        return '"' + s.replace('"', '""') + '"'
    return s


def _migrate_csv_if_needed(path: Path) -> None:
    """Upgrade legacy 5-column CSV to 7-column format (empty respondent fields for old rows)."""
    raw = path.read_text(encoding="utf-8")
    lines = raw.splitlines()
    if not lines:
        return
    first = lines[0].strip()
    if first != OLD_HEADER:
        return
    reader = csv.reader(lines)
    rows = list(reader)
    if not rows:
        return
    out_lines = [NEW_HEADER]
    for parts in rows[1:]:
        if len(parts) == 5:
            rid, sat, qid, cl, sc = parts
            out_lines.append(
                ",".join(
                    [
                        _escape_csv(rid),
                        _escape_csv(sat),
                        _escape_csv(""),
                        _escape_csv(""),
                        _escape_csv(qid),
                        _escape_csv(cl),
                        str(int(sc)),
                    ]
                )
            )
    path.write_text("\n".join(out_lines) + "\n", encoding="utf-8")


def _ensure_file_with_header() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not RESPONSES_CSV.is_file():
        RESPONSES_CSV.write_text(NEW_HEADER + "\n", encoding="utf-8")
        return
    _migrate_csv_if_needed(RESPONSES_CSV)
    head = RESPONSES_CSV.read_text(encoding="utf-8").splitlines()[0].strip() if RESPONSES_CSV.stat().st_size else ""
    if head != NEW_HEADER:
        raise RuntimeError(
            f"responses.csv header is unexpected; expected first line == {NEW_HEADER!r}; path: {RESPONSES_CSV}"
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
                _escape_csv(str(r["respondent_name"])),
                _escape_csv(str(r["account_name"])),
                _escape_csv(str(r["question_id"])),
                _escape_csv(str(r["choice_letter"])),
                str(int(r["score"])),
            ]
        )
        lines.append(line)
    with RESPONSES_CSV.open("a", encoding="utf-8", newline="") as f:
        f.write("\n".join(lines) + "\n")
