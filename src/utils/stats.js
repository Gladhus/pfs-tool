import { state } from '../core/state.js';

export function snapshotForDate(date) {
  const rows = state.snapshots.filter(s => s.date === date);
  const balances = {};
  const comments = {};
  let dayComment = '';
  for (const r of rows) {
    if (r.account_id === '__day__') {
      dayComment = r.comment || '';
    } else {
      balances[r.account_id] = r.balance_raw;
      if (r.comment) comments[r.account_id] = r.comment;
    }
  }
  return { balances, comments, dayComment };
}

// Returns { accountId: balance_raw } — the last known balance for each account
// on or before asOfDate (carry-forward / LOCF semantics).
export function buildEffectiveBalances(asOfDate) {
  const best = {};
  for (const s of state.snapshots) {
    if (s.account_id === '__day__') continue;
    if (s.date > asOfDate) continue;
    const prev = best[s.account_id];
    if (!prev || s.date > prev.date) best[s.account_id] = s;
  }
  const result = {};
  for (const [id, s] of Object.entries(best)) result[id] = s.balance_raw;
  return result;
}

// Efficiently computes carry-forward balances for a sorted array of dates.
// Returns an array (one entry per date) of { accountId: balance_raw } objects.
// Balances from before dates[0] are automatically pre-seeded.
export function buildBalanceSweep(dates) {
  if (!dates.length) return [];
  const sorted = state.snapshots
    .filter(s => s.account_id !== '__day__')
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const results = [];
  const eff = {};
  let si = 0;
  for (const date of dates) {
    while (si < sorted.length && sorted[si].date <= date) {
      eff[sorted[si].account_id] = sorted[si].balance_raw;
      si++;
    }
    results.push({ ...eff });
  }
  return results;
}

export function computeNetWorthFromSnapshots(date) {
  const balances = buildEffectiveBalances(date);
  const acctById = Object.fromEntries(state.accounts.map(a => [a.id, a]));
  let total = 0;
  for (const [id, balance_raw] of Object.entries(balances)) {
    const a = acctById[id];
    if (!a) continue;
    total += balance_raw * (a.ownership_share || 1) * (a.kind === 'debt' ? -1 : 1);
  }
  return total;
}

export function computeDateStats(date) {
  const balances = buildEffectiveBalances(date);
  const acctById = Object.fromEntries(state.accounts.map(a => [a.id, a]));
  let netWorth = 0;
  const byCategory = {};
  for (const [id, balance_raw] of Object.entries(balances)) {
    const a = acctById[id];
    if (!a) continue;
    const signed = balance_raw * (a.ownership_share || 1) * (a.kind === 'debt' ? -1 : 1);
    netWorth += signed;
    byCategory[a.category] = (byCategory[a.category] || 0) + signed;
  }
  return { netWorth, byCategory };
}

export function buildXAxisTicks(dates, canvasWidth, locale) {
  if (dates.length < 2) return { tickSet: new Set([0]), xFmt: () => '' };

  const first = new Date(dates[0] + 'T12:00:00');
  const last  = new Date(dates[dates.length - 1] + 'T12:00:00');
  const rangeYears = (last - first) / (365.25 * 24 * 3600 * 1000);
  const useYearOnly = rangeYears >= 2;

  const targetTicks = canvasWidth < 400 ? 3 : canvasWidth < 700 ? 5 : 7;

  let tickIndices = [];
  if (useYearOnly) {
    const seen = new Set();
    dates.forEach((d, i) => {
      const y = new Date(d + 'T12:00:00').getFullYear();
      if (!seen.has(y)) { seen.add(y); tickIndices.push(i); }
    });
  } else {
    const seen = new Set();
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
    ? d => String(d.getFullYear())
    : d => d.toLocaleDateString(locale, { month: 'short', year: 'numeric' });

  return { tickSet: new Set(tickIndices), xFmt };
}
