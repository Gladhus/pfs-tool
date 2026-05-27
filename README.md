# PFS Tool — Personal Financial Statement

![Version](https://img.shields.io/badge/version-0.9.1-6366f1?style=flat-square)
![Deploy](https://img.shields.io/github/actions/workflow/status/Gladhus/pfs-tool/deploy.yml?branch=main&style=flat-square&label=deploy)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

A privacy-first net worth tracker that stores your data in **your own Google Sheet** — nothing passes through any server you don't control. Built as a zero-dependency progressive web app deployable to GitHub Pages in minutes.

---

## Features

- **Daily snapshots** — enter balances for any date; partial entries supported (leave accounts blank to skip them)
- **Carry-forward (LOCF)** — charts and totals always reflect last known values, preventing artificial drops from sparse entries
- **Overview** — hero net worth with period comparison, asset allocation donut, and per-category or per-group sparkline cards
- **History** — month-grouped cards with day-level entries, delta vs. previous entry, and an incomplete-entry warning when carry-forward is active
- **Groups** — tag-based CNF filters (`all` / `any` / `exclude`) to slice your portfolio any way you like; stored in the sheet
- **Entry form** — account-by-account balance inputs with previous-value hints, direction arrows, and a live net worth total
- **Bilingual** — French and English, switchable at runtime
- **Private mode** — hides all numbers in the UI and on charts with a single click
- **CSV import** — paste historical data directly; fuzzy account matching with a confirm-and-remember mapping UI
- **Accounts manager** — add, edit, archive, reorder accounts and tag them for group membership

---

## How it works

The app is a Vite-built SPA served as static files (GitHub Pages). It talks to Google Sheets via the official gapi + GIS OAuth libraries — no backend, no database, no subscriptions.

```
Your browser  ──OAuth──▶  Google Identity Services
              ──API──────▶  Google Sheets (your Drive)
```

Your data lives in a single Google Sheet with four tabs: `accounts`, `snapshots`, `config`, `groups`. All totals, charts, and deltas are computed in JavaScript from those rows — nothing is written back except raw balances.

---

## Getting started

### Prerequisites

- A Google account
- A GitHub account (for deployment) or any static host

### 1. Google Cloud setup

Follow [`docs/SETUP.md`](docs/SETUP.md) — takes about 5 minutes. You'll create a free OAuth Client ID and enable the Sheets API. No credit card required.

### 2. Configure the app

Edit `public/config.js`:

```js
window.PFS_CONFIG = {
  CLIENT_ID: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
  LANGUAGE:  'fr',   // 'fr' or 'en'
  CURRENCY:  'CAD',
  SHEET_TITLE: 'PFS Tool',
};
```

### 3. Run locally

```bash
npm install
npm run dev
# → http://localhost:8080/pfs-tool/
```

### 4. Deploy to GitHub Pages

Push to `main` — the included GitHub Actions workflow builds and deploys automatically.

```bash
git push origin main
```

The workflow tags the commit with the version from `package.json` (e.g. `v0.9.1`). If the version tag already exists the deploy is blocked — bump the version first.

---

## Data model

| Tab | Contents |
|---|---|
| `accounts` | One row per account — id, name (FR/EN), category, kind, owner, share, active, sort order, tags |
| `snapshots` | Long format: one row per `(date, account_id)` — date (YYYY-MM-DD), balance, comment, entered_at |
| `config` | Key-value settings: language, currency, schema_version |
| `groups` | Group definitions: name, color, all-tags, any-tags, exclude-tags |

Derived totals (net worth, deltas, category sums) are computed in JavaScript — the sheet stays clean. See [`docs/schema.md`](docs/schema.md) for the full column reference.

---

## Versioning

This project follows [Semantic Versioning](https://semver.org/). Every push to `main` must include a version bump in `package.json` — a pre-commit hook and a CI check both enforce this.

To roll back to a previous version, redeploy from its tag:

```bash
git checkout v0.8.0
git push origin HEAD:main --force
```

See [`CHANGELOG.md`](CHANGELOG.md) for the full release history.

---

## Project structure

```
pfs-tool/
├── src/
│   ├── main.js          # event wiring and startup
│   ├── auth.js          # OAuth flow, session restore, sheet bootstrap
│   ├── sheets.js        # all Google Sheets/Drive API calls
│   ├── overview.js      # Overview tab — hero, donut, chart, group cards
│   ├── history.js       # History tab — month cards, chart
│   ├── entry.js         # Entry tab — form, totals, save
│   ├── accounts.js      # Settings — accounts table, CSV import
│   ├── groups.js        # Settings — groups editor
│   ├── state.js         # shared runtime state and constants
│   ├── i18n.js          # FR/EN dictionaries and helpers
│   ├── format.js        # fmtMoney, fmtDelta, parseMoney
│   ├── utils.js         # carry-forward, date helpers, similarity
│   ├── dom.js           # element refs, setStatus, tooltip, confirm dialog
│   └── icons.js         # inline SVG icon library
├── public/
│   └── config.js        # runtime config (CLIENT_ID, language, currency)
├── seed/
│   └── default-accounts.json   # bundled at build time by Vite
├── docs/
│   ├── SETUP.md         # Google Cloud OAuth setup guide
│   └── schema.md        # sheet tab and column reference
├── .githooks/
│   └── pre-commit       # blocks commits to main if version isn't bumped
├── .github/workflows/
│   └── deploy.yml       # build → deploy → auto-tag
├── index.html
├── style.css
├── vite.config.js
├── CHANGELOG.md
└── package.json
```

---

## License

[MIT](LICENSE) — © 2026 Gladhus
