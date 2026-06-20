import type { Currency } from '@/types/sheets';
import { foldCategoryId } from '@/shared/utils/colors';
import { HOUSEHOLD_VIEWER } from '@/shared/utils/ownership';
import type { FilterSpec } from './filters';
import type { Contribution, ValuedContributor } from './contributors/types';
import {
  bucketStrategy, groupStrategy, personStrategy,
  type BucketDef, type BucketModels, type BucketStrategy,
} from './buckets';

export interface DatasetBucketSeries {
  def: BucketDef;
  data: (number | null)[];
}

/**
 * The normalized, viewer-scoped, time-aligned result every page consumes. The
 * series (chartDates/netData/buckets, already trimmed) drives the chart; the
 * scalars drive the hero + allocation cards. See docs/ARCHITECTURE.md §3.
 */
export interface Dataset {
  chartDates: string[];
  netData: (number | null)[];
  buckets: DatasetBucketSeries[];
  latestDate: string | null;
  periodRefDate: string | null;
  netWorth: number;
  byCategory: Record<string, number>;
  prevNetWorth: number | null;
  prevByCategory: Record<string, number> | null;
  groupValues: Map<string, number>;        // group name → current value
  prevGroupValues: Map<string, number> | null;
  personValues: Map<string, number>;       // person id → current value
  prevPersonValues: Map<string, number> | null;
}

export interface DatasetInput {
  contributors: ValuedContributor[];
  /** Period-filtered series dates (the x-axis). */
  axis: string[];
  /** All known dates, for the latest-date fallback when the axis is empty. */
  datesSorted: string[];
  spec: FilterSpec;
  bucketModels: BucketModels;
  main: Currency;
  fxRateFor: (date: string) => number | null;
  /** As-of date for the "current" scalar's equity (injected, not read from the clock). */
  today: string;
  seriesVisible: Record<string, boolean>;
}

const sum = (cs: Contribution[]) => cs.reduce((s, c) => s + c.amount, 0);

/**
 * Fold contributions by (folded) category. Account categories present in the
 * balances are zero-seeded — even when the viewer owns none — so category cards
 * render identically to the legacy path. Equity is excluded from seeding: it only
 * appears when nonzero for the viewer.
 */
function foldByCategory(scoped: Contribution[], all: Contribution[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const c of all) if (c.category !== 'equity') m[foldCategoryId(c.category)] ??= 0;
  for (const c of scoped) {
    const k = foldCategoryId(c.category);
    m[k] = (m[k] ?? 0) + c.amount;
  }
  return m;
}

function accumulate(strategy: BucketStrategy, contribs: Contribution[]): Map<string, number> {
  const m = new Map(strategy.buckets.map(b => [b.key, 0]));
  for (const c of contribs) for (const a of strategy.assign(c)) m.set(a.bucketKey, (m.get(a.bucketKey) ?? 0) + a.amount);
  return m;
}

/**
 * Compose the data layer: value every enabled contributor over the axis, scope to
 * the viewer, bucketize via the view's strategy, and trim leading viewer-empty
 * dates — all in one place. Pure and memoizable.
 */
