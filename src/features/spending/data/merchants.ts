import type { Spending } from '@/types/sheets';

export interface MerchantSuggestion {
  name: string;         // display name (most-recent casing)
  categoryId: string;   // the category most often used for this merchant
  count: number;        // how many times it's been used
}

/**
 * Build the merchant memory from past spendings: one entry per distinct merchant
 * (the `comment` field), carrying its most-used category and usage count. Keyed
 * case-insensitively, keeping the most recently-used casing for display.
 */
export function merchantIndex(spendings: Spending[]): MerchantSuggestion[] {
  const byName = new Map<string, { name: string; cats: Map<string, number>; count: number; last: string }>();
  for (const s of spendings) {
    const name = (s.comment ?? '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    let e = byName.get(key);
    if (!e) { e = { name, cats: new Map(), count: 0, last: '' }; byName.set(key, e); }
    e.count++;
    if (s.date >= e.last) { e.last = s.date; e.name = name; } // freshest casing
    if (s.category_id) e.cats.set(s.category_id, (e.cats.get(s.category_id) ?? 0) + 1);
  }
  return [...byName.values()].map(e => ({
    name: e.name,
    categoryId: [...e.cats.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '',
    count: e.count,
  }));
}

/**
 * Rank merchant suggestions for a query: prefix matches first, then substring, each
 * by usage count. An empty query returns the most-used merchants.
 */
export function suggestMerchants(index: MerchantSuggestion[], query: string, limit = 6): MerchantSuggestion[] {
  const q = query.trim().toLowerCase();
  const matches = q ? index.filter(m => m.name.toLowerCase().includes(q)) : [...index];
  return matches
    .sort((a, b) => {
      const ap = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bp = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      return ap - bp || b.count - a.count || a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}
