import { describe, it, expect } from 'vitest';
import { periodRange, mergeAxis, buildAxis } from '@/core/axis';
import { getDatesForPeriod } from '@/utils/dates';
import { resolveFilterSpec } from '@/core/filters';
import type { Period } from '@/ui/PeriodPills';
import type { ValuedContributor, DateRange } from '@/core/contributors/types';

const DATES = ['2021-03-15', '2022-02-01', '2023-05-10', '2024-06-01'];
const PERIODS: Period[] = ['all', 'ytd', '3m', '6m', '1y', '2y', '3y', '5y'];

describe('periodRange', () => {
  it('returns an empty end for no data', () => {
    expect(periodRange('all', [])).toEqual({ end: '' });
  });

  it('"all" has no lower bound and ends at the latest date', () => {
    expect(periodRange('all', DATES)).toEqual({ end: '2024-06-01' });
  });

  it('"ytd" starts at Jan 1 of the latest year', () => {
    expect(periodRange('ytd', DATES)).toEqual({ start: '2024-01-01', end: '2024-06-01' });
  });

  it('"1y" starts twelve months before the latest date', () => {
    expect(periodRange('1y', DATES)).toEqual({ start: '2023-06-01', end: '2024-06-01' });
  });

  // The whole point of the range: filtering snapshot dates to it must reproduce the
  // legacy getDatesForPeriod output, so the new axis can't drift the time window.
  it('range filtering reproduces getDatesForPeriod for every period', () => {
    for (const period of PERIODS) {
      const { start, end } = periodRange(period, DATES);
      const viaRange = DATES.filter(d => (!start || d >= start) && d <= end);
      expect(viaRange).toEqual(getDatesForPeriod(DATES, period));
    }
  });
});

describe('mergeAxis', () => {
  it('merges, dedupes, and sorts to a single day-level axis', () => {
    expect(mergeAxis([
      ['2023-05-10', '2021-03-15'],
      ['2022-02-01', '2021-03-15'],
      [],
    ])).toEqual(['2021-03-15', '2022-02-01', '2023-05-10']);
  });

  it('is empty for no contributors', () => {
    expect(mergeAxis([])).toEqual([]);
  });
});

// Minimal fake contributor — also exercises the ValuedContributor interface shape.
const fake = (id: string, enabled: boolean, dates: string[]): ValuedContributor => ({
  id,
  isEnabled: () => enabled,
  checkpointDates: (_range: DateRange) => dates,
  valuesOver: () => [],
});

describe('buildAxis', () => {
  const spec = resolveFilterSpec(new URLSearchParams(''), { viewer: 'self' });
  const range: DateRange = { end: '2024-06-01' };

  it('merges only enabled contributors\' checkpoints', () => {
    const axis = buildAxis([
      fake('accounts', true, ['2022-02-01', '2021-03-15']),
      fake('equity', false, ['2099-01-01']),
    ], spec, range);
    expect(axis).toEqual(['2021-03-15', '2022-02-01']);
  });

  it('is empty when all contributors are disabled', () => {
    expect(buildAxis([fake('equity', false, ['2024-01-01'])], spec, range)).toEqual([]);
  });
});
