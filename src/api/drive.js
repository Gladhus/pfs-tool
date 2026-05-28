import seedData from '../../seed/default-accounts.json';
import { state, HEADERS, SHEET_TITLE } from '../core/state.js';

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
