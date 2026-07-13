# Spending Tracker — Feature Design

> Status: **implemented** (v2.5.0). This document specifies a self-contained domain —
> a **spending tracker** — added the way the handbook's *Recipe D* prescribes: a
> flag-gated top-level section (`features/spending/`) with its own tabs,
> selectors, and pages. It reuses existing seams (config flag, per-owner
> `OwnershipEntry`, currency conversion) and **touches nothing in the net-worth
> engine** (`core/`, `buildDataset`, the `ValuedContributor` contract).
>
> **Shipped in v1:** categories, one-off spendings, recurring rules (expanded at
> read time), owner splits, per-month Overview (total + by-category + by-person),
> the Entries ledger, and the Manage page. Budgets remain the deferred Phase 2
> (§8). Files: `features/spending/{data/spending.selectors.ts, data/useSpendingData.ts,
> SpendingOverviewPage, SpendingEntriesPage, SpendingManagePage, components/*}`,
> `app/SpendingGuard.tsx`, `shared/io/api/spending.ts`, plus the IO wiring in §7.

---

## 1. Goal & scope

Let a household **record spendings** — a dated expense with an **amount**, a
**category**, and an **owner split** (who the expense belongs to, by %) — and see
where the money goes. Recurring expenses (rent, subscriptions) are entered once as
a **rule** and counted automatically every period. The feature is turned on by a
checkbox in **Settings → Preferences**, exactly like Stock Options.

**Explicit boundary — "completely separate."** Spending is *not* net worth. It
does **not** implement `ValuedContributor`, does **not** appear in Overview /
History / Detail, and adds **no** branch to `buildDataset`. The two domains never
meet. This keeps the golden masters untouched and the blast radius of the feature
contained to its own files plus the mechanical IO/nav wiring.

### Decisions locked for v1

| Question | Decision | Consequence |
|----------|----------|-------------|
| Budgets | **Deferred.** Focus on *tracking* first. | No budget UI in v1, but the schema + `SpendingSummary` shape reserve a `budget?` slot so Phase 2 lights up with **no data migration** (§8). |
| Recurring | **Supported** via a rules table, expanded virtually at read time. | No materialized rows, no background job — pure selector, in keeping with "raw rows → derived in browser." (§5.2, §6.1) |
| Owner % | **Split like account ownership.** Reuse `OwnershipEntry[]`. | A $80 spend split 60/40 emits two owner slices; person-view and viewer-scoping reuse `shareFor`/`viewerShare` verbatim. (§6.2) |

---

## 2. Where it sits in the architecture

```
features/
  networth/   ← net-worth roll-up  (accounts + options)   ── UNTOUCHED
  accounts/   ← domain: ValuedContributor + selectors      ── UNTOUCHED
  options/    ← domain: ValuedContributor + selectors      ── UNTOUCHED
  spending/   ← NEW self-contained domain, NOT a contributor
    data/
      spending.selectors.ts        ← recurrence expansion, per-owner slicing, summary
    SpendingOverviewPage.tsx       ← totals + by-category + by-person (period selector)
    SpendingDetailPage.tsx         ← per-category MoM / YoY table (last 6 periods with data)
    SpendingEntriesPage.tsx        ← the ledger: list / add / edit / delete
    SpendingManagePage.tsx         ← manage categories + recurring rules
    components/
      SpendingDialog.tsx           ← add/edit one spending (amount, date, category, split)
      RecurrenceDialog.tsx         ← add/edit a recurring rule
      SpendingCategoryDialog.tsx   ← add/edit a category
  settings/   ← +1 checkbox in PreferencesSection
core/         ← UNTOUCHED (spending is not a contributor)
```

