import { lang } from './i18n/index.js';

const cfg = window.PFS_CONFIG || {};

export const fmtMoney = (n) => new Intl.NumberFormat(lang() === 'fr' ? 'fr-CA' : 'en-CA', {
  style: 'currency', currency: cfg.CURRENCY || 'CAD', maximumFractionDigits: 2,
}).format(n || 0);

export const fmtDelta = (n) => (n >= 0 ? '+' : '') + fmtMoney(n);

export const fmtPct = (delta, ref) => {
  if (!ref) return '';
  const p = (delta / Math.abs(ref)) * 100;
  return (p >= 0 ? '+' : '') + p.toFixed(1) + '%';
};

// Compact money formatter for chart axes: "1.2M" / "5k" / raw.
// Pass `prefix` / `suffix` to wrap the result (e.g. "$" prefix or " $" suffix).
export function fmtMoneyShort(n, { prefix = '', suffix = '' } = {}) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M${suffix}`;
  if (abs >= 1_000)     return `${prefix}${(n / 1_000).toFixed(0)}k${suffix}`;
  return `${prefix}${n}${suffix}`;
}

export function parseMoney(str) {
  if (str == null) return null;
  let s = String(str).trim();
  if (s === '') return null;
  s = s.replace(/[^\d.,\-]/g, '');
  if (s === '' || s === '-') return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot   = s.lastIndexOf('.');
  if (lastComma !== -1 || lastDot !== -1) {
    // When both separators present, the later one is the decimal (e.g. "1,234.56").
    // When only a comma: thousands if exactly 3 digits follow (e.g. "6,500"), else decimal.
    // Dots alone are always decimal.
    if (lastComma !== -1 && lastDot !== -1) {
      if (lastDot > lastComma) s = s.replace(/,/g, '');
      else s = s.replace(/\./g, '').replace(',', '.');
    } else if (lastComma !== -1) {
      const commaIsThousands = s.length - lastComma - 1 === 3;
      s = commaIsThousands ? s.replace(/,/g, '') : s.replace(',', '.');
    }
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
