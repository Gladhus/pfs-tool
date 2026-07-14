import { describe, it, expect } from 'vitest';
import { bncImporter, parseAmount, parseFrDate } from '@/features/spending/import/bnc.importer';
import { detectImporter } from '@/features/spending/import/registry';
import {
  summarize, expenseTxns, resolvedExpenses, uncertainCategories, distinct,
  assignImportIds, suggestCategory, slugCategoryId, buildSpendings,
} from '@/features/spending/import/prepare';
import type { ImportSource, PositionedLine, PositionedToken } from '@/features/spending/import/types';
import type { SpendingCategory } from '@/types/sheets';

// ── Fixture builder: mimics pdf.js output — per-word tokens with widths, and a
// wide space token (w > 20) separating columns, like the real Banque Nationale PDF.
const COL = { date: 60, desc: 195, acct: 330, cat: 465, amt: 705 };
const ORDER: (keyof typeof COL)[] = ['date', 'desc', 'acct', 'cat', 'amt'];

function line(page: number, y: number, cells: { date?: string; desc?: string; acct?: string; cat?: string; amt?: string }): PositionedLine {
  const tokens: PositionedToken[] = [];
  let first = true;
  for (const key of ORDER) {
    const val = cells[key];
    if (val == null) continue;
    if (!first) tokens.push({ x: COL[key] - 40, w: 50, str: ' ' }); // wide column separator
    first = false;
    let x = COL[key];
    const words = val.split(' ');
    words.forEach((word, i) => {
      const w = Math.max(3, word.length * 5);
      tokens.push({ x, w, str: word });
      x += w;
      if (i < words.length - 1) { tokens.push({ x, w: 3, str: ' ' }); x += 3; } // intra-cell space
    });
  }
  tokens.sort((a, b) => a.x - b.x);
  return { page, y, tokens, text: tokens.map(t => t.str).join('').replace(/\s+/g, ' ').trim() };
}

function source(lines: PositionedLine[]): ImportSource {
  return { filename: 'Bilan.pdf', text: ['Banque Nationale | Services bancaires | Bilan', ...lines.map(l => l.text)].join('\n'), lines };
}

// y decreases down the page (PDF origin bottom-left); rows already in reading order.
const HEADER = line(1, 800, { date: 'Date', desc: 'Description', acct: 'Compte', cat: 'Catégorie', amt: 'Montant' });

describe('parseAmount', () => {
  it('parses a debit with a non-breaking-space thousands separator', () => {
    expect(parseAmount('2 277,08 $')).toEqual({ value: 2277.08, credit: false, currency: 'CAD' });
  });
  it('parses a credit (leading +)', () => {
    expect(parseAmount('+135,00 $')).toEqual({ value: 135, credit: true, currency: 'CAD' });
  });
  it('parses a USD amount', () => {
    expect(parseAmount('6 342,68 USD')).toEqual({ value: 6342.68, credit: false, currency: 'USD' });
  });
  it('rejects non-amounts', () => {
    expect(parseAmount('Épicerie')).toBeNull();
  });
});

describe('parseFrDate', () => {
  it('parses a French long date', () => {
    expect(parseFrDate('13 juillet 2026')).toBe('2026-07-13');
    expect(parseFrDate('6 janvier 2026')).toBe('2026-01-06');
  });
  it('rejects garbage', () => {
    expect(parseFrDate('En attente')).toBe('');
  });
});

describe('bncImporter.detect', () => {
  it('recognizes a Banque Nationale export', () => {
    expect(detectImporter(source([HEADER]))?.id).toBe('bnc');
  });
  it('rejects an unrelated document', () => {
    expect(detectImporter({ filename: 'x.pdf', text: 'Hello world', lines: [] })).toBeNull();
  });
});

