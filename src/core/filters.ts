import { HOUSEHOLD_VIEWER } from '@/utils/ownership';

/** A time window for the series/table. Owned by the data layer; the PeriodPills UI re-exports it. */
export type Period = '3m' | '6m' | '1y' | '2y' | '3y' | '5y' | 'ytd' | 'all';

export type OverviewView = 'category' | 'group' | 'person';

/**
 * The single description of "what am I looking at" — the inputs every page funnels
 * its data through. Resolved once by {@link resolveFilterSpec} from the URL
 * (period/account) and the UI store (viewer/view), so the Zustand-vs-URL split
 * stops leaking into each page. See docs/ARCHITECTURE.md §3.
 */
export interface FilterSpec {
  viewer: string;          // person id, or HOUSEHOLD_VIEWER for everyone combined
  period: Period;          // time window for the series/table
  view: OverviewView;      // already resolved (person → category for an individual viewer)
  accountId: string;       // single-account drill-down; '' = none
  includeInactive: boolean;
}

export interface FilterInputs {
  viewer: string;
  /** Raw view toggle (Overview only); other pages omit it and default to category. */
  view?: OverviewView;
  defaultPeriod?: Period;
  includeInactive?: boolean;
}

/**
 * Pure: turns the URL params + UI-store inputs into a {@link FilterSpec}. Centralizes
 * the period default, the `account` drill-down read, and the "By person" → category
 * fallback (that view only makes sense for the whole household).
 */
export function resolveFilterSpec(params: URLSearchParams, inputs: FilterInputs): FilterSpec {
  const period = (params.get('period') as Period) ?? inputs.defaultPeriod ?? 'all';
  const accountId = params.get('account') ?? '';
  const rawView: OverviewView = inputs.view ?? 'category';
  const view: OverviewView =
    rawView === 'person' && inputs.viewer !== HOUSEHOLD_VIEWER ? 'category' : rawView;
  return {
    viewer: inputs.viewer,
    period,
    view,
    accountId,
    includeInactive: inputs.includeInactive ?? false,
  };
}
