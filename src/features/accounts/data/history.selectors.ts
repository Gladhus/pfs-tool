import type { Account, Snapshot, Currency } from '@/types/sheets';
import { buildBalanceSweep } from '@/utils/stats';
import { activeAccounts } from '@/utils/balance';
import { signedMain, rateFor } from '@/utils/currency';
import { LEGACY_SELF_ID, HOUSEHOLD_VIEWER } from '@/utils/ownership';
import { makeAccountContributor } from './account.contributor';

/**
 * Accounts-domain selectors for the History page. Pure data — the page renders
 * what these return and computes nothing itself.
 */

export interface CardData {
  month: string;       // YYYY-MM
  latestDate: string;
  net: number;
  prevNet: number | null;
  investments: number;
  realEstate: number;
  realEstateDebts: number;
  debts: number;
  incomplete: boolean;
  olderDates: {
    date: string;
    net: number;
    prevNet: number | null;
    incomplete: boolean;
  }[];
}

/**
 * The History chart series: net split into investments / real-estate / other,
 * with leading viewer-empty dates trimmed. Valuation goes through the shared
 * account contributor; this only groups the per-owner result.
 */
export function computeSeries(
  dates: string[],
  accounts: Account[],
  snapshots: Snapshot[],
  main: Currency,
  fxMap: Map<string, number>,
  viewer: string = LEGACY_SELF_ID,
) {
  if (!dates.length) return { dates: [], investments: [], realEstateNet: [], other: [] };
  const perDate = makeAccountContributor(accounts, snapshots)
    .valuesOver(dates, { viewer, main, fxRateFor: d => rateFor(fxMap, d) });
  const scopeToViewer = (cs: typeof perDate[number]) =>
    viewer === HOUSEHOLD_VIEWER ? cs : cs.filter(c => c.ownerId === viewer);

  const outDates: string[] = [];
  const investments: number[] = [];
  const realEstateNet: number[] = [];
  const other: number[] = [];
  // Per emitted date, whether the viewer holds a stake — used to trim leading
  // dates that belong solely to other people.
  const viewerHasData: boolean[] = [];

  for (let i = 0; i < dates.length; i++) {
    if (!perDate[i].length) continue; // no account has data on this date yet
    const scoped = scopeToViewer(perDate[i]);
    let n = 0, inv = 0, re = 0, red = 0;
    for (const c of scoped) {
      n += c.amount;
      if (c.category === 'investments') inv += c.amount;
      else if (c.category === 'real_estate') re += c.amount;
      else if (c.category === 'real_estate_debt') red += c.amount;
    }
    outDates.push(dates[i]);
    investments.push(inv);
    realEstateNet.push(re + red);
    other.push(n - inv - (re + red));
    viewerHasData.push(scoped.length > 0);
  }

  // Drop leading dates with no data for this viewer (LOCF means gaps only appear
  // before the first stake, never after).
  const firstWithData = viewerHasData.findIndex(Boolean);
  const start = firstWithData < 0 ? outDates.length : firstWithData;

  const nullBeforeFirst = (arr: number[]): (number | null)[] => {
    const first = arr.findIndex(v => v !== 0);
    return first <= 0 ? arr : arr.map((v, i) => (i < first ? null : v));
  };

  return {
    dates: outDates.slice(start),
    investments: nullBeforeFirst(investments.slice(start)),
    realEstateNet: nullBeforeFirst(realEstateNet.slice(start)),
    other: nullBeforeFirst(other.slice(start)),
  };
}

/** Raw balance of a single account across the given dates — the History drill-down line. */
export function accountBalanceSeries(
  snapshots: Snapshot[],
  dates: string[],
  accountId: string,
): { date: string; value: number }[] {
  const sweep = buildBalanceSweep(snapshots, dates);
  const out: { date: string; value: number }[] = [];
  for (let i = 0; i < dates.length; i++) {
    const bal = sweep[i]?.[accountId];
    if (bal !== undefined) out.push({ date: dates[i], value: bal });
  }
  return out;
}

