# Google Sheet Schema

The app manages a single Google Sheet with up to thirteen tabs. The schema is designed for long-format storage so adding, renaming, or disabling accounts never breaks historical data.

Derived totals (net worth, category sums, MoM/YoY deltas) are computed in the browser — never stored in the sheet.

---

## Tab: `accounts`

One row per account.

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Stable internal key (e.g. `celi_1`). Never changes. |
| `type` | string | yes | Account type prefix (e.g. `celi`, `reer`, `chequing`). Drives id generation for new accounts. |
| `name_fr` | string | yes | French display label. |
| `name_en` | string | yes | English display label. |
| `category` | string | yes | e.g. `investments`, `real_estate`, `cash`, `other_asset`, `other_debt`. |
| `kind` | string | yes | `asset` or `debt`. Drives sign in net-worth calculation. |
| `owner` | string | yes | `self`, `partner`, or `joint`. |
| `ownership_share` | number | yes | 0.0–1.0. Multiplier applied to raw balance. `0` excludes the account from totals entirely. |
| `active` | boolean | yes | `FALSE` hides the account from new entries but preserves all history. |
| `sort_order` | integer | yes | Display order within its category. |
| `tags` | string | no | Comma-separated tag names (e.g. `tech, growth`). Used for group membership. |
| `annual_rate` | number | no | Optional growth rate in % per year. Enables the Calculate button in the entry form. |
| `currency` | string | no | `CAD` or `USD`. Absent means the account is in the main currency. |

---

## Tab: `snapshots`

One row per `(date, account_id)` balance. Long format — one row per day per account.

| Column | Type | Required | Notes |
|---|---|---|---|
| `date` | string | yes | `YYYY-MM-DD` (e.g. `2026-05-01`). |
| `account_id` | string | yes | FK to `accounts.id`. |
| `balance_raw` | number | yes | Value as entered. Always the raw number — sign comes from `accounts.kind`. |
| `comment` | string | no | Free-form per-account note for this entry. |
| `entered_at` | ISO 8601 | no | Timestamp written by the app when the row is saved. Used to resolve duplicate rows (latest wins). |

A special row with `account_id = "__day__"` and `balance_raw = 0` holds a day-level comment in the `comment` field. It does not represent a real account.

When a date has duplicate rows for the same `account_id`, the app keeps whichever has the latest `entered_at` (or the last occurrence if timestamps are equal).

---

## Tab: `config`

Key-value settings. Two columns: `key` and `value`.

| Key | Values | Notes |
|---|---|---|
| `language` | `en` \| `fr` | UI language. |
| `currency` | `CAD` \| `USD` | Main display currency. |
| `schema_version` | `1` | Reserved for future migrations. |
| `last_imported_at` | ISO 8601 | Timestamp of the last CSV import. |
| `theme` | `light` \| `dark` \| `system` | UI theme preference. |
| `stock_options_enabled` | `1` \| `0` | Whether the Stock Options tab is visible. |
| `spending_enabled` | `1` \| `0` | Whether the Spending tracker tab is visible. |

---

## Tab: `tags`

Catalog of known tags used for account membership and autocomplete.

| Column | Type | Notes |
|---|---|---|
| `name` | string | Tag name (e.g. `tech`, `growth`). Must be unique. |

Created lazily on first write. The app degrades gracefully if this tab is absent.

---

## Tab: `groups`

User-defined account groups displayed in the Overview.

| Column | Type | Notes |
|---|---|---|
| `name` | string | Display name (e.g. `Liquid Assets`). |
| `color` | string | Hex color for the group's chart series and sparkline card. |
| `all` | string | Comma-separated tags — account must have **all** of these. |
| `any` | string | Comma-separated tags — account must have **at least one** of these. |
| `exclude` | string | Comma-separated tags — account must have **none** of these. |

An account matches a group when it satisfies all three filter columns simultaneously (CNF logic).

---

## Tab: `fx_rates`

Daily USD→CAD exchange rates, cached in the sheet to avoid repeated API calls.

| Column | Type | Notes |
|---|---|---|
| `date` | string | `YYYY-MM-DD`. |
| `usd_cad` | number | Rate: 1 USD = N CAD. |

