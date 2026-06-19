# Data-layer migration plan

How we move from the per-page aggregation funnel (described in
[`ARCHITECTURE.md`](ARCHITECTURE.md) §2) to the `src/core/` data layer
(§3) **without regressions**, and with the new code tested well enough that future
contributors/filters are cheap and safe to add.

## Guardrails

1. **Every phase is independently shippable and behaviour-preserving.** Numbers on
   screen do not change until we deliberately decide they should (the only
   intended visible change is *optionally* richer x-axis points from equity
   vesting days — gated behind its own phase and test).
2. **The old code stays until the new code is proven equal.** `buildDataset` lands
   *alongside* the existing aggregators; pages switch one at a time; the dead code
   is deleted only in the final phase.
3. **Two kinds of test, both required:**
   - **Regression / characterization** — pin *today's* output so the refactor
     can't drift it.
   - **Specification** — assert the *new* model's contracts (per-owner split,
     day-granular axis, carry-in, single-site trim) so future changes stay honest.
4. **CI gate unchanged and green at every phase:** `lint` → `typecheck` →
   `vitest` (unit) → `playwright` (e2e), per `.github/workflows/deploy.yml`.

---

## Testing strategy

### A. Golden master (the safety net) — built in Phase 0, before any refactor

The aggregators are (or can trivially be) pure, so we can freeze their current
output against one rich fixture and assert equality through every later phase.

- **Shared fixture** `src/tests/fixtures/portfolio.ts` — one realistic dataset
  exercising every edge the model must preserve:
  - 2 people; a **50/50 joint** account; a **single-owner** account
  - a **USD** account (FX conversion) and a **debt** (negative sign)
  - **stock options**: 1 company, a grant with a cliff + monthly vesting, an FMV
    change, and a partial exercise
  - dates where the **current viewer holds nothing yet** (leading-empty-date trim)
  - at least one **period boundary** with last data *before* the window (carry-in)
- **Golden tests** capture current results of:
  - `useOverviewStats` via `renderHook` → `netData`, `chartDates`, `byCategory`,
    `prevByCategory`, `bucketData` for category / group / person views
  - `computeSeries` (extends existing `historySeries.test.ts`)
  - `HistoryPage` card data (net / investments / real-estate / debts per month)
  - `getDetailYears` + Detail cell values (YoY table)
- **e2e characterization** — **already provided** by the existing suite, which
  loads `sample.xlsx` and pins exact end-to-end numbers: `viewer-select.spec.ts`
  asserts the hero net worth and Investments/Cash card values across Me / Partner
  / Household ($208,500 / $147,500 / $356,000) and the History card sync, and
  `person-view`, `options`, `migration`, `people`, `xlsx` cover the rest. These
  stay green through every phase as the end-to-end net — no new baseline spec is
  needed (adding one would duplicate `viewer-select`). The new **unit goldens**
  carry the cases the e2e fixture lacks: FX conversion, equity vesting, and the
  leading viewer-empty trim.

These goldens are the contract Phases 3–7 must satisfy. When a phase intends to
change a number, we update the golden in *that* phase's commit with a note.

### B. Per-module specification tests — added with each new module

Each `src/core/` unit ships with focused tests against tiny hand-built fixtures
(not the big golden one), so failures point at one concept.

### C. Regression-vs-new matrix

| Invariant | Kind | Where tested |
|-----------|------|--------------|
| Hero net worth & card values unchanged | regression | Phase 0 golden + e2e |
| Chart series values unchanged | regression | Phase 0 golden |
| YoY Detail table unchanged | regression | Phase 0 golden |
| History cards unchanged | regression | Phase 0 golden |
| Joint account splits into per-owner contributions summing to the whole | spec | Phase 3 |
| Household = Σ owners; viewer = own slice; person view groups by owner | spec | Phase 3 + 6 |
| LOCF carry-forward + carry-in at period start | spec | Phase 3 |
| Equity vesting lands on **exact day**, not month-snapped | spec | Phase 4 |
| Equity FMV LOCF, exercise step-down, owner visibility, currency | spec | Phase 4 |
| `equityDate` (today) vs series-date divergence for the current scalar | spec | Phase 4 + 6 |
| Leading viewer-empty dates trimmed in exactly **one** place | spec | Phase 6 |
| Disabled feature (`isEnabled=false`) contributes nothing / costs nothing | spec | Phase 4 + 6 |
| A brand-new contributor auto-appears in every view with no pipeline edit | spec | Phase 6 (proof) |

---

## Phases

