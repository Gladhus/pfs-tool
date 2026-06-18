import type { Account, Snapshot, AppConfig, Tag, Group, Person, FxRate, OptionCompany, OptionGrant, OptionFmv, OptionExercise } from '@/types/sheets';
import { HEADERS } from '@/constants';
import { normalizeDate } from '@/utils/dates';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function parseTagString(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(t => String(t).trim()).filter(Boolean);
  if (!raw) return [];
  return String(raw).split(',').map(t => t.trim()).filter(Boolean);
}

export function parseNum(v: unknown, fallback = 0): number {
  if (v === '' || v == null) return fallback;
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

function toObj(headers: string[], row: unknown[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
  return obj;
}

// ── Parse (AOA → typed) ───────────────────────────────────────────────────────

export function parseAccountRows(rows: unknown[][]): Account[] {
  if (rows.length < 2) return [];
  const headers = rows[0] as string[];
  return (rows.slice(1) as unknown[][]).map(r => {
    const obj = toObj(headers, r);
    obj.ownership_share = parseNum(obj.ownership_share, 1);
    obj.sort_order      = parseNum(obj.sort_order, 0);
    obj.annual_rate     = parseNum(obj.annual_rate, 0);
    obj.active = obj.active === true || String(obj.active).toUpperCase() === 'TRUE';
    obj.tags = parseTagString(obj.tags);
    const cur = String(obj.currency).toUpperCase();
    obj.currency = cur === 'USD' || cur === 'CAD' ? cur : undefined;
    return obj as unknown as Account;
  }).filter(a => a.id);
}

export function parseSnapshotRows(rows: unknown[][]): Snapshot[] {
  if (rows.length < 2) return [];
  const headers = rows[0] as string[];
  const dataRows = rows.slice(1) as unknown[][];
  const seen = new Map<string, Snapshot & { _idx: number }>();

  dataRows.forEach((r, idx) => {
    const obj = toObj(headers, r);
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

export function parseConfigRows(rows: unknown[][]): Partial<AppConfig> {
  const map = Object.fromEntries((rows.slice(1) as string[][]).map(r => [r[0], r[1] ?? '']));
  const theme = map.theme as 'system' | 'light' | 'dark' | undefined;
  return {
    language: (map.language as 'en' | 'fr') || 'en',
    currency: map.currency || 'CAD',
    schema_version: map.schema_version || '1',
    last_imported_at: map.last_imported_at || undefined,
    stock_options_enabled:
      map.stock_options_enabled === '1' ? true :
      map.stock_options_enabled === '0' ? false : undefined,
    theme: (theme === 'system' || theme === 'light' || theme === 'dark') ? theme : undefined,
  };
}

export function parseTagRows(rows: unknown[][]): Tag[] {
  if (rows.length < 2) return [];
  const headers = rows[0] as string[];
  const nameIdx = headers.indexOf('name');
  if (nameIdx < 0) return [];
  const seen = new Set<string>();
  const result: Tag[] = [];
  for (const r of rows.slice(1) as string[][]) {
    const name = (r[nameIdx] ?? '').toString().trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    result.push({ name });
  }
  return result;
}

const splitTags = (raw: unknown): string[] =>
  raw ? String(raw).split(',').map(t => t.trim()).filter(Boolean) : [];

export function parseGroupRows(rows: unknown[][]): Group[] {
  if (rows.length < 2) return [];
  const headers = rows[0] as string[];
  const ni = headers.indexOf('name');
  const ci = headers.indexOf('color');
  const ai = headers.indexOf('all');
  const ayi = headers.indexOf('any');
  const ei = headers.indexOf('exclude');
  if (ni < 0) return [];
  const result: Group[] = [];
  for (const r of rows.slice(1) as string[][]) {
    const name = (r[ni] ?? '').toString().trim();
    if (!name) continue;
    result.push({
      name,
      color:   ci >= 0  ? (r[ci]  ?? '').toString().trim() : '',
      all:     ai >= 0  ? splitTags(r[ai])  : [],
      any:     ayi >= 0 ? splitTags(r[ayi]) : [],
      exclude: ei >= 0  ? splitTags(r[ei])  : [],
    });
  }
  return result;
}

export function parsePeopleRows(rows: unknown[][]): Person[] {
  if (rows.length < 2) return [];
  const headers = rows[0] as string[];
  return (rows.slice(1) as unknown[][]).map(r => {
    const obj = toObj(headers, r);
    return {
      id: String(obj.id ?? '').trim(),
      name: String(obj.name ?? '').trim(),
      email: obj.email ? String(obj.email).trim() : undefined,
      color: obj.color ? String(obj.color).trim() : undefined,
      sort_order: parseNum(obj.sort_order, 0),
      active: obj.active === true || String(obj.active).toUpperCase() === 'TRUE',
    } as Person;
  }).filter(p => p.id);
}

export function parseFxRateRows(rows: unknown[][]): FxRate[] {
  if (rows.length < 2) return [];
  const hs = rows[0] as string[];
  return (rows.slice(1) as unknown[][])
    .map(r => {
      const obj = toObj(hs, r);
      return { date: String(obj.date ?? ''), usd_cad: Number(obj.usd_cad) };
    })
    .filter(r => r.date && Number.isFinite(r.usd_cad));
}

export function parseOptionCompanyRows(rows: unknown[][]): OptionCompany[] {
  if (rows.length < 2) return [];
  const hs = rows[0] as string[];
  return (rows.slice(1) as unknown[][]).map(r => {
    const obj = toObj(hs, r);
    if (!obj.id) return null;
    const cur = String(obj.currency).toUpperCase();
    return {
      ...obj,
      active: obj.active === true || String(obj.active).toUpperCase() !== 'FALSE',
      tags: parseTagString(obj.tags),
      currency: cur === 'USD' || cur === 'CAD' ? cur : undefined,
    } as OptionCompany;
  }).filter((x): x is OptionCompany => x !== null);
}

export function parseOptionGrantRows(rows: unknown[][]): OptionGrant[] {
  if (rows.length < 2) return [];
  const hs = rows[0] as string[];
  return (rows.slice(1) as unknown[][]).map(r => {
    const obj = toObj(hs, r);
    if (!obj.id || !obj.company_id) return null;
    return {
      ...obj,
      total_shares:   parseNum(obj.total_shares),
      strike_price:   parseNum(obj.strike_price),
      cliff_months:   parseNum(obj.cliff_months),
      vesting_months: parseNum(obj.vesting_months),
    } as OptionGrant;
  }).filter((x): x is OptionGrant => x !== null);
}

export function parseOptionFmvRows(rows: unknown[][]): OptionFmv[] {
  if (rows.length < 2) return [];
  const hs = rows[0] as string[];
  return (rows.slice(1) as unknown[][]).map(r => {
    const obj = toObj(hs, r);
    if (!obj.date || !obj.company_id) return null;
    return { ...obj, fmv: parseNum(obj.fmv) } as OptionFmv;
  }).filter((x): x is OptionFmv => x !== null);
}

export function parseOptionExerciseRows(rows: unknown[][]): OptionExercise[] {
  if (rows.length < 2) return [];
  const hs = rows[0] as string[];
  return (rows.slice(1) as unknown[][]).map(r => {
    const obj = toObj(hs, r);
    if (!obj.id || !obj.grant_id) return null;
    return { ...obj, shares_exercised: parseNum(obj.shares_exercised), price_paid: parseNum(obj.price_paid) } as OptionExercise;
  }).filter((x): x is OptionExercise => x !== null);
}

// ── Serialize (typed → AOA) ───────────────────────────────────────────────────

export function serializeAccounts(accounts: Account[]): unknown[][] {
  const H = ['id', 'type', 'name_fr', 'name_en', 'category', 'kind', 'owner', 'ownership_share', 'active', 'sort_order', 'tags', 'annual_rate', 'currency'] as const;
  return [
    [...H],
    ...accounts.map(a => H.map(h => {
      if (h === 'active') return a.active ? 'TRUE' : 'FALSE';
      if (h === 'tags') return a.tags.join(', ');
      return (a as unknown as Record<string, unknown>)[h] ?? '';
    })),
  ];
}

export function serializeSnapshots(snapshots: Snapshot[]): unknown[][] {
  return [
    ['date', 'account_id', 'balance_raw', 'comment', 'entered_at'],
    ...snapshots.map(s => [s.date, s.account_id, s.balance_raw, s.comment ?? '', s.entered_at ?? '']),
  ];
}

export function serializeConfig(config: Partial<AppConfig>): unknown[][] {
  return [
    ['key', 'value'],
    ...Object.entries(config)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => {
        if (k === 'stock_options_enabled') return [k, v === true ? '1' : '0'];
        return [k, String(v)];
      }),
  ];
}

export function serializeTags(tags: Tag[]): unknown[][] {
  return [['name'], ...tags.map(t => [t.name])];
}

export function serializeGroups(groups: Group[]): unknown[][] {
  return [
    ['name', 'color', 'all', 'any', 'exclude'],
    ...groups.map(g => [g.name, g.color, g.all.join(', '), g.any.join(', '), g.exclude.join(', ')]),
  ];
}

export function serializePeople(people: Person[]): unknown[][] {
  return [
    [...HEADERS.people],
    ...people.map(p => [p.id, p.name, p.email ?? '', p.color ?? '', p.sort_order, p.active ? 'TRUE' : 'FALSE']),
  ];
}

export function serializeFxRates(rates: FxRate[]): unknown[][] {
  const sorted = [...rates].sort((a, b) => a.date.localeCompare(b.date));
  return [['date', 'usd_cad'], ...sorted.map(r => [r.date, r.usd_cad])];
}

function serializeByHeaders<T extends Record<string, unknown>>(headers: readonly string[], items: T[]): unknown[][] {
  return [
    [...headers],
    ...items.map(it => headers.map(h => it[h] ?? '')),
  ];
}

export function serializeOptionCompanies(items: OptionCompany[]): unknown[][] {
  return serializeByHeaders(
    ['id', 'name', 'ticker', 'active', 'tags', 'currency'],
    items.map(c => ({ ...c, active: c.active === false ? 'FALSE' : 'TRUE', tags: c.tags.join(', ') })) as unknown as Record<string, unknown>[],
  );
}

export function serializeOptionGrants(items: OptionGrant[]): unknown[][] {
  return serializeByHeaders(
    ['id', 'company_id', 'label', 'grant_type', 'grant_date', 'total_shares', 'strike_price', 'vesting_start', 'cliff_months', 'vesting_months', 'vesting_interval', 'expiry_date'],
    items as unknown as Record<string, unknown>[],
  );
}

export function serializeOptionFmv(items: OptionFmv[]): unknown[][] {
  return serializeByHeaders(['date', 'company_id', 'fmv', 'note'], items as unknown as Record<string, unknown>[]);
}

export function serializeOptionExercises(items: OptionExercise[]): unknown[][] {
  return serializeByHeaders(['id', 'grant_id', 'date', 'shares_exercised', 'price_paid', 'note'], items as unknown as Record<string, unknown>[]);
}
