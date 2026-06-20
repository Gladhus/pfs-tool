import type { TooltipContentProps } from 'recharts';
import { fmtMoney } from '@/shared/utils/format';

/** Shared dark tooltip surface used by every chart. */
export const TT = { background: '#0f1a0c', border: 'none', borderRadius: 10, padding: '10px 12px' } as const;

interface SeriesTooltipOptions {
  locale: string;
  currency: string;
  isPrivate: boolean;
  /** Hide entries whose value is exactly 0 (used by the history chart). */
  hideZero?: boolean;
}

/**
 * Builds the common "one row per visible series" tooltip renderer shared by the
 * overview, history, and option-summary charts. Returns a function suitable for
 * Recharts' `<Tooltip content={…} />` prop.
 */
export function seriesTooltip({ locale, currency, isPrivate, hideZero = false }: SeriesTooltipOptions) {
  return ({ active, payload }: TooltipContentProps) => {
    if (!active || !payload?.length) return null;
    const items = payload.filter(p => p.value != null && (!hideZero || p.value !== 0));
    if (!items.length) return null;
    return (
      <div style={TT}>
        {items.map(p => (
          <p key={String(p.dataKey)} style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 500, margin: '2px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
            {p.name}: <span style={{ fontFamily: 'DM Mono, ui-monospace, monospace', fontWeight: 600 }}>{isPrivate ? '••••••' : fmtMoney(Number(p.value), locale, currency)}</span>
          </p>
        ))}
      </div>
    );
  };
}
