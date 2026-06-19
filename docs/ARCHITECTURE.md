# Data Architecture — How data flows through PFS Tool

> Status: descriptive audit + target pattern. Nothing here changes behaviour;
> it documents how data is handled today and proposes a distinct data layer so
> new filters/views can be added in one place instead of five.

PFS Tool is a privacy-first net-worth tracker with **no backend**. All data lives
in either a Google Sheet or an in-memory XLSX workbook, and every derived number
(net worth, allocation, history, year-over-year) is computed in the browser from
the same handful of raw tables. So "how data is managed" is really one question:
**how do raw rows become the numbers on screen, and where do viewer/filters/format
get applied along the way?**

Your mental model is correct: it *should* be a funnel — **load → scope to viewer →
filter → aggregate → format**. Today that funnel exists, but it is hand-rolled
per page rather than being a layer. That is the core finding of this audit.

---

## 1. The layers as they exist today

```
┌─────────────────────────────────────────────────────────────────────┐
│ 0. PERSISTENCE / IO        src/datasource/*, src/api/*               │
│    Datasource interface (sheets.ts | xlsx.ts) + parse.ts             │
│    load*()/write*() return typed models; row↔model (de)serialization │
└─────────────────────────────────────────────────────────────────────┘
                                  │  Account[] Snapshot[] FxRate[] …
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. FETCH / CACHE           src/queries/sheetQueries.ts              │
│    useDatasourceQuery() → React Query, keyed by datasource id        │
│    useSheetData() aggregates the common tables                       │
└─────────────────────────────────────────────────────────────────────┘
                                  │  cached, typed models
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. DERIVE WORKING SETS     (inline, in every page component)        │
│    datesSorted   = deriveDatesSorted(snapshots)                      │
│    filteredDates = getDatesForPeriod(datesSorted, period)  ← TIME    │
│    activeAccounts(accounts)                                ← ACTIVE  │
│    accountsVisibleToViewer(accounts, viewer)              ← VIEWER   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. AGGREGATE  ← the heavy compute, RE-IMPLEMENTED PER PAGE          │
│    buildBalanceSweep / buildEffectiveBalances → balances per date   │
│    signedMain(acct, raw, main, usdCad, viewer)  (FX × share × sign)  │
│    accumulate into category / group / person buckets + net          │
│    + equity (options) bolted on separately                          │
│    + trim leading viewer-empty dates                                 │
│                                                                      │
│    Lives in: useOverviewStats, HistoryPage.computeSeries,           │
│              HistoryPage.cardData, DetailPage.getDetailYears,        │
│              utils/stats.ts (computeDateStats, groupStatsFor)        │
└─────────────────────────────────────────────────────────────────────┘
                                  │  numbers + series
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. PRESENT                 utils/format.ts, utils/privacy.ts        │
│    fmtMoney / fmtCur / fmtDelta + priv* (private-mode masking)       │
│    ChartTooltip.seriesTooltip — single shared tooltip renderer      │
└─────────────────────────────────────────────────────────────────────┘

State that drives the funnel:
  • viewer  → Zustand   (ui.store.currentViewer)
  • view    → Zustand   (ui.store.ovView)
  • period  → URL param (?period=)
  • account → URL param (?account=)
  • active  → implicit  (activeAccounts() called everywhere)
```

### The single most important primitive: `signedMain`

```ts
signedMain(account, balanceRaw, main, usdCad, viewer)
  = toMain(balanceRaw, account.currency, main, usdCad)   // FX conversion
  × viewerShare(account.ownership, viewer)                // viewer scoping
  × (account.kind === 'debt' ? -1 : 1)                    // debt sign
```

This one call folds **three distinct funnel stages** (convert, scope-to-viewer,
sign) into a single number. Convenient — but it means "viewer scoping" is not a
stage you can see or reason about; it is buried inside the money math.

---

## 2. Does the flow make sense? — Audit findings

**What is already right (keep it):**

- **Layer 0/1 are clean.** The `Datasource` interface genuinely abstracts Sheets
  vs XLSX; React Query keys by datasource id so switching sources invalidates
  correctly. This is the strongest part of the codebase.
- **Format is now centralized** (`format.ts`, `privacy.ts`, `ChartTooltip`). The
  "present" stage is a real layer — formatting happens only at the edge.