### Phase 0 — Safety net (no production code change) ✅ done
- Added `src/tests/fixtures/portfolio.ts` — the rich shared fixture.
- Added `src/tests/golden/overviewStats.golden.test.ts` (inline snapshots,
  category/group/person × self/partner/household) and
  `src/tests/golden/series.golden.test.ts` (`computeSeries`, `computeDateStats`,
  and a Detail YoY grid; external `.snap`).
- e2e baseline already covered by `e2e/viewer-select.spec.ts` (exact amounts) — no
  new spec added.
- **Exit:** ✅ goldens pass against current code; full suite 281 tests green;
  typecheck + lint clean. Pure-test commit.

### Phase 1 — `FilterSpec` + `scope` (pure extraction) ✅ done
- `src/core/filters.ts`: `FilterSpec` + `resolveFilterSpec(params, inputs)` —
  consolidates the period default, the `account` drill-down read, and the
  "By person" → category fallback that was duplicated in `OverviewPage`.
- `src/core/scope.ts`: `activeVisibleAccounts(accounts, viewer)` and
  `isViewerLockedOut(accounts, viewer)` — the active∩visible display set and the
  viewer empty-state predicate, previously copy-pasted across History/Detail.
  (Aggregator inputs are deliberately untouched: viewer scoping still happens
  inside `signedMain` and unifies onto contributors in Phase 6/7 — pre-filtering
  Overview/History now would change household/person results.)
- Routed Overview/History/Detail through both.
- **Tests:** `src/tests/filters.test.ts` (defaults, URL reads, person→category
  fallback, includeInactive) and `src/tests/scope.test.ts` (active/inactive,
  per-person, household, locked-out predicate).
- **Exit:** ✅ behaviour identical — goldens unchanged, full suite 295 green,
  typecheck + lint clean.

### Phase 2 — Contributor types + axis builder ✅ done
- `src/core/contributors/types.ts`: `Contribution` (date-less per-owner sample),
  `ValueContext` (viewer/main/`fxRateFor`/`equityDate`), `DateRange`, and the
  `ValuedContributor` two-question interface (`checkpointDates` + `valuesOver`).
- `src/core/axis.ts`: `periodRange(period, datesSorted)` → `{start?, end}`;
  `mergeAxis(dateLists)` → sorted/deduped/day-level; `buildAxis(contributors,
  spec, range)` merges only enabled contributors' checkpoints.
- **Tests:** `src/tests/axis.test.ts` — periodRange windows; **range filtering
  reproduces `getDatesForPeriod` for every period** (no time-window drift);
  mergeAxis dedupe/sort; buildAxis respects `isEnabled`.
- **Exit:** ✅ types + axis exist, unused by prod; suite 304 green, typecheck +
  lint clean.

### Phase 3 — `accountContributor` (wrap today's math, per-owner) ✅ done
- `src/core/contributors/accountContributor.ts`:
  - `checkpointDates(range)` = snapshot dates within range (sorted, deduped,
    `__day__` excluded).
  - `valuesOver(axis, ctx)` = `buildBalanceSweep` LOCF (carry-in seeded), emitting
    **one `Contribution` per owner** (amount = that owner's converted/signed slice,
    raw category preserved).
- **Tests (spec):** carry-in into a late axis start; joint → 2 contributions
  summing to the whole; debt negative; USD→main via `ctx.fxRateFor`; raw
  `real_estate_debt` kept; orphan snapshots skipped.
- **Tests (cross-check):** `valuesOver` net per viewer == `computeNetWorthFrom
  Snapshots` at every date, and folded category sums == `computeDateStats`, for
  self / partner / household.
- **Exit:** ✅ account valuation provably equals legacy; suite 318 green;
  goldens untouched; still unused by pages.