/**
 * The History card list: one card per month (newest first), each with the month's
 * latest totals, the prior month's net for the delta, an incomplete-data flag, and
 * the older within-month snapshots.
 */
export function buildHistoryCards(
  datesSorted: string[],
  accounts: Account[],
  snapshots: Snapshot[],
  main: Currency,
  fxMap: Map<string, number>,
  viewer: string = LEGACY_SELF_ID,
): CardData[] {
  if (!datesSorted.length) return [];
  const acctById = Object.fromEntries(accounts.map(a => [a.id, a]));
  const sweep = buildBalanceSweep(snapshots, datesSorted);

  const exactByDate = new Map<string, Set<string>>();
  for (const s of snapshots) {
    if (s.account_id === '__day__') continue;
    if (!exactByDate.has(s.date)) exactByDate.set(s.date, new Set());
    exactByDate.get(s.date)!.add(s.account_id);
  }
  const activeIds = new Set(activeAccounts(accounts).map(a => a.id));

  const byDate = new Map<string, {
    net: number; investments: number; realEstate: number;
    realEstateDebts: number; debts: number; incomplete: boolean;
  }>();

  for (let i = 0; i < datesSorted.length; i++) {
    const date = datesSorted[i];
    const balances = sweep[i];
    if (!Object.keys(balances).length) continue;
    const usdCad = rateFor(fxMap, date);
    let net = 0, inv = 0, re = 0, red = 0, debts = 0;
    for (const [id, balance_raw] of Object.entries(balances)) {
      const a = acctById[id];
      if (!a) continue;
      const signed = signedMain(a, balance_raw, main, usdCad, viewer);
      net += signed;
      if (a.kind === 'debt') debts += signed;
      // Exact categories (matching computeSeries): re = real-estate assets,
      // red = real-estate debt. HistoryCard sums them for net real estate.
      if (a.category === 'investments') inv += signed;
      else if (a.category === 'real_estate') re += signed;
      else if (a.category === 'real_estate_debt') red += signed;
    }
    const exact = exactByDate.get(date) ?? new Set<string>();
    byDate.set(date, {
      net, investments: inv, realEstate: re, realEstateDebts: red, debts,
      incomplete: [...activeIds].some(id => !exact.has(id)),
    });
  }

  const allDatesList = [...byDate.keys()].sort();
  const byMonth = new Map<string, string[]>();
  for (const d of allDatesList) {
    const mo = d.slice(0, 7);
    if (!byMonth.has(mo)) byMonth.set(mo, []);
    byMonth.get(mo)!.push(d);
  }
  const monthsDesc = [...byMonth.keys()].sort().reverse();

  return monthsDesc.map((mo, moIdx) => {
    const datesInMonth = [...byMonth.get(mo)!].reverse(); // newest first
    const latestDate = datesInMonth[0];
    const latest = byDate.get(latestDate)!;
    const prevMoKey = monthsDesc[moIdx + 1];
    const prevLatest = prevMoKey ? [...byMonth.get(prevMoKey)!].sort().pop() : undefined;
    const prevNet = prevLatest ? byDate.get(prevLatest)!.net : null;

    const olderDates = datesInMonth.slice(1).map(date => {
      const d = byDate.get(date)!;
      const prevI = allDatesList.indexOf(date) - 1;
      const prevK = prevI >= 0 ? allDatesList[prevI] : null;
      return {
        date,
        net: d.net,
        prevNet: prevK ? byDate.get(prevK)!.net : null,
        incomplete: d.incomplete,
      };
    });

    return {
      month: mo,
      latestDate,
      net: latest.net,
      prevNet,
      investments: latest.investments,
      realEstate: latest.realEstate,
      realEstateDebts: latest.realEstateDebts,
      debts: latest.debts,
      incomplete: latest.incomplete,
      olderDates,
    };
  });
}
