# Google Sheet Schema

The app manages a single Google Sheet with three tabs. The schema is designed for long-format storage so adding/renaming/disabling accounts never breaks historical data.

## Tab: `accounts`

One row per account. The app reads this to build the entry form and to know how to roll up totals.

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Stable internal key (e.g., `celi_1`). Never changes. |
| `name_fr` | string | yes | French display label. |
| `name_en` | string | yes | English display label. |
| `category` | string | yes | One of: `investments`, `real_estate`, `real_estate_debt`, `cash`, `other_asset`, `other_debt` (extensible). |
| `kind` | string | yes | `asset` or `debt`. Drives sign in net-worth calculation. |
| `owner` | string | yes | `self`, `partner`, or `joint`. |
| `ownership_share` | number | yes | 0.0–1.0. Multiplier applied to the raw balance when computing adjusted totals. `1.0` means 100% yours. |
| `active` | boolean | yes | `FALSE` hides the account from new snapshots but preserves history. |
| `sort_order` | integer | yes | Display order within its category. |

## Tab: `snapshots`

One row per (month, account) balance. Long format.

| Column | Type | Required | Notes |
|---|---|---|---|
| `month` | string | yes | `YYYY-MM` (e.g., `2026-05`). |
| `account_id` | string | yes | FK to `accounts.id`. |
| `balance_raw` | number | yes | Value as entered. Always positive in the cell — sign comes from `accounts.kind`. |
| `comment` | string | no | Free-form per-account comment. |
| `entered_at` | ISO 8601 | yes | Set by the app when the row is written. |

A "monthly snapshot" is the set of rows sharing the same `month`.

There is also a special per-month comment captured as a row with `account_id = "__month__"` and `balance_raw = 0` — the app reads `comment` for that row as the month-level note (mirrors the `Commentaires` row in the existing Historique sheet).

## Tab: `config`

Key-value settings.

| Column | Type | Notes |
|---|---|---|
| `key` | string | e.g., `language`, `currency`, `schema_version`. |
| `value` | string | |

Initial keys:
- `language` — `fr` or `en`
- `currency` — `CAD` (display only)
- `schema_version` — `1`
- `last_imported_at` — ISO timestamp of last CSV import

## Planned (not yet implemented): customizable categories & groups

Categories currently live in `seed/default-accounts.json` and are bundled with the app. Future versions will move them to a fourth sheet tab so each user can customize them. The seed already declares the future schema so no data migration will be needed:

**Future `categories` tab:**

| Column | Notes |
|---|---|
| `id` | stable internal key |
| `name_fr` / `name_en` | display labels |
| `kind` | `asset` or `debt` — determines net-worth sign |
| `sort_order` | display order |
| `group` | optional grouping key — e.g., `liquid`, `real_estate`, `other` — for higher-level rollups like "Liquid Assets" combining `cash` + `investments` |
| `group_sort` | order within group |

`accounts.category` already references category id, so existing accounts will continue to work when categories move to the sheet.

## Derived totals (computed in the app, not stored)

The app computes these on the fly from `snapshots` + `accounts`:

- **Per category total** = Σ (balance_raw × ownership_share × kind_sign) for active accounts in that category, kind_sign = +1 for `asset`, −1 for `debt`.
- **Net worth** = Σ all categories.
- **Month-over-month delta** = current month net worth − previous month net worth.

Computing in code (not in the sheet) keeps the sheet clean and avoids fragile cross-cell formulas.
