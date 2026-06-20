import type { OverviewView } from '../filters';
import type { BucketModels, BucketStrategy } from './types';
import { categoryStrategy } from './category.strategy';
import { groupStrategy } from './group.strategy';
import { personStrategy } from './person.strategy';

export type { BucketDef, BucketAssignment, BucketModels, BucketStrategy } from './types';
export { categoryStrategy } from './category.strategy';
export { groupStrategy } from './group.strategy';
export { personStrategy, personColor } from './person.strategy';

const STRATEGIES: Record<OverviewView, (m: BucketModels) => BucketStrategy> = {
  category: categoryStrategy,
  group: groupStrategy,
  person: personStrategy,
};

/** Build the grouping strategy for a view. */
export function bucketStrategy(view: OverviewView, models: BucketModels): BucketStrategy {
  return STRATEGIES[view](models);
}
