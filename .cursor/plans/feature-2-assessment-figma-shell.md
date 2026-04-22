# Feature 2 — AI Adoption assessment shell (Figma-aligned)

## Goal

Match the provided Figma reference: two-column layout, serif + sans typography, tan accent, dimension sidebar, one question per step, and lightweight help.

## What shipped

- **Survey route layout** (`/`): Minimal fixed toolbar (Admin · Results · optional Figma); main uses `main-assessment` full-width canvas (`client/src/App.tsx` + `client/src/styles.css`).
- **Assessment UI** (`client/src/pages/SurveyPage.tsx`):
  - Header: configurable title, year, subtitle (`VITE_ASSESSMENT_*` with sensible defaults).
  - **Sidebar**: RESPONDENT block (see Feature 3 for fields), survey progress bar + counts, **Dimensions** list with numbered steps, active dimension highlight, jump-to-section buttons.
  - **Main card**: Step `01 / NN` (tan), uppercase dimension **pill**, question as **serif** with `Qn.` prefix, **2×2 grid** of answer cards (letter badge + copy; headline split on `"Title: body"` when safe).
  - **Navigation**: Previous / Next; **Submit assessment** when all questions answered (and Feature 3 metadata valid).
  - **Help**: Floating `?` opens native `<dialog>` with short instructions.
- **Typography**: Google Fonts link for **DM Serif Display** + **Inter** (`client/index.html`); page title updated to assessment naming.
- **Styles**: Large `assessment-*` block — tan palette (~`#D9B99B`), grays, cards, pills, sidebar states, buttons (`.btn-primary` / `.btn-secondary` / `.btn-ghost`), dialog, help FAB (`client/src/styles.css`).

## Env (optional)

| Variable | Purpose |
|----------|---------|
| `VITE_ASSESSMENT_TITLE` | Main title |
| `VITE_ASSESSMENT_SUBTITLE` | Subtitle paragraph |
| `VITE_ASSESSMENT_YEAR` | Year next to title |
| `VITE_FIGMA_REFERENCE_URL` | Link in survey toolbar |
| `VITE_DEFAULT_RESPONDENT_NAME` / `VITE_DEFAULT_ACCOUNT_NAME` | Prefill (Feature 3) |

Declared in `client/src/vite-env.d.ts`.

## Files

| Path | Role |
|------|------|
| `client/src/pages/SurveyPage.tsx` | Wizard flow, dimension grouping, UI structure |
| `client/src/App.tsx` | Survey vs full header; `main-assessment` |
| `client/src/styles.css` | `assessment-*`, toolbar, `sr-only` |
| `client/index.html` | Fonts, document title |

## How to verify

- `npm run dev` → `/`: see sidebar + single question + step counter; change dimension in sidebar → jumps to first question in that dimension.
- Resize: sidebar stacks above main on narrow viewports; grid collapses to one column for choices.

## Follow-ups (optional)

- Deeper pixel parity with Figma (exact spacing, alternate serif).
- Auto-advance after selecting an option (product decision).
