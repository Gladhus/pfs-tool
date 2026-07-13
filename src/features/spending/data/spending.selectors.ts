import type { Currency, Spending, SpendingRecurrence } from '@/types/sheets';
import { addMonths } from '@/shared/utils/dates';
import { toMain } from '@/shared/utils/currency';
import { HOUSEHOLD_VIEWER, totalShare, viewerShare } from '@/shared/utils/ownership';

// ── Types ──────────────────────────────────────────────────────────────────

/** Inclusive day-level window the pages look at (usually one calendar month). */
export interface SpendingWindow {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

/** Everything valuation needs that isn't on the raw row. */
export interface SpendingCtx {
  main: Currency;
  fxRateFor: (date: string) => number | null;
}

/** A ledger row — a stored spending or an expanded recurrence occurrence. */
export type LedgerRow = Spending & { recurring: boolean };

/** One owner's converted slice of one ledger row (a sample, not an event). */
export interface SpendingSlice {
  date: string;
  categoryId: string;
  ownerId: string;
  amount: number;   // this owner's share, in MAIN currency (positive)
  sourceId: string; // spending id / recur:* id
}

export interface CategoryBreakdown { categoryId: string; amount: number; pct: number }
export interface PersonBreakdown { ownerId: string; amount: number; pct: number }

export interface SpendingSummary {
  window: SpendingWindow;
  total: number;
  count: number;                       // distinct ledger rows visible to the viewer
  byCategory: CategoryBreakdown[];     // sorted desc
  byPerson: PersonBreakdown[];         // sorted desc
  /** Phase 2 — populated once budgets ship; undefined today. */
  budget?: { category: Record<string, number>; total: number };
}

// ── Date helpers (local, no clock reads) ─────────────────────────────────────

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** 'YYYY-MM' → the inclusive window covering that whole month. */
export function monthWindow(monthKey: string): SpendingWindow {
  const [y, m] = monthKey.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0); // day 0 of next month = last day of this month
  return { start: isoOf(start), end: isoOf(end) };
}

/** The 'YYYY-MM' of an ISO date. */
export function monthKeyOf(date: string): string {
  return date.slice(0, 7);
}

/** Shift a 'YYYY-MM' key by N months. */
export function shiftMonthKey(monthKey: string, months: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  return isoOf(addMonths(new Date(y, m - 1, 1), months)).slice(0, 7);
}

// ── Recurrence expansion (virtual, read-time) ────────────────────────────────

function stepDate(d: Date, rule: SpendingRecurrence, interval: number): Date {
  switch (rule.frequency) {
    case 'weekly':   return addDays(d, 7 * interval);
    case 'biweekly': return addDays(d, 14 * interval);
    case 'yearly':   return addMonths(d, 12 * interval);
    case 'monthly':
    default:         return addMonths(d, interval);
  }
}

/** Concrete occurrence dates of a rule that fall inside the window. */
export function expandRecurrence(rule: SpendingRecurrence, w: SpendingWindow): string[] {
  if (rule.active === false || !rule.start_date) return [];
  const hardEnd = rule.end_date && rule.end_date < w.end ? rule.end_date : w.end;
  if (rule.start_date > hardEnd) return [];
  const interval = Math.max(1, rule.interval || 1);
  const out: string[] = [];
  let cur = parseISO(rule.start_date);
  // Bounded loop: even a daily-ish weekly rule over years stays well under the cap.
  for (let guard = 0; guard < 20000; guard++) {
    const iso = isoOf(cur);
    if (iso > hardEnd) break;
    if (iso >= w.start) out.push(iso);
    cur = stepDate(cur, rule, interval);
  }
  return out;
}

/** All active rules expanded into synthetic, spending-shaped occurrence rows. */
export function recurringOccurrences(rules: SpendingRecurrence[], w: SpendingWindow): Spending[] {
  const out: Spending[] = [];
  for (const rule of rules) {
    for (const date of expandRecurrence(rule, w)) {
      out.push({
        id: `recur:${rule.id}:${date}`,
        date,
        amount: rule.amount,
        currency: rule.currency,
        category_id: rule.category_id,
        ownership: rule.ownership,
        comment: rule.comment,
      });
    }
  }
  return out;
}

