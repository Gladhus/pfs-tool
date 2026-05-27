import seedData from '../seed/default-accounts.json';
import { state, HEADERS, SHEET_TITLE } from './state.js';
import { normalizeDate, rebuildDatesList, logCoverageDiagnostic } from './utils.js';
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
        { properties: { title: 'tags' } },
        { properties: { title: 'groups' } },
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
        { range: 'tags!A1',      values: [HEADERS.tags] },
        { range: 'groups!A1',    values: [HEADERS.groups] },
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
    obj.tags = parseTags(obj.tags);
    return obj;
  }).filter(a => a.id);
}

function parseTags(raw) {
  if (Array.isArray(raw)) return raw.map(t => String(t).trim()).filter(Boolean);
  if (!raw) return [];
  return String(raw).split(',').map(t => t.trim()).filter(Boolean);
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

export async function loadTagsCatalog() {
  try {
    const resp = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: state.sheetId,
      range: 'tags!A:Z',
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const rows = resp.result.values || [];
    if (rows.length < 2) { state.tagsCatalog = []; return; }
    const headers = rows[0];
    const nameIdx = headers.indexOf('name');
    if (nameIdx < 0) { state.tagsCatalog = []; return; }
    const seen = new Set();
    state.tagsCatalog = [];
    for (const r of rows.slice(1)) {
      const name = (r[nameIdx] ?? '').toString().trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      state.tagsCatalog.push({ name });
    }
  } catch (err) {
    console.log('[pfs] tags tab missing — creating');
    await ensureTagsTab();
    state.tagsCatalog = [];
  }
}

async function ensureTagsTab() {
  try {
    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: state.sheetId,
      resource: { requests: [{ addSheet: { properties: { title: 'tags' } } }] },
    });
  } catch (e) {
    // Already exists — fine
  }
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: state.sheetId, range: 'tags!A1',
    valueInputOption: 'RAW',
    resource: { values: [HEADERS.tags] },
  });
}

export async function writeTagsCatalog(tags) {
  await ensureTagsTab();
  const rows = [HEADERS.tags, ...tags.map(t => [t.name])];
  await gapi.client.sheets.spreadsheets.values.clear({
    spreadsheetId: state.sheetId, range: 'tags!A:Z',
  });
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: state.sheetId, range: 'tags!A1',
    valueInputOption: 'RAW', resource: { values: rows },
  });
}

// Union of catalog + any tag found on accounts (so manual edits to the
// accounts sheet still surface). Persists the merged set if it grew.
export async function mergeAndSyncTagsCatalog() {
  const names = new Set(state.tagsCatalog.map(t => t.name));
  let grew = false;
  for (const a of state.accounts) {
    if (!Array.isArray(a.tags)) continue;
    for (const t of a.tags) {
      if (t && !names.has(t)) { names.add(t); state.tagsCatalog.push({ name: t }); grew = true; }
    }
  }
  if (grew) {
    try { await writeTagsCatalog(state.tagsCatalog); }
    catch (err) { console.warn('[pfs] tags catalog sync failed', err); }
  }
}

async function ensureGroupsTab() {
  try {
    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: state.sheetId,
      resource: { requests: [{ addSheet: { properties: { title: 'groups' } } }] },
    });
  } catch (e) { /* Already exists */ }
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: state.sheetId, range: 'groups!A1',
    valueInputOption: 'RAW',
    resource: { values: [HEADERS.groups] },
  });
}

export async function loadGroupsCatalog() {
  try {
    const resp = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: state.sheetId,
      range: 'groups!A:Z',
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const rows = resp.result.values || [];
    if (rows.length < 2) { state.groupsCatalog = []; return; }
    const headers = rows[0];
    const ni = headers.indexOf('name');
    const ci = headers.indexOf('color');
    const ai = headers.indexOf('all');
    const ayi = headers.indexOf('any');
    const ei = headers.indexOf('exclude');
    if (ni < 0) { state.groupsCatalog = []; return; }
    const splitTags = (raw) => raw ? String(raw).split(',').map(t => t.trim()).filter(Boolean) : [];
    state.groupsCatalog = [];
    for (const r of rows.slice(1)) {
      const name = (r[ni] ?? '').toString().trim();
      if (!name) continue;
      state.groupsCatalog.push({
        name,
        color:   ci >= 0  ? (r[ci]  ?? '').toString().trim() : '',
        all:     ai >= 0  ? splitTags(r[ai])  : [],
        any:     ayi >= 0 ? splitTags(r[ayi]) : [],
        exclude: ei >= 0  ? splitTags(r[ei])  : [],
      });
    }
  } catch (err) {
    console.log('[pfs] groups tab missing — creating');
    await ensureGroupsTab();
    state.groupsCatalog = [];
  }
}

export async function writeGroupsCatalog(groups) {
  await ensureGroupsTab();
  const rows = [HEADERS.groups, ...groups.map(g => [
    g.name,
    g.color || '',
    (g.all || []).join(', '),
    (g.any || []).join(', '),
    (g.exclude || []).join(', '),
  ])];
  await gapi.client.sheets.spreadsheets.values.clear({
    spreadsheetId: state.sheetId, range: 'groups!A:Z',
  });
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: state.sheetId, range: 'groups!A1',
    valueInputOption: 'RAW', resource: { values: rows },
  });
}

export async function loadAll() {
  setStatus('Loading accounts and snapshots…');
  await Promise.all([loadAccounts(), loadSnapshots(), loadCategoryMeta(), loadTagsCatalog(), loadGroupsCatalog()]);
  await mergeAndSyncTagsCatalog();
  rebuildDatesList();
  logCoverageDiagnostic();
}

