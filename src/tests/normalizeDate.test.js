import { describe, it, expect, vi } from 'vitest';

const mockState = { lang: 'en' };
vi.mock('../core/state.js', () => ({ state: mockState }));

const { normalizeDate, normalizeMonth } = await import('../utils/dates.js');

describe('normalizeDate', () => {
  it('returns empty string for null', () => expect(normalizeDate(null)).toBe(''));
  it('returns empty string for undefined', () => expect(normalizeDate(undefined)).toBe(''));
  it('returns empty string for empty string', () => expect(normalizeDate('')).toBe(''));

  it('passes through YYYY-MM-DD unchanged', () => {
    expect(normalizeDate('2024-06-15')).toBe('2024-06-15');
  });

  it('zero-pads single-digit month and day', () => {
    expect(normalizeDate('2024-6-5')).toBe('2024-06-05');
  });

  it('converts YYYY-MM to YYYY-MM-01', () => {
    expect(normalizeDate('2024-06')).toBe('2024-06-01');
  });

  it('converts valid Sheets serial to YYYY-MM-DD', () => {
    // Serial 45658 → 2025-01-01 UTC
    expect(normalizeDate('45658')).toBe('2025-01-01');
  });

  it('boundary serial 25001 converts', () => {
    const result = normalizeDate('25001');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('boundary serial 79999 converts', () => {
    const result = normalizeDate('79999');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('out-of-range serial 24999 passes through as-is', () => {
    expect(normalizeDate('24999')).toBe('24999');
  });

  it('out-of-range serial 80000 passes through as-is', () => {
    expect(normalizeDate('80000')).toBe('80000');
  });

  it('leap-year serial 43890 → 2020-02-29', () => {
    expect(normalizeDate('43890')).toBe('2020-02-29');
  });
});

describe('normalizeMonth', () => {
  it('returns empty string for null', () => expect(normalizeMonth(null)).toBe(''));
  it('returns empty string for empty string', () => expect(normalizeMonth('')).toBe(''));

  it('returns YYYY-MM from YYYY-MM-DD', () => {
    expect(normalizeMonth('2024-06-15')).toBe('2024-06');
  });

  it('returns YYYY-MM from YYYY-MM', () => {
    expect(normalizeMonth('2024-06')).toBe('2024-06');
  });

  it('converts valid Sheets serial to YYYY-MM', () => {
    expect(normalizeMonth('45658')).toBe('2025-01');
  });

  it('leap-year serial 43890 → 2020-02', () => {
    expect(normalizeMonth('43890')).toBe('2020-02');
  });

  it('out-of-range serial falls through to parseMonthLabel', () => {
    // Non-serial text should fall through to parseMonthLabel
    const result = normalizeMonth('Dec 2024');
    expect(result).toBe('2024-12');
  });
});
