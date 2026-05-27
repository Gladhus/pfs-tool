import seedData from '../seed/default-accounts.json';
import { state, HEADERS, SHEET_TITLE } from './state.js';
import { normalizeDate, normalizeMonth, rebuildDatesList, logCoverageDiagnostic } from './utils.js';
import { setStatus } from './dom.js';

const cfg = window.PFS_CONFIG || {};

export async function verifySheet(id) {
  try {
    await gapi.client.sheets.spreadsheets.get({ spreadsheetId: id, fields: 'spreadsheetId' });
    return true;
  } catch (_) {
    return false;
  }
}

export async function findSheetByName(name) {
  const escaped = name.replace(/'/g, "\\'");
  const resp = await gapi.client.drive.files.list({
    q: `name='${escaped}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: 'files(id,name)',
    pageSize: 1,
  });
  return resp.result.files?.[0]?.id || null;
}

export async function createSheet() {
  const resp = await gapi.client.sheets.spreadsheets.create({
    resource: {
      properties: { title: SHEET_TITLE, locale: 'fr_CA' },
      sheets: [
        { properties: { title: 'accounts' } },
        { properties: { title: 'snapshots' } },
        { properties: { title: 'config' } },
      ],
    },
    fields: 'spreadsheetId',
  });
  return resp.result.spreadsheetId;
}

export async function seedNewSheet(sheetId) {
  const accountRows = [
    HEADERS.accounts,
    ...seedData.accounts.map(a => HEADERS.accounts.map(h => a[h] ?? '')),
  ];
  const snapshotRows = [HEADERS.snapshots];
  const configRows = [
    HEADERS.config,
    ['schema_version', String(seedData.schema_version || 1)],
    ['language',       cfg.LANGUAGE || 'fr'],
    ['currency',       cfg.CURRENCY || 'CAD'],
    ['created_at',     new Date().toISOString()],
  ];

  await gapi.client.sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    resource: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: 'accounts!A1',  values: accountRows },
        { range: 'snapshots!A1', values: snapshotRows },
        { range: 'config!A1',    values: configRows },
      ],
    },
  });
}

export async function loadAccounts() {
  const resp = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: state.sheetId,
    range: 'accounts!A:Z',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
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
    obj.active = obj.active === true || String(obj.active).toUpperCase() === 'TRUE';
    return obj;
  }).filter(a => a.id);
}

export async function loadSnapshots() {
  const resp = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: state.sheetId,
    range: 'snapshots!A:Z',
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER',
  });
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

export async function loadAll() {
  setStatus('Loading accounts and snapshots…');
  await Promise.all([loadAccounts(), loadSnapshots(), loadCategoryMeta()]);
  rebuildDatesList();
  logCoverageDiagnostic();
}

export async function migrateMonthlyToDaily() {
  const resp = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: state.sheetId,
    range: 'snapshots!A:A',
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const cells = resp.result.values || [];
  if (!cells.length) return 0;

  const updates = [];
  cells.forEach((cell, rowIdx) => {
    if (rowIdx === 0) return; // skip header
    const val = String(cell[0] || '').trim();
    if (/^\d{4}-\d{2}$/.test(val)) {
      updates.push({ range: `snapshots!A${rowIdx + 1}`, values: [[`${val}-01`]] });
    }
  });

  if (!updates.length) return 0;

  await gapi.client.sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: state.sheetId,
    resource: { valueInputOption: 'RAW', data: updates },
  });
  return updates.length;
}
