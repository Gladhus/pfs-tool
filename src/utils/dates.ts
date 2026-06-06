import type { Snapshot } from '@/types/sheets';

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const targetMonth = d.getMonth() + months;
  const y = d.getFullYear() + Math.floor(targetMonth / 12);
  const m = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(y, m + 1, 0).getDate();
  d.setFullYear(y, m, Math.min(d.getDate(), lastDay));
  return d;
}

export function todayISO(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

export function yearStartIndices(dates: string[]): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < dates.length; i++) {
    if (i === 0 || dates[i].slice(0, 4) !== dates[i - 1].slice(0, 4)) out.add(i);
  }
  return out;
}

export function fmtMonth(yyyymm: string, { locale = 'en', style = 'long' as 'long' | 'short' } = {}): string {
  if (!yyyymm) return '—';
  const [y, m] = yyyymm.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric',
    month: style === 'short' ? 'short' : 'long',
  });
}

export const MONTH_NAMES: Record<string, number> = {
  jan: 1, janv: 1, january: 1, janvier: 1,
  feb: 2, 'fév': 2, fevr: 2, fevrier: 2, 'février': 2, february: 2,
  mar: 3, mars: 3, march: 3,
  apr: 4, avr: 4, april: 4, avril: 4,
  may: 5, mai: 5,
  jun: 6, june: 6, juin: 6,
  jul: 7, july: 7, juil: 7, juillet: 7,
  aug: 8, 'août': 8, aout: 8, august: 8,
  sep: 9, sept: 9, september: 9, septembre: 9,
  oct: 10, october: 10, octobre: 10,
  nov: 11, november: 11, novembre: 11,
  dec: 12, 'déc': 12, december: 12, 'décembre': 12,
};

function expandYear(s: string): string {
  return s.length === 2 ? String(2000 + +s) : s;
}

export function parseMonthLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw).trim().toLowerCase();
  s = s.replace(/[.,]/g, '').replace(/\s+/g, ' ');
  const YR = '(\\d{4})';
  const YR2 = '(\\d{2,4})';
  const SEP = '[\\-\\/]';
  const SEP3 = '[\\-\\/\\s]';
  const MON = '([a-zàâäéèêëîïôöùûüç]+)';
  const DD = '(\\d{1,2})';
  let m: RegExpMatchArray | null;
  m = s.match(new RegExp(`^${YR}${SEP}${DD}$`));
  if (m) return `${m[1]}-${String(+m[2]).padStart(2, '0')}`;
  m = s.match(new RegExp(`^${DD}${SEP}${YR}$`));
  if (m) return `${m[2]}-${String(+m[1]).padStart(2, '0')}`;
  m = s.match(new RegExp(`^${DD}${SEP}${DD}${SEP}${YR2}$`));
  if (m) {
    const yr = expandYear(m[3]);
    const mm = +m[2];
    if (mm >= 1 && mm <= 12) return `${yr}-${String(mm).padStart(2, '0')}`;
  }
  m = s.match(new RegExp(`^${MON}\\s+${YR}$`));
  if (m) {
    const monIdx = MONTH_NAMES[m[1]];
    if (monIdx) return `${m[2]}-${String(monIdx).padStart(2, '0')}`;
  }
  m = s.match(new RegExp(`^${DD}${SEP3}${MON}${SEP3}${YR2}$`));
  if (m) {
    const monIdx = MONTH_NAMES[m[2]];
    if (monIdx) return `${expandYear(m[3])}-${String(monIdx).padStart(2, '0')}`;
  }
  m = s.match(new RegExp(`^${MON}${SEP3}${DD}${SEP3}${YR2}$`));
  if (m) {
    const monIdx = MONTH_NAMES[m[1]];
    if (monIdx) return `${expandYear(m[3])}-${String(monIdx).padStart(2, '0')}`;
  }
  m = s.match(new RegExp(`^${YR}${SEP3}${MON}${SEP3}${DD}$`));
  if (m) {
    const monIdx = MONTH_NAMES[m[2]];
    if (monIdx) return `${m[1]}-${String(monIdx).padStart(2, '0')}`;
  }
  return null;
}

