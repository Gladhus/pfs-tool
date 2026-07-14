import { MASK } from '@/shared/utils/privacy';

/** Compact money ticks that keep one decimal in the low-thousands, so 1,050 and
    1,400 don't both collapse to "1k" (the shared moneyTickFmt rounds to integer k). */
export function moneyTick(v: number, isPrivate: boolean): string {
  if (isPrivate) return MASK.med;
  const abs = Math.abs(v);
  if (abs >= 10_000) return `${Math.round(v / 1000)}k`;
  if (abs >= 1_000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(v));
}

/** X-axis month label from a 'YYYY-MM' key; the year is marked each January. */
export function xMonthTick(m: string, locale: 'en' | 'fr'): string {
  const [y, mo] = m.split('-');
  const short = new Date(+y, +mo - 1, 1).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', { month: 'short' });
  return mo === '01' ? `${short} '${y.slice(2)}` : short;
}
