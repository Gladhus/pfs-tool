import type { SpendingCategory, Spending, SpendingRecurrence, RecurrenceFrequency } from '@/types/sheets';
import { HEADERS, DEFAULT_SPENDING_CATEGORIES } from '@/constants';
import { ownershipFromRow, serializeOwnership } from '@/shared/utils/ownership';
import { normalizeDate } from '@/shared/utils/dates';
import { gapiCall, gapiErrorStatus, safeWriteTab } from './sheets';

const RECURRENCE_FREQUENCIES: RecurrenceFrequency[] = ['weekly', 'biweekly', 'monthly', 'yearly'];

function parseNum(v: unknown, fallback = 0): number {
  if (v === '' || v == null) return fallback;
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

function parseCurrency(v: unknown): 'CAD' | 'USD' | undefined {
  const cur = String(v).toUpperCase();
  return cur === 'USD' || cur === 'CAD' ? cur : undefined;
}

async function ensureTab(sheetId: string, title: string, headers: readonly string[]): Promise<void> {
  try {
    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      resource: { requests: [{ addSheet: { properties: { title } } }] },
    });
  } catch { /* already exists */ }
  await gapiCall(() => gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${title}!A1`,
    valueInputOption: 'RAW',
    resource: { values: [headers as unknown as string[]] },
  }));
}

async function loadTab<T>(sheetId: string, tab: string, headers: readonly string[], parse: (obj: Record<string, unknown>) => T | null): Promise<T[]> {
  try {
    const resp = await gapiCall(() => gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tab}!A:Z`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    }));
    const rows = resp.result.values ?? [];
    if (rows.length < 2) return [];
    const hs = rows[0] as string[];
    return (rows.slice(1) as unknown[][]).map(r => {
      const obj: Record<string, unknown> = {};
      hs.forEach((h, i) => { obj[h] = r[i] ?? ''; });
      return parse(obj);
    }).filter((x): x is T => x !== null);
  } catch (err) {
    // A missing tab surfaces as a 400 "Unable to parse range" — the only case we
    // treat as "no data yet". Any other failure must bubble up (never mistake a
    // transient error for an empty tab and overwrite real data).
    if (gapiErrorStatus(err) !== 400) throw err;
    try { await ensureTab(sheetId, tab, headers); } catch { /* ignore */ }
    return [];
  }
}

async function writeTab(sheetId: string, tab: string, headers: readonly string[], rows: unknown[][], previousCount: number): Promise<void> {
  await ensureTab(sheetId, tab, headers);
  await safeWriteTab(sheetId, tab, rows, previousCount);
}

// ── Spending categories (seeded with defaults on first empty load) ──────────
export async function loadSpendingCategories(sheetId: string): Promise<SpendingCategory[]> {
  const categories = await loadTab<SpendingCategory>(sheetId, 'spending_categories', HEADERS.spending_categories, obj => {
    if (!obj.id) return null;
    return {
      id: String(obj.id).trim(),
      name_fr: String(obj.name_fr ?? '').trim(),
      name_en: String(obj.name_en ?? '').trim(),
      color: String(obj.color ?? '').trim(),
      icon: obj.icon ? String(obj.icon).trim() : undefined,
      sort_order: parseNum(obj.sort_order, 0),
      active: obj.active === true || String(obj.active).toUpperCase() !== 'FALSE',
    } as SpendingCategory;
  });
  if (categories.length) return categories;
  // Empty (new or freshly-created tab): seed the starter set so entries have categories.
  try { await writeSpendingCategories(sheetId, DEFAULT_SPENDING_CATEGORIES, 0); } catch { /* retry on next save */ }
  return DEFAULT_SPENDING_CATEGORIES;
}

export async function loadSpendings(sheetId: string): Promise<Spending[]> {
  return loadTab<Spending>(sheetId, 'spendings', HEADERS.spendings, obj => {
    if (!obj.id) return null;
    const date = normalizeDate(obj.date as string);
    if (!date) return null;
    return {
      id: String(obj.id).trim(),
      date,
      amount: parseNum(obj.amount, 0),
      currency: parseCurrency(obj.currency),
      category_id: String(obj.category_id ?? '').trim(),
      ownership: ownershipFromRow(obj),
      comment: obj.comment ? String(obj.comment) : undefined,
      entered_at: obj.entered_at ? String(obj.entered_at) : undefined,
    } as Spending;
  });
}

export async function loadSpendingRecurrences(sheetId: string): Promise<SpendingRecurrence[]> {
  return loadTab<SpendingRecurrence>(sheetId, 'spending_recurrences', HEADERS.spending_recurrences, obj => {
    if (!obj.id) return null;
    const start = normalizeDate(obj.start_date as string);
    if (!start) return null;
    const freq = String(obj.frequency ?? '').toLowerCase();
    const end = normalizeDate(obj.end_date as string);
    return {
      id: String(obj.id).trim(),
      label: String(obj.label ?? '').trim(),
      amount: parseNum(obj.amount, 0),
      currency: parseCurrency(obj.currency),
      category_id: String(obj.category_id ?? '').trim(),
      ownership: ownershipFromRow(obj),
      frequency: (RECURRENCE_FREQUENCIES as string[]).includes(freq) ? (freq as RecurrenceFrequency) : 'monthly',
      interval: Math.max(1, parseNum(obj.interval, 1)),
      start_date: start,
      end_date: end || undefined,
      active: obj.active === true || String(obj.active).toUpperCase() !== 'FALSE',
      comment: obj.comment ? String(obj.comment) : undefined,
    } as SpendingRecurrence;
  });
}

export function writeSpendingCategories(sheetId: string, items: SpendingCategory[], prev: number): Promise<void> {
  const rows: unknown[][] = [
    HEADERS.spending_categories as unknown as string[],
    ...items.map(c => [c.id, c.name_fr, c.name_en, c.color, c.icon ?? '', c.sort_order, c.active ? 'TRUE' : 'FALSE']),
  ];
  return writeTab(sheetId, 'spending_categories', HEADERS.spending_categories, rows, prev);
}

export function writeSpendings(sheetId: string, items: Spending[], prev: number): Promise<void> {
  const rows: unknown[][] = [
    HEADERS.spendings as unknown as string[],
    ...items.map(s => [s.id, s.date, s.amount, s.currency ?? '', s.category_id, serializeOwnership(s.ownership), s.comment ?? '', s.entered_at ?? '']),
  ];
  return writeTab(sheetId, 'spendings', HEADERS.spendings, rows, prev);
}

export function writeSpendingRecurrences(sheetId: string, items: SpendingRecurrence[], prev: number): Promise<void> {
  const rows: unknown[][] = [
    HEADERS.spending_recurrences as unknown as string[],
    ...items.map(r => [r.id, r.label, r.amount, r.currency ?? '', r.category_id, serializeOwnership(r.ownership), r.frequency, r.interval, r.start_date, r.end_date ?? '', r.active ? 'TRUE' : 'FALSE', r.comment ?? '']),
  ];
  return writeTab(sheetId, 'spending_recurrences', HEADERS.spending_recurrences, rows, prev);
}