- **The primitives are the right ones.** `signedMain`, `viewerShare`,
  `buildBalanceSweep`, `getDatesForPeriod`, `foldCategoryId` are well-factored,
  pure, and tested.

**Where the funnel breaks down:**

1. **The pipeline is copy-pasted, not shared (the root issue).**
   The exact sequence *sweep → convert → scope → bucket → trim* is hand-written in
   at least five places: `useOverviewStats`, `computeSeries`, `cardData`,
   `getDetailYears`, and `utils/stats.ts`. They reuse the *primitives* but not the
   *pipeline*. This is why the recent "leading viewer-empty dates" bug had to be
   fixed in **three separate files** — the trim step isn't a stage in a funnel,
   it's duplicated logic. Any new rule (a new filter, a new exclusion) faces the
   same three-to-five-site edit, and the sites can drift (e.g. `computeSeries`
   trims on `viewerHasData`, `useOverviewStats` trims on `hasAny`+`bucketFirstSeen`
   — same intent, two different implementations).

2. **There is no single "what am I looking at" object.**
   The four filter inputs live in three mechanisms (viewer/view in Zustand,
   period/account in the URL, active implicitly). No page receives a `FilterSpec`;
   each one re-reads and re-derives the same things in its body. Adding a filter
   (by tag, by currency, by account-group) means editing every page.

3. **Viewer scoping isn't a discrete stage.**
   Because it lives inside `signedMain`, every aggregation must *separately*
   re-derive `viewerShare(...) > 0` next to the money math to know whether a date
   "counts" for the viewer. That parallel derivation is exactly the duplication
   that produced the empty-dates bug.

4. **Equity (stock options) flows outside the account pipeline.**
   It is appended after the account loop in every aggregator, each re-doing its own
   `ownerVisibleToViewer` check and per-currency conversion. `useOverviewStats`
   alone handles it in three branches (category/group/person). It should be one
   more "valued contributor" inside the same pipeline, not a parallel path.

**Verdict:** the *order* of operations is correct and consistent (viewer/active →
period → aggregate → format). The problem is purely **structural** — the funnel is
an unwritten convention re-typed per page, so it can't be extended or fixed in one
place. The fix is not new behaviour; it's giving the funnel a name and a home.

---

## 3. Target pattern — a distinct data layer (`src/core/`)

Introduce one explicit selection pipeline between the query layer (1) and the
view layer. Pages stop aggregating; they pass a **FilterSpec** in and read a
**Dataset** out, then format it.

```
        raw models (accounts, snapshots, fx, options, people)
                              │
                              ▼
   ┌──────────────────────────────────────────────────────────┐
   │  buildDataset(models, spec): Dataset      (pure, memoized) │
   │                                                            │
   │  [1] resolveFilterSpec  FilterSpec { viewer, period,       │
   │                          accountId?, view, includeInactive}│
   │  [2] scope        accounts ∩ viewer ∩ active  → Scoped     │
   │  [3] timebase     datesSorted → filteredDates (period)     │
   │  [4] value        for each ValuedContributor, per date:    │
   │                     contribute(date, ctx) → Contribution[] │
   │  [5] bucketize    BucketStrategy(spec.view) groups them    │
   │  [6] trim         drop leading viewer-empty dates  (ONCE)  │
   └──────────────────────────────────────────────────────────┘
                              │  Dataset
                              ▼
        page hook (thin adapter) → picks a slice → fmt*/priv*
```

Two of those stages are **extension points**, not fixed code: stage [4] iterates a
list of **`ValuedContributor`s** (a new asset type plugs in here), and stage [5]
delegates to a **`BucketStrategy`** chosen by `spec.view` (a new way of grouping
plugs in here). Everything else — scoping, timebase, trim, format — is written
once and never touched again. These two seams are what the rest of this section
is about; they are the reason a new feature *implements* rather than *rebuilds*.

### Seam 1 — `ValuedContributor` (the key to "implement, don't rebuild")

Everything that contributes value to net worth — cash/investment/real-estate
account snapshots today, stock-option equity today, **and whatever you add next
(crypto, pensions, a manual asset, a live API price feed)** — implements one
interface. The pipeline doesn't know or care which kind it is; it just asks each
contributor for its signed, main-currency values on a given date.

