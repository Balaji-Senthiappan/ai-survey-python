# Feature 1 — Survey chrome, global styles, and Figma link

## Goal

Improve baseline UX outside the full assessment shell, fix broken radio layout, and add an optional Figma design reference link.

## What shipped

- **Radio / input layout**: Global `input { width: 100% }` was scoped to text-like inputs only; `input[type="radio"]` / `checkbox` use `width: auto` so labels sit beside radios correctly (`client/src/styles.css`).
- **App shell (non-survey routes)**: Sticky header, pill `NavLink` states, optional **Figma reference** link when `VITE_FIGMA_REFERENCE_URL` is set (`client/src/App.tsx`).
- **Design tokens**: Shared CSS variables for surfaces, borders, typography stack (`--font-sans`), buttons, tables (`client/src/styles.css`).
- **Env typing**: `VITE_FIGMA_REFERENCE_URL` on `ImportMetaEnv` (`client/src/vite-env.d.ts`).

## Files

| Area | Path |
|------|------|
| Styles | `client/src/styles.css` |
| Routing / nav | `client/src/App.tsx` |
| Env | `client/src/vite-env.d.ts` |

## How to verify

- Open `/admin` or `/results`: header shows pill nav + Figma link only if env is set.
- Any legacy single-column survey markup using `.choice-row` still benefits from radio width fix if reused.

## Follow-ups (optional)

- Migrate remaining pages to assessment tokens if you want one visual system everywhere.
