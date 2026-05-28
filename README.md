# PFS Tool — Personal Financial Statement

![Version](https://img.shields.io/badge/version-1.3.0-6366f1?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

A privacy-first net worth tracker that stores your data in **your own Google Sheet** — nothing passes through any server you don't control.

---

## What it is

PFS Tool lets you record daily snapshots of your accounts and watch your net worth evolve over time. There is no backend, no database, and no subscription. You sign in with Google, and all data lives in a single spreadsheet in your own Drive — shareable with a spouse like any other Sheet, editable directly, backed up automatically.

---

## Features

- **Daily snapshots** — enter balances for any date; leave accounts blank to skip them without creating a zero entry
- **Carry-forward (LOCF)** — charts and totals always reflect each account's last known value, preventing artificial drops from sparse entries
- **Overview** — hero net worth with period comparison (3M / 6M / 1Y / YTD / all), asset allocation donut, and per-group sparkline cards
- **Groups** — tag-based filters (`all` / `any` / `exclude`) to slice your portfolio any way you like
- **History** — month-grouped entries with day-level detail, delta vs. previous entry, and a warning when carry-forward is active
- **Entry form** — per-account balance inputs with previous-value hints and a live net worth total using carry-forward for unfilled accounts
- **Accounts manager** — add, edit, archive, and reorder accounts; tag them for group membership
- **CSV import** — paste historical data; fuzzy account matching with a confirm-and-remember mapping flow
- **Bilingual** — French and English, switchable at runtime
- **Private mode** — redacts all numbers in the UI and on charts with a single click

---

## Data

All data lives in four tabs of your Google Sheet:

| Tab | Contents |
|---|---|
| `accounts` | One row per account — name, category, kind, owner, ownership share, tags |
| `snapshots` | One row per `(date, account_id)` — raw balance, optional comment, timestamp |
| `config` | Language, currency, schema version |
| `groups` | Group definitions: name, color, tag filters |

Derived totals (net worth, deltas, category sums) are computed in the app — the sheet stays clean.

---

## License

[MIT](LICENSE) — © 2026 Gladhus