// ── Ledger, slicing, summary ─────────────────────────────────────────────────

/** One-off spendings ∪ expanded recurrences within the window, newest first. */
export function ledgerFor(spendings: Spending[], rules: SpendingRecurrence[], w: SpendingWindow): LedgerRow[] {
  const oneOff = spendings.filter(s => s.date >= w.start && s.date <= w.end);
  // A stored row with a recur:* id overrides the generated occurrence for that rule+date.
  // `recurring` marks a *generated* occurrence (read-only in the ledger); a stored
  // override is a real, editable row even though it carries a recur:* id.
  const storedIds = new Set(oneOff.map(s => s.id));
  const occ = recurringOccurrences(rules, w).filter(o => !storedIds.has(o.id));
  const rows: LedgerRow[] = [
    ...oneOff.map(r => ({ ...r, recurring: false })),
    ...occ.map(r => ({ ...r, recurring: true })),
  ];
  rows.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  return rows;
}

/** Split each row into one converted slice per owner. */
export function sliceLedger(rows: Spending[], ctx: SpendingCtx): SpendingSlice[] {
  const slices: SpendingSlice[] = [];
  for (const r of rows) {
    const converted = toMain(r.amount, r.currency ?? ctx.main, ctx.main, ctx.fxRateFor(r.date));
    const owners = r.ownership.filter(o => o.share > 0);
    if (!owners.length) {
      // Defensive: an unsplit row still counts toward the household total.
      slices.push({ date: r.date, categoryId: r.category_id, ownerId: '', amount: converted, sourceId: r.id });
      continue;
    }
    for (const o of owners) {
      slices.push({ date: r.date, categoryId: r.category_id, ownerId: o.person_id, amount: converted * o.share, sourceId: r.id });
    }
  }
  return slices;
}

/** A single row's amount as seen by the viewer, converted to main currency. */
export function viewerAmount(row: Spending, ctx: SpendingCtx, viewer: string): number {
  const converted = toMain(row.amount, row.currency ?? ctx.main, ctx.main, ctx.fxRateFor(row.date));
  if (viewer === HOUSEHOLD_VIEWER) return converted * (totalShare(row.ownership) || 1);
  return converted * viewerShare(row.ownership, viewer);
}

