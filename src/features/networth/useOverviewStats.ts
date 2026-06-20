import { useMemo } from 'react';
import type { Account, CategoryMeta, Group, Snapshot, Currency, Person } from '@/types/sheets';
import { buildBalanceSweep } from '@/shared/utils/stats';
import { todayISO } from '@/shared/utils/dates';
import { foldCategoryId } from '@/shared/utils/colors';
import { rateFor } from '@/shared/utils/currency';
import { LEGACY_SELF_ID } from '@/shared/utils/ownership';
import { tr } from '@/shared/i18n';
import { makeAccountContributor } from '@/features/accounts/data/account.contributor';
import { makeEquityContributor } from '@/features/options/data/equity.contributor';
import type { ValuedContributor } from '@/core/contracts';
import { personColor } from '@/core/buckets';
import type { BucketModels } from '@/core/buckets';
import { buildDataset } from '@/core/dataset';
import type { FilterSpec } from '@/core/filters';
import type { EquityData } from '@/features/options/data/equity.selectors';

export type { EquityData };

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

/**
 * Overview's allocation + chart model. A thin adapter over the `src/core/` data
 * layer: build the contributors, call `buildDataset`, and shape the result into
 * `OverviewStats`. Sparklines (`sparkDates`/`sweepForSpark`) and `catsWithData`
 * stay here as Overview-specific helpers StatCardGrid consumes directly.
 */
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
    const fxRateFor = (d: string) => rateFor(fxMap, d);
    const hasEquity = stockOptEnabled && !!optionData && optionData.companies.length > 0;

    const contributors: ValuedContributor[] = [makeAccountContributor(accounts, snapshots)];
    if (optionData && optionData.companies.length > 0) {
      contributors.push(makeEquityContributor(optionData.companies, optionData.grants, optionData.fmv, optionData.exercises));
    }

    const activePeople = people.filter(p => p.active);
    const bucketModels: BucketModels = { categoryMeta, groups, people: activePeople, hasEquity, tr };
    const spec: FilterSpec = { viewer, period: 'all', view, accountId: '', includeInactive: false };

    const ds = buildDataset({
      contributors, axis: filteredDates, datesSorted, spec, bucketModels,
      main, fxRateFor, today: todayISO(), seriesVisible,
    });

    // effectiveCats / catsWithData / sparklines: Overview-specific, computed directly.
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

    const sparkDates = filteredDates.length ? filteredDates : datesSorted.slice(-24);
    const sweepForSpark = buildBalanceSweep(snapshots, sparkDates);

    const groupStats = groups.map(g => ({
      group: g,
      value: ds.groupValues.get(g.name) ?? 0,
      prevValue: ds.prevGroupValues ? (ds.prevGroupValues.get(g.name) ?? 0) : null,
    }));

    const personStats: PersonStat[] = activePeople.map((p, i) => ({
      person: p,
      color: personColor(p, i),
      value: ds.personValues.get(p.id) ?? 0,
      prevValue: ds.prevPersonValues ? (ds.prevPersonValues.get(p.id) ?? 0) : null,
    }));

    const bucketData: BucketData[] = ds.buckets.map(b => ({
      key: b.def.key, label: b.def.label, color: b.def.color, catId: b.def.catId, data: b.data,
    }));

    return {
      latestDate: ds.latestDate,
      periodRefDate: ds.periodRefDate,
      netWorth: ds.netWorth,
      prevNetWorth: ds.prevNetWorth,
      byCategory: ds.byCategory,
      prevByCategory: ds.prevByCategory,
      effectiveCats,
      catsWithData,
      groupStats,
      personStats,
      sparkDates,
      sweepForSpark,
      chartDates: ds.chartDates,
      netData: ds.netData,
      bucketData,
    };
  }, [
    snapshots, accounts, categoryMeta, groups, people, optionData,
    filteredDates, datesSorted, view, seriesVisible, stockOptEnabled, main, fxMap, viewer,
  ]);
}