### Phase 4 — `equityContributor` (vesting, exact days, `equityDate`) ✅ done
- `src/core/contributors/equityContributor.ts`:
  - `isEnabled()` = has an active company (config-flag gating stays at construction
    time in Phase 6, matching today's OverviewPage).
  - `checkpointDates(range)` = **exact** vesting-step days (cliff, each interval
    boundary, full vest — via `addMonths`, day-of-month preserved) ∪ FMV ∪ exercise
    days; explicitly **not** `generateMonthlyDates`.
  - `valuesOver(axis, ctx)` = `computeCompanyEquityValue` per company at
    `ctx.equityDate ?? date`, single owner, converted at that date's rate. No wall
    clock read — the as-of date is injected.
- **Tests:** exact day-of-month checkpoints (mid-month grant, no `-01` snap);
  one-per-owner; `equityDate` override vs axis date; partner (non-owner) sees 0;
  disabled when no active companies. Cross-check: equity total per viewer ==
  `computeDateStats` equity bucket at every date.
- **Exit:** ✅ equity valuation provably equals legacy; suite 328 green.

### Phase 5 — `BucketStrategy` (category / group / person) ✅ done
- `src/core/buckets/{types,category,group,person,index}.ts` — each a factory →
  `{ buckets, assign(contribution) }`. Equity per view: own bucket (category) /
  tag-match (group) / by `ownerId` (person). `bucketStrategy(view, models)`
  dispatches; `personColor` + palette moved here from `useOverviewStats`.
- **Tests:** `src/tests/buckets.test.ts` — bucket order incl. equity-when-present,
  `real_estate_debt` fold, equity routing/drop, multi-group tag match, person
  by-owner + unknown-owner drop, selector dispatch.
- **Exit:** ✅ grouping logic isolated + unit-tested; suite 338 green;
  `useOverviewStats` not yet changed.

### Phase 6 — `buildDataset` + migrate Overview (the proof) ✅ done
- `src/core/dataset.ts`: `buildDataset(input)` composes value (all enabled
  contributors) → scope → bucketize via `bucketStrategy(view)` → **trim (single
  site)**, plus the latest/prev scalars (net, byCategory, group/person values);
  owns `Dataset`. `today` is injected (no wall-clock read in the engine).
- `useOverviewStats` rewritten as a thin adapter: build contributors, call
  `buildDataset`, shape into `OverviewStats`. `OverviewPage` untouched. The
  duplicated `foldedStatsFor`/`groupStatsFor` loops and the local person palette
  are gone (palette now in `buckets/person`).
- Two legacy quirks reproduced for byte-identical output, each documented in
  `dataset.ts`: zero-seeding `byCategory` for owned-zero categories (card
  visibility), and viewer-independent bucket `firstSeen` for accounts vs
  viewer-dependent for equity (leading-null on empty-for-you category lines).
- **Tests:** Phase 0 Overview goldens pass **byte-for-byte**; `src/tests/dataset.
  test.ts` — trim, household = Σ persons, buckets partition net, **extensibility
  proof** (a test-only `manualAssetContributor` flows into net + the cash bucket
  + byCategory with no pipeline edit; disabled ⇒ no effect).
- **Exit:** ✅ Overview runs entirely on the new layer; goldens unchanged; suite
  344 green; typecheck + lint clean. (e2e exact-amount specs run in CI on
  `sample.xlsx`; account math is golden-verified.)

### Phase 7 — Accounts domain: History + Detail selectors 🔄 in progress
Move all Accounts-domain data computation out of the components into
`src/core/accounts/` (the domain that owns `accountContributor`).
- ✅ History chart: `computeSeries` now values via `accountContributor`.
- History card model (`cardData`) → a `core/accounts` selector; valuation via the
  contributor (add `kind` to `Contribution` for the debt line).
- Detail year-over-year (`getDetailYears` + `buildDetailModel`) → a `core/accounts`
  selector; the viewer-empty year filter reuses the shared scope/trim.
- Relocate `accountContributor` under `core/accounts/`; pages become pure views.
- **Tests:** History + Detail goldens pass; new selector unit tests.
- **Exit:** no Accounts data math in a component; trim/scope/value logic shared.

### Phase 8 — Stock Options domain selectors
Move all Stock-Options data computation out of the page components into
`src/core/options/` (the domain that owns `equityContributor`).
- Company value / vesting / summary selectors (vested-unvested shares, vesting
  schedule series, totals) → pure functions reusing `utils/options` +
  `equityContributor`.
- Refactor `OptionsPage` + chart components to consume them and render only.
- Relocate `equityContributor` under `core/options/`.
- **Tests:** options selector unit tests; existing `options.spec.ts` e2e green.
- **Exit:** no Stock-Options data math in a component; both domains fully layered.

---

## Sequencing notes

- Phases 0–2 carry near-zero risk (tests + types + pure helpers). Phases 3, 4, 6
  are the numeric ones — gated by cross-check + golden tests.
- After Phase 6 the net-worth engine is proven. Phases 7–8 are the domain split:
  every page becomes a pure view over a `src/core/<domain>` selector, guarded by
  the goldens and the e2e suite.
- **Target structure:** `core/{filters,scope,axis,buckets,dataset}` (cross-domain
  engine) + `core/contributors/types` (the contract) + `core/accounts/*` +
  `core/options/*` (the two domains).
- **Coverage:** each new `src/core/` module raises the floor — bump the
  thresholds in `vitest.config.ts` as modules land.
- **Still out of scope:** `EntryPage` totals (`utils/entry.ts`) — a data-entry
  form, not a domain detail view. It already shares `utils` primitives; folding it
  into a selector is a later, optional cleanup.
</content>
