import { state } from '../core/state.js';

function monthsBetween(startStr, endStr) {
  const s = new Date(startStr + 'T12:00:00');
  const e = new Date(endStr + 'T12:00:00');
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
}

export function computeVestedShares(grant, asOfDate) {
  const start = grant.vesting_start || grant.grant_date;
  if (!start || !asOfDate) return 0;
  const months = monthsBetween(start, asOfDate);
  const cliff = Number(grant.cliff_months) || 0;
  const vestingMonths = Number(grant.vesting_months) || 0;
  const totalShares = Number(grant.total_shares) || 0;
  if (!vestingMonths || !totalShares || months < cliff) return 0;
  const intervalMonths = { monthly: 1, quarterly: 3, annual: 12 }[grant.vesting_interval] || 1;
  const completedIntervals = Math.floor(months / intervalMonths);
  const sharesPerInterval = totalShares / (vestingMonths / intervalMonths);
  return Math.min(totalShares, completedIntervals * sharesPerInterval);
}

export function computeUnvestedShares(grant, asOfDate) {
  return Math.max(0, (Number(grant.total_shares) || 0) - computeVestedShares(grant, asOfDate));
}

// Total shares exercised for a grant up to (and including) asOfDate.
export function exercisedSharesForGrant(grantId, asOfDate) {
  let sum = 0;
  for (const ex of state.optionExercises || []) {
    if (ex.grant_id !== grantId) continue;
    if (asOfDate && ex.date > asOfDate) continue;
    sum += Number(ex.shares_exercised) || 0;
  }
  return sum;
}

// Vested shares that have not yet been exercised — these still carry value.
export function exercisableShares(grant, asOfDate) {
  return Math.max(0, computeVestedShares(grant, asOfDate) - exercisedSharesForGrant(grant.id, asOfDate));
}

export function computeIntrinsicValue(grant, fmv, asOfDate) {
  const exercisable = exercisableShares(grant, asOfDate);
  const strike = Number(grant.strike_price) || 0;
  return Math.max(0, exercisable * (fmv - strike));
}

export function computeUnvestedValue(grant, fmv, asOfDate) {
  const unvested = computeUnvestedShares(grant, asOfDate);
  const strike = Number(grant.strike_price) || 0;
  return Math.max(0, unvested * (fmv - strike));
}

export function getEffectiveFmv(companyId, asOfDate) {
  let best = null;
  for (const f of state.optionFmv) {
    if (f.company_id !== companyId) continue;
    if (f.date > asOfDate) continue;
    if (!best || f.date > best.date) best = f;
  }
  return best ? { fmv: Number(best.fmv), date: best.date } : null;
}

export function computeCompanyEquityValue(companyId, asOfDate) {
  const entry = getEffectiveFmv(companyId, asOfDate);
  if (!entry) return 0;
  const grants = state.optionGrants.filter(g => g.company_id === companyId);
  return grants.reduce((sum, g) => sum + computeIntrinsicValue(g, entry.fmv, asOfDate), 0);
}

export function computeCompanyUnvestedValue(companyId, asOfDate) {
  const entry = getEffectiveFmv(companyId, asOfDate);
  if (!entry) return 0;
  const grants = state.optionGrants.filter(g => g.company_id === companyId);
  return grants.reduce((sum, g) => sum + computeUnvestedValue(g, entry.fmv, asOfDate), 0);
}

export function computeTotalEquityValue(asOfDate) {
  if (!state.optionCompanies?.length) return 0;
  return state.optionCompanies
    .filter(c => c.active !== false)
    .reduce((sum, c) => sum + computeCompanyEquityValue(c.id, asOfDate), 0);
}

export function computeTotalUnvestedValue(asOfDate) {
  if (!state.optionCompanies?.length) return 0;
  return state.optionCompanies
    .filter(c => c.active !== false)
    .reduce((sum, c) => sum + computeCompanyUnvestedValue(c.id, asOfDate), 0);
}

export function grantFullyVestedDate(grant) {
  const start = grant.vesting_start || grant.grant_date;
  if (!start) return null;
  const s = new Date(start + 'T12:00:00');
  s.setMonth(s.getMonth() + (Number(grant.vesting_months) || 0));
  return s.toISOString().slice(0, 10);
}

export function grantFirstVestDate(grant) {
  const start = grant.vesting_start || grant.grant_date;
  if (!start) return null;
  const cliff = Number(grant.cliff_months) || 0;
  const s = new Date(start + 'T12:00:00');
  s.setMonth(s.getMonth() + cliff);
  return s.toISOString().slice(0, 10);
}

export function generateMonthlyDates(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10).slice(0, 7) + '-01');
    current.setMonth(current.getMonth() + 1);
  }
  return dates;
}
