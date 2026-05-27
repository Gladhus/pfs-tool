import { state, LS_KEY_IMPORT_MAP } from './state.js';

export const activeAccounts = () => state.accounts.filter(a => a.active);

export function categoriesInOrder() {
  const usedIds = new Set(activeAccounts().map(a => a.category));
  return state.categoryMeta
    .filter(c => usedIds.has(c.id))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

export function accountsForCategory(catId) {
  return activeAccounts()
    .filter(a => a.category === catId)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

export function snapshotForMonth(month) {
  const rows = state.snapshots.filter(s => s.month === month);
  const balances = {};
  const comments = {};
  let monthComment = '';
  for (const r of rows) {
    if (r.account_id === '__month__') {
      monthComment = r.comment || '';
    } else {
      balances[r.account_id] = r.balance_raw;
      if (r.comment) comments[r.account_id] = r.comment;
    }
  }
  return { balances, comments, monthComment };
}

export function prevMonth(month) {
  const idx = state.monthsSorted.indexOf(month);
  if (idx > 0) return state.monthsSorted[idx - 1];
  const earlier = state.monthsSorted.filter(m => m < month);
  return earlier.length ? earlier[earlier.length - 1] : null;
}

export function computeNetWorthFromSnapshots(month) {
  const rows = state.snapshots.filter(s => s.month === month && s.account_id !== '__month__');
  const acctById = Object.fromEntries(state.accounts.map(a => [a.id, a]));
  let total = 0;
  for (const r of rows) {
    const a = acctById[r.account_id];
    if (!a) continue;
    total += r.balance_raw * (a.ownership_share || 1) * (a.kind === 'debt' ? -1 : 1);
  }
  return total;
}

export function computeMonthStats(month) {
  const rows = state.snapshots.filter(s => s.month === month && s.account_id !== '__month__');
  const acctById = Object.fromEntries(state.accounts.map(a => [a.id, a]));
  let netWorth = 0;
  const byCategory = {};
  for (const r of rows) {
    const a = acctById[r.account_id];
    if (!a) continue;
    const signed = r.balance_raw * (a.ownership_share || 1) * (a.kind === 'debt' ? -1 : 1);
    netWorth += signed;
    byCategory[a.category] = (byCategory[a.category] || 0) + signed;
  }
  return { netWorth, byCategory };
}

export function getMonthsForPeriod(period) {
  const all = state.monthsSorted;
  if (!all.length || period === 'all') return all;
  const latest = all[all.length - 1];
  const [yr, mo] = latest.split('-').map(Number);
  if (period === 'YTD') {
    return all.filter(m => m >= `${yr}-01`);
  }
  const nMonths = { '3M': 3, '6M': 6, '1Y': 12, '5Y': 60 }[period];
  if (!nMonths) return all;
  const from = new Date(yr, mo - 1);
  from.setMonth(from.getMonth() - nMonths + 1);
  const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`;
  return all.filter(m => m >= fromStr);
}

export function rebuildMonthsList() {
  const set = new Set(state.snapshots.map(s => s.month));
  state.monthsSorted = [...set].sort();
}

export function logCoverageDiagnostic() {
  const perAccount = {};
  let monthRows = 0;
  for (const s of state.snapshots) {
    if (s.account_id === '__month__') { monthRows++; continue; }
    perAccount[s.account_id] = perAccount[s.account_id] || { all: 0, zero: 0, nonzero: 0, first: null, last: null };
    perAccount[s.account_id].all++;
    if (s.balance_raw === 0) perAccount[s.account_id].zero++;
    else perAccount[s.account_id].nonzero++;
    if (!perAccount[s.account_id].first || s.month < perAccount[s.account_id].first) perAccount[s.account_id].first = s.month;
    if (!perAccount[s.account_id].last  || s.month > perAccount[s.account_id].last)  perAccount[s.account_id].last  = s.month;
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
      summary.push({ account_id: id, name: '(no matching account in accounts tab)', all: p.all, nonzero: p.nonzero, zero: p.zero, first: p.first, last: p.last });
    }
  }
  console.log(`[pfs] snapshots per account (months row count: ${monthRows}):`);
  console.table(summary);
  window.__pfs = state;
  window.__pfsMonth = (m) => {
    const rows = state.snapshots.filter(s => s.month === m);
    const byAcct = Object.fromEntries(state.accounts.map(a => [a.id, a]));
    console.table(rows.map(r => ({
      month: r.month,
      account_id: r.account_id,
      name: byAcct[r.account_id]?.name_fr || '(unknown)',
      balance: r.balance_raw,
      kind: byAcct[r.account_id]?.kind || '',
      comment: r.comment,
    })));
    return rows;
  };
}

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

export function parseMonthLabel(raw) {
  if (!raw) return null;
  let s = String(raw).trim().toLowerCase();
  s = s.replace(/[.,]/g, '').replace(/\s+/g, ' ');
  let m = s.match(/^(\d{4})[\-\/](\d{1,2})$/);
  if (m) return `${m[1]}-${String(+m[2]).padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[\-\/](\d{4})$/);
  if (m) return `${m[2]}-${String(+m[1]).padStart(2, '0')}`;
  m = s.match(/^([a-zàâäéèêëîïôöùûüç]+)\s+(\d{4})$/);
  if (m) {
    const monIdx = MONTH_NAMES[m[1]];
    if (monIdx) return `${m[2]}-${String(monIdx).padStart(2, '0')}`;
  }
  return null;
}

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

export function parseDelimited(text) {
  const sep = text.includes('\t') ? '\t' : ',';
  const out = [];
  let row = [];
  let cur = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i += 2; continue; }
      if (ch === '"') { inQuotes = false; i++; continue; }
      cur += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === sep) { row.push(cur); cur = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { row.push(cur); out.push(row); row = []; cur = ''; i++; continue; }
    cur += ch; i++;
  }
  if (cur.length || row.length) { row.push(cur); out.push(row); }
  return out.filter(r => r.some(c => c.trim() !== ''));
}

export function normalizeName(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function similarity(a, b) {
  const setA = new Set(normalizeName(a).split(' ').filter(Boolean));
  const setB = new Set(normalizeName(b).split(' ').filter(Boolean));
  if (!setA.size && !setB.size) return 0;
  let inter = 0;
  for (const tok of setA) if (setB.has(tok)) inter++;
  return inter / (setA.size + setB.size - inter);
}

export function suggestAccount(sourceName) {
  const remembered = (() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY_IMPORT_MAP) || '{}'); }
    catch (_) { return {}; }
  })();
  const key = normalizeName(sourceName);
  if (remembered[key]) return remembered[key];
  let best = null, bestScore = 0;
  for (const a of activeAccounts()) {
    const score = Math.max(similarity(sourceName, a.name_fr), similarity(sourceName, a.name_en));
    if (score > bestScore) { bestScore = score; best = a; }
  }
  return bestScore >= 0.5 ? best.id : null;
}

export function rememberMapping(sourceName, accountId) {
  try {
    const m = JSON.parse(localStorage.getItem(LS_KEY_IMPORT_MAP) || '{}');
    m[normalizeName(sourceName)] = accountId;
    localStorage.setItem(LS_KEY_IMPORT_MAP, JSON.stringify(m));
  } catch (_) { /* ignore */ }
}

export function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || `account_${Date.now()}`;
}
