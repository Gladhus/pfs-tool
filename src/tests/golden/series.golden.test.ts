import { describe, it, expect } from 'vitest';
import { computeSeries, buildHistoryCards } from '@/core/accounts/history';
import { getDetailYears, buildDetailModel } from '@/core/accounts/detail';
import { computeDateStats, buildEffectiveBalances } from '@/utils/stats';
import { activeAccounts } from '@/utils/balance';
import { signedMain, rateFor } from '@/utils/currency';
import { accountsVisibleToViewer, HOUSEHOLD_VIEWER } from '@/utils/ownership';
import {
  ACCOUNTS, SNAPSHOTS, DATES_SORTED, FX_MAP, MAIN, CATEGORY_META, OPTION_DATA,
} from '../fixtures/portfolio';

/**
 * GOLDEN MASTER for the pure aggregation paths that back the History chart and the
 * Detail year-over-year table. Frozen (external `.snap`) so the `src/core/`
 * migration must reproduce them. Re-bless with `vitest -u` only on intended
 * changes. External snapshots (not inline) because these cases run in loops, which
 * inline snapshots can't address individually.
 */

const active = activeAccounts(ACCOUNTS);
const VIEWERS = ['self', 'partner', HOUSEHOLD_VIEWER];

describe('GOLDEN computeSeries (History chart)', () => {
  for (const viewer of VIEWERS) {
    it(`viewer = ${viewer}`, () => {
      expect(computeSeries(DATES_SORTED, active, SNAPSHOTS, MAIN, FX_MAP, viewer)).toMatchSnapshot();
    });
  }
});

describe('GOLDEN buildHistoryCards (History card list)', () => {
  for (const viewer of VIEWERS) {
    it(`viewer = ${viewer}`, () => {
      expect(buildHistoryCards(DATES_SORTED, ACCOUNTS, SNAPSHOTS, MAIN, FX_MAP, viewer)).toMatchSnapshot();
    });
  }
});

describe('GOLDEN computeDateStats (net worth + byCategory at latest date)', () => {
  // `today` (equityDate) is fixed so vesting valuation is deterministic.
  const TODAY = '2024-06-01';
  const date = DATES_SORTED[DATES_SORTED.length - 1];
  for (const viewer of VIEWERS) {
    it(`viewer = ${viewer}`, () => {
      expect(computeDateStats(SNAPSHOTS, ACCOUNTS, date, MAIN, FX_MAP, OPTION_DATA, TODAY, viewer))
        .toMatchSnapshot();
    });
  }
});

// Mirrors the Detail page's per-account, per-year signed values (the YoY grid)
// without rendering: effective balance at each year-start, signed for the viewer.
describe('GOLDEN Detail year-over-year cell values', () => {
  const YEARS = [2021, 2022, 2023, 2024];
  for (const viewer of ['self', HOUSEHOLD_VIEWER]) {
    it(`viewer = ${viewer}`, () => {
      const visible = accountsVisibleToViewer(active, viewer);
      const grid: Record<string, Record<number, number | null>> = {};
      for (const a of visible) {
        grid[a.id] = {};
        for (const y of YEARS) {
          const asOf = `${y}-01-01`;
          const bal = buildEffectiveBalances(SNAPSHOTS, asOf)[a.id];
          grid[a.id][y] = bal !== undefined ? signedMain(a, bal, MAIN, rateFor(FX_MAP, asOf), viewer) : null;
        }
      }
      expect(grid).toMatchSnapshot();
    });
  }
});

// The actual Detail selectors (post-migration): year columns + the full table model.
describe('GOLDEN Detail model (getDetailYears + buildDetailModel)', () => {
  const stubLabels = { net: 'Net worth', total: 'Total', tr: (e: { name_en?: string }) => e.name_en ?? '' };
  for (const viewer of ['self', 'partner', HOUSEHOLD_VIEWER]) {
    it(`viewer = ${viewer}`, () => {
      const visibleIds = new Set(accountsVisibleToViewer(active, viewer).map(a => a.id));
      const years = getDetailYears(SNAPSHOTS, DATES_SORTED, 'all', visibleIds);
      const model = buildDetailModel(SNAPSHOTS, ACCOUNTS, CATEGORY_META, years, MAIN, FX_MAP, viewer, stubLabels);
      expect({ years, model }).toMatchSnapshot();
    });
  }
});
