import { useMemo } from 'react';
import type { Account, CategoryMeta, Group, Snapshot, OptionCompany, OptionGrant, OptionFmv, OptionExercise } from '@/types/sheets';
import { buildEffectiveBalances, buildBalanceSweep, computeDateStats } from '@/utils/stats';
import { computeTotalEquityValue } from '@/utils/options';
import { foldCategoryId, accountMatchesGroup, groupColor } from '@/utils/colors';
import { tr } from '@/i18n';

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
  optionData?: EquityData,
): { netWorth: number; byCategory: Record<string, number> } {
  const raw = computeDateStats(snapshots, accounts, date, optionData);
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
): number {
  const balances = buildEffectiveBalances(snapshots, date);
  const acctById = Object.fromEntries(accounts.map(a => [a.id, a]));
  let total = 0;
  for (const [id, balance_raw] of Object.entries(balances)) {
    const a = acctById[id];
    if (!a || !accountMatchesGroup(a, group)) continue;
    total += balance_raw * (a.ownership_share ?? 1) * (a.kind === 'debt' ? -1 : 1);
  }
  return total;
}

interface Params {
  snapshots: Snapshot[];
  accounts: Account[];
  categoryMeta: CategoryMeta[];
  groups: Group[];
  optionData?: EquityData;
  filteredDates: string[];
  datesSorted: string[];
  view: 'category' | 'group';
  seriesVisible: Record<string, boolean>;
  stockOptEnabled: boolean;
}

export function useOverviewStats({
  snapshots,
  accounts,
  categoryMeta,
  groups,
  optionData,
  filteredDates,
  datesSorted,
  view,
  seriesVisible,
  stockOptEnabled,
}: Params): OverviewStats {
  return useMemo(() => {
    const latestDate = filteredDates.length
      ? filteredDates[filteredDates.length - 1]
      : datesSorted.length
      ? datesSorted[datesSorted.length - 1]
      : null;
    const periodRefDate = filteredDates.length > 1 ? filteredDates[0] : null;

    const current = latestDate
      ? foldedStatsFor(latestDate, snapshots, accounts, optionData)
      : { netWorth: 0, byCategory: {} as Record<string, number> };
    const periodRef = periodRefDate
      ? foldedStatsFor(periodRefDate, snapshots, accounts, optionData)
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
      value: latestDate ? groupStatsFor(latestDate, g, snapshots, accounts) : 0,
      prevValue: periodRefDate ? groupStatsFor(periodRefDate, g, snapshots, accounts) : null,
    }));

    const sparkDates = datesSorted.slice(-24);
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
      match: (a: Account) => boolean;
    };

    const buckets: Bucket[] = view === 'group'
      ? groups.map(g => ({
          key: 'group:' + g.name,
          label: g.name,
          color: groupColor(g),
          match: (a: Account) => accountMatchesGroup(a, g),
        }))
      : effectiveCats.map(c => ({
          key: c.id,
          label: tr(c),
          color: null,
          catId: c.id,
          match: (a: Account) => foldCategoryId(a.category) === c.id,
        }));

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
      let dayHasAny = false;
      for (const [acctId, balance_raw] of Object.entries(balances)) {
        const a = acctById[acctId];
        if (!a) continue;
        dayHasAny = true;
        const signed = balance_raw * (a.ownership_share ?? 1) * (a.kind === 'debt' ? -1 : 1);
        net[i] += signed;
        for (let b = 0; b < buckets.length; b++) {
          if (b === equityBucketIdx) continue;
          if (buckets[b].match(a)) {
            seriesArr[b][i] += signed;
            if (bucketFirstSeen[b] === -1) bucketFirstSeen[b] = i;
          }
        }
      }
      if (optionData && optionData.companies.length > 0) {
        const equity = computeTotalEquityValue(
          optionData.companies, optionData.grants, optionData.fmv, optionData.exercises, filteredDates[i],
        );
        if (equity) {
          net[i] += equity;
          dayHasAny = true;
          if (equityBucketIdx >= 0) {
            seriesArr[equityBucketIdx][i] += equity;
            if (bucketFirstSeen[equityBucketIdx] === -1) bucketFirstSeen[equityBucketIdx] = i;
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
      sparkDates,
      sweepForSpark,
      chartDates,
      netData: trimmedNetData,
      bucketData,
    };
  }, [
    snapshots, accounts, categoryMeta, groups, optionData,
    filteredDates, datesSorted, view, seriesVisible, stockOptEnabled,
  ]);
}
