import type { Tag } from '@/types/sheets';
import { HEADERS } from '@/constants';
import { gapiCall, safeWriteTab } from './sheets';

async function ensureTagsTab(sheetId: string): Promise<void> {
  try {
    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      resource: { requests: [{ addSheet: { properties: { title: 'tags' } } }] },
    });
  } catch { /* already exists */ }
  await gapiCall(() => gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'tags!A1',
    valueInputOption: 'RAW',
    resource: { values: [HEADERS.tags as unknown as string[]] },
  }));
}

export async function loadTagsCatalog(sheetId: string): Promise<Tag[]> {
  try {
    const resp = await gapiCall(() => gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'tags!A:Z',
      valueRenderOption: 'UNFORMATTED_VALUE',
    }));
    const rows = resp.result.values ?? [];
    if (rows.length < 2) return [];
    const headers = rows[0] as string[];
    const nameIdx = headers.indexOf('name');
    if (nameIdx < 0) return [];
    const seen = new Set<string>();
    const result: Tag[] = [];
    for (const r of rows.slice(1) as string[][]) {
      const name = (r[nameIdx] ?? '').toString().trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      result.push({ name });
    }
    return result;
  } catch {
    try { await ensureTagsTab(sheetId); } catch { /* ignore */ }
    return [];
  }
}

export async function writeTagsCatalog(sheetId: string, tags: Tag[], previousCount: number): Promise<void> {
  await ensureTagsTab(sheetId);
  const rows: unknown[][] = [HEADERS.tags as unknown as string[], ...tags.map(t => [t.name])];
  await safeWriteTab(sheetId, 'tags', rows, previousCount);
}
