import seedData from '../../seed/default-accounts.json';
import { state } from '../core/state.js';
import { normalizeDate } from '../utils/dates.js';
import { gapiCall } from './sheets.js';

function parseTags(raw) {
  if (Array.isArray(raw)) return raw.map(t => String(t).trim()).filter(Boolean);
  if (!raw) return [];
  return String(raw).split(',').map(t => t.trim()).filter(Boolean);
}

export async function loadAccounts() {
  const resp = await gapiCall(() => gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: state.sheetId,
    range: 'accounts!A:Z',
    valueRenderOption: 'UNFORMATTED_VALUE',
  }));
  const rows = resp.result.values || [];
  if (rows.length < 2) { state.accounts = []; return; }
  const headers = rows[0];

  const parseNum = (v, fallback) => {
    if (v === '' || v == null) return fallback;
    if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  };

  state.accounts = rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = r[i] ?? ''; });
    obj.ownership_share = parseNum(obj.ownership_share, 1);
    obj.sort_order      = parseNum(obj.sort_order, 0);
    obj.annual_rate     = parseNum(obj.annual_rate, 0);
    obj.active = obj.active === true || String(obj.active).toUpperCase() === 'TRUE';
    obj.tags = parseTags(obj.tags);
    return obj;
  }).filter(a => a.id);
}

export async function loadSnapshots() {
  const resp = await gapiCall(() => gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: state.sheetId,
    range: 'snapshots!A:Z',
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER',
  }));
  const rows = resp.result.values || [];
  if (rows.length < 2) { state.snapshots = []; return; }
  const headers = rows[0];

  const dataRows = rows.slice(1);
  const dropped = { noDate: 0, noAccount: 0, badDate: 0 };

  const seen = new Map();
  dataRows.forEach((r, idx) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = r[i] ?? ''; });
    // Support both old 'month' column name and new 'date' column name
    const dateRaw = obj.date ?? obj.month ?? '';
    obj.date = normalizeDate(dateRaw);
    delete obj.month;
    obj.balance_raw = Number(obj.balance_raw);
    if (!obj.date) { dropped.noDate++; if (dateRaw) dropped.badDate++; return; }
    if (!obj.account_id) { dropped.noAccount++; return; }
    if (!Number.isFinite(obj.balance_raw)) obj.balance_raw = 0;
    const key = `${obj.date}|${obj.account_id}`;
    const prev = seen.get(key);
    if (!prev) { seen.set(key, { ...obj, _idx: idx }); return; }
    const ta = obj.entered_at || '';
    const tp = prev.entered_at || '';
    const wins = ta && tp ? ta > tp : (!ta && !tp ? idx > prev._idx : !!ta);
    if (wins) seen.set(key, { ...obj, _idx: idx });
  });
  state.snapshots = [...seen.values()].map(({ _idx, ...rest }) => rest);

  const collapsed = dataRows.length - state.snapshots.length - dropped.noDate - dropped.noAccount;
  console.log('[pfs] snapshots loaded:', {
    sheetRows: dataRows.length,
    kept: state.snapshots.length,
    droppedNoDate: dropped.noDate,
    droppedBadDate: dropped.badDate,
    droppedNoAccount: dropped.noAccount,
    collapsedDuplicates: Math.max(0, collapsed),
  });
}

export async function loadCategoryMeta() {
  if (state.categoryMeta.length && state.accountTypes.length) return;
  state.categoryMeta = seedData.categories    || [];
  state.accountTypes = seedData.account_types || [];
}
