# PFS Tool — Personal Financial Statement

![Version](https://img.shields.io/badge/version-2.0.0-6366f1?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)
![Deploy](https://img.shields.io/github/actions/workflow/status/Gladhus/pfs-tool/deploy.yml?style=flat-square&label=deploy)
![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06b6d4?style=flat-square&logo=tailwindcss&logoColor=white)
![Tests](https://img.shields.io/badge/tests-181%20passing-22c55e?style=flat-square)
![Bilingual](https://img.shields.io/badge/i18n-EN%20%7C%20FR-f59e0b?style=flat-square)
![XLSX](https://img.shields.io/badge/works%20offline-XLSX%20mode-8b5cf6?style=flat-square)

A privacy-first net worth tracker that stores your data in **your own Google Sheet** — or entirely offline as an XLSX file. Nothing passes through any server you don't control.

---

## What it does

PFS Tool lets you record snapshots of your accounts over time and watch your net worth evolve. There is no backend, no database, and no subscription. Sign in with Google and your data lives in a single spreadsheet in your own Drive — or work completely offline by uploading or creating an XLSX file directly in the browser.

---

## Features

### Net worth tracking
- **Daily snapshots** — record balances for any date across all your accounts
- **Carry-forward (LOCF)** — charts always show each account's last known value, preventing artificial drops from sparse entries
- **Ownership share** — scale joint account balances by any percentage; set to 0 to exclude entirely
- **Multi-currency** — CAD and USD accounts in the same portfolio; live exchange rates fetched automatically

### Overview
- Hero net worth with period comparison (3M / 6M / YTD / 1Y / 2Y / 5Y / All)
- Asset allocation area chart by category or by custom group
- Per-group sparkline stat cards with delta vs. prior period

### Accounts & History
- Month-grouped history with day-level detail, MoM delta, and carry-forward warnings
- Year-over-year detail table with per-account balances at each January 1st
- Account manager — add, edit, reorder, and archive accounts; assign tags for group membership

### Groups
- Tag-based filters with `all` / `any` / `exclude` logic to slice your portfolio any way you like
- Groups appear as their own series in the overview chart and as sparkline cards

### Entry form
- Per-account balance inputs with previous-value hints and direction arrows
- Live net worth total using carry-forward for unfilled accounts
- Sticky totals bar, confirm-before-leaving guard, and copy-previous-entry shortcut

### Stock options *(optional)*
- Track equity grants across multiple companies (ISO, NSO, RSU, SAR)
- Full vesting schedule — cliff, monthly/quarterly/annual intervals
- FMV history with intrinsic value calculated at every date
- Exercise tracking — log exercises per grant; exercisable shares update automatically
- Vested value flows into net worth, overview chart, and group totals

### CSV import
- Paste historical data from a spreadsheet export
- Fuzzy account matching with a confirm-and-remember mapping flow

### XLSX mode *(new in v2)*
- **Open XLSX** — upload a `.xlsx` export of your Google Sheet and use the full app without signing in
- **New XLSX file** — start fresh with a blank file, no Google account required
- All edits are kept in memory; download the updated file at any time from the banner

### Comfort features
- **Bilingual** — French and English, switchable at runtime
- **Private mode** — redacts all numbers and chart values with a single click
- **Dark / light / system theme** — synced to your sheet for cross-device consistency
- **Keyboard shortcuts** — common actions without reaching for the mouse

---

## Data

All data lives in your Google Sheet (or XLSX file). Nothing is stored on any external server.

| Tab | Contents |
|---|---|
| `accounts` | One row per account — name, category, kind, owner, ownership share, tags, growth rate, currency |
| `snapshots` | One row per `(date, account_id)` — raw balance, optional comment, timestamp |
| `config` | Language, currency, theme, schema version, feature flags |
| `tags` | Tag catalog for autocomplete |
| `groups` | Group definitions — name, color, tag filters |
| `fx_rates` | Daily USD↔CAD exchange rates (fetched from frankfurter.dev, cached in the sheet) |
| `option_companies` | One row per company — name, ticker, tags, currency |
| `option_grants` | One row per grant — type, dates, shares, strike, vesting schedule |
| `option_fmv` | FMV history per company |
| `option_exercises` | Exercise log per grant |

Derived totals — net worth, category sums, MoM/YoY deltas — are computed in the browser and never written back.

---

## Getting started

### With Google Sheets
1. Open the app and click **Sign in with Google**
2. On first sign-in, a sheet named *Net Worth Tracker* is created automatically in your Drive
3. Add your accounts in **Settings → Accounts**, then start entering balances

### Without a Google account
1. Open the app and click **Open XLSX** to upload an export, or **New XLSX File** to start blank
2. Work normally — all changes stay in memory
3. Click **Download XLSX** in the top banner whenever you want to save your work

### Self-hosting
The app is a static site. Any static host works:
```bash
npm install
npm run build   # → dist/
```
Deploy `dist/` anywhere — GitHub Pages, Netlify, Vercel, or a plain web server. Update `base` in `vite.config.ts` to match your path.

---

## Setup (Google OAuth)

A `CLIENT_ID` from Google Cloud Console is required for sign-in. See [`docs/SETUP.md`](docs/SETUP.md) for the one-time setup. The XLSX mode works without any configuration.

---

## License

MIT
