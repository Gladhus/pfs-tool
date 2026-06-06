import { describe, it, expect } from 'vitest';
import { normalizeDate, normalizeMonth } from '@/utils/dates';

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

  it('converts Google Sheets serial number to ISO date', () => {
    // 45000 = 2023-03-22 (approximately)
    const result = normalizeDate('45000');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns original string for unrecognised format', () => {
    expect(normalizeDate('not-a-date')).toBe('not-a-date');
  });
});

describe('normalizeMonth', () => {
  it('returns empty string for null', () => expect(normalizeMonth(null)).toBe(''));

  it('passes through YYYY-MM', () => {
    expect(normalizeMonth('2024-06')).toBe('2024-06');
  });

  it('strips day from YYYY-MM-DD', () => {
    expect(normalizeMonth('2024-06-15')).toBe('2024-06');
  });

  it('parses a month label', () => {
    expect(normalizeMonth('Dec 2024')).toBe('2024-12');
  });
});
