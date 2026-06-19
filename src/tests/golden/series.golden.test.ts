import { describe, it, expect } from 'vitest';
import { computeSeries } from '@/pages/history/HistoryPage';
import { computeDateStats, buildEffectiveBalances } from '@/utils/stats';
import { activeAccounts } from '@/utils/balance';
import { signedMain, rateFor } from '@/utils/currency';
import { accountsVisibleToViewer, HOUSEHOLD_VIEWER } from '@/utils/ownership';
import {
  ACCOUNTS, SNAPSHOTS, DATES_SORTED, FX_MAP, MAIN, OPTION_DATA,
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
