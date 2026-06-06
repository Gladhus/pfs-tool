import { MASK } from '@/utils/privacy';

export const TOOLTIP_STYLE = {
  backgroundColor: '#0f172a',
  titleColor: '#94a3b8',
  bodyColor: '#f1f5f9',
  padding: 12,
  cornerRadius: 10,
  titleFont: { size: 11 },
  bodyFont: { size: 13, weight: '600' as const },
};

type TooltipCtx = { dataset: { label: string }; parsed: { y: number } };

export function chartTooltip({
  labelFn,
  titleFn,
  padding,
  cornerRadius,
}: {
  labelFn: (ctx: TooltipCtx) => string;
  titleFn?: (ctx: TooltipCtx[]) => string;
  padding?: number;
  cornerRadius?: number;
}) {
  const style = { ...TOOLTIP_STYLE };
  if (padding != null) style.padding = padding;
  if (cornerRadius != null) style.cornerRadius = cornerRadius;
  return {
    ...style,
    callbacks: {
      ...(titleFn ? { title: titleFn } : {}),
      label: labelFn,
    },
  };
}

/** Read design token colors from CSS custom properties (must be called post-paint). */
export function chartColors() {
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    muted:      get('--subtle',           '#94a3b8'),
    grid:       get('--border',           'rgba(15,23,42,.06)'),
    accent:     get('--accent',           '#10b981'),
    debt:       get('--cat-debts',        '#f43f5e'),
    invest:     get('--cat-investments',  '#3b82f6'),
    realEstate: get('--cat-real-estate',  '#f59e0b'),
    cash:       get('--cat-cash',         '#10b981'),
  };
}

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
  return (v: number) => {
    if (isPrivate) return mask;
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return `${prefix}${(v / 1_000_000).toFixed(1)}M${suffix}`;
    if (abs >= 1_000)     return `${prefix}${(v / 1_000).toFixed(0)}k${suffix}`;
    return `${prefix}${v}${suffix}`;
  };
}

export function sharesTickFmt({ mask = MASK.short, isPrivate = false } = {}) {
  return (v: number) => {
    if (isPrivate) return mask;
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (abs >= 1_000)     return (v / 1_000).toFixed(0) + 'k';
    return String(Math.round(v));
  };
}

export function pctTickFmt({ isPrivate = false } = {}) {
  return (v: number) => {
    if (isPrivate) return MASK.short;
    return v.toFixed(1) + '%';
  };
}
