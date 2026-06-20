import { foldCategoryId } from '@/utils/colors';
import type { BucketDef, BucketModels, BucketStrategy } from './types';

/**
 * Group by folded category. real_estate_debt folds into real_estate; equity is its
 * own bucket appended last (only when equity exists). Mirrors useOverviewStats'
 * category branch.
 */
export function categoryStrategy(models: BucketModels): BucketStrategy {
  const effectiveCats = models.categoryMeta
    .filter(c => c.id !== 'real_estate_debt')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const buckets: BucketDef[] = effectiveCats.map(c => ({
    key: c.id, label: models.tr(c), color: null, catId: c.id,
  }));
  if (models.hasEquity) buckets.push({ key: 'equity', label: 'equity', color: null, catId: 'equity' });

  const keys = new Set(buckets.map(b => b.key));
  return {
    buckets,
    assign(c) {
      const key = c.category === 'equity' ? 'equity' : foldCategoryId(c.category);
      return keys.has(key) ? [{ bucketKey: key, amount: c.amount }] : [];
    },
  };
}