The domain owns **all** its computation in `data/spending.selectors.ts` (the "no
data logic in components" rule). Its pages render selector output and format at the
edge with the existing `fmt*` / `priv*` helpers.

---

## 3. Data model — three new tabs

All three follow the existing long-format, id-keyed conventions. Owner splits reuse
the **same JSON `ownership` column** as `accounts` (parsed by `ownershipFromRow`,
written by `serializeOwnership`), so people renaming/archiving already works.

### Tab: `spending_categories`

A small managed catalog (like `groups` / `people`) — spending categories are their
own thing, unrelated to the asset/debt net-worth categories.

| Column | Type | Notes |
|---|---|---|
| `id` | string | Stable key, e.g. `groceries`. |
| `name_fr` | string | French label. |
| `name_en` | string | English label. |
| `color` | string | Hex, for chart series + the category chip. |
| `icon` | string | Optional Lucide icon name (display only). |
| `sort_order` | integer | Display order. |
| `active` | boolean | `FALSE` hides it from new entries but preserves history. |

Seeded with a sensible starter set on a brand-new sheet (§9): Groceries, Dining,
Transport, Housing, Utilities, Health, Entertainment, Shopping, Travel, Other.

### Tab: `spendings`

One row per actual expense (one-off, or a manual/edited occurrence).

| Column | Type | Notes |
|---|---|---|
| `id` | string | Stable key. |
| `date` | string | `YYYY-MM-DD`. |
| `amount` | number | Positive number, the gross expense. |
| `currency` | string | `CAD` \| `USD`. Absent → main currency. Converted via `toMain` + `fx_rates`. |
| `category_id` | string | FK → `spending_categories.id`. |
| `ownership` | JSON | `OwnershipEntry[]` — the owner split, shares sum to 1. Same encoding as `accounts`. |
| `comment` | string | Optional note. |
| `entered_at` | ISO 8601 | Written by the app; latest-wins on duplicate ids. |

### Tab: `spending_recurrences`

One row per recurring rule. Occurrences are **not** stored — they are expanded on
read (§5.2).

| Column | Type | Notes |
|---|---|---|
| `id` | string | Stable key. |
| `label` | string | Display name, e.g. "Rent". |
| `amount` | number | Per-occurrence amount. |
| `currency` | string | `CAD` \| `USD`. Absent → main currency. |
| `category_id` | string | FK → `spending_categories.id`. |
| `ownership` | JSON | `OwnershipEntry[]` — same as above. |
| `frequency` | string | `weekly` \| `biweekly` \| `monthly` \| `yearly`. |
| `interval` | integer | Every N units of `frequency` (default 1). |
| `start_date` | string | `YYYY-MM-DD`, first occurrence. |
| `end_date` | string | Optional last date; blank = open-ended. |
| `active` | boolean | `FALSE` stops future expansion, keeps history. |
| `comment` | string | Optional. |

> **Phase 2 seam (not built in v1):** a fourth tab `spending_budgets`
> (`category_id`, `period` = `monthly`, `amount`, `ownership?`) plus a
> `spending_budget_scope` config key. The `SpendingSummary` type already reserves
> the `budget?` field, so adding this is additive. See §8.

---

## 4. Config flag

One new key in the `config` tab, mirroring `stock_options_enabled` exactly:

| Key | Values | Notes |
|---|---|---|
| `spending_enabled` | `1` \| `0` | Whether the Spending section is visible. |

Add `spending_enabled?: boolean` to `AppConfig` (`types/sheets.ts`), and teach the
three config codecs about it: `parseConfigRows` + `serializeConfig` (`parse.ts`)
and `loadConfig` (`api/config.ts`) — the same three edits `stock_options_enabled`
required.

---

## 5. The data layer — `data/spending.selectors.ts`

Pure functions, unit-tested against fixtures. **The engine never reads the clock**
— the viewed window (a month, typically) and `today` are passed in.

### 5.1 The window

```ts
interface SpendingWindow { start: string; end: string; } // inclusive YYYY-MM-DD
```

The Overview page defaults to the current month (`monthStart(today)` …
`monthEnd(today)`); the Entries ledger can widen it (a range or "all").

### 5.2 Recurrence expansion (virtual, read-time)

```ts
/** Generate the concrete occurrence dates of a rule that fall within [start,end]. */
function expandRecurrence(rule: SpendingRecurrence, w: SpendingWindow): string[];

/** All rules → occurrence "rows" shaped exactly like a stored spending. */
function recurringOccurrences(rules: SpendingRecurrence[], w: SpendingWindow): Spending[];
```

`expandRecurrence` steps from `start_date` by `interval × frequency`, stopping at
`min(end, rule.end_date)`, skipping inactive rules. Monthly stepping uses the
existing date helpers (clamp end-of-month like Jan-31 → Feb-28). Each occurrence is
synthesized into a `Spending`-shaped object with a **derived, stable id**
(`recur:<ruleId>:<date>`) so the UI can tell generated rows from stored ones and a
future "skip/override this occurrence" feature can key off it.

### 5.3 The unified ledger

```ts
/** One-off spendings ∪ expanded recurrences, within the window, sorted by date. */
function ledgerFor(
  spendings: Spending[],
  rules: SpendingRecurrence[],
  w: SpendingWindow,
): Spending[];
```

Deduping rule: if a stored `spendings` row carries a `recur:*`-style override id for
the same rule+date, it **replaces** the generated occurrence (the Phase-2 override
seam; in v1 no such rows exist, so it's a plain union).

### 5.4 Per-owner slicing + currency

Reusing the net-worth per-owner idea, but scoped to spending. Each ledger row is
sliced into **one `SpendingSlice` per owner**, converted to main currency:

```ts
interface SpendingSlice {
  date: string;
  categoryId: string;
  ownerId: string;      // single owner
  amount: number;       // this owner's share, in MAIN currency (positive)
  sourceId: string;     // spending id or recur:* id (drill-down)
}

function sliceLedger(rows: Spending[], ctx: SpendingCtx): SpendingSlice[];
// ctx = { main: Currency; fxRateFor: (date) => number | null }
```

`amount = toMain(row.amount, row.currency, main, fx(date)) × share`. Then every
downstream question collapses to "group the slices":

| Question | How it's answered |
|----------|-------------------|
| Total spent | sum all slices |
| Spent by category | group by `categoryId` |
| Spent by person | group by `ownerId` |
| Viewing as one person | keep `ownerId === viewer` (`viewerShare` semantics) |

### 5.5 The summary the pages consume

```ts
interface SpendingSummary {
  window: SpendingWindow;
  total: number;
  count: number;                              // number of ledger rows (not slices)
  byCategory: { categoryId: string; amount: number; pct: number }[];  // sorted desc
  byPerson:   { ownerId: string;    amount: number; pct: number }[];
  budget?: { category: Record<string, number>; total: number };       // Phase 2 — undefined in v1
}

function spendingSummary(
  spendings: Spending[],
  rules: SpendingRecurrence[],
  categories: SpendingCategory[],
  w: SpendingWindow,
  ctx: SpendingCtx,
  viewer: string,
): SpendingSummary;
```

The `budget?` field is populated later without changing this signature's callers.

---

## 6. Reuse — what we do *not* rewrite

| Concern | Reused primitive |
|---------|------------------|
| Owner split parse/serialize | `ownershipFromRow`, `serializeOwnership`, `parseOwnership` (`utils/ownership.ts`) |
| Owner share / viewer scoping | `shareFor`, `viewerShare` (`utils/ownership.ts`) |
| Currency conversion | `toMain`, `rateFor` + `fx_rates` query (`utils/currency.ts`) |
| Money / privacy formatting | `fmtMoney`, `fmtCur`, `priv*` (`utils/format.ts`, `privacy.ts`) |
| Charts | `recharts` + `ChartTooltip` (donut for by-category, bar for by-person) |
| CRUD dialogs, chips, selects | `PersonDialog`/`GroupDialog` patterns, `TagChipInput`, `CategorySelect`, `ColorSwatchPicker` |
| Viewer state | `ui.store.currentViewer` (household vs one person) |

---

## 7. IO wiring — the mechanical surface

The full "new tab" checklist from the handbook, applied three times (categories,
spendings, recurrences):

1. **`types/sheets.ts`** — add `SpendingCategory`, `Spending`, `SpendingRecurrence`
   interfaces; add `spending_enabled?: boolean` to `AppConfig`.
2. **`constants.ts`** — add three `HEADERS.*` arrays.
3. **`datasource/types.ts`** — `loadSpendingCategories/Spendings/Recurrences` +
   the three `write*` on the `Datasource` interface.
4. **`datasource/parse.ts`** — `parseSpending*Rows` + `serializeSpending*`
   (ownership via the shared helpers); extend `parseConfigRows`/`serializeConfig`
   for `spending_enabled`.
5. **`datasource/sheets.ts`** + **`datasource/xlsx.ts`** — implement the six
   methods (Sheets via `safeWriteTab` + a `api/spending.ts` loader following
   `api/options.ts`; XLSX via its in-memory tab map).
6. **`api/spending.ts`** — `loadSpending*` loaders (Sheets path).
7. **`api/config.ts`** — parse `spending_enabled`.
8. **`queries/keys.ts`** — `spendingCategories`, `spendings`, `spendingRecurrences`.
9. **`queries/sheetQueries.ts`** — three `useDatasourceQuery` hooks gated by a
   `useSpendingEnabled()` helper (copy of `useOptionsEnabled`).
10. **`queries/sheetMutations.ts`** — three `useWrite*Mutation` hooks.

Every tab is created lazily on first write and the app degrades gracefully when a
tab is absent (empty array) — the same contract every optional tab already honors.

---

## 7b. Importing bank exports (pluggable, auto-detecting)

Transactions can be bulk-imported from a bank export via a wizard at
`/spending/import`. The design is a **format-plugin registry** so new banks are
additive — you write one `SpendingImporter` and register it; detection is automatic.

```
features/spending/import/
  types.ts            SpendingImporter · RawTxn · ImportSource · PositionedLine
  pdf.ts              extractPdf(file) → { text, lines }  (pdfjs, lazy-loaded)
  registry.ts         IMPORTERS[] + detectImporter(src)   ← add a plugin here
  bnc.importer.ts     Banque Nationale (PDF table)        ← one plugin
  prepare.ts          expense filtering · stable import ids · buildSpendings (pure)
  mappings.ts         remembered category/account maps (localStorage, per importer)
```

**The seam.** A `SpendingImporter` is `{ detect(src), parse(src) }`. `extractPdf`
returns both the full `text` (for `detect`) and geometry — positioned `lines` with
per-token `x`/width (for table `parse`). `detectImporter` returns the first plugin
whose `detect` passes. Adding "Desjardins" or a CSV export is a new file + one line
in `registry.ts`; nothing else changes.

**Why geometry, not line order.** pdf.js emits per-character fragment tokens and
separates table columns with wide space tokens. The BNC importer rebuilds cells by
splitting each line at those wide spaces and assigning cells to columns by their
left-x — robust to fragmentation and to descriptions that wrap onto a second line.
A second pass recovers an account absorbed by a very long merchant name.

**Pipeline.** `parse` → `RawTxn[]` (bank-native labels, each classified
`expense | income | transfer | uncertain`). `income` and `transfer` are always
excluded — critically, **credit-card payments and account transfers never count as
spending**, so paying off a card doesn't double-count the individual purchases the
export already lists. Then the wizard:

1. **Uncertain** — categories that aren't clearly personal spending (bank fees,
   cash withdrawals, "Non catégorisé", …) are surfaced for an explicit
   include/skip decision (default: skip). Shown only when present; decisions are
   remembered per category, so the step shrinks over time.
2. **Accounts → ownership** and **Categories → your categories** — both remembered
   in `localStorage`, unknowns surfaced first. "Create new" lets you **type the new
   category's name** (defaults to the bank's label). The accounts step also offers a
   one-click **"assign everything to me"** shortcut (owned by the current viewer /
   primary member) that skips per-account mapping.
