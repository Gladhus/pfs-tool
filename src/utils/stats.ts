import type { Account, Snapshot } from '@/types/sheets';
import type { OptionCompany, OptionGrant, OptionFmv, OptionExercise } from '@/types/sheets';
import { buildXAxisTicks } from './dates';
import { computeTotalEquityValue } from './options';

export { buildXAxisTicks };

export function snapshotForDate(snapshots: Snapshot[], date: string): {
  balances: Record<string, number>;
  comments: Record<string, string>;
  dayComment: string;
} {
  const balances: Record<string, number> = {};
  const comments: Record<string, string> = {};
  let dayComment = '';
  for (const r of snapshots.filter(s => s.date === date)) {
    if (r.account_id === '__day__') {
      dayComment = r.comment ?? '';
    } else {
      balances[r.account_id] = r.balance_raw;
      if (r.comment) comments[r.account_id] = r.comment;
    }
  }
  return { balances, comments, dayComment };
}

export function buildEffectiveBalances(snapshots: Snapshot[], asOfDate: string): Record<string, number> {
  const best: Record<string, Snapshot> = {};
  for (const s of snapshots) {
    if (s.account_id === '__day__') continue;
    if (s.date > asOfDate) continue;
    const prev = best[s.account_id];
    if (!prev || s.date > prev.date) best[s.account_id] = s;
  }
  const result: Record<string, number> = {};
  for (const [id, s] of Object.entries(best)) result[id] = s.balance_raw;
  return result;
}

export function buildBalanceSweep(snapshots: Snapshot[], dates: string[]): Record<string, number>[] {
  if (!dates.length) return [];
  const sorted = snapshots
    .filter(s => s.account_id !== '__day__')
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const results: Record<string, number>[] = [];
  const eff: Record<string, number> = {};
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

export function computeNetWorthFromSnapshots(snapshots: Snapshot[], accounts: Account[], date: string): number {
  const balances = buildEffectiveBalances(snapshots, date);
  const acctById = Object.fromEntries(accounts.map(a => [a.id, a]));
  let total = 0;
  for (const [id, balance_raw] of Object.entries(balances)) {
    const a = acctById[id];
    if (!a) continue;
    total += balance_raw * (a.ownership_share ?? 1) * (a.kind === 'debt' ? -1 : 1);
  }
  return total;
}

interface EquityData {
  companies: OptionCompany[];
  grants: OptionGrant[];
  fmv: OptionFmv[];
  exercises: OptionExercise[];
}

export function computeDateStats(
  snapshots: Snapshot[],
  accounts: Account[],
  date: string,
  equity?: EquityData,
): { netWorth: number; byCategory: Record<string, number> } {
  const balances = buildEffectiveBalances(snapshots, date);
  const acctById = Object.fromEntries(accounts.map(a => [a.id, a]));
  let netWorth = 0;
  const byCategory: Record<string, number> = {};
  for (const [id, balance_raw] of Object.entries(balances)) {
    const a = acctById[id];
    if (!a) continue;
    const signed = balance_raw * (a.ownership_share ?? 1) * (a.kind === 'debt' ? -1 : 1);
    netWorth += signed;
    byCategory[a.category] = (byCategory[a.category] ?? 0) + signed;
  }
  if (equity) {
    const eqVal = computeTotalEquityValue(equity.companies, equity.grants, equity.fmv, equity.exercises, date);
    if (eqVal) {
      netWorth += eqVal;
      byCategory['equity'] = eqVal;
    }
  }
  return { netWorth, byCategory };
}
