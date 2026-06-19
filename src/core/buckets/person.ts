import type { Person } from '@/types/sheets';
import type { BucketDef, BucketModels, BucketStrategy } from './types';

// Fallback palette for people without an explicit colour (kept identical to the
// legacy useOverviewStats palette so person-view colours don't shift).
const PERSON_COLORS = ['#06b6d4', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#3b82f6'];

export function personColor(person: Person, index: number): string {
  return person.color || PERSON_COLORS[index % PERSON_COLORS.length];
}

/**
 * Group by owner. Because contributions are already per-owner (a joint account
 * emitted one slice per person; equity carries its single owner), assignment is just
 * "bucket by ownerId" — the polymorphism the legacy person branch hand-rolled.
 */
export function personStrategy(models: BucketModels): BucketStrategy {
  const buckets: BucketDef[] = models.people.map((p, i) => ({
    key: 'person:' + p.id, label: p.name || p.id, color: personColor(p, i), personId: p.id,
  }));

  const keys = new Set(buckets.map(b => b.key));
  return {
    buckets,
    assign(c) {
      const key = 'person:' + c.ownerId;
      return keys.has(key) ? [{ bucketKey: key, amount: c.amount }] : [];
    },
  };
}
