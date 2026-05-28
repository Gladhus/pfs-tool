import { state, HEADERS } from '../core/state.js';

async function ensureTab(title, headers) {
  try {
    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: state.sheetId,
      resource: { requests: [{ addSheet: { properties: { title } } }] },
    });
  } catch (_) { /* already exists */ }
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: state.sheetId, range: `${title}!A1`,
    valueInputOption: 'RAW',
    resource: { values: [headers] },
  });
}

function parseNum(v, fallback = 0) {
  if (v === '' || v == null) return fallback;
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

export async function loadOptionCompanies() {
  try {
    const resp = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: state.sheetId, range: 'option_companies!A:Z',
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const rows = resp.result.values || [];
    if (rows.length < 2) { state.optionCompanies = []; return; }
    const headers = rows[0];
    state.optionCompanies = rows.slice(1).map(r => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = r[i] ?? ''; });
      obj.active = obj.active === true || String(obj.active).toUpperCase() !== 'FALSE';
      return obj;
    }).filter(c => c.id);
  } catch (_) {
    await ensureTab('option_companies', HEADERS.option_companies);
    state.optionCompanies = [];
  }
}

export async function loadOptionGrants() {
  try {
    const resp = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: state.sheetId, range: 'option_grants!A:Z',
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const rows = resp.result.values || [];
    if (rows.length < 2) { state.optionGrants = []; return; }
    const headers = rows[0];
    state.optionGrants = rows.slice(1).map(r => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = r[i] ?? ''; });
      obj.total_shares   = parseNum(obj.total_shares);
      obj.strike_price   = parseNum(obj.strike_price);
      obj.cliff_months   = parseNum(obj.cliff_months);
      obj.vesting_months = parseNum(obj.vesting_months);
      return obj;
    }).filter(g => g.id && g.company_id);
  } catch (_) {
    await ensureTab('option_grants', HEADERS.option_grants);
    state.optionGrants = [];
  }
}

export async function loadOptionFmv() {
  try {
    const resp = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: state.sheetId, range: 'option_fmv!A:Z',
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const rows = resp.result.values || [];
    if (rows.length < 2) { state.optionFmv = []; return; }
    const headers = rows[0];
    state.optionFmv = rows.slice(1).map(r => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = r[i] ?? ''; });
      obj.fmv = parseNum(obj.fmv);
      return obj;
    }).filter(f => f.date && f.company_id);
  } catch (_) {
    await ensureTab('option_fmv', HEADERS.option_fmv);
    state.optionFmv = [];
  }
}

async function writeTab(tabName, headers, rows) {
  await ensureTab(tabName, headers);
  await gapi.client.sheets.spreadsheets.values.clear({
    spreadsheetId: state.sheetId, range: `${tabName}!A:Z`,
  });
  const allRows = rows.length ? [headers, ...rows] : [headers];
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: state.sheetId, range: `${tabName}!A1`,
    valueInputOption: 'RAW',
    resource: { values: allRows },
  });
}

export async function writeOptionCompanies(companies) {
  await writeTab('option_companies', HEADERS.option_companies,
    companies.map(c => HEADERS.option_companies.map(h => {
      if (h === 'active') return c.active === false ? 'FALSE' : 'TRUE';
      return c[h] ?? '';
    })));
  state.optionCompanies = companies;
}

export async function writeOptionGrants(grants) {
  await writeTab('option_grants', HEADERS.option_grants,
    grants.map(g => HEADERS.option_grants.map(h => g[h] ?? '')));
  state.optionGrants = grants;
}

export async function addOptionFmvEntry(entry) {
  await ensureTab('option_fmv', HEADERS.option_fmv);
  const row = HEADERS.option_fmv.map(h => entry[h] ?? '');
  await gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: state.sheetId, range: 'option_fmv!A:Z',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: { values: [row] },
  });
  state.optionFmv.push(entry);
}
