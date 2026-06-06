import seedData from '../../seed/default-accounts.json';
import type { Account, Snapshot, CategoryMeta } from '@/types/sheets';
import { gapiCall } from './sheets';
import { normalizeDate } from '@/utils/dates';

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(t => String(t).trim()).filter(Boolean);
  if (!raw) return [];
  return String(raw).split(',').map(t => t.trim()).filter(Boolean);
}

function parseNum(v: unknown, fallback: number): number {
  if (v === '' || v == null) return fallback;
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

export async function loadAccounts(sheetId: string): Promise<Account[]> {
  const resp = await gapiCall(() => gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'accounts!A:Z',
    valueRenderOption: 'UNFORMATTED_VALUE',
  }));
  const rows = resp.result.values ?? [];
  if (rows.length < 2) return [];
  const headers = rows[0] as string[];
  return (rows.slice(1) as unknown[][]).map(r => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => { obj[h] = r[i] ?? ''; });
    obj.ownership_share = parseNum(obj.ownership_share, 1);
    obj.sort_order      = parseNum(obj.sort_order, 0);
    obj.annual_rate     = parseNum(obj.annual_rate, 0);
    obj.active = obj.active === true || String(obj.active).toUpperCase() === 'TRUE';
    obj.tags = parseTags(obj.tags);
    return obj as unknown as Account;
  }).filter(a => a.id);
}

export async function loadSnapshots(sheetId: string): Promise<Snapshot[]> {
  const resp = await gapiCall(() => gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'snapshots!A:Z',
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER',
  }));
  const rows = resp.result.values ?? [];
  if (rows.length < 2) return [];
  const headers = rows[0] as string[];
  const dataRows = rows.slice(1) as unknown[][];
  const seen = new Map<string, Snapshot & { _idx: number }>();

  dataRows.forEach((r, idx) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => { obj[h] = r[i] ?? ''; });
    const dateRaw = (obj.date ?? obj.month ?? '') as string;
    obj.date = normalizeDate(dateRaw);
    delete obj.month;
    obj.balance_raw = Number(obj.balance_raw);
    if (!obj.date) return;
    if (!obj.account_id) return;
    if (!Number.isFinite(obj.balance_raw as number)) obj.balance_raw = 0;

    const key = `${obj.date}|${obj.account_id}`;
    const prev = seen.get(key);
    if (!prev) { seen.set(key, { ...(obj as unknown as Snapshot), _idx: idx }); return; }

    const ta = (obj.entered_at as string) || '';
    const tp = prev.entered_at || '';
    const wins = ta && tp ? (ta > tp || (ta === tp && idx > prev._idx)) : (!ta && !tp ? idx > prev._idx : !!ta);
    if (wins) seen.set(key, { ...(obj as unknown as Snapshot), _idx: idx });
  });

  return [...seen.values()].map(({ _idx: _i, ...rest }) => rest as Snapshot);
}

export async function loadCategoryMeta(): Promise<CategoryMeta[]> {
  const seed = seedData as { categories?: CategoryMeta[] };
  return seed.categories ?? [];
}
