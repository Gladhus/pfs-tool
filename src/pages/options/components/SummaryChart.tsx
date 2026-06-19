import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { moneyTickFmt } from '@/utils/chartOptions';
import { buildXAxisTicks } from '@/utils/dates';
import { seriesTooltip } from '@/components/ChartTooltip';
import { generateMonthlyDates, getEffectiveFmv, computeIntrinsicValue } from '@/utils/options';
import { toMain, rateFor } from '@/utils/currency';
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

  const { dates, data, shown, active } = useMemo(() => {
    const active = companies.filter(c => c.active !== false);
    const shown = active.filter(c => !hiddenIds?.has(c.id));
    const fmvDates = fmv.map(f => f.date).sort();
    if (!shown.length || !fmvDates.length) return { dates: [] as string[], data: [], shown, active };

    const start = fromDate && fromDate > fmvDates[0] ? fromDate : fmvDates[0];
    const allDates = generateMonthlyDates(start, now);
    if (allDates.length < 2) return { dates: [] as string[], data: [], shown, active };

    const shownValues = shown.map(c => {
      const cGrants = grants.filter(g => g.company_id === c.id);
      return allDates.map(d => {
        const entry = getEffectiveFmv(fmv, c.id, d);
        if (!entry) return null;
        const granted = cGrants.filter(g => g.grant_date.slice(0, 7) <= d.slice(0, 7));
        if (!granted.length) return null;
        const native = granted.reduce((s, g) => s + computeIntrinsicValue(g, [], entry.fmv, d), 0);
        return toMain(native, c.currency ?? main, main, rateFor(fxMap, d));
      });
    });

    let trim = 0;
    while (trim < allDates.length && shownValues.every(v => v[trim] === null)) trim++;
    const dates = allDates.slice(trim);
    const values = shownValues.map(v => v.slice(trim));
    if (dates.length < 2) return { dates: [] as string[], data: [], shown, active };

    const data = dates.map((date, di) => {
      const pt: Record<string, number | null | string> = { date };
      shown.forEach((company, ci) => { pt[company.id] = values[ci][di]; });
      return pt;
    });

    return { dates, data, shown, active };
  }, [companies, grants, fmv, now, fromDate, hiddenIds, main, fxMap]);

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
