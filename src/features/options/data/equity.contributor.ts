import type { OptionCompany, OptionGrant, OptionFmv, OptionExercise } from '@/types/sheets';
import { computeCompanyEquityValue } from '@/shared/utils/options';
import { toMain } from '@/shared/utils/currency';
import { addMonths } from '@/shared/utils/dates';
import type { ValuedContributor, ValueContext, Contribution, DateRange } from '@/core/contributor.contract';

const INTERVAL_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, annual: 12 };

function addMonthsISO(start: string, months: number): string {
  return addMonths(new Date(start + 'T12:00:00'), months).toISOString().slice(0, 10);
}

/**
 * Exact day-level dates a grant's vested value steps on: the cliff, each interval
 * boundary through full vest, and the fully-vested date. Derived from the schedule
 * (addMonths preserves the day-of-month) — deliberately NOT generateMonthlyDates,
 * which snaps to the 1st and would drop equity to month precision.
 */
function vestingCheckpoints(g: OptionGrant): string[] {
  const start = g.vesting_start || g.grant_date;
  const vm = Number(g.vesting_months) || 0;
  if (!start || vm <= 0) return [];
  const cliff = Number(g.cliff_months) || 0;
  const interval = INTERVAL_MONTHS[g.vesting_interval] ?? 1;
  const out = new Set<string>();
  out.add(addMonthsISO(start, Math.min(cliff, vm)));   // first vest (cliff)
  for (let k = interval; k <= vm; k += interval) {
    if (k >= cliff) out.add(addMonthsISO(start, k));
  }
  out.add(addMonthsISO(start, vm));                    // fully vested
  return [...out];
}

/**
 * The calculated value source: stock-option equity. No stored snapshots — value is
 * computed from the vesting schedule, FMV history, and exercises at the asked-for
 * date. Each company has a single owner, so it emits one Contribution per company.
 *
 * Reads `ctx.equityDate` when set (the "current" scalar values equity at ~today
 * while accounts stay at their snapshot date); otherwise values at each axis date,
 * matching the legacy time-series behaviour. The contributor never reads the wall
 * clock — the as-of date is injected by the pipeline.
 *
 * Behaviour-identical to `computeCompanyEquityValue` + `ownerVisibleToViewer`;
 * proven by cross-check against `computeDateStats`' equity bucket.
 */
export function makeEquityContributor(
  companies: OptionCompany[],
  grants: OptionGrant[],
  fmv: OptionFmv[],
  exercises: OptionExercise[],
): ValuedContributor {
  const activeCompanies = companies.filter(c => c.active !== false);

  return {
    id: 'equity',
    isEnabled: () => activeCompanies.length > 0,

    checkpointDates({ start, end }: DateRange): string[] {
      const out = new Set<string>();
      const push = (d: string) => {
        if (d && (!start || d >= start) && (!end || d <= end)) out.add(d);
      };
      for (const c of activeCompanies) {
        const cGrants = grants.filter(g => g.company_id === c.id);
        for (const g of cGrants) for (const d of vestingCheckpoints(g)) push(d);
        for (const f of fmv) if (f.company_id === c.id) push(f.date);
        const gids = new Set(cGrants.map(g => g.id));
        for (const e of exercises) if (gids.has(e.grant_id)) push(e.date);
      }
      return [...out].sort();
    },

    valuesOver(axis: string[], ctx: ValueContext): Contribution[][] {
      return axis.map(date => {
        const valDate = ctx.equityDate ?? date;
        const usdCad = ctx.fxRateFor(valDate);
        const out: Contribution[] = [];
        for (const c of activeCompanies) {
          const v = computeCompanyEquityValue(c.id, grants, fmv, exercises, valDate);
          if (!v) continue;
          out.push({
            amount: toMain(v, c.currency ?? ctx.main, ctx.main, usdCad),
            category: 'equity',
            ownerId: c.owner,
            sourceId: c.id,
            tags: c.tags,
          });
        }
        return out;
      });
    },
  };
}
