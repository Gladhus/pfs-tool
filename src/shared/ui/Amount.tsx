import { useUIStore } from '@/shared/stores/ui.store';
import { useConfigQuery } from '@/shared/io/queries/sheetQueries';
import { privCur } from '@/shared/utils/currency';
import type { Currency } from '@/types/sheets';

interface AmountProps {
  /** The amount. Aggregations should already be converted to the main currency. */
  value: number;
  /** The value's native currency. Defaults to the main currency (renders plain "$"). */
  currency?: Currency;
  /** Color green when ≥ 0, red when < 0 (for signed figures like deltas). */
  signed?: boolean;
  /** Use compact mono font (Inconsolata) instead of the default (DM Mono). */
  compact?: boolean;
  /**
   * Whether the value is sensitive (a holding/balance) and should be hidden in
   * private mode. Defaults to `true`. Set `false` for public figures like share
   * prices / FMV, which stay visible even when private mode is on.
   */
  sensitive?: boolean;
  className?: string;
}

/**
 * Canonical amount display — currency- and privacy-aware. Reads the main currency
 * (config), locale, and private mode itself, so callers only pass the value and,
 * for non-main values, the native currency. Non-main amounts get a code suffix
 * ("$1,234.00 USD"); the main currency renders plain ("$1,234.00").
 */
export function Amount({ value, currency, signed = false, sensitive = true, compact = false, className = '' }: AmountProps) {
  const lang = useUIStore(s => s.lang);
  const privateMode = useUIStore(s => s.privateMode);
  const main: Currency = useConfigQuery().data?.currency === 'USD' ? 'USD' : 'CAD';
  const locale = lang === 'fr' ? 'fr' : 'en';
  const cur = currency ?? main;
  const tone = signed ? (value < 0 ? 'text-red' : 'text-ok') : '';
  const isPrivate = sensitive && privateMode;
  return <span className={`${compact ? 'font-mono-compact' : 'font-mono'} tabular-nums ${tone} ${className}`}>{privCur(value, isPrivate, locale, cur, main)}</span>;
}
