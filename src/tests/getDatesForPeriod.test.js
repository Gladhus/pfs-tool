import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockState = { datesSorted: [] };
vi.mock('../core/state.js', () => ({ state: mockState }));

const { getDatesForPeriod } = await import('../utils/dates.js');

beforeEach(() => { mockState.datesSorted = []; });

const DATES = [
  '2022-03-01', '2022-06-01', '2022-09-01', '2022-12-01',
  '2023-03-01', '2023-06-01', '2023-09-01', '2023-12-01',
  '2024-03-01', '2024-06-01', '2024-09-01', '2024-12-01',
];

describe('getDatesForPeriod', () => {
  it('returns full array for "all"', () => {
    mockState.datesSorted = DATES;
    expect(getDatesForPeriod('all')).toEqual(DATES);
  });

  it('returns full array for empty dates regardless of period', () => {
    mockState.datesSorted = [];
    expect(getDatesForPeriod('3M')).toEqual([]);
  });

  it('YTD filters to dates in the latest data point year (not today)', () => {
    mockState.datesSorted = DATES;
    const result = getDatesForPeriod('YTD');
    expect(result.every(d => d.startsWith('2024-'))).toBe(true);
    expect(result).toEqual(['2024-03-01', '2024-06-01', '2024-09-01', '2024-12-01']);
  });

  it('3M returns dates within 3 months of the latest', () => {
    mockState.datesSorted = DATES;
    const result = getDatesForPeriod('3M');
    // latest is 2024-12-01; cutoff is 2024-09-01
    expect(result).toContain('2024-09-01');
    expect(result).toContain('2024-12-01');
    expect(result).not.toContain('2024-06-01');
  });

  it('6M returns dates within 6 months of the latest', () => {
    mockState.datesSorted = DATES;
    const result = getDatesForPeriod('6M');
    expect(result).toContain('2024-06-01');
    expect(result).toContain('2024-12-01');
    expect(result).not.toContain('2024-03-01');
  });

  it('1Y returns dates within 12 months of the latest', () => {
    mockState.datesSorted = DATES;
    const result = getDatesForPeriod('1Y');
    expect(result).toContain('2023-12-01');
    expect(result).toContain('2024-12-01');
    expect(result).not.toContain('2023-09-01');
  });

  it('2Y returns dates within 24 months of the latest', () => {
    mockState.datesSorted = DATES;
    const result = getDatesForPeriod('2Y');
    expect(result).toContain('2022-12-01');
    expect(result).toContain('2024-12-01');
    expect(result).not.toContain('2022-09-01');
  });

  it('5Y returns all dates when range is under 5 years', () => {
    mockState.datesSorted = DATES;
    const result = getDatesForPeriod('5Y');
    expect(result).toEqual(DATES);
  });

  it('unknown period falls back to returning all', () => {
    mockState.datesSorted = DATES;
    expect(getDatesForPeriod('7D')).toEqual(DATES);
    expect(getDatesForPeriod('wtf')).toEqual(DATES);
  });

  it('month-end latest date (2024-05-31) does not overflow into June', () => {
    mockState.datesSorted = ['2024-02-01', '2024-03-01', '2024-04-01', '2024-05-31'];
    const result = getDatesForPeriod('3M');
    // cutoff should be 2024-02-28/29 (3M before May 31), so Feb 1 is excluded
    expect(result).toContain('2024-03-01');
    expect(result).toContain('2024-05-31');
    // Feb 1 is before Feb 28 cutoff
    expect(result).not.toContain('2024-02-01');
  });
});
