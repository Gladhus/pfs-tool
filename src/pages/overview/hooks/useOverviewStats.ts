import { useMemo } from 'react';
import type { Account, CategoryMeta, Group, Snapshot, OptionCompany, OptionGrant, OptionFmv, OptionExercise, Currency, Person } from '@/types/sheets';
import { buildEffectiveBalances, buildBalanceSweep, computeDateStats } from '@/utils/stats';
import { todayISO } from '@/utils/dates';
import { computeCompanyEquityValue } from '@/utils/options';
import { foldCategoryId, accountMatchesGroup, groupColor } from '@/utils/colors';
import { signedMain, toMain, rateFor } from '@/utils/currency';
import { LEGACY_SELF_ID, shareFor, ownerVisibleToViewer } from '@/utils/ownership';
import { tr } from '@/i18n';

const PERSON_COLORS = ['#06b6d4', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#3b82f6'];
function personColor(person: Person, index: number): string {
  return person.color || PERSON_COLORS[index % PERSON_COLORS.length];
}

export interface EquityData {
  companies: OptionCompany[];
  grants: OptionGrant[];
  fmv: OptionFmv[];
  exercises: OptionExercise[];
}

export interface BucketData {
  key: string;
  label: string;
  color: string | null;
  catId?: string;
  data: (number | null)[];
}

export interface PersonStat {
  person: Person;
  color: string;
  value: number;
  prevValue: number | null;
}

export interface OverviewStats {
  latestDate: string | null;
  periodRefDate: string | null;
  netWorth: number;
  prevNetWorth: number | null;
  byCategory: Record<string, number>;
  prevByCategory: Record<string, number> | null;
  effectiveCats: CategoryMeta[];
  catsWithData: Set<string>;
  groupStats: { group: Group; value: number; prevValue: number | null }[];
  personStats: PersonStat[];
  sparkDates: string[];
  sweepForSpark: Record<string, number>[];
  chartDates: string[];
  netData: (number | null)[];
  bucketData: BucketData[];
}

function foldedStatsFor(
  date: string,
  snapshots: Snapshot[],
  accounts: Account[],
  main: Currency,
  fxMap: Map<string, number>,
  optionData?: EquityData,
  equityDate: string = date,
  viewer: string = LEGACY_SELF_ID,
): { netWorth: number; byCategory: Record<string, number> } {
  const raw = computeDateStats(snapshots, accounts, date, main, fxMap, optionData, equityDate, viewer);
  const byCategory: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw.byCategory)) {
    const fk = foldCategoryId(k);
    byCategory[fk] = (byCategory[fk] ?? 0) + v;
  }
  return { netWorth: raw.netWorth, byCategory };
}

function groupStatsFor(
  date: string,
  group: Group,
  snapshots: Snapshot[],
  accounts: Account[],
  main: Currency,
  fxMap: Map<string, number>,
  optionData?: EquityData,
  equityDate: string = date,
  viewer: string = LEGACY_SELF_ID,
): number {
  const balances = buildEffectiveBalances(snapshots, date);
  const acctById = Object.fromEntries(accounts.map(a => [a.id, a]));
  const usdCad = rateFor(fxMap, date);
  let total = 0;
  for (const [id, balance_raw] of Object.entries(balances)) {
    const a = acctById[id];
    if (!a || !accountMatchesGroup(a, group)) continue;
    total += signedMain(a, balance_raw, main, usdCad, viewer);
  }
  // Roll in equity for any company whose tags match this group (valued at the equity
  // date, converted from its currency at that date's rate).
  if (optionData) {
    const eqUsdCad = rateFor(fxMap, equityDate);
    for (const c of optionData.companies) {
      if (c.active === false) continue;
      if (!ownerVisibleToViewer(c.owner, viewer)) continue;
      if (accountMatchesGroup({ tags: c.tags }, group)) {
        const v = computeCompanyEquityValue(c.id, optionData.grants, optionData.fmv, optionData.exercises, equityDate);
        total += toMain(v, c.currency ?? main, main, eqUsdCad);
      }
    }
  }
  return total;
}

interface Params {
  snapshots: Snapshot[];
  accounts: Account[];
  categoryMeta: CategoryMeta[];
  groups: Group[];
  people?: Person[];
  optionData?: EquityData;
  filteredDates: string[];
  datesSorted: string[];
  view: 'category' | 'group' | 'person';
  seriesVisible: Record<string, boolean>;
  stockOptEnabled: boolean;
  main: Currency;
  fxMap: Map<string, number>;
  viewer?: string;
}

