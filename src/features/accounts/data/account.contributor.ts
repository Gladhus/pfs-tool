import type { Account, Snapshot } from '@/types/sheets';
import { buildBalanceSweep } from '@/shared/utils/stats';
import { toMain } from '@/shared/utils/currency';
import type { ValuedContributor, ValueContext, Contribution, DateRange } from '@/core/contributors/types';

/**
 * The snapshot/LOCF value source: account balances carried forward across the axis,
 * converted to the main currency and signed (debt < 0). Emits ONE Contribution per
 * owner so a joint account splits into per-person slices (summing to the whole) —
 * which is what lets viewer scoping and person view fall out of "group by ownerId".
 *
 * Behaviour-identical to the legacy `signedMain` over `buildBalanceSweep`; proven by
 * cross-check tests against `computeDateStats` / `computeNetWorthFromSnapshots`.
 */
export function makeAccountContributor(accounts: Account[], snapshots: Snapshot[]): ValuedContributor {
  const acctById = new Map(accounts.map(a => [a.id, a]));

  return {
    id: 'accounts',
    isEnabled: () => true,

    checkpointDates({ start, end }: DateRange): string[] {
      const set = new Set<string>();
      for (const s of snapshots) {
        if (s.account_id === '__day__' || !s.date) continue;
        if (start && s.date < start) continue;
        if (end && s.date > end) continue;
        set.add(s.date);
      }
      return [...set].sort();
    },

    valuesOver(axis: string[], ctx: ValueContext): Contribution[][] {
      // buildBalanceSweep seeds from the last snapshot <= axis[0], so values carry
      // into a period that starts after an account's most recent entry.
      const sweep = buildBalanceSweep(snapshots, axis);
      return axis.map((date, i) => {
        const usdCad = ctx.fxRateFor(date);
        const out: Contribution[] = [];
        for (const [accountId, balanceRaw] of Object.entries(sweep[i])) {
          const a = acctById.get(accountId);
          if (!a) continue;
          const signed = toMain(balanceRaw, a.currency ?? ctx.main, ctx.main, usdCad) * (a.kind === 'debt' ? -1 : 1);
          for (const o of a.ownership) {
            if (!(o.share > 0)) continue;
            out.push({
              amount: signed * o.share,
              category: a.category,
              ownerId: o.person_id,
              sourceId: a.id,
              tags: a.tags,
            });
          }
        }
        return out;
      });
    },
  };
}
