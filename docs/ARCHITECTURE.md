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
   │  [3] axis     each contributor.checkpointDates(range) →    │
   │                 merge + dedupe → shared day-level timeline │
   │  [4] value    each contributor.valuesOver(timeline) →      │
   │                 Contribution[] per date (owns carry-fwd)   │
   │  [5] bucketize  BucketStrategy(spec.view) groups them      │
   │  [6] trim       drop leading viewer-empty dates  (ONCE)    │
   └──────────────────────────────────────────────────────────┘
                              │  Dataset
                              ▼
        page hook (thin adapter) → picks a slice → fmt*/priv*
```

Two of those stages are **extension points**, not fixed code: stages [3]+[4]
iterate a list of **`ValuedContributor`s** (a new asset type plugs in here), and
stage [5] delegates to a **`BucketStrategy`** chosen by `spec.view` (a new way of
grouping plugs in here). Everything else — scoping, axis-merge, trim, format — is
written once and never touched again. These two seams are what the rest of this
section is about; they are the reason a new feature *implements* rather than
*rebuilds*. Note that valuation is **two passes**: first collect every
contributor's dates and merge them into one axis, then value every contributor on
that merged axis (see "two questions" below).

### Seam 1 — `ValuedContributor` (the key to "implement, don't rebuild")

Everything that contributes value to net worth — account snapshots and
stock-option equity today, **and whatever you add next (crypto, pensions, a manual
asset, a live price feed)** — implements one interface. The pipeline never learns
which kind it is; it asks each contributor **two questions** and merges the
answers:

- **Q1 — which dates do you put on the timeline?**
- **Q2 — what are you worth on each date of the merged timeline?**

```ts
interface ValuedContributor {
  readonly id: string;
  /** Cheap gate so disabled features cost nothing (e.g. stock_options flag off). */
  isEnabled(spec: FilterSpec): boolean;

  /** Q1 — the day-level dates I change on, within the period window. Merged with
      every other contributor's dates into one shared axis. May return [] for a
      pure sampler (e.g. a daily price feed) that just rides whatever axis others
      define. */
  checkpointDates(range: { start?: string; end: string }): string[];

  /** Q2 — my value at each date of the FINAL merged axis. I own my own
      carry-forward (accounts = LOCF; equity = vesting step) and seed from the
      last data point <= axis[0], so period boundaries carry in correctly. */
  valuesOver(axis: string[], ctx: ValueContext): Contribution[][];   // [dateIndex][contribution]
}
```

**Why two questions, not one "give me everything in this range."** Net worth on
day D is the sum of *every* contributor valued on D, so all series must share one
x-axis. But account-entry days and vesting days don't line up. So it's two
passes: first collect everyone's dates and **merge** them; then value everyone on
the merged set, each contributor **carrying its last value forward** onto dates it
has no native point for.

```
Accounts entered:  Mar-14         Jun-02
Equity vests:           Apr-15  May-15
Merged axis:       Mar-14 Apr-15 May-15 Jun-02      ← union of both, day-level
  accounts →        100    100    100    120         (LOCF between entries)
  equity   →         20     35     45     45         (step; carries onto Jun-02)
  net      →        120    135    145    165         (sum each column)
```

Neither source had a point on every day; the merged axis plus per-contributor
carry-forward reconciles them. To your "send a delta" instinct: the `range` is
how the *axis* (Q1) gets proposed; valuation (Q2) then runs on the *merged* axis,
because a contributor must answer for the *other* contributors' dates too.

**Day granularity, on purpose.** Every date is a full `YYYY-MM-DD` — snapshot
days, and equity's exact vesting / FMV / exercise days. Equity vesting *amounts*
step monthly internally, but each step lands on a real calendar day
(`grantFirstVestDate` / `grantFullyVestedDate` already return full dates), so the
equity contributor derives **exact vesting days** for `checkpointDates`. Do *not*
reuse `generateMonthlyDates` (it snaps to the 1st of the month — that's only for
the vesting chart's sampling and would quietly drop equity to month precision).

**A `Contribution` is a *sample*, not an *event* — so it carries no date.** The
date is the axis position the pipeline asked about, not data on the row:

```ts
interface Contribution {
  amount: number;        // THIS owner's slice, converted to main currency + signed (debt < 0)
  category: string;      // folded category id, e.g. 'investments' | 'equity'
  ownerId: string;       // single owner (see per-owner note below)
  tags?: string[];       // for group / tag matching
  sourceId: string;      // account id / company id (drill-down + memo keys)
}

