import type { Account, Snapshot, Currency } from '@/types/sheets';
import { parseMoney } from '@/utils/format';
import { signedMain, rateFor } from '@/utils/currency';

export interface EntryFormEntry {
  balance: string;
  comment: string;
}
export type EntryForm = Record<string, EntryFormEntry>;

export interface EntryTotals {
  byCategory: Record<string, number>;
  netWorth: number;
  /** Accounts with a parsed balance this entry. */
  filled: number;
  /** Accounts visible to the viewer (the denominator for progress). */
  total: number;
  /** True when at least one account fell back to its previous (carried-forward) balance. */
  usingFallback: boolean;
}

/**
 * Net-worth + per-category totals for the entry form. Accounts left blank fall
 * back to their previous (carried-forward) balance so the running total mirrors
 * what will actually be saved. Pure — safe to unit test.
 */
export function computeEntryTotals(params: {
  visible: Account[];
  form: EntryForm;
  prevBalances: Record<string, number>;
  date: string;
  mainCurrency: Currency;
  fxRateMap: Map<string, number>;
  viewer: string;
}): EntryTotals {
  const { visible, form, prevBalances, date, mainCurrency, fxRateMap, viewer } = params;
  const byCategory: Record<string, number> = {};
  let netWorth = 0;
  let filled = 0;
  let usingFallback = false;
  const usdCad = rateFor(fxRateMap, date);
  for (const a of visible) {
    const parsed = parseMoney(form[a.id]?.balance ?? '');
    let balance: number;
    if (parsed !== null) { filled++; balance = parsed; }
    else if (prevBalances[a.id] !== undefined) { balance = prevBalances[a.id]; usingFallback = true; }
    else continue;
    const signed = signedMain(a, balance, mainCurrency, usdCad, viewer);
    byCategory[a.category] = (byCategory[a.category] ?? 0) + signed;
    netWorth += signed;
  }
  return { byCategory, netWorth, filled, total: visible.length, usingFallback };
}

export interface BuiltEntryRows {
  rows: Snapshot[];
  /** Accounts that previously had a value but will be removed by this save. */
  deleted: Account[];
}

/**
 * Builds the snapshot rows to persist for a date from the current form state.
 * Preserves rows for accounts that aren't active (so hidden owners' data is
 * never lost) and reports which previously-filled accounts would be deleted.
 * Pure apart from the timestamp, which can be injected for tests.
 */
export function buildEntryRows(params: {
  active: Account[];
  form: EntryForm;
  dayComment: string;
  snapshots: Snapshot[];
  date: string;
  existingBalances: Record<string, number>;
  enteredAt?: string;
}): BuiltEntryRows {
  const { active, form, dayComment, snapshots, date, existingBalances } = params;
  const enteredAt = params.enteredAt ?? new Date().toISOString();
  const activeIds = new Set(active.map(a => a.id));
  const rows: Snapshot[] = [];
  for (const a of active) {
    const parsed = parseMoney(form[a.id]?.balance ?? '');
    if (parsed !== null) {
      rows.push({
        date,
        account_id: a.id,
        balance_raw: parsed,
        comment: (form[a.id]?.comment ?? '').trim(),
        entered_at: enteredAt,
      });
    }
  }
  const dc = dayComment.trim();
  if (dc) rows.push({ date, account_id: '__day__', balance_raw: 0, comment: dc, entered_at: enteredAt });

  for (const s of snapshots) {
    if (s.date !== date || s.account_id === '__day__') continue;
    if (!activeIds.has(s.account_id)) rows.push(s);
  }

  const writtenIds = new Set(rows.map(r => r.account_id));
  const deleted = active.filter(a => existingBalances[a.id] !== undefined && !writtenIds.has(a.id));
  return { rows, deleted };
}