export function buildDataset(input: DatasetInput): Dataset {
  const { contributors, axis, datesSorted, spec, bucketModels, main, fxRateFor, today, seriesVisible } = input;
  const enabled = contributors.filter(c => c.isEnabled(spec));
  const scope = (cs: Contribution[]) =>
    spec.viewer === HOUSEHOLD_VIEWER ? cs : cs.filter(c => c.ownerId === spec.viewer);

  // ---- scalars (single-date evaluations) ----
  const latestDate = axis.length ? axis[axis.length - 1]
    : datesSorted.length ? datesSorted[datesSorted.length - 1] : null;
  const periodRefDate = axis.length > 1 ? axis[0] : null;

  const asOf = (date: string, equityDate: string): Contribution[] =>
    enabled.flatMap(c => c.valuesOver([date], { viewer: spec.viewer, main, fxRateFor, equityDate })[0]);

  // Current values equity at ~today (accounts stay at their snapshot date); the
  // period baseline values equity at the ref date so deltas reflect growth.
  const currentAll = latestDate ? asOf(latestDate, today) : [];
  const prevAll = periodRefDate ? asOf(periodRefDate, periodRefDate) : null;
  const currentScoped = scope(currentAll);
  const prevScoped = prevAll ? scope(prevAll) : null;

  const groupStrat = groupStrategy(bucketModels);
  const personStrat = personStrategy(bucketModels);
  const curGroup = accumulate(groupStrat, currentScoped);
  const curPerson = accumulate(personStrat, currentAll);          // person values are per-owner, viewer-independent
  const prevGroup = prevScoped ? accumulate(groupStrat, prevScoped) : null;
  const prevPerson = prevAll ? accumulate(personStrat, prevAll) : null;

  const scalars = {
    latestDate,
    periodRefDate,
    netWorth: sum(currentScoped),
    byCategory: foldByCategory(currentScoped, currentAll),
    prevNetWorth: prevScoped ? sum(prevScoped) : null,
    prevByCategory: prevScoped && prevAll ? foldByCategory(prevScoped, prevAll) : null,
    groupValues: new Map(bucketModels.groups.map(g => [g.name, curGroup.get('group:' + g.name) ?? 0])),
    prevGroupValues: prevGroup ? new Map(bucketModels.groups.map(g => [g.name, prevGroup.get('group:' + g.name) ?? 0])) : null,
    personValues: new Map(bucketModels.people.map(p => [p.id, curPerson.get('person:' + p.id) ?? 0])),
    prevPersonValues: prevPerson ? new Map(bucketModels.people.map(p => [p.id, prevPerson.get('person:' + p.id) ?? 0])) : null,
  };

  if (!axis.length) {
    return { chartDates: [], netData: [], buckets: [], ...scalars };
  }

  // ---- series (per-axis-date) ----
  const perContributor = enabled.map(c => c.valuesOver(axis, { viewer: spec.viewer, main, fxRateFor }));
  const strategy = bucketStrategy(spec.view, bucketModels);
  const keyIndex = new Map(strategy.buckets.map((b, i) => [b.key, i]));
  const seriesArr = strategy.buckets.map(() => new Array<number>(axis.length).fill(0));
  const firstSeen = new Array<number>(strategy.buckets.length).fill(-1);
  const net = new Array<number>(axis.length).fill(0);
  const hasAny = new Array<boolean>(axis.length).fill(false);

  for (let i = 0; i < axis.length; i++) {
    const unscoped = perContributor.flatMap(s => s[i]);
    const scoped = scope(unscoped);
    hasAny[i] = scoped.length > 0;

    // Values are viewer-scoped.
    for (const c of scoped) {
      net[i] += c.amount;
      for (const a of strategy.assign(c)) {
        const bi = keyIndex.get(a.bucketKey);
        if (bi !== undefined) seriesArr[bi][i] += a.amount;
      }
    }

    // First-seen drives leading-null per bucket. Account presence is viewer-
    // independent (an empty-for-you category still starts where its accounts do);
    // equity only counts once it's visible to the viewer.
    const presence = unscoped.filter(c => c.category !== 'equity')
      .concat(scoped.filter(c => c.category === 'equity'));
    for (const c of presence) {
      for (const a of strategy.assign(c)) {
        const bi = keyIndex.get(a.bucketKey);
        if (bi !== undefined && firstSeen[bi] === -1) firstSeen[bi] = i;
      }
    }
  }

  const netData: (number | null)[] = net.map((v, i) => (hasAny[i] ? v : null));
  const rawBucket = seriesArr.map((arr, b) =>
    arr.map((v, i) => (!hasAny[i] || i < firstSeen[b]) ? null : v));

  // Trim leading dates that are null across every visible series.
  const isVis = (key: string) => seriesVisible[key] !== false;
  const candidates: (number | null)[][] = [];
  if (isVis('net')) candidates.push(netData);
  strategy.buckets.forEach((b, bi) => { if (isVis(b.key)) candidates.push(rawBucket[bi]); });
  let trimStart = 0;
  if (candidates.length) {
    const firsts = candidates.map(a => a.findIndex(v => v !== null)).filter(x => x >= 0);
    if (firsts.length) trimStart = Math.min(...firsts);
  }

  return {
    ...scalars,
    chartDates: trimStart ? axis.slice(trimStart) : axis,
    netData: trimStart ? netData.slice(trimStart) : netData,
    buckets: strategy.buckets.map((def, b) => ({
      def, data: trimStart ? rawBucket[b].slice(trimStart) : rawBucket[b],
    })),
  };
}
