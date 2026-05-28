import { describe, it, expect, vi } from 'vitest';

vi.mock('../core/state.js', () => ({ state: {} }));

const { parseMonthLabel } = await import('../utils/dates.js');

describe('parseMonthLabel', () => {
  it('returns null for empty input', () => {
    expect(parseMonthLabel(null)).toBeNull();
    expect(parseMonthLabel('')).toBeNull();
  });

  // YYYY-MM / YYYY/MM
  it('parses YYYY-MM', () => {
    expect(parseMonthLabel('2015-12')).toBe('2015-12');
    expect(parseMonthLabel('2015/12')).toBe('2015-12');
    expect(parseMonthLabel('2015-01')).toBe('2015-01');
  });

  // MM/YYYY
  it('parses MM/YYYY', () => {
    expect(parseMonthLabel('12/2015')).toBe('2015-12');
    expect(parseMonthLabel('1/2015')).toBe('2015-01');
  });

  // DD/MM/YYYY — French convention
  it('parses DD/MM/YYYY', () => {
    expect(parseMonthLabel('01/12/2015')).toBe('2015-12');
    expect(parseMonthLabel('13/12/2015')).toBe('2015-12'); // day > 12 → unambiguous
    expect(parseMonthLabel('15/06/2020')).toBe('2020-06');
  });

  // Named month + 4-digit year
  it('parses "MMM YYYY"', () => {
    expect(parseMonthLabel('Dec 2015')).toBe('2015-12');
    expect(parseMonthLabel('décembre 2020')).toBe('2020-12');
    expect(parseMonthLabel('jan 2022')).toBe('2022-01');
  });

  // DD-MMM-YY (his actual format)
  it('parses DD-MMM-YY (2-digit year)', () => {
    expect(parseMonthLabel('1-Dec-15')).toBe('2015-12');
    expect(parseMonthLabel('1-Jan-16')).toBe('2016-01');
    expect(parseMonthLabel('15-Feb-99')).toBe('2099-02');
    expect(parseMonthLabel('1-oct-15')).toBe('2015-10');
  });

  // DD-MMM-YYYY
  it('parses DD-MMM-YYYY (4-digit year)', () => {
    expect(parseMonthLabel('1-Dec-2015')).toBe('2015-12');
    expect(parseMonthLabel('15-Mar-2020')).toBe('2020-03');
  });

  // MMM-DD-YY(YY)
  it('parses MMM-DD-YY(YY)', () => {
    expect(parseMonthLabel('Dec-1-15')).toBe('2015-12');
    expect(parseMonthLabel('Oct-15-2020')).toBe('2020-10');
  });

  // YYYY-MMM-DD
  it('parses YYYY-MMM-DD', () => {
    expect(parseMonthLabel('2015-Dec-1')).toBe('2015-12');
  });

  it('returns null for unrecognised formats', () => {
    expect(parseMonthLabel('not a date')).toBeNull();
    expect(parseMonthLabel('12345')).toBeNull();
  });
});