export function useOverviewStats({
  snapshots,
  accounts,
  categoryMeta,
  groups,
  people = [],
  optionData,
  filteredDates,
  datesSorted,
  view,
  seriesVisible,
  stockOptEnabled,
  main,
  fxMap,
  viewer = LEGACY_SELF_ID,
}: Params): OverviewStats {
  return useMemo(() => {
    const latestDate = filteredDates.length
      ? filteredDates[filteredDates.length - 1]
      : datesSorted.length
      ? datesSorted[datesSorted.length - 1]
      : null;
    const periodRefDate = filteredDates.length > 1 ? filteredDates[0] : null;

    // Equity is always valued at today (latest FX rate); accounts stay at their snapshot
    // date. Period baselines keep equity at the historical ref date so deltas reflect growth.
    const today = todayISO();
    const current = latestDate
      ? foldedStatsFor(latestDate, snapshots, accounts, main, fxMap, optionData, today, viewer)
      : { netWorth: 0, byCategory: {} as Record<string, number> };
    const periodRef = periodRefDate
      ? foldedStatsFor(periodRefDate, snapshots, accounts, main, fxMap, optionData, periodRefDate, viewer)
      : null;

    const effectiveCats = categoryMeta
      .filter(c => c.id !== 'real_estate_debt')
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const acctById = Object.fromEntries(accounts.map(a => [a.id, a]));
    const catsWithData = new Set<string>();
    for (const s of snapshots) {
      if (s.account_id === '__day__' || !s.balance_raw) continue;
      const a = acctById[s.account_id];
      if (!a) continue;
      catsWithData.add(foldCategoryId(a.category));
    }

    const groupStats = groups.map(g => ({
      group: g,
      value: latestDate ? groupStatsFor(latestDate, g, snapshots, accounts, main, fxMap, optionData, today, viewer) : 0,
      prevValue: periodRefDate ? groupStatsFor(periodRefDate, g, snapshots, accounts, main, fxMap, optionData, periodRefDate, viewer) : null,
    }));

    const activePeople = people.filter(p => p.active);
    const personStats: PersonStat[] = activePeople.map((p, i) => ({
      person: p,
      color: personColor(p, i),
      value: latestDate ? foldedStatsFor(latestDate, snapshots, accounts, main, fxMap, optionData, today, p.id).netWorth : 0,
      prevValue: periodRefDate ? foldedStatsFor(periodRefDate, snapshots, accounts, main, fxMap, optionData, periodRefDate, p.id).netWorth : null,
    }));

    // Sparklines follow the selected period; fall back to the last 24 entries
    // only when the period yields nothing.
    const sparkDates = filteredDates.length ? filteredDates : datesSorted.slice(-24);
    const sweepForSpark = buildBalanceSweep(snapshots, sparkDates);

    const empty: OverviewStats = {
      latestDate,
      periodRefDate,
      netWorth: current.netWorth,
      prevNetWorth: periodRef?.netWorth ?? null,
      byCategory: current.byCategory,
      prevByCategory: periodRef?.byCategory ?? null,
      effectiveCats,
      catsWithData,
      groupStats,
      personStats,
      sparkDates,
      sweepForSpark,
      chartDates: [],
      netData: [],
      bucketData: [],
    };

    if (!filteredDates.length) return empty;

    const sweep = buildBalanceSweep(snapshots, filteredDates);

    type Bucket = {
      key: string;
      label: string;
      color: string | null;
      catId?: string;
      personId?: string;
      match: (a: Account) => boolean;
    };

    const buckets: Bucket[] = view === 'group'
      ? groups.map(g => ({
          key: 'group:' + g.name,
          label: g.name,
          color: groupColor(g),
          match: (a: Account) => accountMatchesGroup(a, g),
        }))
      : view === 'person'
      ? activePeople.map((p, i) => ({
          key: 'person:' + p.id,
          label: p.name || p.id,
          color: personColor(p, i),
          personId: p.id,
          match: () => false,
        }))
      : effectiveCats.map(c => ({
          key: c.id,
          label: tr(c),
          color: null,
          catId: c.id,
          match: (a: Account) => foldCategoryId(a.category) === c.id,
        }));

    // Category view: equity is its own "Stock Options" bucket. Group view: equity
    // rolls into groups whose filter matches a company's tags (handled in the loop).
    const hasEquityBucket =
      view === 'category' &&
      stockOptEnabled &&
      !!optionData &&
      optionData.companies.length > 0;
    const equityBucketIdx = hasEquityBucket ? buckets.length : -1;
    if (hasEquityBucket) {
      buckets.push({ key: 'equity', label: 'equity', color: null, catId: 'equity', match: () => false });
    }

    const seriesArr = buckets.map(() => new Array(filteredDates.length).fill(0));
    const net = new Array(filteredDates.length).fill(0);
    const hasAny = new Array(filteredDates.length).fill(false);
    const bucketFirstSeen = new Array(buckets.length).fill(-1);

    for (let i = 0; i < filteredDates.length; i++) {
      const balances = sweep[i];
      const usdCad = rateFor(fxMap, filteredDates[i]);
      let dayHasAny = false;
      for (const [acctId, balance_raw] of Object.entries(balances)) {
        const a = acctById[acctId];
        if (!a) continue;
        dayHasAny = true;
        const signed = signedMain(a, balance_raw, main, usdCad, viewer);
        net[i] += signed;
        if (view === 'person') {
          for (let b = 0; b < buckets.length; b++) {
            const personId = buckets[b].personId!;
            if (!shareFor(a.ownership, personId)) continue;
            seriesArr[b][i] += signedMain(a, balance_raw, main, usdCad, personId);
            if (bucketFirstSeen[b] === -1) bucketFirstSeen[b] = i;
          }
        } else {
          for (let b = 0; b < buckets.length; b++) {
            if (b === equityBucketIdx) continue;
            if (buckets[b].match(a)) {
              seriesArr[b][i] += signed;
              if (bucketFirstSeen[b] === -1) bucketFirstSeen[b] = i;
            }
          }
        }
      }
      if (optionData && optionData.companies.length > 0) {
        if (view === 'category') {
          // Sum each company's equity converted from its own currency.
          let equity = 0;
          for (const c of optionData.companies) {
            if (c.active === false) continue;
            if (!ownerVisibleToViewer(c.owner, viewer)) continue;
            const v = computeCompanyEquityValue(c.id, optionData.grants, optionData.fmv, optionData.exercises, filteredDates[i]);
            equity += toMain(v, c.currency ?? main, main, usdCad);
          }
          if (equity) {
            net[i] += equity;
            dayHasAny = true;
            if (equityBucketIdx >= 0) {
              seriesArr[equityBucketIdx][i] += equity;
              if (bucketFirstSeen[equityBucketIdx] === -1) bucketFirstSeen[equityBucketIdx] = i;
            }
          }
        } else if (view === 'person') {
          // Person view: each company's equity belongs entirely to its single owner.
          for (const c of optionData.companies) {
            if (c.active === false) continue;
            const raw = computeCompanyEquityValue(c.id, optionData.grants, optionData.fmv, optionData.exercises, filteredDates[i]);
            const ceq = toMain(raw, c.currency ?? main, main, usdCad);
            if (!ceq) continue;
            net[i] += ceq;
            dayHasAny = true;
            const b = buckets.findIndex(bucket => bucket.personId === c.owner);
            if (b >= 0) {
              seriesArr[b][i] += ceq;
              if (bucketFirstSeen[b] === -1) bucketFirstSeen[b] = i;
            }
          }
        } else {
          // Group view: attribute each company's (converted) equity to groups its tags match.
          for (const c of optionData.companies) {
            if (c.active === false) continue;
            if (!ownerVisibleToViewer(c.owner, viewer)) continue;
            const raw = computeCompanyEquityValue(c.id, optionData.grants, optionData.fmv, optionData.exercises, filteredDates[i]);
            const ceq = toMain(raw, c.currency ?? main, main, usdCad);
            if (!ceq) continue;
            net[i] += ceq;
            dayHasAny = true;
            for (let b = 0; b < groups.length; b++) {
              if (accountMatchesGroup({ tags: c.tags }, groups[b])) {
                seriesArr[b][i] += ceq;
                if (bucketFirstSeen[b] === -1) bucketFirstSeen[b] = i;
              }
            }
          }
        }
      }
      hasAny[i] = dayHasAny;
    }

    const netData: (number | null)[] = net.map((v, i) => (hasAny[i] ? v : null));
    const rawBucketData = seriesArr.map((arr, b) =>
      arr.map((v, i) => (!hasAny[i] || i < bucketFirstSeen[b]) ? null : v),
    );

    const isVis = (key: string) => seriesVisible[key] !== false;
    const candidates: (number | null)[][] = [];
    if (isVis('net')) candidates.push(netData);
    for (let b = 0; b < buckets.length; b++) {
      if (isVis(buckets[b].key)) candidates.push(rawBucketData[b]);
    }
    let trimStart = 0;
    if (candidates.length) {
      const firstIndices = candidates.map(arr => arr.findIndex(v => v !== null)).filter(i => i >= 0);
      if (firstIndices.length) trimStart = Math.min(...firstIndices);
    }

    const chartDates = trimStart ? filteredDates.slice(trimStart) : filteredDates;
    const trimmedNetData = trimStart ? netData.slice(trimStart) : netData;
    const bucketData: BucketData[] = rawBucketData.map((arr, b) => ({
      key: buckets[b].key,
      label: buckets[b].label,
      color: buckets[b].color,
      catId: buckets[b].catId,
      data: trimStart ? arr.slice(trimStart) : arr,
    }));

    return {
      latestDate,
      periodRefDate,
      netWorth: current.netWorth,
      prevNetWorth: periodRef?.netWorth ?? null,
      byCategory: current.byCategory,
      prevByCategory: periodRef?.byCategory ?? null,
      effectiveCats,
      catsWithData,
      groupStats,
      personStats,
      sparkDates,
      sweepForSpark,
      chartDates,
      netData: trimmedNetData,
      bucketData,
    };
  }, [
    snapshots, accounts, categoryMeta, groups, people, optionData,
    filteredDates, datesSorted, view, seriesVisible, stockOptEnabled, main, fxMap, viewer,
  ]);
}
