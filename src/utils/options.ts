import type { OptionGrant, OptionFmv, OptionExercise, OptionCompany } from '@/types/sheets';
import { addMonths } from './dates';

function monthsBetween(startStr: string, endStr: string): number {
  const s = new Date(startStr + 'T12:00:00');
  const e = new Date(endStr + 'T12:00:00');
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
}

export function computeVestedShares(grant: OptionGrant, asOfDate: string): number {
  const start = grant.vesting_start || grant.grant_date;
  if (!start || !asOfDate) return 0;
  const months = monthsBetween(start, asOfDate);
  const cliff = Number(grant.cliff_months) || 0;
  const vestingMonths = Number(grant.vesting_months) || 0;
  const totalShares = Number(grant.total_shares) || 0;
  if (!vestingMonths || !totalShares || months < cliff) return 0;
  const intervalMonths = { monthly: 1, quarterly: 3, annual: 12 }[grant.vesting_interval as string] ?? 1;
  const completedIntervals = Math.floor(months / intervalMonths);
  const sharesPerInterval = totalShares / (vestingMonths / intervalMonths);
  return Math.min(totalShares, completedIntervals * sharesPerInterval);
}

export function computeUnvestedShares(grant: OptionGrant, asOfDate: string): number {
  return Math.max(0, (Number(grant.total_shares) || 0) - computeVestedShares(grant, asOfDate));
}

export function exercisedSharesForGrant(exercises: OptionExercise[], grantId: string, asOfDate?: string): number {
  let sum = 0;
  for (const ex of exercises) {
    if (ex.grant_id !== grantId) continue;
    if (asOfDate && ex.date > asOfDate) continue;
    sum += Number(ex.shares_exercised) || 0;
  }
  return sum;
}

export function exercisableShares(grant: OptionGrant, exercises: OptionExercise[], asOfDate: string): number {
  return Math.max(0, computeVestedShares(grant, asOfDate) - exercisedSharesForGrant(exercises, grant.id, asOfDate));
}

export function computeIntrinsicValue(grant: OptionGrant, exercises: OptionExercise[], fmv: number, asOfDate: string): number {
  const ex = exercisableShares(grant, exercises, asOfDate);
  const strike = Number(grant.strike_price) || 0;
  return Math.max(0, ex * (fmv - strike));
}

export function computeUnvestedValue(grant: OptionGrant, fmv: number, asOfDate: string): number {
  const unvested = computeUnvestedShares(grant, asOfDate);
  const strike = Number(grant.strike_price) || 0;
  return Math.max(0, unvested * (fmv - strike));
}

export function getEffectiveFmv(fmvRows: OptionFmv[], companyId: string, asOfDate: string): { fmv: number; date: string } | null {
  let best: OptionFmv | null = null;
  for (const f of fmvRows) {
    if (f.company_id !== companyId) continue;
    if (f.date > asOfDate) continue;
    if (!best || f.date > best.date) best = f;
  }
  return best ? { fmv: Number(best.fmv), date: best.date } : null;
}

export function computeCompanyEquityValue(
  companyId: string,
  grants: OptionGrant[],
  fmvRows: OptionFmv[],
  exercises: OptionExercise[],
  asOfDate: string,
): number {
  const entry = getEffectiveFmv(fmvRows, companyId, asOfDate);
  if (!entry) return 0;
  return grants
    .filter(g => g.company_id === companyId)
    .reduce((sum, g) => sum + computeIntrinsicValue(g, exercises, entry.fmv, asOfDate), 0);
}

export function computeTotalEquityValue(
  companies: OptionCompany[],
  grants: OptionGrant[],
  fmvRows: OptionFmv[],
  exercises: OptionExercise[],
  asOfDate: string,
): number {
  if (!companies?.length) return 0;
  return companies
    .filter(c => c.active !== false)
    .reduce((sum, c) => sum + computeCompanyEquityValue(c.id, grants, fmvRows, exercises, asOfDate), 0);
}

export function grantFullyVestedDate(grant: OptionGrant): string | null {
  const start = grant.vesting_start || grant.grant_date;
  if (!start) return null;
  return addMonths(new Date(start + 'T12:00:00'), Number(grant.vesting_months) || 0).toISOString().slice(0, 10);
}

export function grantFirstVestDate(grant: OptionGrant): string | null {
  const start = grant.vesting_start || grant.grant_date;
  if (!start) return null;
  return addMonths(new Date(start + 'T12:00:00'), Number(grant.cliff_months) || 0).toISOString().slice(0, 10);
}

export function generateMonthlyDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 7) + '-01');
    current.setMonth(current.getMonth() + 1);
  }
  return dates;
}
