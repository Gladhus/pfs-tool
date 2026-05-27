# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

```bash
npm install        # first time only
npm run dev        # dev server at http://localhost:5173/pfs-tool/ with HMR
npm run build      # production build → dist/
```

Before the app will work, `public/config.js` must have a valid `CLIENT_ID` (see `docs/SETUP.md` for the one-time Google Cloud setup).

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds with Vite and deploys `dist/` to GitHub Pages. In the repo settings, Pages source must be set to **GitHub Actions**.

## Architecture

The app is a **Vite-built SPA** with no framework. Entry point is `src/main.js`; all modules are under `src/`. The legacy `app.js` at the root is the old single-file version kept for reference only — it is not loaded.

- `index.html` — app shell; all tabs exist in the DOM at load time, shown/hidden by JS
- `src/main.js` — event wiring and startup polling for Google APIs
- `src/auth.js` — OAuth flow, session restore, sheet bootstrap, tab routing
- `src/sheets.js` — all Google Sheets/Drive API calls; imports seed JSON at build time
- `src/overview.js` — Overview tab rendering + chart
- `src/history.js` — History table + chart + account select dropdown
- `src/entry.js` — Entry form, recompute totals, save snapshot
- `src/accounts.js` — Accounts table, import flow, migrate ID dialog
- `src/state.js` — shared `state` object, LS keys, HEADERS
- `src/i18n.js` — I18N dictionaries, `t()`, `tr()`, `applyI18n()`, `setLang()`
- `src/format.js` — `fmtMoney()`, `fmtDelta()`, `fmtPct()`, `parseMoney()`
- `src/utils.js` — month/CSV parsing, similarity, account helpers
- `src/dom.js` — `els` object (all DOM refs), `setStatus()`
- `style.css` — all styles
- `public/config.js` — user-editable runtime config (`CLIENT_ID`, `LANGUAGE`, `CURRENCY`, `SHEET_TITLE`)
- `seed/default-accounts.json` — seed data bundled at build time (imported by `sheets.js`)

### Key objects in `src/state.js`

- **`els`** (in `dom.js`) — map of every DOM element looked up once at startup
- **`state`** — all mutable runtime state: token, sheet ID, loaded accounts/snapshots, chart instances, etc.
- **`HEADERS`** — canonical column order for each sheet tab (`accounts`, `snapshots`, `config`); controls read/write layout

### Auth flow

Two Google libraries are loaded from CDN: **gapi** (Sheets/Drive API client) and **GIS** (Google Identity Services token client). Both must signal ready before sign-in is enabled. `maybeEnableSignIn()` gates on `state.gapiReady && state.gisReady`.

On load the app tries to restore an existing session silently (cached token in `localStorage` → silent GIS refresh → prompt the user).

### LocalStorage keys

| Key | Purpose |
|---|---|
| `pfs_sheet_id` | Cached Google Sheet ID |
| `pfs_token` | Cached OAuth token `{access_token, expires_at}` |
| `pfs_import_mappings` | Remembered CSV column → account_id mappings |
| `pfs_active_tab` | Last active tab |

### Google Sheet data model

Three tabs — full schema in `docs/schema.md`:

- **`accounts`** — one row per account; `id` is a stable key, never changes
- **`snapshots`** — long format: one row per `(month, account_id)` balance; a special row with `account_id = "__month__"` holds the month-level comment
- **`config`** — key-value settings (`language`, `currency`, `schema_version`, `last_imported_at`)

Derived totals (per-category sums, net worth, MoM/YoY deltas) are computed in JS, never stored in the sheet. `accounts.kind` (`asset` / `debt`) drives the sign in net-worth arithmetic; `ownership_share` scales the raw balance for joint accounts.

### UI tabs

Four tabs rendered by `app.js`: **Overview** (hero net-worth + chart), **History** (snapshot table), **Entry** (monthly data entry form), **Settings** (accounts management + CSV import).

Chart rendering uses **Chart.js** (npm package, bundled by Vite).
