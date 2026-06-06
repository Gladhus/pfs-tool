import type { Account, Snapshot, Currency } from '@/types/sheets';
import type { OptionCompany, OptionGrant, OptionFmv, OptionExercise } from '@/types/sheets';
import { buildXAxisTicks } from './dates';
import { computeCompanyEquityValue } from './options';
import { signedMain, toMain, rateFor } from './currency';

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

export function computeNetWorthFromSnapshots(
  snapshots: Snapshot[],
  accounts: Account[],
  date: string,
  main: Currency = 'CAD',
  fxMap?: Map<string, number>,
): number {
  const balances = buildEffectiveBalances(snapshots, date);
  const acctById = Object.fromEntries(accounts.map(a => [a.id, a]));
  const usdCad = fxMap ? rateFor(fxMap, date) : null;
  let total = 0;
  for (const [id, balance_raw] of Object.entries(balances)) {
    const a = acctById[id];
    if (!a) continue;
    total += signedMain(a, balance_raw, main, usdCad);
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
  main: Currency = 'CAD',
  fxMap?: Map<string, number>,
  equity?: EquityData,
  /**
   * Date at which to value equity (and pick its FX rate). Equity vests continuously and
   * is independent of snapshot cadence, so callers pass `today` for the current value
   * while accounts stay at their snapshot `date`. Defaults to `date`.
   */
  equityDate: string = date,
): { netWorth: number; byCategory: Record<string, number> } {
  const balances = buildEffectiveBalances(snapshots, date);
  const acctById = Object.fromEntries(accounts.map(a => [a.id, a]));
  const usdCad = fxMap ? rateFor(fxMap, date) : null;
  let netWorth = 0;
  const byCategory: Record<string, number> = {};
  for (const [id, balance_raw] of Object.entries(balances)) {
    const a = acctById[id];
    if (!a) continue;
    const signed = signedMain(a, balance_raw, main, usdCad);
    netWorth += signed;
    byCategory[a.category] = (byCategory[a.category] ?? 0) + signed;
  }
  if (equity) {
    // Equity is in each company's currency → convert per company at the equity date's rate.
    const eqUsdCad = fxMap ? rateFor(fxMap, equityDate) : null;
    let eqVal = 0;
    for (const c of equity.companies) {
      if (c.active === false) continue;
      const v = computeCompanyEquityValue(c.id, equity.grants, equity.fmv, equity.exercises, equityDate);
      if (v) eqVal += toMain(v, c.currency ?? main, main, eqUsdCad);
    }
    if (eqVal) {
      netWorth += eqVal;
      byCategory['equity'] = eqVal;
    }
  }
  return { netWorth, byCategory };
}
