import type { Person } from '@/types/sheets';
import { HEADERS, DEFAULT_PEOPLE } from '@/constants';
import { ensurePrimaryPerson } from '@/shared/utils/ownership';
import { gapiCall, gapiErrorStatus, safeWriteTab } from './sheets';

async function ensurePeopleTab(sheetId: string): Promise<void> {
  try {
    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      resource: { requests: [{ addSheet: { properties: { title: 'people' } } }] },
    });
  } catch { /* already exists */ }
  await gapiCall(() => gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'people!A1',
    valueInputOption: 'RAW',
    resource: { values: [HEADERS.people as unknown as string[]] },
  }));
}

function serializeRows(people: Person[]): unknown[][] {
  return [
    HEADERS.people as unknown as string[],
    ...people.map(p => [p.id, p.name, p.email ?? '', p.color ?? '', p.sort_order, p.active ? 'TRUE' : 'FALSE', p.primary ? 'TRUE' : 'FALSE']),
  ];
}

/**
 * Loads the people catalog, lazily seeding `self`/`partner` defaults the first time a
 * sheet (new, or legacy/pre-people-tab) is opened. This keeps existing `owner` values
 * on accounts (which still reference 'self'/'partner'/'joint') resolving to real people
 * without a one-time migration step the user has to run.
 */
export async function loadPeopleCatalog(sheetId: string): Promise<Person[]> {
  try {
    const resp = await gapiCall(() => gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'people!A:Z',
      valueRenderOption: 'UNFORMATTED_VALUE',
    }));
    const rows = resp.result.values ?? [];
    if (rows.length < 2) {
      await writePeopleCatalog(sheetId, DEFAULT_PEOPLE, 0);
      return DEFAULT_PEOPLE;
    }
    const headers = rows[0] as string[];
    const people = (rows.slice(1) as unknown[][]).map(r => {
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => { obj[h] = r[i] ?? ''; });
      return {
        id: String(obj.id ?? '').trim(),
        name: String(obj.name ?? '').trim(),
        email: obj.email ? String(obj.email).trim() : undefined,
        color: obj.color ? String(obj.color).trim() : undefined,
        sort_order: Number(obj.sort_order) || 0,
        active: obj.active === true || String(obj.active).toUpperCase() === 'TRUE',
        primary: obj.primary === true || String(obj.primary).toUpperCase() === 'TRUE',
      } as Person;
    }).filter(p => p.id);
    return ensurePrimaryPerson(people);
  } catch (err) {
    // A missing `people` tab (legacy/pre-people-tab sheet) surfaces as a 400 "Unable to
    // parse range" error — that's the only case we seed defaults for. Any other failure
    // (network blip, rate limit, transient 5xx, etc.) must NOT be treated as "no data
    // yet", or we'd overwrite a real, populated people tab with the seeded defaults.
    if (gapiErrorStatus(err) !== 400) throw err;
    try { await ensurePeopleTab(sheetId); } catch { /* ignore */ }
    await writePeopleCatalog(sheetId, DEFAULT_PEOPLE, 0);
    return DEFAULT_PEOPLE;
  }
}

export async function writePeopleCatalog(sheetId: string, people: Person[], previousCount: number): Promise<void> {
  await ensurePeopleTab(sheetId);
  await safeWriteTab(sheetId, 'people', serializeRows(people), previousCount);
}