interface ValueContext {
  viewer: string;
  main: Currency;
  fxRateFor: (date: string) => number | null;  // pipeline resolves per axis date
  equityDate?: string;   // value time-vesting assets here for the "current" scalar
                         // (≈ today); along the series each axis date is used
}
```

A contributor is built from the raw models it needs and closes over them:

```ts
makeAccountContributor(accounts, snapshots)                 // snapshot / LOCF path
makeEquityContributor(companies, grants, fmv, exercises)    // stock options
// later — with ZERO changes to buildDataset, scope, buckets, trim, or format:
makeCryptoContributor(holdings, priceFeed)
makePensionContributor(pensions)
```

**Per-owner contributions — the refinement that dissolves `share` *and* the
empty-dates bug.** Accounts can have *fractional, multiple* owners; equity has a
*single* owner. Instead of a `share` multiplier, a contributor emits **one
`Contribution` per owner**, each already carrying that owner's sliced amount:

- a 50/50 joint account → **two** contributions: (`self`, half) and (`partner`, half)
- an equity grant → **one** contribution (the single-owner case)

Then every downstream concern collapses to "group by `ownerId`":

| Question | How it's answered |
|----------|-------------------|
| Household total | sum all owner-contributions |
| Viewing as one person | keep `ownerId === viewer` |
| Person-view buckets | group by `ownerId` |
| "Does this day count for the viewer?" (trim) | any surviving contribution after the viewer filter |

This removes the separate `share` field **and** the parallel `viewerShare(...) > 0`
check that caused the original leading-empty-dates bug. **This is the seam you
liked:** adding an asset class is "write a `ValuedContributor`, register it" — the
axis merge, carry-forward, FX, viewer scoping, trim, bucketing, and every page
that renders a `Dataset` get the new value for free.

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
  ones) inherits it, because viewer scoping is just filtering contributions by
  `ownerId`.
- **FX + debt sign** — applied inside each contributor's `valuesOver` via
  `ctx.fxRateFor(date)`, never re-derived per page.
- **Testability** — `buildDataset(models, spec)` is pure; contributors
  (`checkpointDates` + `valuesOver`) and strategies are unit-tested in isolation
  against tiny fixtures.

### The governing principle: data layer owns data, views render

`src/core/` is **the data layer** — it owns *all* data computation. Pages and
components are the **view layer**: they call a selector and render its output, with
no aggregation, valuation, or scoping of their own. **No data logic in a
component** is the invariant that holds everywhere.

The layer is organized by **domain**. A domain is a kind of financial thing the
app tracks; today there are two: **Accounts** and **Stock Options**. Each domain
owns two things:

1. **A `ValuedContributor`** — how the domain contributes to net worth (its Tier-1
   interface into the engine).
2. **Detail selectors** — pure functions for the domain's own pages, exposing
   shapes the net-worth `Dataset` can't.

| Domain | Contributor (→ net worth) | Detail selectors (its pages) |
|--------|---------------------------|------------------------------|
| **Accounts** | `accountContributor` | History (chart + card model), Detail (year-over-year) |
| **Stock Options** | `equityContributor` | Options (vested/unvested shares, vesting schedule, summary) |

**Overview is not a domain** — it's the **cross-domain roll-up**: `buildDataset`
combines every domain's contributor into one net-worth view. That's the only place
the domains meet (History/Detail use accounts only; the Options page uses equity
only; Overview uses both).

```
src/core/
  filters · scope · axis · buckets · dataset   ← cross-domain net-worth engine
  contributors/types                            ← the ValuedContributor contract
  accounts/   contributor + history + detail    ← Accounts domain
  options/    contributor + vesting + summary   ← Stock Options domain
```

> **Why a domain owns both halves:** the Options page needs "504 vested / 396
> unvested shares," which is not a net-worth slice — so it lives in the Stock
> Options domain's detail selectors, beside the `equityContributor` that feeds
> Overview. Same math (`utils/options`), two shapes. A future domain (crypto,
> pensions, a cashflow ledger) is added the same way: one contributor + its own
> detail selectors, never a branch inside `buildDataset`.

### Migration

The transition is broken into independently shippable, behaviour-preserving
phases, each with its own unit + e2e coverage. The full plan — phases, file-level
tasks, the regression-vs-new-behaviour test matrix, and the characterization
"golden master" strategy — lives in **[`data-layer-migration.md`](data-layer-migration.md)**.

The one-line shape: extract `FilterSpec`/`scope` → land the `ValuedContributor`
two-phase axis (`checkpointDates` + `valuesOver`) wrapping today's account/equity
math behaviour-identically → lift category/group/person into `BucketStrategy` →
compose `buildDataset` and migrate Overview, then History, then Detail → delete
the dead per-page loops (the empty-dates trim collapses to one site).

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
