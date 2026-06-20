import { accountMatchesGroup, groupColor } from '@/shared/utils/colors';
import type { BucketDef, BucketModels, BucketStrategy } from './types';

/**
 * Group by user-defined tag groups. A contribution (account or equity) can match
 * several groups via its tags, so `assign` may return multiple buckets. Mirrors
 * useOverviewStats' group branch, where equity rolls into groups its company tags
 * match.
 */
export function groupStrategy(models: BucketModels): BucketStrategy {
  const buckets: BucketDef[] = models.groups.map(g => ({
    key: 'group:' + g.name, label: g.name, color: groupColor(g),
  }));

  return {
    buckets,
    assign(c) {
      const tags = c.tags ?? [];
      return models.groups
        .filter(g => accountMatchesGroup({ tags }, g))
        .map(g => ({ bucketKey: 'group:' + g.name, amount: c.amount }));
    },
  };
}