3. **Review** — the resulting rows, any of which can be unticked.

`buildSpendings` then emits `Spending[]` with **deterministic ids** so re-importing
the same export is idempotent (identical rows de-duplicated).

**pdfjs is lazy.** It's `import()`-ed inside `pdf.ts` only when a PDF is parsed, so
it (and its worker) code-split out of the main bundle — the app pays for it only on
the import screen.

## 8. Budgets — the deferred Phase 2 (designed, not built)

The user asked to focus on tracking first. Budgets slot in additively:

- **Data:** a `spending_budgets` tab (`category_id`, `period`, `amount`) + a
  `spending_budget_scope` config key (`household` \| `per_person`).
- **Selector:** `spendingSummary` fills `SpendingSummary.budget` from the budgets
  tab; no signature change, so pages that already read `summary` keep working.
- **UI:** the Overview's per-category rows gain a progress bar + "spent / budget"
  the moment `budget` is defined; until then they render totals only.

Because the v1 `SpendingSummary` already carries `budget?`, none of this is a
migration — it's a new tab + a populated field.

---

## 9. Pages, routes, navigation, settings

Mirror the Stock Options section (`router.tsx:33-36`, `:89-102`), which has an
Overview + Manage sub-nav behind a guard.

**Routes** (`app/router.tsx`):
```
element: <SpendingGuard />          ← copy of OptionsGuard, reads spending_enabled
  path: 'spending', element: <SectionLayout links={SPENDING_LINKS} />
    index                → <SpendingOverviewPage />
    'entries'            → <SpendingEntriesPage />
    'manage'             → <SpendingManagePage />
```
```ts
const SPENDING_LINKS = [
  { to: '/spending',         label: 'Overview', icon: 'dashboard', end: true },
  { to: '/spending/entries', label: 'Entries',  icon: 'calendar' },
  { to: '/spending/manage',  label: 'Manage',   icon: 'settings' },
];
```

