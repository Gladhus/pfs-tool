import { describe, it, expect } from 'vitest';
import { merchantIndex, suggestMerchants } from '@/features/spending/data/merchants';
import type { Spending } from '@/types/sheets';

function spend(over: Partial<Spending>): Spending {
  return {
    id: Math.random().toString(36).slice(2), date: '2026-07-01', amount: 10,
    category_id: 'groceries', ownership: [{ person_id: 'self', share: 1 }], ...over,
  };
}

describe('merchantIndex', () => {
  it('groups merchants case-insensitively with their most-used category + count', () => {
    const idx = merchantIndex([
      spend({ comment: 'Costco', category_id: 'groceries', date: '2026-05-01' }),
      spend({ comment: 'costco', category_id: 'groceries', date: '2026-06-01' }),
      spend({ comment: 'Costco', category_id: 'shopping', date: '2026-07-01' }),
      spend({ comment: 'Uber', category_id: 'transport' }),
      spend({ comment: '   ' }), // blank → ignored
    ]);
    const costco = idx.find(m => m.name.toLowerCase() === 'costco')!;
    expect(costco.count).toBe(3);
    expect(costco.categoryId).toBe('groceries'); // 2 groceries vs 1 shopping
    expect(costco.name).toBe('Costco'); // most-recent casing (the 2026-07 row)
    expect(idx.some(m => m.name === 'Uber')).toBe(true);
    expect(idx).toHaveLength(2); // blank dropped
  });
});

describe('suggestMerchants', () => {
  const idx = merchantIndex([
    spend({ comment: 'Costco', category_id: 'groceries' }),
    spend({ comment: 'Costco', category_id: 'groceries' }),
    spend({ comment: 'Cinema Costa', category_id: 'entertainment' }),
    spend({ comment: 'Uber', category_id: 'transport' }),
  ]);

  it('ranks prefix matches first, then by usage count', () => {
    const out = suggestMerchants(idx, 'co');
    expect(out.map(m => m.name)).toEqual(['Costco', 'Cinema Costa']); // both match "co"; prefix "Costco" first
  });

  it('returns the most-used merchants for an empty query', () => {
    expect(suggestMerchants(idx, '')[0].name).toBe('Costco'); // used twice
  });

  it('respects the limit', () => {
    expect(suggestMerchants(idx, '', 1)).toHaveLength(1);
  });

  it('matches substrings case-insensitively', () => {
    expect(suggestMerchants(idx, 'UBER').map(m => m.name)).toEqual(['Uber']);
  });
});
