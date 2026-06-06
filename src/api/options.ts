import type { OptionCompany, OptionGrant, OptionFmv, OptionExercise } from '@/types/sheets';
import { HEADERS } from '@/constants';
import { gapiCall, safeWriteTab } from './sheets';

function parseNum(v: unknown, fallback = 0): number {
  if (v === '' || v == null) return fallback;
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
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
  } catch {
    try { await ensureTab(sheetId, tab, headers); } catch { /* ignore */ }
    return [];
  }
}

export const loadOptionCompanies = (sheetId: string): Promise<OptionCompany[]> =>
  loadTab(sheetId, 'option_companies', HEADERS.option_companies, obj => {
    if (!obj.id) return null;
    return { ...obj, active: obj.active === true || String(obj.active).toUpperCase() !== 'FALSE' } as OptionCompany;
  });

export const loadOptionGrants = (sheetId: string): Promise<OptionGrant[]> =>
  loadTab(sheetId, 'option_grants', HEADERS.option_grants, obj => {
    if (!obj.id || !obj.company_id) return null;
    return {
      ...obj,
      total_shares: parseNum(obj.total_shares),
      strike_price: parseNum(obj.strike_price),
      cliff_months: parseNum(obj.cliff_months),
      vesting_months: parseNum(obj.vesting_months),
    } as OptionGrant;
  });

export const loadOptionFmv = (sheetId: string): Promise<OptionFmv[]> =>
  loadTab(sheetId, 'option_fmv', HEADERS.option_fmv, obj => {
    if (!obj.date || !obj.company_id) return null;
    return { ...obj, fmv: parseNum(obj.fmv) } as OptionFmv;
  });

export const loadOptionExercises = (sheetId: string): Promise<OptionExercise[]> =>
  loadTab(sheetId, 'option_exercises', HEADERS.option_exercises, obj => {
    if (!obj.id || !obj.grant_id) return null;
    return { ...obj, shares_exercised: parseNum(obj.shares_exercised), price_paid: parseNum(obj.price_paid) } as OptionExercise;
  });

async function writeTab<T extends Record<string, unknown>>(
  sheetId: string, tab: string, headers: readonly string[], items: T[], previousCount: number,
): Promise<void> {
  await ensureTab(sheetId, tab, headers);
  const rows: unknown[][] = items.length
    ? [headers as unknown as string[], ...items.map(it => headers.map(h => it[h] ?? ''))]
    : [headers as unknown as string[]];
  await safeWriteTab(sheetId, tab, rows, previousCount);
}

export const writeOptionCompanies = (sheetId: string, items: OptionCompany[], prev: number) =>
  writeTab(sheetId, 'option_companies', HEADERS.option_companies,
    items.map(c => ({ ...c, active: c.active === false ? 'FALSE' : 'TRUE' })), prev);

export const writeOptionGrants = (sheetId: string, items: OptionGrant[], prev: number) =>
  writeTab(sheetId, 'option_grants', HEADERS.option_grants, items as unknown as Record<string, unknown>[], prev);

export const writeOptionFmv = (sheetId: string, items: OptionFmv[], prev: number) =>
  writeTab(sheetId, 'option_fmv', HEADERS.option_fmv, items as unknown as Record<string, unknown>[], prev);

export const writeOptionExercises = (sheetId: string, items: OptionExercise[], prev: number) =>
  writeTab(sheetId, 'option_exercises', HEADERS.option_exercises, items as unknown as Record<string, unknown>[], prev);