export function normalizeDate(raw: string | number | null | undefined): string {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s) return '';
  const m1 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m1) return `${m1[1]}-${String(+m1[2]).padStart(2, '0')}-${String(+m1[3]).padStart(2, '0')}`;
  const m2 = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m2) return `${m2[1]}-${String(+m2[2]).padStart(2, '0')}-01`;
  const num = Number(s);
  if (Number.isFinite(num) && num > 25000 && num < 80000) {
    const d = new Date(Math.round((num - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  return s;
}

export function normalizeMonth(raw: string | number | null | undefined): string {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s) return '';
  const m1 = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (m1) return `${m1[1]}-${String(+m1[2]).padStart(2, '0')}`;
  const num = Number(s);
  if (Number.isFinite(num) && num > 25000 && num < 80000) {
    const d = new Date(Math.round((num - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  return parseMonthLabel(s) ?? s;
}

export function getDatesForPeriod(datesSorted: string[], period: string): string[] {
  if (!datesSorted.length || period === 'all') return datesSorted;
  const latest = datesSorted[datesSorted.length - 1];
  const [yr] = latest.split('-').map(Number);
  if (period === 'ytd' || period === 'YTD') {
    return datesSorted.filter(d => d >= `${yr}-01-01`);
  }
  const nMonths: Record<string, number> = { '3m': 3, '6m': 6, '1y': 12, '2y': 24, '3y': 36, '5y': 60,
                                             '3M': 3, '6M': 6, '1Y': 12, '2Y': 24, '3Y': 36, '5Y': 60 };
  const n = nMonths[period];
  if (!n) return datesSorted;
  const fromStr = addMonths(new Date(latest), -n).toISOString().slice(0, 10);
  return datesSorted.filter(d => d >= fromStr);
}

/** Replace rebuildDatesList — pure, takes snapshots as param. */
export function deriveDatesSorted(snapshots: Snapshot[]): string[] {
  return [...new Set(snapshots.map(s => s.date).filter(Boolean))].sort();
}

export function prevDate(datesSorted: string[], date: string): string | null {
  const idx = datesSorted.indexOf(date);
  if (idx > 0) return datesSorted[idx - 1];
  const earlier = datesSorted.filter(d => d < date);
  return earlier.length ? earlier[earlier.length - 1] : null;
}

export function buildXAxisTicks(dates: string[], canvasWidth: number, locale: string): {
  tickSet: Set<number>;
  xFmt: (d: Date) => string;
} {
  if (dates.length < 2) return { tickSet: new Set([0]), xFmt: () => '' };
  const first = new Date(dates[0] + 'T12:00:00');
  const last  = new Date(dates[dates.length - 1] + 'T12:00:00');
  const rangeYears = (last.getTime() - first.getTime()) / (365.25 * 24 * 3600 * 1000);
  const useYearOnly = rangeYears >= 2;
  const targetTicks = canvasWidth < 400 ? 3 : canvasWidth < 700 ? 5 : 7;
  let tickIndices: number[] = [];
  if (useYearOnly) {
    const seen = new Set<number>();
    dates.forEach((d, i) => {
      const y = new Date(d + 'T12:00:00').getFullYear();
      if (!seen.has(y)) { seen.add(y); tickIndices.push(i); }
    });
  } else {
    const seen = new Set<string>();
    dates.forEach((d, i) => {
      const dt = new Date(d + 'T12:00:00');
      const key = `${dt.getFullYear()}-${dt.getMonth()}`;
      if (!seen.has(key)) { seen.add(key); tickIndices.push(i); }
    });
  }
  if (tickIndices.length > targetTicks) {
    const step = Math.ceil(tickIndices.length / targetTicks);
    tickIndices = tickIndices.filter((_, i) => i % step === 0);
  }
  const xFmt = useYearOnly
    ? (d: Date) => String(d.getFullYear())
    : (d: Date) => d.toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', { month: 'short', year: 'numeric' });
  return { tickSet: new Set(tickIndices), xFmt };
}
