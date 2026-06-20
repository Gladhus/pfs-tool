import type { Group } from '@/types/sheets';
import { HEADERS } from '@/constants';
import { gapiCall, safeWriteTab } from './sheets';

async function ensureGroupsTab(sheetId: string): Promise<void> {
  try {
    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      resource: { requests: [{ addSheet: { properties: { title: 'groups' } } }] },
    });
  } catch { /* already exists */ }
  await gapiCall(() => gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'groups!A1',
    valueInputOption: 'RAW',
    resource: { values: [HEADERS.groups as unknown as string[]] },
  }));
}

const splitTags = (raw: unknown): string[] =>
  raw ? String(raw).split(',').map(t => t.trim()).filter(Boolean) : [];

export async function loadGroupsCatalog(sheetId: string): Promise<Group[]> {
  try {
    const resp = await gapiCall(() => gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'groups!A:Z',
      valueRenderOption: 'UNFORMATTED_VALUE',
    }));
    const rows = resp.result.values ?? [];
    if (rows.length < 2) return [];
    const headers = rows[0] as string[];
    const ni = headers.indexOf('name');
    const ci = headers.indexOf('color');
    const ai = headers.indexOf('all');
    const ayi = headers.indexOf('any');
    const ei = headers.indexOf('exclude');
    if (ni < 0) return [];
    const result: Group[] = [];
    for (const r of rows.slice(1) as string[][]) {
      const name = (r[ni] ?? '').toString().trim();
      if (!name) continue;
      result.push({
        name,
        color:   ci >= 0  ? (r[ci]  ?? '').toString().trim() : '',
        all:     ai >= 0  ? splitTags(r[ai])  : [],
        any:     ayi >= 0 ? splitTags(r[ayi]) : [],
        exclude: ei >= 0  ? splitTags(r[ei])  : [],
      });
    }
    return result;
  } catch {
    try { await ensureGroupsTab(sheetId); } catch { /* ignore */ }
    return [];
  }
}

export async function writeGroupsCatalog(sheetId: string, groups: Group[], previousCount: number): Promise<void> {
  await ensureGroupsTab(sheetId);
  const rows: unknown[][] = [
    HEADERS.groups as unknown as string[],
    ...groups.map(g => [g.name, g.color || '', (g.all || []).join(', '), (g.any || []).join(', '), (g.exclude || []).join(', ')]),
  ];
  await safeWriteTab(sheetId, 'groups', rows, previousCount);
}
