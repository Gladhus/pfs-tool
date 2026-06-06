import { MASK } from '@/utils/privacy';

export function moneyTickFmt({
  suffix = '',
  prefix = '',
  mask = MASK.med,
  isPrivate = false,
}: {
  suffix?: string;
  prefix?: string;
  mask?: string;
  isPrivate?: boolean;
} = {}) {
  return (raw: string | number) => {
    if (isPrivate) return mask;
    const v = typeof raw === 'number' ? raw : Number(raw);
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return `${prefix}${(v / 1_000_000).toFixed(1)}M${suffix}`;
    if (abs >= 1_000)     return `${prefix}${(v / 1_000).toFixed(0)}k${suffix}`;
    return `${prefix}${v}${suffix}`;
  };
}

export function sharesTickFmt({ mask = MASK.short, isPrivate = false } = {}) {
  return (raw: string | number) => {
    if (isPrivate) return mask;
    const v = typeof raw === 'number' ? raw : Number(raw);
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (abs >= 1_000)     return (v / 1_000).toFixed(0) + 'k';
    return String(Math.round(v));
  };
}

export function pctTickFmt({ isPrivate = false } = {}) {
  return (raw: string | number) => {
    if (isPrivate) return MASK.short;
    const v = typeof raw === 'number' ? raw : Number(raw);
    return v.toFixed(1) + '%';
  };
}
