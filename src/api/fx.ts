import type { FxRate } from '@/types/sheets';
import { HEADERS } from '@/constants';
import { gapiCall, safeWriteTab } from './sheets';

// frankfurter.app now 301-redirects to frankfurter.dev/v1; the redirect response
// carries no CORS headers, so the browser blocks it. Call the new host directly.
const FRANKFURTER = 'https://api.frankfurter.dev/v1';

// ── fx_rates sheet tab ────────────────────────────────────────────────────

async function ensureFxTab(sheetId: string): Promise<void> {
  try {
    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      resource: { requests: [{ addSheet: { properties: { title: 'fx_rates' } } }] },
    });
  } catch { /* already exists */ }
  await gapiCall(() => gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'fx_rates!A1',
    valueInputOption: 'RAW',
    resource: { values: [HEADERS.fx_rates as unknown as string[]] },
  }));
}

/** Load persisted rates. Returns [] if the tab doesn't exist yet (created lazily on first write). */
export async function loadFxRates(sheetId: string): Promise<FxRate[]> {
  try {
    const resp = await gapiCall(() => gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'fx_rates!A:Z',
      valueRenderOption: 'UNFORMATTED_VALUE',
    }));
    const rows = resp.result.values ?? [];
    if (rows.length < 2) return [];
    const hs = rows[0] as string[];
    return (rows.slice(1) as unknown[][])
      .map(r => {
        const obj: Record<string, unknown> = {};
        hs.forEach((h, i) => { obj[h] = r[i] ?? ''; });
        return { date: String(obj.date ?? ''), usd_cad: Number(obj.usd_cad) };
      })
      .filter(r => r.date && Number.isFinite(r.usd_cad));
  } catch {
    return [];
  }
}

export async function writeFxRates(sheetId: string, rates: FxRate[], previousCount: number): Promise<void> {
  await ensureFxTab(sheetId);
  const sorted = [...rates].sort((a, b) => a.date.localeCompare(b.date));
  const rows: unknown[][] = [HEADERS.fx_rates as unknown as string[], ...sorted.map(r => [r.date, r.usd_cad])];
  await safeWriteTab(sheetId, 'fx_rates', rows, previousCount);
}

// ── frankfurter.app (free, no key, ECB USD↔CAD) ───────────────────────────

/** USD→CAD for a single date (or latest). Frankfurter returns the nearest prior business day. */
export async function fetchUsdCad(date?: string): Promise<number | null> {
  const path = date ? `/${date}` : '/latest';
  try {
    const resp = await fetch(`${FRANKFURTER}${path}?from=USD&to=CAD`);
    if (!resp.ok) return null;
    const data = await resp.json() as { rates?: { CAD?: number } };
    const cad = data.rates?.CAD;
    return typeof cad === 'number' ? cad : null;
  } catch {
    return null;
  }
}

/** USD→CAD for every business day in [start, end] — a single request for the whole range. */
export async function fetchUsdCadSeries(start: string, end: string): Promise<Record<string, number>> {
  try {
    const resp = await fetch(`${FRANKFURTER}/${start}..${end}?from=USD&to=CAD`);
    if (!resp.ok) return {};
    const data = await resp.json() as { rates?: Record<string, { CAD?: number }> };
    const out: Record<string, number> = {};
    for (const [d, r] of Object.entries(data.rates ?? {})) {
      if (typeof r.CAD === 'number') out[d] = r.CAD;
    }
    return out;
  } catch {
    return {};
  }
}

/** Next calendar day for a YYYY-MM-DD string (UTC, no timezone drift). */
function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * Fetch a USD→CAD series for [start, end] and return one row per CALENDAR day (one
 * request). Frankfurter only returns business days, so weekends/holidays are forward-
 * filled with the prior business day's rate — giving a literally dense daily sheet.
 */
export async function fetchRateRange(start: string, end: string): Promise<FxRate[]> {
  if (!start || !end || start > end) return [];
  const series = await fetchUsdCadSeries(start, end);
  const keys = Object.keys(series).sort();
  if (!keys.length) return [];

  const out: FxRate[] = [];
  let lastRate = series[keys[0]]; // seed: any pre-first-business-day dates take the first known rate
  let ki = 0;
  for (let d = start; d <= end; d = nextDay(d)) {
    while (ki < keys.length && keys[ki] <= d) { lastRate = series[keys[ki]]; ki++; }
    if (Number.isFinite(lastRate)) out.push({ date: d, usd_cad: lastRate });
  }
  return out;
}
