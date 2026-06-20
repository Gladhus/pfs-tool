import type { AppConfig } from '@/types/sheets';
import { gapiCall } from './sheets';

export async function loadConfig(sheetId: string): Promise<AppConfig> {
  const resp = await gapiCall(() => gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'config!A:B',
    valueRenderOption: 'UNFORMATTED_VALUE',
  }));
  const rows = resp.result.values ?? [];
  const map = Object.fromEntries((rows.slice(1) as string[][]).map(r => [r[0], r[1] ?? '']));
  const theme = map.theme as 'system' | 'light' | 'dark' | undefined;
  return {
    language: (map.language as 'en' | 'fr') || 'fr',
    currency: map.currency || 'CAD',
    schema_version: map.schema_version || '1',
    last_imported_at: map.last_imported_at || undefined,
    stock_options_enabled:
      map.stock_options_enabled === '1' ? true :
      map.stock_options_enabled === '0' ? false : undefined,
    theme: (theme === 'system' || theme === 'light' || theme === 'dark') ? theme : undefined,
  };
}

export async function writeConfig(sheetId: string, key: string, value: string): Promise<void> {
  const resp = await gapiCall(() => gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'config!A:B',
    valueRenderOption: 'UNFORMATTED_VALUE',
  }));
  const rows = resp.result.values ?? [];
  const idx = (rows as string[][]).findIndex(r => r[0] === key);
  if (idx >= 1) {
    await gapiCall(() => gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `config!B${idx + 1}`,
      valueInputOption: 'RAW',
      resource: { values: [[value]] },
    }));
  } else {
    await gapiCall(() => gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'config!A:B',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [[key, value]] },
    }));
  }
}