```ts
/** A signed, main-currency amount tagged so any BucketStrategy can group it. */
interface Contribution {
  amount: number;            // already converted to main currency + signed (debt < 0)
  category: string;          // folded category id, e.g. 'investments' | 'equity'
  ownerId?: string;          // for person view / viewer attribution
  share: number;             // viewer's share of this contribution (0 trims the date)
  tags?: string[];           // for group/tag matching
  sourceId: string;          // account id, company id, … (debugging / drill-down)
}

interface ValueContext {
  date: string;              // the snapshot date being valued
  equityDate: string;        // date to value time-vesting assets at (often `today`)
  viewer: string;
  main: Currency;
  fxRate: number | null;     // resolved once per date by the pipeline
}

interface ValuedContributor {
  /** Stable id, for memo keys and feature flags. */
  readonly id: string;
  /** Cheap gate so disabled features cost nothing (e.g. stock_options flag off). */
  isEnabled(spec: FilterSpec): boolean;
  /** Everything this contributor is worth on `ctx.date`, already scoped + converted. */
  contribute(ctx: ValueContext): Contribution[];
}
```

A contributor is constructed from the raw models it needs and closes over them:

```ts
makeAccountContributor(accounts, snapshots)   // the snapshot/LOCF path
makeEquityContributor(companies, grants, fmv, exercises)   // stock options
// later, with ZERO changes to buildDataset, scope, bucketize, trim, or format:
makeCryptoContributor(holdings, priceFeed)
makePensionContributor(pensions)
```

`buildDataset` takes the list, and stage [4] becomes a single uniform loop —
no more `if (view === 'category') … else if (view === 'person') …` equity
branches copy-pasted three times:

```ts
for (const c of contributors.filter(c => c.isEnabled(spec))) {
  for (const contribution of c.contribute(ctx)) { /* accumulate */ }
}
```

**This is the seam you liked:** adding an asset class is "write a
`ValuedContributor`, register it" — the funnel, the viewer trim, the FX, the
formatting, and every page that renders a `Dataset` get the new value for free.
Critically, `share` and `category`/`tags`/`ownerId` are part of the
`Contribution`, so viewer-scoping and bucketing apply to new contributors
automatically — the empty-dates trim and the category/group/person cards "just
work" for crypto the day you add it.

### Seam 2 — `BucketStrategy` (how contributions are grouped)

The `category | group | person` toggle is real polymorphism, not a flag. Make it
an interface so each grouping is self-contained and a fourth view is additive:

```ts
interface BucketStrategy {
  /** Stable bucket definitions for this view (drives series + legend order). */
  buckets(models: Models, spec: FilterSpec): BucketDef[];
  /** Which bucket(s) a contribution belongs to, and with what amount. */
  assign(contribution: Contribution, buckets: BucketDef[]): { bucketKey: string; amount: number }[];
}

const STRATEGIES: Record<FilterSpec['view'], BucketStrategy> = {
  category: categoryStrategy,   // foldCategoryId match; equity is its own bucket
  group:    groupStrategy,      // tag-filter match; equity rolls into matching groups
  person:   personStrategy,     // per-owner share; equity → its single owner
};
```

Stage [5] is then just `STRATEGIES[spec.view]` — the three tangled branches in
`useOverviewStats` collapse into three small, separately testable files.

### `FilterSpec` — the single source of truth for "what am I looking at"

```ts
interface FilterSpec {
  viewer: string;                 // person id | HOUSEHOLD_VIEWER
  period: Period;                 // 'all' | 'ytd' | '1y' | …
  view: 'category' | 'group' | 'person';
  accountId?: string;             // drill-down (History/Detail)
  includeInactive?: boolean;
  // ← new filters land here: tag?, currency?, groupId? …
}
```

Resolved once (`resolveFilterSpec(searchParams, uiStore)`), so the Zustand-vs-URL
split becomes an implementation detail of one function instead of leaking into
every page.

**`Dataset`** — the normalized, viewer-scoped, filtered, time-aligned result every
page consumes:

```ts
interface Dataset {
  dates: string[];                       // already trimmed
  net: (number | null)[];
  buckets: BucketSeries[];               // category | group | person
  byCategory: Record<string, number>;    // latest
  prevByCategory: Record<string, number> | null;
  latest: number; prev: number | null;
  groupStats: …; personStats: …;
}
```

**Suggested files** (primitives stay where they are; the pipeline composes them):

