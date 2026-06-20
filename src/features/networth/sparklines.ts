import type { Account, Group, Currency } from '@/types/sheets';
import { foldCategoryId, accountMatchesGroup } from '@/shared/utils/colors';
import { signedMain, toMain, rateFor } from '@/shared/utils/currency';
import { computeCompanyEquityValue } from '@/shared/utils/options';
import { LEGACY_SELF_ID, shareFor, ownerVisibleToViewer } from '@/shared/utils/ownership';
import type { EquityData } from '@/features/options/data/equity.selectors';

/**
 * Sparkline series for the Overview allocation cards. Cross-domain (account
 * balances + option equity) helpers that StatCardGrid renders but no longer
 * computes. Each returns the value series with leading no-data points trimmed.
 */

/** Drop leading entries that have no underlying data so the line starts at the first real point. */
function trimLeading(raw: { total: number; has: boolean }[]): number[] {
  const first = raw.findIndex(r => r.has);
  return first < 0 ? [] : raw.slice(first).map(r => r.total);
}

export function categorySparkline(
  catId: string,
  accounts: Account[],
  sweep: Record<string, number>[],
  dates: string[],
  main: Currency,
  fxMap: Map<string, number>,
  viewer: string = LEGACY_SELF_ID,
): number[] {
  const acctById = Object.fromEntries(accounts.map(a => [a.id, a]));
  return trimLeading(sweep.map((balances, i) => {
    const usdCad = rateFor(fxMap, dates[i]);
    let total = 0;
    let has = false;
    for (const [id, balance_raw] of Object.entries(balances)) {
      const a = acctById[id];
      if (!a || foldCategoryId(a.category) !== catId) continue;
      total += signedMain(a, balance_raw, main, usdCad, viewer);
      has = true;
    }
    return { total, has };
  }));
}

export function groupSparkline(
  group: Group,
  accounts: Account[],
  sweep: Record<string, number>[],
  dates: string[],
  main: Currency,
  fxMap: Map<string, number>,
  optionData?: EquityData,
  viewer: string = LEGACY_SELF_ID,
): number[] {
  const acctById = Object.fromEntries(accounts.map(a => [a.id, a]));
  return trimLeading(sweep.map((balances, i) => {
    const usdCad = rateFor(fxMap, dates[i]);
    let total = 0;
    let has = false;
    for (const [id, balance_raw] of Object.entries(balances)) {
      const a = acctById[id];
      if (!a || !accountMatchesGroup(a, group)) continue;
      total += signedMain(a, balance_raw, main, usdCad, viewer);
      has = true;
    }
    if (optionData) {
      for (const c of optionData.companies) {
        if (c.active === false) continue;
        if (!ownerVisibleToViewer(c.owner, viewer)) continue;
        if (accountMatchesGroup({ tags: c.tags }, group)) {
          const raw = computeCompanyEquityValue(c.id, optionData.grants, optionData.fmv, optionData.exercises, dates[i]);
          if (raw) { total += toMain(raw, c.currency ?? main, main, usdCad); has = true; }
        }
      }
    }
    return { total, has };
  }));
}

export function personSparkline(
  personId: string,
  accounts: Account[],
  sweep: Record<string, number>[],
  dates: string[],
  main: Currency,
  fxMap: Map<string, number>,
  optionData?: EquityData,
): number[] {
  const acctById = Object.fromEntries(accounts.map(a => [a.id, a]));
  return trimLeading(sweep.map((balances, i) => {
    const usdCad = rateFor(fxMap, dates[i]);
    let total = 0;
    let has = false;
    for (const [id, balance_raw] of Object.entries(balances)) {
      const a = acctById[id];
      if (!a || !shareFor(a.ownership, personId)) continue;
      total += signedMain(a, balance_raw, main, usdCad, personId);
      has = true;
    }
    if (optionData) {
      for (const c of optionData.companies) {
        if (c.active === false || c.owner !== personId) continue;
        const raw = computeCompanyEquityValue(c.id, optionData.grants, optionData.fmv, optionData.exercises, dates[i]);
        if (raw) { total += toMain(raw, c.currency ?? main, main, usdCad); has = true; }
      }
    }
    return { total, has };
  }));
}

export function equitySparkline(
  optionData: EquityData | undefined,
  dates: string[],
  main: Currency,
  fxMap: Map<string, number>,
  viewer: string = LEGACY_SELF_ID,
): number[] {
  if (!optionData) return [];
  const raw = dates.map(d => {
    const usdCad = rateFor(fxMap, d);
    return optionData.companies.reduce((s, c) => {
      if (c.active === false) return s;
      if (!ownerVisibleToViewer(c.owner, viewer)) return s;
      const v = computeCompanyEquityValue(c.id, optionData.grants, optionData.fmv, optionData.exercises, d);
      return s + toMain(v, c.currency ?? main, main, usdCad);
    }, 0);
  });
  const first = raw.findIndex(v => v !== 0);
  return first < 0 ? [] : raw.slice(first);
}
