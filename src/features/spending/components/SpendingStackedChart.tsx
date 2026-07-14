import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { fmtMonth } from '@/shared/utils/dates';
import { privCur } from '@/shared/utils/currency';
import { useContainerWidth } from '@/shared/hooks/useContainerWidth';
import type { Currency } from '@/types/sheets';
import { moneyTick, xMonthTick } from './chartFormat';

type Row = { month: string; [k: string]: number | string };

interface Props {
  data: Row[];
  categoryKeys: string[];              // stack order (bottom → top)
  colorFor: (key: string) => string;
  nameFor: (key: string) => string;
  selectedMonths: Set<string>;
  locale: 'en' | 'fr';
  currency: Currency;
  isPrivate: boolean;
  onSelectMonth?: (month: string) => void;
}

function TooltipCard({ active, payload, label, categoryKeys, colorFor, nameFor, locale, currency, isPrivate }: {
  active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string;
  categoryKeys: string[]; colorFor: (k: string) => string; nameFor: (k: string) => string;
  locale: 'en' | 'fr'; currency: Currency; isPrivate: boolean;
}) {
  if (!active || !payload?.length || !label) return null;
  const byKey = new Map(payload.map(p => [p.dataKey, p.value]));
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  const shown = categoryKeys.filter(k => (byKey.get(k) ?? 0) > 0);
  return (
    <div className="min-w-40 rounded-lg border border-border bg-surface-1 px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium text-fg">{fmtMonth(label, { locale })}</div>
      {shown.map(k => (
        <div key={k} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-fg-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorFor(k) }} />
            {nameFor(k)}
          </span>
          <span className="font-mono tabular-nums text-fg">{privCur(byKey.get(k) ?? 0, isPrivate, locale, currency, currency)}</span>
        </div>
      ))}
      <div className="mt-1 flex items-center justify-between gap-3 border-t border-border/60 pt-1 font-medium">
        <span className="text-fg-2">Σ</span>
        <span className="font-mono tabular-nums text-fg">{privCur(total, isPrivate, locale, currency, currency)}</span>
      </div>
    </div>
  );
}

/** Monthly spending stacked by category. Category colours carry identity (with a
    legend + per-segment tooltip as secondary encoding, since the user-editable
    category palette isn't guaranteed colourblind-separable); a surface-coloured
    stroke gaps the segments. Bars outside the selected period are dimmed. */
export function SpendingStackedChart({ data, categoryKeys, colorFor, nameFor, selectedMonths, locale, currency, isPrivate, onSelectMonth }: Props) {
  const [containerRef, width] = useContainerWidth();
  const interval = width && width < 380 ? 1 : 0;

  return (
    <div>
      <div ref={containerRef} className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="18%">
            <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={(m: string) => xMonthTick(m, locale)}
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
              content={<TooltipCard categoryKeys={categoryKeys} colorFor={colorFor} nameFor={nameFor} locale={locale} currency={currency} isPrivate={isPrivate} />}
              cursor={{ fill: 'var(--border)', fillOpacity: 0.35 }}
            />
            {categoryKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="s"
                fill={colorFor(key)}
                stroke="var(--surface-1)"
                strokeWidth={1}
                maxBarSize={44}
                radius={i === categoryKeys.length - 1 ? [3, 3, 0, 0] : undefined}
                isAnimationActive={false}
                onClick={(d: unknown) => { const m = (d as Row)?.month; if (m && onSelectMonth) onSelectMonth(m); }}
                className={onSelectMonth ? 'cursor-pointer' : undefined}
              >
                {data.map(d => (
                  <Cell key={d.month} fillOpacity={selectedMonths.has(d.month) ? 1 : 0.32} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend — identity is never colour-alone */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {categoryKeys.map(key => (
          <span key={key} className="inline-flex items-center gap-1.5 text-xs text-fg-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorFor(key) }} />
            {nameFor(key)}
          </span>
        ))}
      </div>
    </div>
  );
}