describe('bncImporter.parse', () => {
  const lines = [
    HEADER,
    line(1, 760, { date: '13 juillet 2026', desc: 'Simons', acct: 'Mastercard World Elite', cat: 'Vêtements', amt: '55,19 $' }),
    // wrapped description across two physical lines
    line(1, 740, { date: '7 juillet 2026', desc: 'Santé dentaire réclamation', acct: 'Compte Perso', cat: 'Revenus', amt: '+178,21 $' }),
    line(1, 725, { desc: 'assurance' }),
    // transfer (excluded) + income (excluded)
    line(1, 700, { date: '6 juillet 2026', desc: 'Transfert entre comptes', acct: 'Compte Perso', cat: 'Transfert', amt: '1 500,00 $' }),
    // credit-card payoff — must NOT count as spending (would double-count card purchases)
    line(1, 695, { date: '6 juillet 2026', desc: 'Mastercard BNC', acct: 'Compte Perso', cat: 'Paiement carte de crédit', amt: '2 303,20 $' }),
    // an uncertain category (bank fee) — user decides
    line(1, 690, { date: '6 juillet 2026', desc: 'Frais mensuels', acct: 'Compte Conjoint', cat: 'Frais', amt: '4,00 $' }),
    line(1, 680, { date: '5 juillet 2026', desc: 'Mondou', acct: 'Compte Conjoint', cat: 'Animaux', amt: '158,19 $' }),
    // pending (no date, excluded)
    line(1, 660, { date: 'En attente', desc: 'McDonald’s', acct: 'Mastercard World Elite', cat: 'Restauration rapide', amt: '26,97 $' }),
    // footer noise
    line(1, 40, { date: '7/13/26, 8:32 AM' }),
    line(1, 30, { desc: 'https://app.bnc.ca/accounts' }),
  ];
  const txns = bncImporter.parse(source(lines));

  it('extracts every transaction row (incl. wrapped description)', () => {
    const wrapped = txns.find(t => t.date === '2026-07-07');
    expect(wrapped?.description).toBe('Santé dentaire réclamation assurance');
    expect(wrapped?.account).toBe('Compte Perso');
    expect(wrapped?.category).toBe('Revenus');
  });

  it('classifies kinds correctly', () => {
    expect(txns.find(t => t.description === 'Simons')?.kind).toBe('expense');
    expect(txns.find(t => t.category === 'Transfert')?.kind).toBe('transfer');
    expect(txns.find(t => t.category === 'Paiement carte de crédit')?.kind).toBe('transfer'); // no double-count
    expect(txns.find(t => t.category === 'Frais')?.kind).toBe('uncertain');
    expect(txns.find(t => t.description.startsWith('Santé'))?.kind).toBe('income'); // + credit
    expect(txns.find(t => t.pending)?.pending).toBe(true);
  });

  it('excludes credit-card payments and transfers from expenses by default', () => {
    const s = summarize(txns);
    expect(s.expenses).toBe(2);   // Simons, Mondou
    expect(s.transfers).toBe(2);  // Transfert + Paiement carte de crédit
    expect(s.income).toBe(1);
    expect(s.uncertain).toBe(1);  // Frais
    expect(s.pending).toBe(1);
    // Default resolve keeps only certain expenses — no card payoff, no fee.
    expect(expenseTxns(txns).map(t => t.description).sort()).toEqual(['Mondou', 'Simons']);
  });

  it('surfaces uncertain categories and includes them only when chosen', () => {
    expect(uncertainCategories(txns)).toEqual(['Frais']);
    const withFees = resolvedExpenses(txns, new Set(['Frais']));
    expect(withFees.map(t => t.description).sort()).toEqual(['Frais mensuels', 'Mondou', 'Simons']);
  });
});

describe('bncImporter.parse — real-PDF quirks', () => {
  it('reconstructs words from per-character fragment tokens', () => {
    // pdf.js splits "Date"→D,a,t,e and separates columns with a wide space token.
    const frag = (x0: number, s: string): PositionedToken[] =>
      [...s].map((ch, i) => ({ x: x0 + i * 5, w: 5, str: ch }));
    const sep = (x: number): PositionedToken => ({ x, w: 60, str: ' ' });
    const mk = (cells: [number, string][]): PositionedLine => {
      const toks: PositionedToken[] = [];
      cells.forEach(([x, s], i) => { if (i) toks.push(sep(x - 20)); toks.push(...frag(x, s)); });
      return { page: 1, y: 0, tokens: toks, text: toks.map(t => t.str).join('').replace(/\s+/g, ' ').trim() };
    };
    const header = mk([[60, 'Date'], [195, 'Description'], [330, 'Compte'], [465, 'Catégorie'], [705, 'Montant']]);
    const row = mk([[60, '13 juillet 2026'], [195, 'Simons'], [330, 'Mastercard'], [465, 'Vêtements'], [705, '55,19 $']]);
    const txns = bncImporter.parse(source([header, row]));
    expect(txns).toHaveLength(1);
    expect(txns[0]).toMatchObject({ date: '2026-07-13', description: 'Simons', category: 'Vêtements', amount: 55.19 });
  });

  it('recovers an account swallowed by a long merchant description', () => {
    const lines = [
      HEADER,
      // Establishes "Compte Conjoint" in the account vocabulary.
      line(1, 760, { date: '5 juillet 2026', desc: 'Mondou', acct: 'Compte Conjoint', cat: 'Animaux', amt: '158,19 $' }),
      // Long merchant: account merged into the description cell, account column empty.
      line(1, 740, { date: '4 juillet 2026', desc: 'Petits Bonheurs St Lambert Compte Conjoint', cat: 'Restaurants', amt: '10,99 $' }),
    ];
    const txns = bncImporter.parse(source(lines));
    const merged = txns.find(t => t.date === '2026-07-04')!;
    expect(merged.account).toBe('Compte Conjoint');
    expect(merged.description).toBe('Petits Bonheurs St Lambert');
  });
});