| File | Responsibility |
|------|----------------|
| `src/core/filters.ts` | `FilterSpec` + `resolveFilterSpec()` |
| `src/core/scope.ts`   | viewer ∩ active ∩ account scoping (stage 2) |
| `src/core/contributors/` | **Seam 1.** `ValuedContributor` type + one file per source: `accountContributor.ts`, `equityContributor.ts`, … each new asset type is a new file here |
| `src/core/buckets/` | **Seam 2.** `BucketStrategy` type + `category.ts`, `group.ts`, `person.ts` |
| `src/core/dataset.ts` | `buildDataset()` — composes scope → timebase → contributors → strategy → trim; owns the `Dataset` type |
| `utils/currency.ts`, `utils/ownership.ts`, `utils/stats.ts` | unchanged — contributors call these |

`useOverviewStats`, `HistoryPage`, and `DetailPage` each shrink to: build a
`FilterSpec`, call `buildDataset`, read the slice they render, format at the edge.

### Why this makes expansion cheap

The two seams turn the three most common kinds of change into *additive* work —
a new file that implements an interface, with no edits to the pipeline or pages:

| You want to add… | You write… | You do **not** touch |
|------------------|-----------|----------------------|
| A new asset type (crypto, pension, manual asset) | one `ValuedContributor` | scope, timebase, trim, buckets, format, any page |
| A new way to group (e.g. "by institution") | one `BucketStrategy` + a `view` value | contributors, valuation, trim, format |
| A new filter (by tag, currency, account) | one `FilterSpec` field + the stage that reads it | contributors, strategies, pages |
| A new screen | consume an existing `Dataset` slice | aggregation (none to write) |

And the cross-cutting wins come for free because they live in the shared stages:

- **Viewer-empty trim** — fixed once at stage 6; every contributor (incl. future
  ones) inherits it, because `share` is part of each `Contribution`.
- **FX + debt sign** — resolved once per date in `ValueContext` / inside each
  contributor's `contribute`, never re-derived per page.
- **Testability** — `buildDataset(models, spec)` is pure; contributors and
  strategies are unit-tested in isolation against tiny fixtures.

> **Honest boundary:** this pipeline is the *net-worth-over-time* engine. Features
> that aren't a slice of that cube — forecasting, goals, raw transaction/cashflow
> ledgers, what-if scenarios — should **not** be forced through `buildDataset`.
> They get their own selector alongside it (and may reuse `ValuedContributor`s as
> inputs). Keeping that line explicit is what stops `buildDataset` from rotting
> into a god-function.

### Suggested sequencing (incremental, low-risk — for later, if you choose)

1. Extract `FilterSpec` + `resolveFilterSpec` (pure rename of existing reads).
2. Extract `scope.ts` and route the three pages through it.
3. Define `ValuedContributor` + `Contribution`; wrap **today's** logic as
   `accountContributor` and `equityContributor` (behaviour-identical, just moved).
4. Define `BucketStrategy`; lift the category/group/person branches out of
   `useOverviewStats` into three strategy files.
5. Land `buildDataset` composing 2–4; migrate **Overview** first (largest
   aggregator), verify numbers match, then History and Detail.
6. Delete the now-dead per-page loops; the empty-dates trim collapses to one site.

Each step is independently shippable and behaviour-preserving. After step 3 you
can already prove the seam by adding a throwaway `makeManualAssetContributor` and
watching it appear in every chart and card with no other change.

---

## Appendix — current file map

| Stage | Files |
|-------|-------|
| Persistence | `datasource/{types,sheets,xlsx,parse}.ts`, `api/*` |
| Fetch/cache | `queries/sheetQueries.ts`, `queries/keys.ts`, `hooks/useSheetData.ts` |
| Working sets | `utils/dates.ts` (`getDatesForPeriod`, `deriveDatesSorted`), `utils/balance.ts` (`activeAccounts`), `utils/ownership.ts` (`accountsVisibleToViewer`) |
| Aggregate | `utils/stats.ts`, `pages/overview/hooks/useOverviewStats.ts`, `pages/history/HistoryPage.tsx`, `pages/detail/DetailPage.tsx` |
| Money math | `utils/currency.ts` (`signedMain`, `toMain`, `rateFor`) |
| Scoping primitives | `utils/ownership.ts` (`viewerShare`, `shareFor`, `ownerVisibleToViewer`) |
| Present | `utils/format.ts`, `utils/privacy.ts`, `components/ChartTooltip.tsx` |
| Filter state | `stores/ui.store.ts` (viewer/view), URL params (period/account) |
</content>
</invoke>
