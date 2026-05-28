import { state } from '../core/state.js';

export const MONTH_NAMES = {
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

function expandYear(s) {
  const n = +s;
  if (s.length === 2) return String(2000 + n);
  return s;
}

export function parseMonthLabel(raw) {
  if (!raw) return null;
  let s = String(raw).trim().toLowerCase();
  s = s.replace(/[.,]/g, '').replace(/\s+/g, ' ');
  const YR = '(\\d{4})';
  const YR2 = '(\\d{2,4})';
  const SEP = '[\\-\\/]';
  const SEP3 = '[\\-\\/\\s]';
  const MON = '([a-zàâäéèêëîïôöùûüç]+)';
  const DD = '(\\d{1,2})';
  let m;
  m = s.match(new RegExp(`^${YR}${SEP}${DD}$`));
  if (m) return `${m[1]}-${String(+m[2]).padStart(2, '0')}`;
  m = s.match(new RegExp(`^${DD}${SEP}${YR}$`));
  if (m) return `${m[2]}-${String(+m[1]).padStart(2, '0')}`;
  // Full numeric date: DD/MM/YY(YY) — if first part > 12 it's the day; otherwise DD/MM assumed
  m = s.match(new RegExp(`^${DD}${SEP}${DD}${SEP}${YR2}$`));
  if (m) {
    const [a, b, yr] = [+m[1], +m[2], expandYear(m[3])];
    const [, mm] = a > 12 ? [a, b] : [b, a];
    if (mm >= 1 && mm <= 12) return `${yr}-${String(mm).padStart(2, '0')}`;
  }
  // Named month + 4-digit year: "Dec 2015"
  m = s.match(new RegExp(`^${MON}\\s+${YR}$`));
  if (m) {
    const monIdx = MONTH_NAMES[m[1]];
    if (monIdx) return `${m[2]}-${String(monIdx).padStart(2, '0')}`;
  }
  // DD-MMM-YY(YY): "1-Dec-15", "1-Dec-2015"
  m = s.match(new RegExp(`^${DD}${SEP3}${MON}${SEP3}${YR2}$`));
  if (m) {
    const monIdx = MONTH_NAMES[m[2]];
    if (monIdx) return `${expandYear(m[3])}-${String(monIdx).padStart(2, '0')}`;
  }
  // MMM-DD-YY(YY): "Dec-1-15"
  m = s.match(new RegExp(`^${MON}${SEP3}${DD}${SEP3}${YR2}$`));
  if (m) {
    const monIdx = MONTH_NAMES[m[1]];
    if (monIdx) return `${expandYear(m[3])}-${String(monIdx).padStart(2, '0')}`;
  }
  // YYYY-MMM-DD: "2015-Dec-1"
  m = s.match(new RegExp(`^${YR}${SEP3}${MON}${SEP3}${DD}$`));
  if (m) {
    const monIdx = MONTH_NAMES[m[2]];
    if (monIdx) return `${m[1]}-${String(monIdx).padStart(2, '0')}`;
  }
  return null;
}

export function normalizeDate(raw) {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s) return '';
  // YYYY-MM-DD
  const m1 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m1) return `${m1[1]}-${String(+m1[2]).padStart(2, '0')}-${String(+m1[3]).padStart(2, '0')}`;
  // YYYY-MM (old monthly format — treated as first of month)
  const m2 = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m2) return `${m2[1]}-${String(+m2[2]).padStart(2, '0')}-01`;
  // Google Sheets serial number
  const num = Number(s);
  if (Number.isFinite(num) && num > 25000 && num < 80000) {
    const d = new Date(Math.round((num - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  return s;
}

// Kept for migration code only — returns YYYY-MM
export function normalizeMonth(raw) {
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
  const parsed = parseMonthLabel(s);
  if (parsed) return parsed;
  return s;
}

export function getDatesForPeriod(period) {
  const all = state.datesSorted;
  if (!all.length || period === 'all') return all;
  const latest = all[all.length - 1];
  const [yr] = latest.split('-').map(Number);
  if (period === 'YTD') {
    return all.filter(d => d >= `${yr}-01-01`);
  }
  const nMonths = { '3M': 3, '6M': 6, '1Y': 12, '2Y': 24, '5Y': 60 }[period];
  if (!nMonths) return all;
  const fromDate = new Date(latest);
  fromDate.setMonth(fromDate.getMonth() - nMonths);
  const fromStr = fromDate.toISOString().slice(0, 10);
  return all.filter(d => d >= fromStr);
}

export function rebuildDatesList() {
  const set = new Set(state.snapshots.map(s => s.date));
  state.datesSorted = [...set].filter(Boolean).sort();
}

export function prevDate(date) {
  const idx = state.datesSorted.indexOf(date);
  if (idx > 0) return state.datesSorted[idx - 1];
  const earlier = state.datesSorted.filter(d => d < date);
  return earlier.length ? earlier[earlier.length - 1] : null;
}

export function logCoverageDiagnostic() {
  const perAccount = {};
  let dayRows = 0;
  for (const s of state.snapshots) {
    if (s.account_id === '__day__') { dayRows++; continue; }
    perAccount[s.account_id] = perAccount[s.account_id] || { all: 0, zero: 0, nonzero: 0, first: null, last: null };
    perAccount[s.account_id].all++;
    if (s.balance_raw === 0) perAccount[s.account_id].zero++;
    else perAccount[s.account_id].nonzero++;
    if (!perAccount[s.account_id].first || s.date < perAccount[s.account_id].first) perAccount[s.account_id].first = s.date;
    if (!perAccount[s.account_id].last  || s.date > perAccount[s.account_id].last)  perAccount[s.account_id].last  = s.date;
  }
  const knownIds = new Set(state.accounts.map(a => a.id));
  const summary = [];
  for (const a of state.accounts) {
    const p = perAccount[a.id] || { all: 0, zero: 0, nonzero: 0, first: '', last: '' };
    summary.push({ account_id: a.id, name: a.name_fr || a.name_en, all: p.all, nonzero: p.nonzero, zero: p.zero, first: p.first, last: p.last });
  }
  for (const id of Object.keys(perAccount)) {
    if (!knownIds.has(id)) {
      const p = perAccount[id];
      summary.push({ account_id: id, name: '(no matching account)', all: p.all, nonzero: p.nonzero, zero: p.zero, first: p.first, last: p.last });
    }
  }
  console.log(`[pfs] snapshots per account (day comment rows: ${dayRows}):`);
  console.table(summary);
  window.__pfs = state;
  window.__pfsDate = (d) => {
    const rows = state.snapshots.filter(s => s.date === d);
    const byAcct = Object.fromEntries(state.accounts.map(a => [a.id, a]));
    console.table(rows.map(r => ({
      date: r.date,
      account_id: r.account_id,
      name: byAcct[r.account_id]?.name_fr || '(unknown)',
      balance: r.balance_raw,
      kind: byAcct[r.account_id]?.kind || '',
      comment: r.comment,
    })));
    return rows;
  };
}
