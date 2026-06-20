import { describe, it, expect } from 'vitest';
import { makeEquityContributor } from '@/features/options/data/equity.contributor';
import type { ValueContext } from '@/core/contracts';
import { computeDateStats } from '@/shared/utils/stats';
import { rateFor } from '@/shared/utils/currency';
import { HOUSEHOLD_VIEWER } from '@/shared/utils/ownership';
import type { Contribution, OptionGrant } from '@/types/sheets';
import {
  ACCOUNTS, SNAPSHOTS, DATES_SORTED, FX_MAP, MAIN,
  OPTION_COMPANIES, OPTION_GRANTS, OPTION_FMV, OPTION_EXERCISES, OPTION_DATA,
} from './fixtures/portfolio';

const ctx = (equityDate?: string): ValueContext => ({
  viewer: 'self', main: MAIN, fxRateFor: (d: string) => rateFor(FX_MAP, d), equityDate,
});

const equityFor = (cs: Contribution[], viewer: string) =>
  cs.filter(c => viewer === HOUSEHOLD_VIEWER || c.ownerId === viewer)
    .reduce((s, c) => s + c.amount, 0);

const contributor = () => makeEquityContributor(OPTION_COMPANIES, OPTION_GRANTS, OPTION_FMV, OPTION_EXERCISES);

describe('equityContributor.checkpointDates', () => {
  it('includes exact vesting, FMV, and exercise days within range', () => {
    const dates = contributor().checkpointDates({ end: '2026-12-31' });
    expect(dates).toContain('2023-01-01'); // cliff: 2022-01-01 + 12mo
    expect(dates).toContain('2026-01-01'); // fully vested: + 48mo
    expect(dates).toContain('2024-01-01'); // FMV step
    expect(dates).toContain('2024-02-01'); // exercise
    expect(dates).toEqual([...dates].sort());
  });

  it('honours the range bounds', () => {
    const dates = contributor().checkpointDates({ start: '2024-01-01', end: '2024-12-31' });
    expect(dates.every(d => d >= '2024-01-01' && d <= '2024-12-31')).toBe(true);
    expect(dates).not.toContain('2023-01-01');
  });

  it('uses exact day-of-month, not month-snapped (proves it is not generateMonthlyDates)', () => {
    const midMonth: OptionGrant = {
      ...OPTION_GRANTS[0], id: 'gm', vesting_start: '2022-03-15', cliff_months: 0, vesting_months: 12,
    };
    const dates = makeEquityContributor(OPTION_COMPANIES, [midMonth], [], []).checkpointDates({ end: '2099-01-01' });
    expect(dates).toContain('2022-04-15');
    expect(dates).toContain('2023-03-15');
    expect(dates.some(d => d.endsWith('-01'))).toBe(false);
  });
});

describe('equityContributor.valuesOver', () => {
  it('emits one contribution per active company, tagged to its single owner', () => {
    const row = contributor().valuesOver(['2024-06-01'], ctx())[0];
    expect(row).toHaveLength(1);
    expect(row[0]).toMatchObject({ category: 'equity', ownerId: 'self', sourceId: 'optco' });
    // 504.17 exercisable × $9 intrinsic × 1.40 FX ≈ 6352.5
    expect(row[0].amount).toBeCloseTo(6352.5, 1);
  });

  it('values at ctx.equityDate when set, regardless of the axis date', () => {
    // Axis date 2022-02-01 (pre-cliff → 0), but equityDate today-equivalent → fully vested.
    const row = contributor().valuesOver(['2022-02-01'], ctx('2026-06-01'))[0];
    // Fully vested 1000 − 100 exercised = 900 × $9 × 1.40 = 11340.
    expect(row[0]?.amount).toBeCloseTo(11340, 1);
  });
});

describe('equityContributor — cross-check vs computeDateStats equity bucket', () => {
  const series = contributor().valuesOver(DATES_SORTED, ctx());
  for (const viewer of ['self', 'partner', HOUSEHOLD_VIEWER]) {
    it(`equity total matches at every date (viewer=${viewer})`, () => {
      DATES_SORTED.forEach((date, i) => {
        const expected = computeDateStats(SNAPSHOTS, ACCOUNTS, date, MAIN, FX_MAP, OPTION_DATA, date, viewer)
          .byCategory['equity'] ?? 0;
        expect(equityFor(series[i], viewer)).toBeCloseTo(expected, 4);
      });
    });
  }

  it('is invisible to a viewer who does not own the company (partner)', () => {
    // optco's owner is self; partner sees 0 at every date.
    expect(series.every(row => equityFor(row, 'partner') === 0)).toBe(true);
  });
});

describe('equityContributor — disabled when there are no active companies', () => {
  const empty = makeEquityContributor([], [], [], []);
  it('reports not enabled, no checkpoints, empty values', () => {
    expect(empty.isEnabled({} as never)).toBe(false);
    expect(empty.checkpointDates({ end: '2099-01-01' })).toEqual([]);
    expect(empty.valuesOver(['2024-01-01'], ctx())).toEqual([[]]);
  });
});
