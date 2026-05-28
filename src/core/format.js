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

export function parseMoney(str) {
  if (str == null) return null;
  let s = String(str).trim();
  if (s === '') return null;
  s = s.replace(/[^\d.,\-]/g, '');
  if (s === '' || s === '-') return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot   = s.lastIndexOf('.');
  if (lastComma !== -1 || lastDot !== -1) {
    const decimalSep = lastComma > lastDot ? ',' : '.';
    const thouSep    = decimalSep === ',' ? '.' : ',';
    s = s.split(thouSep).join('');
    if (decimalSep === ',') s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
