import { addMonths } from '@/shared/utils/dates';
import type { FilterSpec, Period } from './filters';
import type { DateRange, ValuedContributor } from './contract.contributor';

// Mirrors getDatesForPeriod's month windows so a range-then-merge over account
// snapshot dates reproduces the legacy filtered date list (proven in axis.test.ts).
const PERIOD_MONTHS: Record<string, number> = {
  '3m': 3, '6m': 6, '1y': 12, '2y': 24, '3y': 36, '5y': 60,
  '3M': 3, '6M': 6, '1Y': 12, '2Y': 24, '3Y': 36, '5Y': 60,
};

/**
 * The inclusive date window for a period, derived from the data's own span. `end`
 * is the latest known date; `start` is the period boundary (undefined for "all" or
 * an unknown period → no lower bound). Contributors enumerate their checkpoints
 * within this window.
 */
export function periodRange(period: Period, datesSorted: string[]): DateRange {
  if (!datesSorted.length) return { end: '' };
  const end = datesSorted[datesSorted.length - 1];
  if (period === 'ytd' || (period as string) === 'YTD') return { start: `${end.slice(0, 4)}-01-01`, end };
  const n = PERIOD_MONTHS[period as string];
  if (!n) return { end };
  return { start: addMonths(new Date(end), -n).toISOString().slice(0, 10), end };
}

/** Merge per-contributor checkpoint dates into one sorted, deduped, day-level axis. */
export function mergeAxis(dateLists: string[][]): string[] {
  const set = new Set<string>();
  for (const list of dateLists) for (const d of list) set.add(d);
  return [...set].sort();
}

/** The shared axis for a spec: every enabled contributor's checkpoints in range, merged. */
export function buildAxis(contributors: ValuedContributor[], spec: FilterSpec, range: DateRange): string[] {
  return mergeAxis(contributors.filter(c => c.isEnabled(spec)).map(c => c.checkpointDates(range)));
}
