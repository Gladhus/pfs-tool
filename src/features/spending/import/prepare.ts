import type { OwnershipEntry, Spending, SpendingCategory } from '@/types/sheets';
import type { RawTxn } from './types';

/** Counts by kind, for the upload summary. */
export interface ImportSummary {
  total: number;
  expenses: number;
  income: number;
  transfers: number;
  pending: number;
}

export function summarize(raw: RawTxn[]): ImportSummary {
  return {
    total: raw.length,
    expenses: expenseTxns(raw).length,
    income: raw.filter(t => t.kind === 'income').length,
    transfers: raw.filter(t => t.kind === 'transfer').length,
    pending: raw.filter(t => t.pending).length,
  };
}

/** The rows we actually import: real, dated, money-out expenses. */
export function expenseTxns(raw: RawTxn[]): RawTxn[] {
  return raw.filter(t => t.kind === 'expense' && !t.pending && t.amount > 0 && !!t.date);
}

/** Distinct bank labels (stable order of first appearance). */
export function distinct(items: RawTxn[], key: (t: RawTxn) => string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    const k = key(it);
    if (k && !seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}

function hash36(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Deterministic id so re-importing the same export doesn't duplicate rows.
    `occ` distinguishes genuinely-identical rows within one export. */
export function importedId(txn: RawTxn, occ: number): string {
  return `imp_${hash36(`${txn.date}|${txn.amount.toFixed(2)}|${txn.currency}|${txn.description}|${txn.account}|${occ}`)}`;
}

export interface KeyedTxn { txn: RawTxn; id: string }

/** Assign each expense a stable import id (identical rows get distinct occurrences). */
export function assignImportIds(expenses: RawTxn[]): KeyedTxn[] {
  const occ = new Map<string, number>();
  return expenses.map(txn => {
    const baseKey = `${txn.date}|${txn.amount.toFixed(2)}|${txn.currency}|${txn.description}|${txn.account}`;
    const n = occ.get(baseKey) ?? 0;
    occ.set(baseKey, n + 1);
    return { txn, id: importedId(txn, n) };
  });
}

/** Suggest an existing category whose FR/EN name matches the bank's label. */
export function suggestCategory(bankCategory: string, categories: SpendingCategory[]): string {
  const norm = (s: string) => s.trim().toLowerCase();
  const target = norm(bankCategory);
  const hit = categories.find(c => norm(c.name_fr) === target || norm(c.name_en) === target);
  return hit?.id ?? '';
}

/** Slugify a category name into a stable, unique id. */
export function slugCategoryId(name: string, taken: Set<string>): string {
  const base = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'category';
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}_${n++}`;
  return id;
}

export interface BuildResult {
  spendings: Spending[];
  duplicates: number;
}

/**
 * Turn keyed expense rows into Spendings, applying the account→ownership and
 * bank-category→spending-category maps. Excluded rows are skipped; rows whose id
 * already exists are counted as duplicates and skipped.
 */
export function buildSpendings(
  keyed: KeyedTxn[],
  categoryTarget: Record<string, string>,
  accountOwnership: Record<string, OwnershipEntry[]>,
  existingIds: Set<string>,
  now: string,
  excludedIds: Set<string> = new Set(),
): BuildResult {
  const spendings: Spending[] = [];
  let duplicates = 0;

  for (const { txn: t, id } of keyed) {
    if (excludedIds.has(id)) continue;
    if (existingIds.has(id)) { duplicates++; continue; }
    const category_id = categoryTarget[t.category];
    if (!category_id) continue; // unmapped — shouldn't happen after the wizard
    spendings.push({
      id,
      date: t.date,
      amount: t.amount,
      currency: t.currency,
      category_id,
      ownership: accountOwnership[t.account] ?? [],
      comment: t.description || undefined,
      entered_at: now,
    });
  }

  return { spendings, duplicates };
}
