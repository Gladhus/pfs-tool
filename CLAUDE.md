# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

OAuth requires the app to be served over `http://localhost` — it will not work from `file://`.

```bash
python3 -m http.server 8080
# or: npx http-server -p 8080
```

Then open `http://localhost:8080`. There is no build step, no bundler, no package manager, and no test suite.

Before the app will work, `config.js` must have a valid `CLIENT_ID` (see `docs/SETUP.md` for the one-time Google Cloud setup).

## Architecture

The app is a **static SPA** with no framework and no build tooling — just three files the browser loads directly:

- `index.html` — full app shell; all tabs and sections exist in the DOM at load time, shown/hidden by JS
- `app.js` — **all runtime logic** in one IIFE; handles OAuth, Google Sheets/Drive API calls, and every UI interaction
- `style.css` — all styles
- `config.js` — user-editable runtime config (`CLIENT_ID`, `LANGUAGE`, `CURRENCY`, `SHEET_TITLE`)
- `seed/default-accounts.json` — seed data (accounts, categories, account types) written to a new Google Sheet on first run

### Key objects in `app.js`

- **`els`** — map of every DOM element looked up once at startup
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

Chart rendering uses **Chart.js** loaded from CDN.
