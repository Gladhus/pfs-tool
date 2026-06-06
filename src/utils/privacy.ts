import { fmtMoney, fmtDelta, fmtPct, fmtMoneyShort } from './format';

export const MASK = {
  full:  '••••••',
  med:   '••••',
  short: '••',
} as const;

export function privMoney(n: number, privateMode: boolean, locale: string, currency: string): string {
  return privateMode ? MASK.full : fmtMoney(n, locale, currency);
}

export function privDelta(n: number, privateMode: boolean, locale: string, currency: string): string {
  return privateMode ? MASK.short : fmtDelta(n, locale, currency);
}

export function privPct(delta: number, ref: number): string {
  return fmtPct(delta, ref);
}

export function privShares(n: number, privateMode: boolean): string {
  return privateMode ? MASK.short : Math.round(n).toLocaleString();
}

export function privShort(
  n: number,
  privateMode: boolean,
  { mask = MASK.med, prefix = '', suffix = '' } = {},
): string {
  if (privateMode) return mask;
  return fmtMoneyShort(n, { prefix, suffix });
}
