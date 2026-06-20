import seedData from '../../../../seed/default-accounts.json';
import { HEADERS, SHEET_TITLE, DEFAULT_PEOPLE } from '@/constants';
import { migrateLegacyOwnership, serializeOwnership } from '@/shared/utils/ownership';
import type { Person } from '@/types/sheets';
import cfg from '@/config';

export async function verifySheet(id: string): Promise<boolean> {
  try {
    await gapi.client.sheets.spreadsheets.get({ spreadsheetId: id, fields: 'spreadsheetId' });
    return true;
  } catch (err) {
    const status =
      (err as { status?: number })?.status ??
      (err as { result?: { error?: { code?: number } } })?.result?.error?.code;
    if (status === 403 || status === 404) return false;
    throw err;
  }
}

export async function findSheetByName(name: string): Promise<string | null> {
  const escaped = name.replace(/'/g, "\\'");
  const resp = await gapi.client.drive.files.list({
    q: `name='${escaped}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: 'files(id,name)',
    pageSize: 1,
  });
  return (resp.result.files?.[0]?.id) ?? null;
}

export async function createSheet(): Promise<string> {
  const resp = await gapi.client.sheets.spreadsheets.create({
    resource: {
      properties: { title: SHEET_TITLE, locale: 'fr_CA' },
      sheets: [
        { properties: { title: 'accounts' } },
        { properties: { title: 'snapshots' } },
        { properties: { title: 'config' } },
        { properties: { title: 'tags' } },
        { properties: { title: 'groups' } },
        { properties: { title: 'people' } },
        { properties: { title: 'option_companies' } },
        { properties: { title: 'option_grants' } },
        { properties: { title: 'option_fmv' } },
        { properties: { title: 'option_exercises' } },
      ],
    },
    fields: 'spreadsheetId',
  });
  return resp.result.spreadsheetId;
}

type SeedData = {
  schema_version?: number;
  accounts: Record<string, unknown>[];
  people?: Record<string, unknown>[];
};

export async function seedNewSheet(sheetId: string): Promise<void> {
  const seed = seedData as SeedData;
  const accountRows = [
    [...HEADERS.accounts],
    ...seed.accounts.map((a) => HEADERS.accounts.map((h) => {
      if (h === 'ownership') return serializeOwnership(migrateLegacyOwnership(a.owner, a.ownership_share));
      return (a[h] as string | number | boolean) ?? '';
    })),
  ];
  const people: Person[] = seed.people?.length
    ? seed.people.map(p => ({
        id: String(p.id ?? ''),
        name: String(p.name ?? ''),
        email: p.email ? String(p.email) : '',
        color: p.color ? String(p.color) : '',
        sort_order: Number(p.sort_order) || 0,
        active: p.active !== false,
        primary: p.primary === true,
      }))
    : DEFAULT_PEOPLE;

  await gapi.client.sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    resource: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: 'accounts!A1',         values: accountRows },
        { range: 'snapshots!A1',        values: [[...HEADERS.snapshots]] },
        { range: 'config!A1',           values: [
            [...HEADERS.config],
            ['schema_version', String(seed.schema_version ?? 1)],
            ['language',       cfg.LANGUAGE || 'fr'],
            ['currency',       cfg.CURRENCY || 'CAD'],
            ['created_at',     new Date().toISOString()],
          ]},
        { range: 'tags!A1',             values: [[...HEADERS.tags]] },
        { range: 'groups!A1',           values: [[...HEADERS.groups]] },
        { range: 'people!A1',           values: [
            [...HEADERS.people],
            ...people.map(p => [p.id, p.name, p.email ?? '', p.color ?? '', p.sort_order, p.active ? 'TRUE' : 'FALSE', p.primary ? 'TRUE' : 'FALSE']),
          ]},
        { range: 'option_companies!A1', values: [[...HEADERS.option_companies]] },
        { range: 'option_grants!A1',    values: [[...HEADERS.option_grants]] },
        { range: 'option_fmv!A1',       values: [[...HEADERS.option_fmv]] },
        { range: 'option_exercises!A1', values: [[...HEADERS.option_exercises]] },
      ],
    },
  });
}

export async function listSheets(): Promise<Array<{ id: string; name: string; modifiedTime?: string }>> {
  const resp = await gapi.client.drive.files.list({
    q: `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: 'files(id,name,modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: 30,
  });
  return resp.result.files ?? [];
}
