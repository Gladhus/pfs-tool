import { describe, it, expect } from 'vitest';
import { getDatesForPeriod } from '@/shared/utils/dates';

const DATES = [
  '2022-03-01', '2022-06-01', '2022-09-01', '2022-12-01',
  '2023-03-01', '2023-06-01', '2023-09-01', '2023-12-01',
  '2024-03-01', '2024-06-01', '2024-09-01', '2024-12-01',
];

describe('getDatesForPeriod', () => {
  it('returns full array for "all"', () => {
    expect(getDatesForPeriod(DATES, 'all')).toEqual(DATES);
  });

  it('returns full array for empty dates regardless of period', () => {
    expect(getDatesForPeriod([], '3m')).toEqual([]);
  });

  it('YTD filters to dates in the latest data point year', () => {
    const result = getDatesForPeriod(DATES, 'ytd');
    expect(result.every(d => d.startsWith('2024-'))).toBe(true);
    expect(result).toEqual(['2024-03-01', '2024-06-01', '2024-09-01', '2024-12-01']);
  });

  it('3m returns dates within 3 months of the latest', () => {
    const result = getDatesForPeriod(DATES, '3m');
    expect(result).toContain('2024-09-01');
    expect(result).toContain('2024-12-01');
    expect(result).not.toContain('2024-06-01');
  });

  it('6m returns dates within 6 months of the latest', () => {
    const result = getDatesForPeriod(DATES, '6m');
    expect(result).toContain('2024-06-01');
    expect(result).toContain('2024-12-01');
    expect(result).not.toContain('2024-03-01');
  });

  it('1y returns dates within 12 months of the latest', () => {
    const result = getDatesForPeriod(DATES, '1y');
    expect(result).toContain('2023-12-01');
    expect(result).toContain('2024-12-01');
    expect(result).not.toContain('2023-09-01');
  });

  it('2y returns dates within 24 months of the latest', () => {
    const result = getDatesForPeriod(DATES, '2y');
    expect(result).toContain('2022-12-01');
    expect(result).toContain('2024-12-01');
    expect(result).not.toContain('2022-09-01');
  });

  it('5y returns all dates when range is under 5 years', () => {
    expect(getDatesForPeriod(DATES, '5y')).toEqual(DATES);
  });

  it('unknown period falls back to returning all', () => {
    expect(getDatesForPeriod(DATES, 'wtf')).toEqual(DATES);
  });

  it('month-end latest date (2024-05-31) does not overflow into June', () => {
    const dates = ['2024-02-01', '2024-03-01', '2024-04-01', '2024-05-31'];
    const result = getDatesForPeriod(dates, '3m');
    expect(result).toContain('2024-03-01');
    expect(result).toContain('2024-05-31');
    expect(result).not.toContain('2024-02-01');
  });
});