**Guard** (`app/SpendingGuard.tsx`): copy `OptionsGuard.tsx`, swap
`stock_options_enabled` → `spending_enabled`, redirect to `/overview` when off.

**Settings checkbox** (`features/settings/sections/PreferencesSection.tsx`): add a
`Row` with a `Checkbox` bound to `spending_enabled`, next to the Stock Options one:
```tsx
<Row label={t('enable_spending')}>
  <Checkbox checked={spendingEnabled} disabled={writeConfig.isPending}
            onCheckedChange={c => writeConfig.mutate({ key: 'spending_enabled', value: c ? '1' : '0' })} />
</Row>
```

**Primary nav** (both, gated by the flag like `stockOptionsEnabled`):
- `BottomTabBar.tsx` — `{spendingEnabled && <TabItem to="/spending" label="Spending" icon="wallet"/>}` (pick a distinct icon, e.g. `receipt`/`creditCard`).
- Desktop `Header` nav — matching entry.
- `SettingsSectionLayout.tsx` — an external "Manage spending" sub-link when enabled (like the Options one).

**Overview page layout:**
```
┌── July 2026            [‹ ›] month picker ──┐
│  Total spent: $2,140          21 entries    │
│  ┌─ by category (donut) ─┐ ┌─ by person ─┐  │
│  │ Groceries  $620  29%  │ │ Me     55%  │  │
│  │ Housing    $500  23%  │ │ Partner 45% │  │
│  │ Dining     $310  14%  │ └─────────────┘  │
│  └───────────────────────┘                  │
│  Recent entries →  (links to /spending/entries)
└─────────────────────────────────────────────┘
```
(The empty progress-bar space to the right of each category row is where Phase-2
budgets render.)

