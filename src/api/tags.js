import { state, HEADERS } from '../core/state.js';
import { safeWriteTab } from './sheets.js';

async function ensureTagsTab() {
  try {
    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: state.sheetId,
      resource: { requests: [{ addSheet: { properties: { title: 'tags' } } }] },
    });
  } catch {
    // Already exists — fine
  }
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: state.sheetId, range: 'tags!A1',
    valueInputOption: 'RAW',
    resource: { values: [HEADERS.tags] },
  });
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
  } catch {
    console.log('[pfs] tags tab missing — creating');
    try { await ensureTagsTab(); } catch (e) { console.warn('[pfs] ensureTagsTab failed', e); }
    state.tagsCatalog = [];
  }
}

export async function writeTagsCatalog(tags) {
  await ensureTagsTab();
  const rows = [HEADERS.tags, ...tags.map(t => [t.name])];
  await safeWriteTab('tags', rows, state.tagsCatalog.length);
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
