import type { CategoryMeta, Group, Person } from '@/types/sheets';
import type { Contribution } from '../contributor.contract';

/** A series/legend entry: stable key, display label, optional colour + ids for the UI. */
export interface BucketDef {
  key: string;
  label: string;
  color: string | null;
  catId?: string;
  personId?: string;
}

/** Which bucket a contribution lands in, and with what amount. */
export interface BucketAssignment {
  bucketKey: string;
  amount: number;
}

/** Everything a strategy needs to define its buckets (data-independent of the dates). */
export interface BucketModels {
  categoryMeta: CategoryMeta[];
  groups: Group[];
  /** Active people in display order (person view only). */
  people: Person[];
  /** Whether equity contributions exist — drives the category view's equity bucket. */
  hasEquity: boolean;
  /** Localized label resolver for category names (injected to keep core i18n-free). */
  tr: (e: { name_en?: string; name_fr?: string }) => string;
}

/**
 * One grouping of contributions (category | group | person). Built from models, then
 * `assign` maps each contribution to zero or more buckets — group view can match
 * several groups; category/person match at most one.
 */
export interface BucketStrategy {
  buckets: BucketDef[];
  assign(c: Contribution): BucketAssignment[];
}
