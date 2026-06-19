import { describe, it, expect } from 'vitest';
import {
  companyEquitySummary, buildVestingSeries, buildCompanyValueSeries,
  buildSummarySeries, equityValueAt, equityTotals,
} from '@/core/options/selectors';
import { computeCompanyEquityValue } from '@/utils/options';
import { toMain, rateFor } from '@/utils/currency';
import {
  OPTION_COMPANIES, OPTION_GRANTS, OPTION_FMV, OPTION_EXERCISES, FX_MAP, MAIN,
} from './fixtures/portfolio';

const company = OPTION_COMPANIES[0];
const args = [OPTION_GRANTS, OPTION_FMV, OPTION_EXERCISES] as const;

describe('companyEquitySummary', () => {
  it('computes vested/unvested shares and values at a date', () => {
    const s = companyEquitySummary(company, ...args, '2024-06-01');
    // 1000 shares, 29 months in at 1000/48 per month, cliff passed.
    expect(s.vestedShares).toBeCloseTo(604.17, 1);
    expect(s.unvestedShares).toBeCloseTo(395.83, 1);
    expect(s.fmvVal).toBe(10);
    // vested intrinsic: (604.17 − 100 exercised) × (10 − 1 strike) = 4537.5 (native USD)
    expect(s.vestedVal).toBeCloseTo(4537.5, 1);
    expect(s.unvestedVal).toBeCloseTo(395.83 * 9, 1);
    expect(s.hasFmvHistory).toBe(true);
  });

  it('reports null values when no FMV is known yet', () => {
    const s = companyEquitySummary(company, ...args, '2021-01-01');
    expect(s.fmvVal).toBeNull();
    expect(s.vestedVal).toBeNull();
  });
});

describe('buildVestingSeries', () => {
  const series = buildVestingSeries(OPTION_GRANTS, '2026-06-01');

  it('produces a monthly date axis with a today marker', () => {
    expect(series.dates.length).toBeGreaterThan(2);
    expect(series.todayDate).toBeTruthy();
  });

  it('accrues vested shares monotonically up to the grant total', () => {
    const g0 = series.grantValues[0];
    for (let i = 1; i < g0.length; i++) expect(g0[i]).toBeGreaterThanOrEqual(g0[i - 1]);
    expect(g0[g0.length - 1]).toBeCloseTo(1000, 5);
  });
});

describe('buildCompanyValueSeries', () => {
  it('yields vested ≤ total at each point, starting at the first FMV', () => {
    const { dates, data } = buildCompanyValueSeries(company, ...args, '2026-06-01');
    expect(dates[0]).toBe('2022-01-01');
    for (const pt of data) {
      if (pt.vested != null && pt.total != null) expect(pt.total).toBeGreaterThanOrEqual(pt.vested);
    }
  });
});

describe('buildSummarySeries', () => {
  it('emits a main-currency value series per shown company', () => {
    const { data, shown } = buildSummarySeries(OPTION_COMPANIES, OPTION_GRANTS, OPTION_FMV, '2026-06-01', null, undefined, MAIN, FX_MAP);
    expect(shown.map(c => c.id)).toEqual(['optco']);
    expect(data.length).toBeGreaterThan(2);
    expect(data[data.length - 1]).toHaveProperty('optco');
  });

  it('drops a company hidden via hiddenIds', () => {
    const { shown } = buildSummarySeries(OPTION_COMPANIES, OPTION_GRANTS, OPTION_FMV, '2026-06-01', null, new Set(['optco']), MAIN, FX_MAP);
    expect(shown).toHaveLength(0);
  });
});

describe('equityValueAt / equityTotals', () => {
  it('matches computeCompanyEquityValue converted to main', () => {
    const got = equityValueAt(OPTION_COMPANIES, ...args, '2024-06-01', 'vested', MAIN, FX_MAP);
    const native = computeCompanyEquityValue('optco', ...args, '2024-06-01');
    expect(got).toBeCloseTo(toMain(native, 'USD', MAIN, rateFor(FX_MAP, '2024-06-01')), 6);
  });

  it('reports totals and a period delta', () => {
    const t = equityTotals(OPTION_COMPANIES, ...args, '2026-06-01', 'all', MAIN, FX_MAP);
    expect(t.totalVested).toBeGreaterThan(0);
    expect(t.totalUnvested).toBeGreaterThanOrEqual(0);
    expect(t.periodStart).toBeTruthy();
    expect(t.delta).not.toBeNull();
  });
});
