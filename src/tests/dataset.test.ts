import { describe, it, expect } from 'vitest';
import { buildDataset, type DatasetInput } from '@/core/dataset';
import { makeAccountContributor } from '@/features/accounts/data/account.contributor';
import { makeEquityContributor } from '@/features/options/data/equity.contributor';
import type { ValuedContributor } from '@/core/contributors/types';
import type { BucketModels } from '@/core/buckets';
import type { FilterSpec, OverviewView } from '@/core/filters';
import { rateFor } from '@/utils/currency';
import { HOUSEHOLD_VIEWER } from '@/utils/ownership';
import {
  ACCOUNTS, SNAPSHOTS, DATES_SORTED, FX_MAP, MAIN,
  CATEGORY_META, GROUPS, PEOPLE, OPTION_DATA,
} from './fixtures/portfolio';

const baseContributors = (): ValuedContributor[] => [
  makeAccountContributor(ACCOUNTS, SNAPSHOTS),
  makeEquityContributor(OPTION_DATA.companies, OPTION_DATA.grants, OPTION_DATA.fmv, OPTION_DATA.exercises),
];

const models: BucketModels = {
  categoryMeta: CATEGORY_META, groups: GROUPS, people: PEOPLE.filter(p => p.active),
  hasEquity: true, tr: (e) => e.name_en ?? e.name_fr ?? '',
};

const spec = (viewer: string, view: OverviewView = 'category'): FilterSpec =>
  ({ viewer, period: 'all', view, accountId: '', includeInactive: false });

const input = (over: Partial<DatasetInput> = {}): DatasetInput => ({
  contributors: baseContributors(),
  axis: DATES_SORTED,
  datesSorted: DATES_SORTED,
  spec: spec('self'),
  bucketModels: models,
  main: MAIN,
  fxRateFor: (d) => rateFor(FX_MAP, d),
  today: '2026-06-01',
  seriesVisible: {},
  ...over,
});

const lastNonNull = (arr: (number | null)[]) => [...arr].reverse().find(v => v !== null) as number;

describe('buildDataset — viewer scoping + trim', () => {
  it('trims leading viewer-empty dates for an individual viewer', () => {
    const ds = buildDataset(input({ spec: spec('self') }));
    expect(ds.chartDates[0]).toBe('2022-02-01');      // 2021 (partner-only) trimmed away
    expect(ds.chartDates).toHaveLength(3);
  });

  it('keeps every date for the household viewer', () => {
    const ds = buildDataset(input({ spec: spec(HOUSEHOLD_VIEWER) }));
    expect(ds.chartDates).toEqual(DATES_SORTED);
  });

  it('household net worth is the sum of each person\'s net worth', () => {
    const hh = buildDataset(input({ spec: spec(HOUSEHOLD_VIEWER) }));
    const self = buildDataset(input({ spec: spec('self') }));
    const partner = buildDataset(input({ spec: spec('partner') }));
    expect(hh.netWorth).toBeCloseTo(self.netWorth + partner.netWorth, 4);
  });
});

describe('buildDataset — category buckets partition the net line', () => {
  it('the bucket values at each charted date sum to net', () => {
    const ds = buildDataset(input({ spec: spec(HOUSEHOLD_VIEWER) }));
    ds.chartDates.forEach((_, i) => {
      if (ds.netData[i] == null) return;
      const bucketSum = ds.buckets.reduce((s, b) => s + (b.data[i] ?? 0), 0);
      expect(bucketSum).toBeCloseTo(ds.netData[i] as number, 4);
    });
  });
});

// The seam: a brand-new value source flows through net + the right bucket with no
// edit to buildDataset, scope, trim, or the strategies.
describe('buildDataset — a new ValuedContributor plugs in with no pipeline change', () => {
  const manualAsset = (amount: number): ValuedContributor => ({
    id: 'manual',
    isEnabled: () => true,
    checkpointDates: () => [],
    valuesOver: (axis) => axis.map(() => [{ amount, category: 'cash', ownerId: 'self', sourceId: 'manual1' }]),
  });

  it('adds its value to net and the matching category bucket', () => {
    const without = buildDataset(input({ spec: spec('self') }));
    const withManual = buildDataset(input({
      contributors: [...baseContributors(), manualAsset(500)],
      spec: spec('self'),
    }));

    expect(lastNonNull(withManual.netData) - lastNonNull(without.netData)).toBeCloseTo(500, 4);

    const cashBefore = without.buckets.find(b => b.def.key === 'cash')!.data;
    const cashAfter = withManual.buckets.find(b => b.def.key === 'cash')!.data;
    expect(lastNonNull(cashAfter) - lastNonNull(cashBefore)).toBeCloseTo(500, 4);

    expect(withManual.byCategory['cash'] - without.byCategory['cash']).toBeCloseTo(500, 4);
  });

  it('is excluded when isEnabled is false (costs nothing)', () => {
    const off: ValuedContributor = { ...manualAsset(500), isEnabled: () => false };
    const without = buildDataset(input({ spec: spec('self') }));
    const withOff = buildDataset(input({ contributors: [...baseContributors(), off], spec: spec('self') }));
    expect(lastNonNull(withOff.netData)).toBeCloseTo(lastNonNull(without.netData), 4);
  });
});
