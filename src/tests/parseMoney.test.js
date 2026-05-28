import { describe, it, expect, vi } from 'vitest';

vi.mock('../core/i18n/index.js', () => ({ lang: () => 'en' }));
globalThis.window = { PFS_CONFIG: {} };

const { parseMoney } = await import('../core/format.js');

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
  it('strips surrounding whitespace', () => expect(parseMoney('  1000  ')).toBe(1000));
  it('strips whitespace inside value', () => expect(parseMoney('$ 1 000')).toBe(1000));
});

describe('parseMoney — comma as thousands separator', () => {
  it('handles x,000', () => expect(parseMoney('1,000')).toBe(1000));
  it('handles xx,000', () => expect(parseMoney('10,000')).toBe(10000));
  it('handles xxx,000', () => expect(parseMoney('100,000')).toBe(100000));
  it('handles x,xxx,xxx', () => expect(parseMoney('1,234,567')).toBe(1234567));
  it('handles $ + comma thousands', () => expect(parseMoney('$6,500')).toBe(6500));
  it('handles $xx,xxx', () => expect(parseMoney('$13,900')).toBe(13900));
  it('handles $xxx,xxx', () => expect(parseMoney('$125,780')).toBe(125780));
  it('handles $x,xxx,xxx', () => expect(parseMoney('$1,234,567')).toBe(1234567));
});

describe('parseMoney — comma as decimal separator', () => {
  it('handles x,x', () => expect(parseMoney('6,5')).toBe(6.5));
  it('handles x,xx', () => expect(parseMoney('6,50')).toBeCloseTo(6.5));
  it('handles xx,xx', () => expect(parseMoney('1,99')).toBeCloseTo(1.99));
  it('handles 0,xx', () => expect(parseMoney('0,75')).toBeCloseTo(0.75));
});

describe('parseMoney — dot as decimal separator', () => {
  it('handles x.x', () => expect(parseMoney('6.5')).toBe(6.5));
  it('handles x.xx', () => expect(parseMoney('6.50')).toBeCloseTo(6.5));
  it('handles xxx.xx', () => expect(parseMoney('999.99')).toBeCloseTo(999.99));
  it('handles 0.xx', () => expect(parseMoney('0.25')).toBeCloseTo(0.25));
});

describe('parseMoney — mixed comma thousands + dot decimal', () => {
  it('handles x,xxx.xx', () => expect(parseMoney('1,234.56')).toBeCloseTo(1234.56));
  it('handles $x,xxx.xx', () => expect(parseMoney('$1,234.56')).toBeCloseTo(1234.56));
  it('handles $xx,xxx.xx', () => expect(parseMoney('$12,345.67')).toBeCloseTo(12345.67));
  it('handles $x,xxx,xxx.xx', () => expect(parseMoney('$1,234,567.89')).toBeCloseTo(1234567.89));
  it('handles value ending in .00', () => expect(parseMoney('$1,500.00')).toBeCloseTo(1500));
});

describe('parseMoney — negative values', () => {
  it('handles negative plain', () => expect(parseMoney('-500')).toBe(-500));
  it('handles negative with $', () => expect(parseMoney('-$1,500')).toBe(-1500));
  it('handles negative with comma thousands', () => expect(parseMoney('-10,000')).toBe(-10000));
  it('handles negative with decimal', () => expect(parseMoney('-1,234.56')).toBeCloseTo(-1234.56));
});

describe('parseMoney — real values from his spreadsheet', () => {
  it('$6,500', () => expect(parseMoney('$6,500')).toBe(6500));
  it('$41,300', () => expect(parseMoney('$41,300')).toBe(41300));
  it('$102,060', () => expect(parseMoney('$102,060')).toBe(102060));
  it('$57,500', () => expect(parseMoney('$57,500')).toBe(57500));
  it('$130,140', () => expect(parseMoney('$130,140')).toBe(130140));
  it('empty cell (empty string)', () => expect(parseMoney('')).toBeNull());
});