Rates are fetched from [frankfurter.dev](https://frankfurter.dev) and written here on demand. The app forward-fills weekends and holidays from the prior business day's rate.

---

## Tab: `option_companies`

One row per company offering stock options.

| Column | Type | Notes |
|---|---|---|
| `id` | string | Stable internal key. |
| `name` | string | Company display name. |
| `ticker` | string | Stock ticker (display only). |
| `active` | boolean | `FALSE` hides the company but preserves grants and FMV history. |
| `tags` | string | Comma-separated tags — controls which Overview groups include this company's equity value. |
| `currency` | string | `CAD` or `USD`. Currency of FMV and strike prices. |

---

## Tab: `option_grants`

One row per equity grant.

| Column | Type | Notes |
|---|---|---|
| `id` | string | Stable internal key. |
| `company_id` | string | FK to `option_companies.id`. |
| `label` | string | Display label (e.g. `Series A grant`). |
| `grant_type` | string | `ISO`, `NSO`, `RSU`, or `SAR`. |
| `grant_date` | string | `YYYY-MM-DD`. |
| `total_shares` | number | Total shares in the grant. |
| `strike_price` | number | Exercise price per share. |
| `vesting_start` | string | `YYYY-MM-DD`. Start of the vesting period (may differ from grant date). |
| `cliff_months` | number | Months before any shares vest. |
| `vesting_months` | number | Total vesting duration in months. |
| `vesting_interval` | string | `monthly`, `quarterly`, or `annually`. |
| `expiry_date` | string | `YYYY-MM-DD`. Date after which the grant can no longer be exercised. |

---

## Tab: `option_fmv`

Fair market value history per company.

| Column | Type | Notes |
|---|---|---|
| `date` | string | `YYYY-MM-DD`. |
| `company_id` | string | FK to `option_companies.id`. |
| `fmv` | number | Fair market value per share on this date. |
| `note` | string | Optional note (e.g. `409A valuation`). |

LOCF semantics apply: the app uses the last known FMV for any date without an explicit entry.

---

## Tab: `option_exercises`

Log of option exercises per grant.

| Column | Type | Notes |
|---|---|---|
| `id` | string | Stable internal key. |
| `grant_id` | string | FK to `option_grants.id`. |
| `date` | string | `YYYY-MM-DD`. Exercise date. |
| `shares_exercised` | number | Number of shares exercised. Must not exceed exercisable shares as of that date. |
| `price_paid` | number | Total price paid (typically `shares × strike_price`). |
| `note` | string | Optional note. |

---

## Tab: `spending_categories`

User-defined spending categories. Independent of the asset/debt net-worth categories.
Seeded with a starter set (Groceries, Dining, …) the first time the tab is empty.

| Column | Type | Notes |
|---|---|---|
| `id` | string | Stable internal key (e.g. `groceries`). |
| `name_fr` | string | French display label. |
| `name_en` | string | English display label. |
| `color` | string | Hex color for the category chip + chart series. |
| `icon` | string | Optional Lucide icon name (display only). |
| `sort_order` | integer | Display order. |
| `active` | boolean | `FALSE` hides it from new entries but preserves history. |

---

## Tab: `spendings`

One row per recorded expense. Split across owners like an account.

| Column | Type | Notes |
|---|---|---|
| `id` | string | Stable internal key. |
| `date` | string | `YYYY-MM-DD`. |
| `amount` | number | Gross amount as entered — always positive. |
| `currency` | string | `CAD` \| `USD`. Absent → main currency. Converted via `fx_rates`. |
| `category_id` | string | FK to `spending_categories.id`. |
| `ownership` | JSON | `[{ "person_id": "self", "share": 0.6 }, …]` — shares sum to 1. Same encoding as `accounts`. |
| `comment` | string | Optional note. |
| `entered_at` | ISO 8601 | Timestamp written by the app when the row is saved. |

A stored row whose `id` is `recur:<ruleId>:<date>` overrides the generated occurrence
of that recurring rule for that date (reserved for a future per-occurrence edit; not
produced by the app today).

---

## Tab: `spending_recurrences`

One row per recurring-spending rule. Occurrences are expanded in the browser on read —
never stored.

| Column | Type | Notes |
|---|---|---|
| `id` | string | Stable internal key. |
| `label` | string | Display name (e.g. `Rent`). |
| `amount` | number | Per-occurrence amount. |
| `currency` | string | `CAD` \| `USD`. Absent → main currency. |
| `category_id` | string | FK to `spending_categories.id`. |
| `ownership` | JSON | Owner split — same encoding as `spendings`. |
| `frequency` | string | `weekly` \| `biweekly` \| `monthly` \| `yearly`. |
| `interval` | integer | Every N units of `frequency` (≥ 1). |
| `start_date` | string | `YYYY-MM-DD`, first occurrence. |
| `end_date` | string | Optional last date (inclusive). Blank = open-ended. |
| `active` | boolean | `FALSE` stops future expansion, keeps history. |
| `comment` | string | Optional note. |

---

## Derived totals

Computed in the browser from `accounts` + `snapshots`. Never written to the sheet.

- **Adjusted balance** = `balance_raw × ownership_share`
- **Net worth contribution** = adjusted balance × (+1 for `asset`, −1 for `debt`)
- **Net worth** = Σ net worth contributions across all active accounts
- **Category total** = Σ net worth contributions for accounts in that category
- **Group total** = Σ adjusted balances for accounts matching the group's tag filters (+ equity value if tags match)
- **MoM / YoY delta** = net worth at date A − net worth at date B
- **Vested shares** = computed from grant schedule as of a given date, respecting cliff
- **Exercisable shares** = vested shares − already exercised shares
- **Intrinsic value** = exercisable shares × (FMV − strike price), floored at 0