describe('prepare helpers', () => {
  const cats: SpendingCategory[] = [
    { id: 'groceries', name_fr: 'Épicerie', name_en: 'Groceries', color: '#000', sort_order: 10, active: true },
    { id: 'dining', name_fr: 'Restaurants', name_en: 'Dining', color: '#000', sort_order: 20, active: true },
  ];

  it('suggestCategory matches on FR or EN name (case-insensitive)', () => {
    expect(suggestCategory('épicerie', cats)).toBe('groceries');
    expect(suggestCategory('Dining', cats)).toBe('dining');
    expect(suggestCategory('Carburant et essence', cats)).toBe('');
  });

  it('slugCategoryId strips accents and dedupes', () => {
    const taken = new Set<string>();
    const a = slugCategoryId('Carburant et essence', taken); taken.add(a);
    expect(a).toBe('carburant_et_essence');
    expect(slugCategoryId('Carburant et essence', taken)).toBe('carburant_et_essence_2');
  });

  it('assignImportIds gives identical rows distinct ids, stably', () => {
    const raw = expenseTxns(bncImporter.parse(source([
      HEADER,
      line(1, 760, { date: '3 juillet 2026', desc: 'Shell', acct: 'Mastercard World Elite', cat: 'Carburant et essence', amt: '150,00 $' }),
      line(1, 740, { date: '3 juillet 2026', desc: 'Shell', acct: 'Mastercard World Elite', cat: 'Carburant et essence', amt: '150,00 $' }),
    ])));
    const keyed = assignImportIds(raw);
    expect(keyed).toHaveLength(2);
    expect(keyed[0].id).not.toBe(keyed[1].id);
    // stable across runs
    expect(assignImportIds(raw).map(k => k.id)).toEqual(keyed.map(k => k.id));
  });
});

describe('buildSpendings', () => {
  const raw = expenseTxns(bncImporter.parse(source([
    HEADER,
    line(1, 760, { date: '13 juillet 2026', desc: 'Simons', acct: 'Mastercard World Elite', cat: 'Vêtements', amt: '55,19 $' }),
    line(1, 740, { date: '5 juillet 2026', desc: 'Mondou', acct: 'Compte Conjoint', cat: 'Animaux', amt: '158,19 $' }),
  ])));
  const keyed = assignImportIds(raw);
  const catTarget = { 'Vêtements': 'shopping', 'Animaux': 'pets' };
  const acctOwn = {
    'Mastercard World Elite': [{ person_id: 'self', share: 1 }],
    'Compte Conjoint': [{ person_id: 'self', share: 0.5 }, { person_id: 'partner', share: 0.5 }],
  };

  it('maps categories + account ownership onto spendings', () => {
    const { spendings, duplicates } = buildSpendings(keyed, catTarget, acctOwn, new Set(), '2026-07-13T00:00:00Z');
    expect(duplicates).toBe(0);
    const simons = spendings.find(s => s.comment === 'Simons')!;
    expect(simons.category_id).toBe('shopping');
    expect(simons.amount).toBe(55.19);
    expect(simons.ownership).toEqual([{ person_id: 'self', share: 1 }]);
    const mondou = spendings.find(s => s.comment === 'Mondou')!;
    expect(mondou.ownership).toHaveLength(2);
  });

  it('skips rows whose id already exists (duplicates)', () => {
    const existing = new Set([keyed[0].id]);
    const { spendings, duplicates } = buildSpendings(keyed, catTarget, acctOwn, existing, 'now');
    expect(spendings).toHaveLength(1);
    expect(duplicates).toBe(1);
  });

  it('honors the excluded set', () => {
    const { spendings } = buildSpendings(keyed, catTarget, acctOwn, new Set(), 'now', new Set([keyed[1].id]));
    expect(spendings).toHaveLength(1);
    expect(spendings[0].id).toBe(keyed[0].id);
  });

  it('distinct lists accounts in first-seen order', () => {
    expect(distinct(raw, t => t.account)).toEqual(['Mastercard World Elite', 'Compte Conjoint']);
  });
});
