import { describe, it, expect } from 'vitest';
import { parseMoney } from '@/shared/utils/format';

describe('parseMoney — null / empty', () => {
  it('returns null for null', () => expect(parseMoney(null)).toBeNull());
  it('returns null for undefined', () => expect(parseMoney(undefined)).toBeNull());
  it('returns null for empty string', () => expect(parseMoney('')).toBeNull());
  it('returns null for whitespace only', () => expect(parseMoney('   ')).toBeNull());
  it('returns null for lone dash', () => expect(parseMoney('-')).toBeNull());
  it('returns null for alphabetic string', () => expect(parseMoney('abc')).toBeNull());
  it('returns null for n/a', () => expect(parseMoney('n/a')).toBeNull());
  it('returns null for dash placeholder', () => expect(parseMoney('—')).toBeNull());
});

describe('parseMoney — plain integers', () => {
  it('parses zero', () => expect(parseMoney('0')).toBe(0));
  it('parses small integer', () => expect(parseMoney('42')).toBe(42));
  it('parses large integer', () => expect(parseMoney('1000000')).toBe(1000000));
  it('accepts numeric input directly', () => expect(parseMoney(1500)).toBe(1500));
});

describe('parseMoney — currency symbols and whitespace', () => {
  it('strips leading $', () => expect(parseMoney('$6500')).toBe(6500));
  it('strips leading €', () => expect(parseMoney('€1000')).toBe(1000));
  it('strips leading £', () => expect(parseMoney('£750')).toBe(750));
  it('strips trailing currency symbol', () => expect(parseMoney('500$')).toBe(500));
  it('strips whitespace around the value', () => expect(parseMoney('  1 234  ')).toBe(1234));
});

describe('parseMoney — thousands and decimal separators', () => {
  it('en-style 1,234.56', () => expect(parseMoney('1,234.56')).toBe(1234.56));
  it('fr-style 1 234,56', () => expect(parseMoney('1 234,56')).toBe(1234.56));
  it('comma-as-thousands with exactly 3 trailing digits: 6,500', () => expect(parseMoney('6,500')).toBe(6500));
  it('comma-as-decimal with < 3 trailing digits: 6,5', () => expect(parseMoney('6,5')).toBe(6.5));
  it('dot-only is always decimal: 6.5', () => expect(parseMoney('6.5')).toBe(6.5));
  it('dot-only thousands: 1.234 with 3 trailing → interpreted as decimal 1.234', () => {
    // Single dot with 3 trailing digits is ambiguous — we treat dot-only as decimal
    expect(parseMoney('1.234')).toBe(1.234);
  });
});

describe('parseMoney — negative values', () => {
  it('leading minus sign', () => expect(parseMoney('-500')).toBe(-500));
  it('parentheses notation', () => expect(parseMoney('(1,200)')).toBe(-1200));
});