---

## 10. i18n

Every label gets `en` + `fr` keys in `shared/i18n/{en,fr}.json`: `enable_spending`,
`spending`, `spending_overview`, `spending_entries`, `spending_manage`,
`add_spending`, `spending_amount`, `spending_category`, `spending_owner_split`,
`recurring`, `frequency_weekly|biweekly|monthly|yearly`, `every_n`, `starts`,
`ends`, `total_spent`, `by_category`, `by_person`, category display names, etc.

---

## 11. Phased implementation plan

1. **Schema + IO** — types, headers, parse/serialize, datasource methods (Sheets +
   XLSX), api loaders, keys, queries, mutations. Unit-test parse/serialize.
2. **Flag + guard + settings toggle + nav** — `spending_enabled` end to end, the
   section reachable (empty pages). Verify the checkbox shows/hides the tab.
3. **Selectors** — `expandRecurrence`, `ledgerFor`, `sliceLedger`,
   `spendingSummary`. Unit-test against fixtures (a one-off + a monthly rule that
   clamps at month-end; a 60/40 split; a USD row).
4. **Manage page** — CRUD for categories and recurring rules (dialogs).
5. **Entries page** — the ledger: list, add/edit/delete a one-off spending.
6. **Overview page** — month picker, total, by-category donut, by-person split,
   recent list; honor viewer + private mode.
7. **Docs + version** — update `docs/schema.md` with the three tabs and the config
   key, `README.md` feature list, bump version + CHANGELOG.
8. **(Later) Phase 2 budgets** — per §8, additive.

### Checklist (from the handbook, §14.5)
- [ ] Computation in `.selectors.ts`, not `.tsx`.
- [ ] `core/` untouched (spending is not a contributor).
- [ ] `en.json` + `fr.json` for every string.
- [ ] Unit tests for the selectors.
- [ ] Golden snapshots **unchanged** (Overview/History/Detail don't see spending).
- [ ] `npm run typecheck && npm test && npm run lint` green.
- [ ] Version + CHANGELOG bumped.

---

## 12. Why this is low-risk

- **No engine changes.** `core/`, `buildDataset`, and the contributors are
  untouched, so net-worth numbers can't regress and the golden masters stay frozen.
- **Additive tabs.** Three new optional tabs; absent tabs degrade to empty — old
  sheets keep working, no migration.
- **Proven pattern.** It's the Stock Options section reskinned: same flag-gating,
  same guard, same lazy-tab IO, same CRUD-dialog UI — a walked path.
- **Reused primitives.** Ownership, currency, formatting, and privacy all come from
  shared code that's already tested.
</content>
</invoke>
