import { state, HEADERS } from '../core/state.js';
import { safeWriteTab } from './sheets.js';

async function ensureGroupsTab() {
  try {
    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: state.sheetId,
      resource: { requests: [{ addSheet: { properties: { title: 'groups' } } }] },
    });
  } catch { /* Already exists */ }
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
  } catch {
    console.log('[pfs] groups tab missing — creating');
    try { await ensureGroupsTab(); } catch (e) { console.warn('[pfs] ensureGroupsTab failed', e); }
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
  await safeWriteTab('groups', rows, state.groupsCatalog.length);
}
