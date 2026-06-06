# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

```bash
npm install        # first time only
npm run dev        # dev server at http://localhost:8080/pfs-tool-react/ with HMR
npm run build      # production build → dist/
```

Before the app will work, `public/config.js` must have a valid `CLIENT_ID` (see `docs/SETUP.md` for the one-time Google Cloud setup).

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds with Vite and deploys `dist/` to GitHub Pages. In the repo settings, Pages source must be set to **GitHub Actions**.

## Architecture

<!-- TODO: update for React migration — see MIGRATION_PLAN.md (in the /plan directory at the repo root) -->

This repo is the **React 19 + TypeScript** rewrite of the vanilla JS `pfs-tool`. The migration is in progress; the full plan is at `../plan/MIGRATION_PLAN.md`.

- Entry point: `src/main.tsx`
- Styling: Tailwind 4 (via `@tailwindcss/vite`)
- Server state: TanStack Query v5
- Client/UI state: Zustand
- Routing: react-router-dom v7, `basename='/pfs-tool-react/'`
- i18n: react-i18next (`en`/`fr`)
- `public/config.js` — user-editable runtime config (`CLIENT_ID`, `LANGUAGE`, `CURRENCY`, `SHEET_TITLE`)
- `seed/default-accounts.json` — seed data for new sheets

### Google Sheet data model

Three tabs — full schema in `docs/schema.md`:

- **`accounts`** — one row per account; `id` is a stable key, never changes
- **`snapshots`** — long format: one row per `(date, account_id)` balance; a special row with `account_id = "__day__"` holds a day-level comment
- **`config`** — key-value settings (`language`, `currency`, `schema_version`, `last_imported_at`)

Derived totals (per-category sums, net worth, MoM/YoY deltas) are computed in JS, never stored in the sheet. `accounts.kind` (`asset` / `debt`) drives net-worth arithmetic; `ownership_share` scales raw balances for joint accounts (`?? 1`; `0` means exclude).

### LocalStorage keys

| Key | Purpose |
|---|---|
| `pfs_sheet_id` | Cached Google Sheet ID |
| `pfs_import_mappings` | Remembered CSV column → account_id mappings |
| `pfs_lang` | UI language override |
| `pfs_theme` | UI theme preference |
