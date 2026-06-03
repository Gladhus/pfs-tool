// Shared Chart.js options bits. Every chart in the app uses the same dark
// tooltip + dotted axes + privacy-aware tick callbacks; this collects the
// boilerplate so the call sites stay focused on their data.

import Chart from 'chart.js/auto';
import { state } from './state.js';
import { fmtMoney, fmtMoneyShort } from './format.js';
import { privMoney, MASK } from './privacy.js';

export const TOOLTIP_STYLE = {
  backgroundColor: '#0f172a',
  titleColor: '#94a3b8',
  bodyColor: '#f1f5f9',
  padding: 12,
  cornerRadius: 10,
  titleFont: { size: 11 },
  bodyFont: { size: 13, weight: '600' },
};

// Build a tooltip config. `labelFn` is the Chart.js callback receiving ctx.
// `titleFn` is optional. Returns a plain object to drop into options.plugins.tooltip.
export function chartTooltip({ labelFn, titleFn = null, padding, cornerRadius } = {}) {
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

// Default money tooltip label: "  Series name: $1,234.56" (with privacy mask).
export const moneyTooltipLabel = (ctx) =>
  `  ${ctx.dataset.label}: ${privMoney(ctx.parsed.y)}`;

// Y-axis tick callback: compacts large money to "1.2M" / "5k".
// `suffix` appends after the unit (e.g. ' $' for fr-style); `prefix` prepends
// (e.g. '$' for en-style). `mask` is the private-mode replacement.
// `smallFmt` overrides how sub-1k values are rendered (defaults to raw).
export function moneyTickFmt({
  suffix = '',
  prefix = '',
  mask = MASK.med,
  smallFmt = null,
} = {}) {
  return (v) => {
    if (state.privateMode) return mask;
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return `${prefix}${(v / 1_000_000).toFixed(1)}M${suffix}`;
    if (abs >= 1_000)     return `${prefix}${(v / 1_000).toFixed(0)}k${suffix}`;
    return smallFmt ? smallFmt(v) : `${prefix}${v}${suffix}`;
  };
}

// Read the theme palette from CSS custom properties on :root.
// All charts pull the same set; keeping this in one place means a theme change
// doesn't need to update each feature's local colour constants.
export function chartColors() {
  const cs = getComputedStyle(document.documentElement);
  const get = (name, fallback) => (cs.getPropertyValue(name).trim() || fallback);
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

// Destroy any existing Chart on `holder[key]` and replace it with a new one.
// Handles both top-level state (e.g. swapChart(state, 'overviewChart', ...))
// and per-id collections (swapChart(state.optionCompanyCharts, companyId, ...)).
export function swapChart(holder, key, canvas, config) {
  if (holder[key]) { holder[key].destroy(); holder[key] = null; }
  holder[key] = new Chart(canvas, config);
  return holder[key];
}

// Y-axis tick callback for share counts (no $ formatting; private-mode shows '••').
export function sharesTickFmt({ mask = MASK.short } = {}) {
  return (v) => {
    if (state.privateMode) return mask;
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (abs >= 1_000)     return (v / 1_000).toFixed(0) + 'k';
    return Math.round(v);
  };
}
