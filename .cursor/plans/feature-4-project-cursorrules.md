# Feature 4 — Root `.cursorrules` for the repo

## Goal

Give Cursor (and contributors) a short, accurate map of the stack and conventions so edits stay aligned with this project.

## What shipped

- **File**: `.cursorrules` at repository root.
- **Content**: Backend (`backend/app`, uvicorn port 3001), client (`client/`, Vite 5173), SQLite + migrations + CSV export, survey submit contract (including respondent fields), TypeScript/env conventions, and guidance to keep diffs focused.

## Files

| Path | Role |
|------|------|
| `.cursorrules` | Persistent AI / contributor hints |

## How to verify

- Open `.cursorrules` in the editor; Cursor loads it for context in this workspace.

## Note

Cursor also supports `.cursor/rules/*.mdc` for scoped rules; this project uses the single root file by explicit request. Split into `.mdc` rules later if you want file-type scoping.
