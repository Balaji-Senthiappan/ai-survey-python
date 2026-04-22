# Feature 3 — Respondent name, account name, and persistence

## Goal

Collect **Name of respondent** and **Account name** in the sidebar, require them for submit, persist with each response, and surface them in exports and results.

## What shipped

### Frontend (`client/src/pages/SurveyPage.tsx`)

- Two controlled text inputs under **RESPONDENT** (underline style via `assessment-field*` in `client/src/styles.css`).
- **sessionStorage** keys `assessment.respondentName` and `assessment.accountName` so values survive refresh.
- Optional prefills: `VITE_DEFAULT_RESPONDENT_NAME`, `VITE_DEFAULT_ACCOUNT_NAME` (only when storage empty).
- **Submit** sends JSON: `answers`, `respondent_name`, `account_name` (trimmed). Submit disabled until every question is answered **and** both fields non-empty (max 200 chars, aligned with API).
- Thank-you state shows submitted respondent + account.

### Backend (`backend/app/main.py`)

- `SubmitBody` extended with `respondent_name`, `account_name`.
- Validation: both required after strip; max length 200.
- `INSERT INTO response_batches` includes the two columns.

### Database (`backend/app/database.py`)

- `_migrate_response_batch_metadata`: `ALTER TABLE` adds `respondent_name` and `account_name` if missing (defaults for existing rows).

### CSV (`backend/app/csv_export.py`)

- New header: `response_id,submitted_at,respondent_name,account_name,question_id,choice_letter,score`.
- One-time migration from legacy 5-column header; old rows get empty respondent/account columns.

### Results API + UI

- `GET /api/results/summary`: each submission includes `respondent_name`, `account_name`.
- `client/src/pages/ResultsPage.tsx`: **Recent submissions** table adds Respondent and Account columns.

## Files

| Path | Role |
|------|------|
| `client/src/pages/SurveyPage.tsx` | Inputs, storage, submit body, thank-you |
| `client/src/styles.css` | `.assessment-field*` |
| `client/src/vite-env.d.ts` | Default env typings |
| `backend/app/main.py` | Validation, insert, summary query |
| `backend/app/database.py` | Migration |
| `backend/app/csv_export.py` | Header + migrate + append |

## How to verify

1. Fill name + account, complete all questions, submit → 201 and thank-you shows values.
2. API rejects missing names: omit fields → `400` with `respondent_name and account_name are required`.
3. `/results`: new columns populated for new submissions; legacy batches show empty strings unless backfilled manually.

## Follow-ups (optional)

- Admin export or anonymization policy if PII must be restricted.
- Server-side rate limiting or auth if the survey is public.
