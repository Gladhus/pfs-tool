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
- **e2e characterization** (`e2e/networth-baseline.spec.ts`): load `sample.xlsx`,
  snapshot the **hero net-worth string** and a couple of **category card values**.
  This catches any end-to-end drift the unit goldens might miss (formatting,
  wiring).

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

### Phase 0 — Safety net (no production code change)
- Add `src/tests/fixtures/portfolio.ts` and all golden tests above.
- Add `e2e/networth-baseline.spec.ts`.
- **Exit:** goldens pass against *current* code; CI green. This commit is pure test.

### Phase 1 — `FilterSpec` + `scope` (pure extraction)
- `src/core/filters.ts`: `FilterSpec` + `resolveFilterSpec(searchParams, uiState)`
  (consolidates today's scattered Zustand/URL reads).
- `src/core/scope.ts`: `scopeAccounts(accounts, spec)` = `active ∩ visibleToViewer
  (∩ accountId)`, lifting `activeAccounts` / `accountsVisibleToViewer` usage.
- Route Overview/History/Detail through them for their existing inline derivations.
- **Tests:** `resolveFilterSpec` (defaults, URL-vs-store precedence, `person`→
  fallback when not household); `scopeAccounts` (active, viewer slice, household,
  account drill-down). Goldens + e2e unchanged.
- **Exit:** behaviour identical; one source of truth for "what am I looking at".

### Phase 2 — Contributor types + axis builder
- `src/core/contributors/types.ts`: `Contribution`, `ValueContext`,
  `ValuedContributor`.
- `src/core/axis.ts`: `periodRange(spec, datesSorted)` →`{start?, end}`;
  `mergeAxis(contributors, range)` → sorted, deduped, **day-level** date array.
- **Tests:** merge dedupes & sorts; preserves day granularity; `periodRange`
  matches today's `getDatesForPeriod` window; includes `start` boundary for
  carry-in.
- **Exit:** types + axis exist, unused by prod yet.

### Phase 3 — `accountContributor` (wrap today's math, per-owner) ⚠ highest numeric risk
- `src/core/contributors/accountContributor.ts`:
  - `checkpointDates(range)` = snapshot dates within range.
  - `valuesOver(axis, ctx)` = `buildBalanceSweep`-style LOCF, emitting **one
    `Contribution` per owner** (amount = that owner's `signedMain` slice).
- **Tests (spec):** LOCF + carry-in; joint → 2 contributions summing to the whole;
  debt negative; USD→main via `ctx.fxRateFor`; viewer slice.
- **Tests (cross-check):** assert account-only `valuesOver` reproduces
  `computeSeries` / `computeDateStats` numbers on the Phase 0 fixture.
- **Exit:** account valuation provably equals legacy, still unused by pages.

### Phase 4 — `equityContributor` (vesting, exact days, `equityDate`)
- `src/core/contributors/equityContributor.ts`:
  - `isEnabled(spec)` = stock-options flag.
  - `checkpointDates(range)` = **exact** vesting days (`grantFirstVestDate` →
    `grantFullyVestedDate`) ∪ FMV days ∪ exercise days — **not**
    `generateMonthlyDates`.
  - `valuesOver(axis, ctx)` = `computeCompanyEquityValue` per company at the axis
    date (or `ctx.equityDate` for the current scalar), single owner, converted.
- **Tests:** vesting step on exact day; FMV LOCF; exercise step-down; owner
  visibility; currency; `equityDate=today` vs series-date; disabled ⇒ no
  contributions. Cross-check vs `computeCompanyEquityValue`.
- **Exit:** equity valuation provably equals legacy.

### Phase 5 — `BucketStrategy` (category / group / person)
- `src/core/buckets/{types,category,group,person}.ts` — each `buckets()` +
  `assign(contribution)`. Equity per view: own bucket (category) / tag-match
  (group) / by `ownerId` (person).
- **Tests:** each strategy against small contribution fixtures, incl. equity
  attribution and the `real_estate_debt` fold.
- **Exit:** grouping logic isolated and unit-tested; `useOverviewStats` not yet
  changed.

### Phase 6 — `buildDataset` + migrate Overview (the proof) ⚠
- `src/core/dataset.ts`: `buildDataset(models, spec)` composes scope → axis →
  value (all contributors) → bucketize → **trim (single site)**; owns `Dataset`.
- Rewrite `useOverviewStats` to delegate to `buildDataset`, adapting to the
  existing `OverviewStats` shape so `OverviewPage` is untouched.
- **Tests:** Phase 0 Overview goldens must pass byte-for-byte; add `buildDataset`
  specs (net = Σ contributions; prev baseline; trim once; person/household/viewer
  equivalences); **extensibility proof** — register a tiny test-only
  `manualAssetContributor` and assert it appears in net + the right bucket with no
  other change.
- **Exit:** Overview runs entirely on the new layer; goldens + e2e green.

### Phase 7 — migrate History + Detail, delete dead code
- Re-express `computeSeries` and History `cardData` as thin readers over
  `buildDataset` (or a history-shaped projection that reuses the same
  contributors).
- Re-express Detail `getDetailYears` + cells over the shared scope/contributor
  path; the viewer-empty year filter reduces to the shared trim.
- Delete the now-dead per-page loops; collapse the empty-dates trim to the one
  site in `buildDataset`. Decide `utils/stats.ts`'s fate: keep `computeDateStats`
  as a thin single-date wrapper over `buildDataset` **only** if `EntryPage` still
  needs it, else remove.
- **Tests:** History + Detail goldens pass; remove tests pinning deleted internals.
- **Exit:** one funnel, no duplication; `grep` shows the trim/scope/value logic
  exists once.

---

## Sequencing notes

- Phases 0–2 carry near-zero risk (tests + types + pure helpers) and can land
  quickly. Phases 3, 4, 6 are the numeric ones — gated by cross-check + golden
  tests, reviewed carefully.
- After Phase 6 the architecture is proven; Phase 7 is mechanical cleanup that the
  goldens fully protect.
- **Coverage:** each new `src/core/` module raises the floor — bump the
  thresholds in `vitest.config.ts` as modules land so coverage ratchets up rather
  than drifting down.
- **Out of scope (for now):** `EntryPage` totals (`utils/entry.ts`), forecasting,
  goals, and any non-"net-worth-over-time" feature — per the honest boundary in
  `ARCHITECTURE.md`. These may *consume* contributors later but are not part of
  this migration.
</content>
