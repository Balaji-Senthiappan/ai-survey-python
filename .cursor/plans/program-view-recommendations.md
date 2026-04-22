---
name: Program view and recommendations
overview: "Restructure Results for a program (dimension-first) view with expandable question details, and a Top-3 improvement section whose items are ranked by dimension scores and expanded with industry-style, actionable next steps (not single-line blurbs)."
todos:
  - id: recommendations-playbook
    content: "Add recommendation playbook module (e.g. resultsRecommendations.ts): rank top 3 weakest dimensions, map each to 3–4 verb-led action steps using keyword buckets + default playbook; align wording with common practice themes (governance, skills, process, measurement, safe pilots)."
    status: pending
  - id: recommendations-ui
    content: "Build Top recommendations UI — card or list with headline (dimension + score), short rationale, numbered actionable steps; empty/edge states."
    status: pending
  - id: results-layout
    content: "Restructure ResultsPage: program intro, Top 3 block, dimension table with per-row expand for questions; hide or demote full question table."
    status: pending
  - id: plotly-placement
    content: "Move or gate ResultsPlotSection; optionally add dimension-only bar chart at program level."
    status: pending
  - id: styles-a11y
    content: "CSS for recommendation cards and dimension expand; keyboard-friendly disclosure."
    status: pending
isProject: true
---

# Program-level view, recommendations (best-practice + actionable)

## Goals (unchanged structurally)

- **Default view:** program / survey level — **dimensions only**; no question table until the user expands.
- **Per-dimension expand:** that dimension’s questions (existing choice mix, avg, n).
- **Recommendations:** **Top 3** at program level for **"What do we need to improve?"** — not only a ranked list, but **actionable steps** consistent with **common industry practice** (no dependency on a paid framework license; language can echo widely used themes: **clear ownership**, **baseline and metrics**, **governance and human oversight**, **skills and change**, **pilot then scale**, **security and data handling** as appropriate).

## Ranking (what to improve first)

- Client-only from existing [`GET /api/results/summary`](backend/app/main.py) `dimension_summary`.
- Sort by **`average_score` ascending** (lowest = highest priority to improve); stable tie-break by `dimension` name.
- Take up to **3** dimensions. Fewer if fewer dimensions exist. Muted copy if nothing to show.

## Recommendations content model (industry-style, actionable)

Each of the top 3 dimensions becomes one **recommendation block** with:

1. **Headline** — e.g. prioritize *{Dimension label}* (include **program average** score for context).
2. **Why this appears** — one line: e.g. relative position among dimensions or “lowest current maturity signal in this survey” (data-backed, not hype).
3. **Actionable steps (3–4 items)** — **numbered or bulleted**, each:
   - **Verb-first** (Define / Establish / Run / Measure / Review / …).
   - **Time horizon** where it helps: e.g. “next 2–4 weeks”, “next quarter” (industry program management habit).
   - Tied to the **dimension’s theme** when the dimension string matches known **keyword buckets** (case-insensitive substring on `dimension` and optionally `question` themes from seed data). Examples of buckets (adjust to your seed dimensions):
   - **People / fluency / skills** — e.g. role-based training, community of practice, job aids, proficiency checkpoints.
   - **Infrastructure / tooling** — e.g. approved stack, access provisioning, cost/usage visibility, environment standards.
   - **SDLC / use cases** — e.g. pilot workflows in 1–2 phases, clear acceptance criteria, code review with AI in scope.
   - **Governance / policy / risk** — e.g. acceptable-use policy, human-in-the-loop for sensitive work, review cadence.
4. **Fallback** — if no keyword matches, use a **default playbook** (still actionable): e.g. assign an owner, baseline current practice, run a time-boxed pilot, define 2 leading metrics, review in 30–60 days.

Implementation: small module (e.g. [`client/src/resultsRecommendations.ts`](client/src/resultsRecommendations.ts) or colocated) exporting `buildTopRecommendations(dimensionSummary, { max: 3 })` returning structured items `{ dimension, averageScore, rank, rationaleLine, steps: string[] }`. Keep copy in one place for later i18n or admin tuning.

**Explicitly not in v1:** LLM generation, or claiming certification against a specific proprietary maturity model. Wording should stay **practical and auditable** (what the program would actually do next).

## UI

- **Section: “Top recommendations”** (or “Where to focus next”) — three blocks (or fewer), each with headline, rationale, **action list**.
- **Program view — by dimension** — same table as planned; **expand** for questions.
- **Plotly** — gated or moved per prior plan; optional **dimension bar chart** at program level.
- **Recent submissions** — bottom.

## Files (additions)

- New: [`client/src/resultsRecommendations.ts`](client/src/resultsRecommendations.ts) (or similar) — ranking + playbook steps.
- [`client/src/pages/ResultsPage.tsx`](client/src/pages/ResultsPage.tsx) — wire playbook, layout, expand.
- [`client/src/styles.css`](client/src/styles.css) — recommendation cards, expand.
- [`client/src/pages/ResultsPlotSection.tsx`](client/src/pages/ResultsPlotSection.tsx) — placement / dimension chart only as needed.

## Accessibility

- Expand: `<details>`/`<summary>` or buttons with visible labels; list semantics for steps (`<ol>` for ordered actions).

## Out of scope

- Backend-stored recommendations, LLM, or purchasable framework PDFs. Optional later: move playbook strings to JSON or CMS.