/** The overview roll-up for one window, scoped to the viewer. */
export function spendingSummary(
  spendings: Spending[],
  rules: SpendingRecurrence[],
  w: SpendingWindow,
  ctx: SpendingCtx,
  viewer: string,
): SpendingSummary {
  const rows = ledgerFor(spendings, rules, w);
  const slices = sliceLedger(rows, ctx);
  const visible = viewer === HOUSEHOLD_VIEWER ? slices : slices.filter(s => s.ownerId === viewer);

  const total = visible.reduce((sum, s) => sum + s.amount, 0);
  const count = new Set(visible.map(s => s.sourceId)).size;

  const catMap = new Map<string, number>();
  for (const s of visible) catMap.set(s.categoryId, (catMap.get(s.categoryId) ?? 0) + s.amount);
  const byCategory = [...catMap.entries()]
    .map(([categoryId, amount]) => ({ categoryId, amount, pct: total ? (amount / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);

  const perMap = new Map<string, number>();
  for (const s of visible) perMap.set(s.ownerId, (perMap.get(s.ownerId) ?? 0) + s.amount);
  const byPerson = [...perMap.entries()]
    .map(([ownerId, amount]) => ({ ownerId, amount, pct: total ? (amount / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);

  return { window: w, total, count, byCategory, byPerson };
}

/** Distinct 'YYYY-MM' keys that have any one-off spending, newest first. */
export function monthsWithData(spendings: Spending[]): string[] {
  return [...new Set(spendings.map(s => monthKeyOf(s.date)))].sort((a, b) => b.localeCompare(a));
}

// ── Overview period windows ──────────────────────────────────────────────────

export type SpendingPeriod = 'month' | '3m' | '6m' | 'ytd' | '1y' | 'all';

/**
 * The window a given overview period maps to, relative to `today` (YYYY-MM-DD).
 * Multi-month periods span whole calendar months (e.g. 3M = the current month plus
 * the two before it, from the 1st of the earliest to the last day of the current).
 */
export function periodWindow(period: SpendingPeriod, today: string): SpendingWindow {
  const thisMonth = today.slice(0, 7);
  if (period === 'month') return monthWindow(thisMonth);
  if (period === 'all') return { start: '0000-01-01', end: monthWindow(thisMonth).end };
  if (period === 'ytd') return { start: `${today.slice(0, 4)}-01-01`, end: monthWindow(thisMonth).end };
  const months = period === '3m' ? 3 : period === '6m' ? 6 : 12; // 1y
  return { start: monthWindow(shiftMonthKey(thisMonth, -(months - 1))).start, end: monthWindow(thisMonth).end };
}

// ── Detail: per-category, per-period table (MoM / YoY) ───────────────────────

export interface CategoryPeriodRow {
  categoryId: string;
  cells: number[];   // aligned to `periods`
  total: number;
}

export interface CategoryPeriodTable {
  periods: string[];        // column keys (oldest → newest); 'YYYY-MM' or 'YYYY'
  rows: CategoryPeriodRow[]; // sorted by total desc
  columnTotals: number[];
  grandTotal: number;
}

/**
 * Spending per category across the most recent `maxPeriods` periods that actually
 * have data (empty periods are skipped, so 2 years of history shows 2 columns,
 * not 6). `granularity` = 'month' for MoM, 'year' for YoY.
 */
export function categoryPeriodTable(
  spendings: Spending[],
  rules: SpendingRecurrence[],
  ctx: SpendingCtx,
  viewer: string,
  granularity: 'month' | 'year',
  today: string,
  maxPeriods = 6,
): CategoryPeriodTable {
  const empty: CategoryPeriodTable = { periods: [], rows: [], columnTotals: [], grandTotal: 0 };
  const dates = [...spendings.map(s => s.date), ...rules.map(r => r.start_date)].filter(Boolean);
  if (!dates.length) return empty;

  const start = dates.reduce((a, b) => (a < b ? a : b));
  const w: SpendingWindow = { start, end: today };
  const slices = sliceLedger(ledgerFor(spendings, rules, w), ctx);
  const visible = viewer === HOUSEHOLD_VIEWER ? slices : slices.filter(s => s.ownerId === viewer);

  const keyOf = (date: string) => (granularity === 'month' ? date.slice(0, 7) : date.slice(0, 4));

  const byPeriodCat = new Map<string, Map<string, number>>();
  for (const s of visible) {
    const pk = keyOf(s.date);
    let m = byPeriodCat.get(pk);
    if (!m) { m = new Map(); byPeriodCat.set(pk, m); }
    m.set(s.categoryId, (m.get(s.categoryId) ?? 0) + s.amount);
  }

  const withData = [...byPeriodCat.keys()].sort();
  if (!withData.length) return empty;

  // Columns are a CONTIGUOUS run ending at the latest period with data — middle
  // gaps are kept (shown as $0 for a true period-over-period comparison), only
  // leading empties are trimmed, and the run is capped at `maxPeriods` columns.
  const first = withData[0];
  const last = withData[withData.length - 1];
  const step = (key: string, n: number) => (granularity === 'month' ? shiftMonthKey(key, n) : String(Number(key) + n));
  let colStart = step(last, -(maxPeriods - 1));
  if (colStart < first) colStart = first;
  const periods: string[] = [];
  for (let k = colStart; k <= last && periods.length < maxPeriods; k = step(k, 1)) periods.push(k);

  const catTotals = new Map<string, number>();
  for (const p of periods) for (const [cat, amt] of byPeriodCat.get(p) ?? []) catTotals.set(cat, (catTotals.get(cat) ?? 0) + amt);

  const rows: CategoryPeriodRow[] = [...catTotals.keys()]
    .map(cat => ({ categoryId: cat, cells: periods.map(p => byPeriodCat.get(p)?.get(cat) ?? 0), total: catTotals.get(cat) ?? 0 }))
    .sort((a, b) => b.total - a.total);

  const columnTotals = periods.map(p => [...(byPeriodCat.get(p)?.values() ?? [])].reduce((a, b) => a + b, 0));
  const grandTotal = columnTotals.reduce((a, b) => a + b, 0);

  return { periods, rows, columnTotals, grandTotal };
}
