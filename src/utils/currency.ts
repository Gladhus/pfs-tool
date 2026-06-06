import type { Account, Currency, FxRate } from '@/types/sheets';
import { MASK } from './privacy';

/** Build a date→(USD→CAD) lookup from persisted rows. */
export function fxMap(rates: FxRate[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rates) m.set(r.date, r.usd_cad);
  return m;
}

/** USD→CAD rate for an exact date; nearest prior if the exact day isn't stored. */
export function rateFor(map: Map<string, number>, date: string): number | null {
  const exact = map.get(date);
  if (exact != null) return exact;
  let best: string | null = null;
  for (const d of map.keys()) {
    if (d <= date && (best === null || d > best)) best = d;
  }
  return best ? map.get(best)! : null;
}

/**
 * Convert an amount from one currency to the main currency.
 * `usdCad` is the USD→CAD rate for the relevant date. Same-currency is a no-op;
 * a missing rate falls back to no conversion (better than zeroing the value).
 */
export function toMain(amount: number, from: Currency, main: Currency, usdCad: number | null): number {
  if (from === main) return amount;
  if (usdCad == null || !usdCad) return amount;
  if (from === 'USD' && main === 'CAD') return amount * usdCad;
  if (from === 'CAD' && main === 'USD') return amount / usdCad;
  return amount;
}

/**
 * An account's balance converted to the main currency and signed for net-worth math:
 * convert (native→main using the date's rate) × ownership_share × (debt ? -1 : 1).
 */
export function signedMain(account: Account, balanceRaw: number, main: Currency, usdCad: number | null): number {
  const converted = toMain(balanceRaw, account.currency ?? main, main, usdCad);
  return converted * (account.ownership_share ?? 1) * (account.kind === 'debt' ? -1 : 1);
}

/**
 * Format money. Main currency renders as a plain "$1,234.00"; a non-main currency
 * appends its ISO code: "$1,234.00 USD".
 */
export function fmtCur(value: number, locale: string, currency: Currency, main: Currency): string {
  const v = value || 0;
  const abs = new Intl.NumberFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(v));
  const body = `${v < 0 ? '-' : ''}$${abs}`;
  return currency === main ? body : `${body} ${currency}`;
}

/** Privacy-aware fmtCur: masks the value but keeps the currency-code suffix. */
export function privCur(value: number, isPrivate: boolean, locale: string, currency: Currency, main: Currency): string {
  if (isPrivate) return currency === main ? MASK.full : `${MASK.full} ${currency}`;
  return fmtCur(value, locale, currency, main);
}
