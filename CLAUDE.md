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
- `src/main.js` — CSS imports (air-datepicker first, then style.css), event wiring and startup polling for Google APIs
- `style.css` — all styles (imported by `src/main.js`)
- `public/config.js` — user-editable runtime config (`CLIENT_ID`, `LANGUAGE`, `CURRENCY`, `SHEET_TITLE`)
- `seed/default-accounts.json` — seed data bundled at build time (imported by api files)

### Core modules (`src/core/`)

- `src/core/state.js` — shared `state` object, LS keys, `HEADERS`, `OWNERS`, `KINDS`, `SHEET_TITLE`, `TOKEN_SKEW_MS`
- `src/core/dom.js` — `els` object (all DOM refs), `setStatus()`, `showConfirm()`, `showSheetLink()`, `_setToastFn()`
- `src/core/format.js` — `fmtMoney()`, `fmtDelta()`, `fmtPct()`, `parseMoney()`
- `src/core/toast.js` — `toast()` standalone notification helper
- `src/core/icons.js` — `icon()`, `iconEl()`, `categoryIcon()`, `categoryKey()`
- `src/core/autocomplete.js` — `attachAutocomplete()` tag/chip input helper
- `src/core/i18n/index.js` — registry-based i18n: `registerTranslations()`, `registerWriteConfig()`, `lang()`, `t()`, `tFn()`, `tr()`, `applyI18n()`, `setLang()`
- `src/core/i18n/common/fr.js` and `en.js` — shared translation strings (tabs, buttons, settings)

### Utility modules (`src/utils/`)

- `src/utils/dates.js` — `MONTH_NAMES`, `parseMonthLabel()`, `normalizeDate()`, `normalizeMonth()`, `getDatesForPeriod()`, `rebuildDatesList()`, `prevDate()`, `logCoverageDiagnostic()`
- `src/utils/stats.js` — `snapshotForDate()`, `buildEffectiveBalances()`, `buildBalanceSweep()`, `computeNetWorthFromSnapshots()`, `computeDateStats()`, `buildXAxisTicks()`
- `src/utils/balance.js` — `activeAccounts()`, `categoriesInOrder()`, `accountsForCategory()`
- `src/utils/import.js` — `parseDelimited()`, `normalizeName()`, `similarity()`, `suggestAccount()`, `rememberMapping()`, `slugify()`

### API modules (`src/api/`)

- `src/api/index.js` — `loadAll()` (calls all loaders in parallel); re-exports from all api/* modules
- `src/api/drive.js` — `verifySheet()`, `findSheetByName()`, `createSheet()`, `seedNewSheet()`
- `src/api/accounts.js` — `loadAccounts()`, `loadSnapshots()`, `loadCategoryMeta()`
- `src/api/config.js` — `loadConfig()`, `writeConfig()`
- `src/api/tags.js` — `loadTagsCatalog()`, `writeTagsCatalog()`, `mergeAndSyncTagsCatalog()`
- `src/api/groups.js` — `loadGroupsCatalog()`, `writeGroupsCatalog()`

### Feature modules (`src/features/`)

Each feature has `index.js` (logic) and optional `fr.js`/`en.js` (translations).

- `src/features/auth/` — OAuth flow, session restore, sheet bootstrap, tab routing
- `src/features/overview/` — Overview tab: hero net-worth, donut chart, stat cards, sparklines, tag/group views
- `src/features/history/` — History table (cards by month) + line chart + account select dropdown
- `src/features/entry/` — Entry form, recompute totals, save snapshot, progress strip
- `src/features/detail/` — Detail tab: year-over-year table by category and account
- `src/features/settings/` — Settings tab translations
- `src/features/settings/accounts/` — Accounts list, edit dialog, import flow, migrate ID dialog
- `src/features/settings/groups/` — Groups list and edit dialog

### Key objects in `src/core/state.js`

- **`els`** (in `core/dom.js`) — map of every DOM element looked up once at startup
- **`state`** — all mutable runtime state: token, sheet ID, loaded accounts/snapshots, chart instances, etc.
- **`HEADERS`** — canonical column order for each sheet tab (`accounts`, `snapshots`, `config`); controls read/write layout

### i18n registry pattern

Instead of a monolithic dictionary, translations are registered per-feature:

```js
import { registerTranslations } from '../../core/i18n/index.js';
registerTranslations('fr', { my_key: 'Valeur FR' });
registerTranslations('en', { my_key: 'EN value' });
```

`src/main.js` imports all `fr.js`/`en.js` files to trigger registration before `applyI18n()` runs.

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
- **`snapshots`** — long format: one row per `(date, account_id)` balance; a special row with `account_id = "__day__"` holds a day-level comment
- **`config`** — key-value settings (`language`, `currency`, `schema_version`, `last_imported_at`)

Derived totals (per-category sums, net worth, MoM/YoY deltas) are computed in JS, never stored in the sheet. `accounts.kind` (`asset` / `debt`) drives the sign in net-worth arithmetic; `ownership_share` scales the raw balance for joint accounts.

### UI tabs

Five tabs rendered by JS: **Overview** (hero net-worth + chart), **Detail** (year-over-year table), **History** (snapshot cards + chart), **Entry** (monthly data entry form), **Settings** (accounts management + CSV import + groups editor).

Chart rendering uses **Chart.js** (npm package, bundled by Vite).
Date picker uses **AirDatepicker** (npm package, bundled by Vite).
