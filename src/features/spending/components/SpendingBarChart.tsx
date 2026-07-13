import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { fmtMonth } from '@/shared/utils/dates';
import { privCur } from '@/shared/utils/currency';
import { MASK } from '@/shared/utils/privacy';
import { useContainerWidth } from '@/shared/hooks/useContainerWidth';
import type { Currency } from '@/types/sheets';
import type { MonthlyTotal } from '../data/spending.selectors';

/** Compact money ticks that keep one decimal in the low-k range, so 1,050 and
    1,400 don't both collapse to "1k" (the shared moneyTickFmt rounds to integer k). */
function moneyTick(v: number, isPrivate: boolean): string {
  if (isPrivate) return MASK.med;
  const abs = Math.abs(v);
  if (abs >= 10_000) return `${Math.round(v / 1000)}k`;
  if (abs >= 1_000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(v));
}

interface Props {
  data: MonthlyTotal[];
  selectedMonths: Set<string>;   // months inside the active period window → highlighted
  locale: 'en' | 'fr';
  currency: Currency;
  isPrivate: boolean;
  onSelectMonth?: (month: string) => void;
}

interface Row { month: string; total: number }

function TooltipCard({ active, payload, locale, currency, isPrivate }: {
  active?: boolean; payload?: { payload: Row }[]; locale: 'en' | 'fr'; currency: Currency; isPrivate: boolean;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-surface-1 px-3 py-2 text-xs shadow-lg">
      <div className="font-medium text-fg">{fmtMonth(row.month, { locale })}</div>
      <div className="mt-0.5 font-mono tabular-nums text-fg-2">{privCur(row.total, isPrivate, locale, currency, currency)}</div>
    </div>
  );
}

/** Monthly-total bar chart for the overview. Single series (accent); bars inside the
    selected period are solid, the rest dimmed. Click a bar to jump to that month. */
export function SpendingBarChart({ data, selectedMonths, locale, currency, isPrivate, onSelectMonth }: Props) {
  const [containerRef, width] = useContainerWidth();

  const xTick = (m: string) => {
    const [y, mo] = m.split('-');
    const short = new Date(+y, +mo - 1, 1).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', { month: 'short' });
    return mo === '01' ? `${short} '${y.slice(2)}` : short; // year marker each January
  };
  // Keep ~8 labels max so they never collide on narrow screens.
  const interval = width && width < 380 ? 1 : 0;

  return (
    <div ref={containerRef} className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="18%">
          <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={xTick}
            tick={{ fill: 'var(--subtle)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval={interval}
            minTickGap={4}
          />
          <YAxis
            tickFormatter={(v: string | number) => moneyTick(Number(v), isPrivate)}
            tick={{ fill: 'var(--subtle)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickCount={5}
            width={48}
          />
          <Tooltip
            content={<TooltipCard locale={locale} currency={currency} isPrivate={isPrivate} />}
            cursor={{ fill: 'var(--border)', fillOpacity: 0.35 }}
          />
          <Bar
            dataKey="total"
            radius={[4, 4, 0, 0]}
            maxBarSize={44}
            isAnimationActive={false}
            onClick={(d: unknown) => { const m = (d as Row)?.month; if (m && onSelectMonth) onSelectMonth(m); }}
            className={onSelectMonth ? 'cursor-pointer' : undefined}
          >
            {data.map(d => (
              <Cell key={d.month} fill="var(--accent)" fillOpacity={selectedMonths.has(d.month) ? 1 : 0.32} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
