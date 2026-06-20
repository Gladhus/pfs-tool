import { describe, it, expect } from 'vitest';
import { parseMonthLabel } from '@/shared/utils/dates';

describe('parseMonthLabel', () => {
  it('returns null for empty input', () => {
    expect(parseMonthLabel(null)).toBeNull();
    expect(parseMonthLabel('')).toBeNull();
  });

  it('parses YYYY-MM / YYYY/MM', () => {
    expect(parseMonthLabel('2015-12')).toBe('2015-12');
    expect(parseMonthLabel('2015/12')).toBe('2015-12');
    expect(parseMonthLabel('2015-01')).toBe('2015-01');
  });

  it('parses MM/YYYY', () => {
    expect(parseMonthLabel('12/2015')).toBe('2015-12');
    expect(parseMonthLabel('01/2015')).toBe('2015-01');
  });

  it('parses named month + year: Dec 2015', () => {
    expect(parseMonthLabel('Dec 2015')).toBe('2015-12');
    expect(parseMonthLabel('dec 2015')).toBe('2015-12');
    expect(parseMonthLabel('January 2020')).toBe('2020-01');
  });

  it('parses French month names', () => {
    expect(parseMonthLabel('déc 2015')).toBe('2015-12');
    expect(parseMonthLabel('janvier 2020')).toBe('2020-01');
  });

  it('parses DD-MMM-YYYY: 1-Dec-2015', () => {
    expect(parseMonthLabel('1-Dec-2015')).toBe('2015-12');
  });

  it('parses MMM-DD-YYYY: Dec-1-2015', () => {
    expect(parseMonthLabel('Dec-1-2015')).toBe('2015-12');
  });

  it('returns null for completely unrecognised input', () => {
    expect(parseMonthLabel('not a date')).toBeNull();
  });
});
