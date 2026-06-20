import type { Currency } from '@/types/sheets';
import type { FilterSpec } from './filters';

/**
 * A signed, main-currency amount for ONE owner on a date the pipeline asked about.
 * It carries no date — a Contribution is a *sample* (the answer to "what are you
 * worth as of date D"), not an *event*; the date is its position on the axis. An
 * account split between two people yields two Contributions (one per owner); a
 * single-owner source yields one. See docs/ARCHITECTURE.md §3.
 */
export interface Contribution {
  /** This owner's slice, converted to main currency and signed (debt < 0). */
  amount: number;
  /**
   * Raw category id, e.g. 'investments' | 'real_estate' | 'real_estate_debt' |
   * 'equity'. Kept raw (not folded) so consumers that distinguish real-estate debt
   * still can; the category BucketStrategy folds via foldCategoryId when grouping.
   */
  category: string;
  /** The single owner this slice belongs to (drives viewer scoping + person view). */
  ownerId: string;
  /** Source row id (account/company) — for drill-down and memo keys. */
  sourceId: string;
  /** Tags for group/tag matching, when the source has them. */
  tags?: string[];
}

/** Everything a contributor needs to value a date, resolved once by the pipeline. */
export interface ValueContext {
  viewer: string;
  main: Currency;
  /** USD↔main rate for a given date (nearest prior if exact day isn't stored). */
  fxRateFor: (date: string) => number | null;
  /**
   * Date at which to value time-vesting assets (≈ today) for the "current" scalar.
   * Along the time series the pipeline passes each axis date instead; contributors
   * that don't vest ignore this.
   */
  equityDate?: string;
}

/** Inclusive date window for axis construction. `start` undefined = from the beginning. */
export interface DateRange {
  start?: string;
  end: string;
}

/**
 * A source of net-worth value (accounts, stock options, future crypto/pensions).
 * The pipeline asks every contributor two questions — which dates it changes on
 * (to build a shared axis) and what it's worth on each axis date — and never needs
 * to know which kind it is.
 */
export interface ValuedContributor {
  readonly id: string;
  /** Cheap gate so a disabled feature contributes nothing and costs nothing. */
  isEnabled(spec: FilterSpec): boolean;
  /** Day-level dates this source changes on, within `range`. May be [] for a pure sampler. */
  checkpointDates(range: DateRange): string[];
  /** Value at each date of the FINAL merged `axis`; owns its own carry-forward. */
  valuesOver(axis: string[], ctx: ValueContext): Contribution[][];
}
