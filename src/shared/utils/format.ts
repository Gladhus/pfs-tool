export function fmtMoney(value: number, locale: string, currency: string): string {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function fmtDelta(value: number, locale: string, currency: string): string {
  return (value >= 0 ? '+' : '') + fmtMoney(value, locale, currency);
}

export function fmtPct(delta: number, ref: number): string {
  if (!ref) return '';
  const p = (delta / Math.abs(ref)) * 100;
  return (p >= 0 ? '+' : '') + p.toFixed(1) + '%';
}

export function fmtMoneyShort(n: number, { prefix = '', suffix = '' } = {}): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M${suffix}`;
  if (abs >= 1_000)     return `${prefix}${(n / 1_000).toFixed(0)}k${suffix}`;
  return `${prefix}${n}${suffix}`;
}

export function hexToRgba(hex: string, a: number): string {
  const m = String(hex).trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return hex;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function parseMoney(str: string | number | null | undefined): number | null {
  if (str == null) return null;
  let s = String(str).trim();
  if (s === '') return null;
  const isNegative = /[()]/.test(s) || /^-/.test(s);
  s = s.replace(/[^\d.,]/g, '');
  if (s === '') return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot   = s.lastIndexOf('.');
  if (lastComma !== -1 || lastDot !== -1) {
    if (lastComma !== -1 && lastDot !== -1) {
      if (lastDot > lastComma) s = s.replace(/,/g, '');
      else s = s.replace(/\./g, '').replace(',', '.');
    } else if (lastComma !== -1) {
      const commaIsThousands = s.length - lastComma - 1 === 3;
      s = commaIsThousands ? s.replace(/,/g, '') : s.replace(',', '.');
    }
  }
  const n = Number(s);
  return Number.isFinite(n) ? (isNegative ? -n : n) : null;
}
