import { describe, it, expect } from 'vitest';
import { spendingsToCsv } from '@/features/spending/data/csv';
import type { LedgerRow } from '@/features/spending/data/spending.selectors';
import type { Person, SpendingCategory } from '@/types/sheets';

const CATEGORIES: SpendingCategory[] = [
  { id: 'groceries', name_fr: 'Épicerie', name_en: 'Groceries', color: '#000', sort_order: 10, active: true },
];
const PEOPLE: Person[] = [
  { id: 'self', name: 'Me', sort_order: 10, active: true, primary: true },
  { id: 'partner', name: 'Partner', sort_order: 20, active: true, primary: false },
];

function row(over: Partial<LedgerRow> = {}): LedgerRow {
  return {
    id: 's1', date: '2026-07-05', amount: 55.19, currency: 'CAD', category_id: 'groceries',
    ownership: [{ person_id: 'self', share: 1 }], recurring: false, ...over,
  };
}

describe('spendingsToCsv', () => {
  it('writes a header and one row per spending with resolved names', () => {
    const csv = spendingsToCsv([row({ comment: 'IGA' })], CATEGORIES, PEOPLE, 'en', 'Household');
    const lines = csv.split('\n');
    expect(lines[0]).toBe('date,amount,currency,category,owners,comment,recurring');
    expect(lines[1]).toBe('2026-07-05,55.19,CAD,Groceries,Me,IGA,');
  });

  it('resolves the localized category name and split owners', () => {
    const csv = spendingsToCsv(
      [row({ ownership: [{ person_id: 'self', share: 0.5 }, { person_id: 'partner', share: 0.5 }] })],
      CATEGORIES, PEOPLE, 'fr', 'Foyer',
    );
    expect(csv.split('\n')[1]).toContain('Épicerie');
    expect(csv.split('\n')[1]).toContain('Me 50% · Partner 50%');
  });

  it('quotes and escapes fields containing commas or quotes', () => {
    const csv = spendingsToCsv([row({ comment: 'Lunch, with "friends"' })], CATEGORIES, PEOPLE, 'en', 'Household');
    expect(csv.split('\n')[1]).toContain('"Lunch, with ""friends"""');
  });

  it('marks recurring occurrences', () => {
    const csv = spendingsToCsv([row({ recurring: true })], CATEGORIES, PEOPLE, 'en', 'Household');
    expect(csv.trim().endsWith(',yes')).toBe(true);
  });
});
