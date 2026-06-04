import { state } from '../core/state.js';

export async function loadConfig() {
  try {
    const resp = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: state.sheetId, range: 'config!A:B',
    });
    const rows = resp.result.values || [];
    const map = Object.fromEntries(rows.slice(1).map(r => [r[0], r[1] ?? '']));
    if (map.language) state.configLang = map.language;
    if (map.theme)    state.configTheme = map.theme;
    if (map.stock_options_enabled !== undefined)
      state.configStockOptions = map.stock_options_enabled === '1' ? true : map.stock_options_enabled === '0' ? false : null;
    if (map.equity_tags !== undefined)
      state.configEquityTags = String(map.equity_tags || '').split(',').map(t => t.trim()).filter(Boolean);
  } catch (err) {
    console.warn('[pfs] loadConfig failed', err);
  }
}

export async function writeConfig(key, value) {
  if (!state.sheetId) return;
  try {
    const resp = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: state.sheetId, range: 'config!A:B',
    });
    const rows = resp.result.values || [];
    const idx = rows.findIndex(r => r[0] === key);
    if (idx >= 1) {
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: state.sheetId,
        range: `config!B${idx + 1}`,
        valueInputOption: 'RAW',
        resource: { values: [[value]] },
      });
    } else {
      await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: state.sheetId,
        range: 'config!A:B',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: [[key, value]] },
      });
    }
  } catch (err) {
    console.warn('[pfs] writeConfig failed', err);
  }
}
