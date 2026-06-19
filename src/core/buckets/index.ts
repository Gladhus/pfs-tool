import type { OverviewView } from '../filters';
import type { BucketModels, BucketStrategy } from './types';
import { categoryStrategy } from './category';
import { groupStrategy } from './group';
import { personStrategy } from './person';

export type { BucketDef, BucketAssignment, BucketModels, BucketStrategy } from './types';
export { categoryStrategy } from './category';
export { groupStrategy } from './group';
export { personStrategy, personColor } from './person';

const STRATEGIES: Record<OverviewView, (m: BucketModels) => BucketStrategy> = {
  category: categoryStrategy,
  group: groupStrategy,
  person: personStrategy,
};

/** Build the grouping strategy for a view. */
export function bucketStrategy(view: OverviewView, models: BucketModels): BucketStrategy {
  return STRATEGIES[view](models);
}
