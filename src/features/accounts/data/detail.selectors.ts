import type { Account, CategoryMeta, Snapshot, Currency } from '@/types/sheets';
import { buildEffectiveBalances } from '@/shared/utils/stats';
import { categoriesInOrder, accountsForCategory } from '@/shared/utils/balance';
import { signedMain, rateFor } from '@/shared/utils/currency';
import { LEGACY_SELF_ID, accountsVisibleToViewer } from '@/shared/utils/ownership';

/**
 * Accounts-domain selectors for the Detail (year-over-year) page. Pure data — the
 * page renders what these return and computes nothing itself.
 */

export type DetailRowKind = 'category-header' | 'account' | 'category-total' | 'net';

export interface DetailRow {
  kind: DetailRowKind;
  label: string;
  categoryId?: string;
  values: (number | null)[];
}

export interface DetailModel {
  years: string[];
  rows: DetailRow[];
}

/** Labels the view supplies (kept out of core so the data layer stays i18n-free). */
export interface DetailLabels {
  net: string;
  total: string;
  tr: (e: { name_en?: string; name_fr?: string }) => string;
}

// Year-over-year window: how many year columns each period keeps.
const PERIOD_LIMIT: Record<string, number | null> = { '3y': 3, '5y': 5, all: null };

/**
 * The year columns to show: every year present in the data (plus the current
 * year), keeping only those where an account the viewer can see has a value
 * carried into Jan 1 — so a viewer who joined later isn't shown empty leading
 * columns belonging to someone else.
 */
export function getDetailYears(
  snapshots: Snapshot[],
  datesSorted: string[],
  period: string,
  visibleIds: Set<string>,
): string[] {
  const currentYear = String(new Date().getFullYear());
  const seen = new Set(datesSorted.map(d => d.slice(0, 4)));
  seen.add(currentYear);
  let sorted = [...seen]
    .sort()
    .filter(y => {
      const bals = buildEffectiveBalances(snapshots, `${y}-01-01`);
      return Object.keys(bals).some(id => visibleIds.has(id));
    });
  const limit = PERIOD_LIMIT[period];
  if (limit && sorted.length > limit) sorted = sorted.slice(-limit);
  return sorted;
}

/**
 * The year-over-year table: category headers, per-account rows (when a category
 * has more than one account), category totals, and a net row — each signed and
 * scoped for the viewer at every year-start. Returns null when there's no data.
 */
export function buildDetailModel(
  snapshots: Snapshot[],
  accounts: Account[],
  categoryMeta: CategoryMeta[],
  years: string[],
  main: Currency,
  fxMap: Map<string, number>,
  viewer: string = LEGACY_SELF_ID,
  labels: DetailLabels,
): DetailModel | null {
  const yearBals: Record<string, Record<string, number>> = {};
  const yearRate: Record<string, number | null> = {};
  for (const y of years) {
    yearBals[y] = buildEffectiveBalances(snapshots, `${y}-01-01`);
    yearRate[y] = rateFor(fxMap, `${y}-01-01`);
  }

  const getVal = (acct: Account, year: string): number | null => {
    const raw = yearBals[year][acct.id];
    return raw !== undefined ? signedMain(acct, raw, main, yearRate[year], viewer) : null;
  };

  const rows: DetailRow[] = [];
  const netByYear: Record<string, number> = Object.fromEntries(years.map(y => [y, 0]));
  const netHasData: Record<string, boolean> = Object.fromEntries(years.map(y => [y, false]));
  let anyData = false;

  for (const cat of categoriesInOrder(accounts, categoryMeta)) {
    const allAccts = accountsForCategory(accounts, cat.id);
    const accts = accountsVisibleToViewer(allAccts, viewer);
    if (!accts.length) continue;

    const catByYear: Record<string, number | null> = Object.fromEntries(years.map(y => [y, null]));
    const catRows: { acct: Account; vals: Record<string, number | null> }[] = [];

    for (const acct of accts) {
      const vals: Record<string, number | null> = Object.fromEntries(years.map(y => [y, getVal(acct, y)]));
      if (!years.some(y => vals[y] !== null)) continue;
      for (const y of years) {
        const v = vals[y];
        if (v !== null) {
          catByYear[y] = (catByYear[y] ?? 0) + v;
          netByYear[y] += v;
          netHasData[y] = true;
          anyData = true;
        }
      }
      catRows.push({ acct, vals });
    }
    if (!catRows.length) continue;

    rows.push({ kind: 'category-header', label: labels.tr(cat), categoryId: cat.id, values: years.map(() => null) });

    // Line items are gated on the category's full account count, not the viewer-filtered one —
    // otherwise a category collapses to "total only" for whichever viewer happens to see fewer
    // of its accounts, while another viewer of the same category still gets line items.
    const showLineItems = allAccts.length > 1;
    if (showLineItems) {
      for (const { acct, vals } of catRows) {
        rows.push({ kind: 'account', label: labels.tr(acct), values: years.map(y => vals[y]) });
      }
    }

    // Skip the category total when it would just repeat a single visible line item verbatim
    // (e.g. a multi-account category where the viewer owns only one of them).
    if (!(showLineItems && catRows.length === 1)) {
      rows.push({ kind: 'category-total', label: labels.total, values: years.map(y => catByYear[y]) });
    }
  }

  if (!anyData) return null;

  rows.push({
    kind: 'net',
    label: labels.net,
    values: years.map(y => (netHasData[y] ? netByYear[y] : null)),
  });

  return { years, rows };
}
