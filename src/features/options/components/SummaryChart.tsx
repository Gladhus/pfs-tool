import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { moneyTickFmt } from '@/utils/chartOptions';
import { buildXAxisTicks } from '@/utils/dates';
import { seriesTooltip } from '@/components/ChartTooltip';
import { buildSummarySeries } from '@/features/options/data/equity.selectors';
import { useContainerWidth } from '@/hooks/useContainerWidth';
import { COMPANY_COLORS } from './charts';
import type { OptionCompany, OptionGrant, OptionFmv, OptionExercise, Currency } from '@/types/sheets';

interface Props {
  companies: OptionCompany[];
  grants: OptionGrant[];
  fmv: OptionFmv[];
  exercises: OptionExercise[];
  now: string;
  locale: string;
  currency: Currency;
  isPrivate: boolean;
  fromDate?: string;
  hiddenIds?: Set<string>;
  main: Currency;
  fxMap: Map<string, number>;
}

export function SummaryChart({
  companies, grants, fmv, now, locale, currency, isPrivate, fromDate, hiddenIds, main, fxMap,
}: Props) {
  const [containerRef, width] = useContainerWidth();

  const { dates, data, shown, active } = useMemo(
    () => buildSummarySeries(companies, grants, fmv, now, fromDate ?? null, hiddenIds, main, fxMap),
    [companies, grants, fmv, now, fromDate, hiddenIds, main, fxMap],
  );

  const { tickSet, xFmt } = useMemo(
    () => buildXAxisTicks(dates, width, locale),
    [dates, width, locale],
  );
  const xTicks = useMemo(() => dates.filter((_, i) => tickSet.has(i)), [dates, tickSet]);
  const tickFmt = useMemo(() => moneyTickFmt({ isPrivate }), [isPrivate]);

  const renderTooltip = seriesTooltip({ locale, currency, isPrivate });

  if (!dates.length) return null;

  return (
    <div ref={containerRef} className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
          <XAxis
            dataKey="date"
            ticks={xTicks}
            tickFormatter={(d: string) => xFmt(new Date(d + 'T12:00:00'))}
            tick={{ fill: 'var(--subtle)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={tickFmt}
            tick={{ fill: 'var(--subtle)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickCount={5}
            width={55}
          />
          <Tooltip
            content={renderTooltip}
            cursor={{ stroke: 'var(--subtle)', strokeWidth: 1, strokeOpacity: 0.4 }}
          />
          {shown.map((company, ci) => {
            const color = COMPANY_COLORS[active.findIndex(a => a.id === company.id) % COMPANY_COLORS.length];
            return (
              <Area
                key={company.id}
                dataKey={company.id}
                name={company.ticker ? `${company.name} (${company.ticker})` : company.name}
                type="monotone"
                stackId="s"
                stroke={color}
                strokeWidth={2}
                fill={color}
                fillOpacity={ci === 0 ? 0.18 : 0.14}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
