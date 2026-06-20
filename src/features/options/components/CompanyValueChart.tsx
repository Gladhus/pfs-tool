import { useMemo } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  type TooltipContentProps,
} from 'recharts';
import { moneyTickFmt } from '@/utils/chartOptions';
import { TT } from '@/components/ChartTooltip';
import { privMoney } from '@/utils/privacy';
import { fmtMonth, buildXAxisTicks } from '@/utils/dates';
import { buildCompanyValueSeries } from '@/features/options/data/equity.selectors';
import { useContainerWidth } from '@/hooks/useContainerWidth';
import type { OptionCompany, OptionGrant, OptionFmv, OptionExercise } from '@/types/sheets';

interface Props {
  company: OptionCompany;
  grants: OptionGrant[];
  fmv: OptionFmv[];
  exercises: OptionExercise[];
  color: string;
  now: string;
  locale: string;
  currency: string;
  isPrivate: boolean;
}

export function CompanyValueChart({
  company, grants, fmv, exercises, color, now, locale, currency, isPrivate,
}: Props) {
  const [containerRef, width] = useContainerWidth();

  const { dates, data } = useMemo(
    () => buildCompanyValueSeries(company, grants, fmv, exercises, now),
    [company, grants, fmv, exercises, now],
  );

  const { tickSet, xFmt } = useMemo(
    () => buildXAxisTicks(dates, width, locale),
    [dates, width, locale],
  );
  const xTicks = useMemo(() => dates.filter((_, i) => tickSet.has(i)), [dates, tickSet]);
  const tickFmt = useMemo(() => moneyTickFmt({ prefix: '$', isPrivate }), [isPrivate]);

  const renderTooltip = ({ active, payload, label }: TooltipContentProps) => {
    if (!active || !payload?.length || !label) return null;
    const dateStr = String(label);
    const vestedPt = payload.find(p => p.dataKey === 'vested');
    const totalPt = payload.find(p => p.dataKey === 'total');
    const vestedVal = Number(vestedPt?.value ?? 0);
    const unvestedVal = Number(totalPt?.value ?? 0) - vestedVal;
    return (
      <div style={TT}>
        <p style={{ color: '#8aaa7a', fontSize: 11, margin: '0 0 4px' }}>
          {fmtMonth(dateStr.slice(0, 7), { locale, style: 'short' })}
        </p>
        {vestedPt?.value != null && (
          <p style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 500, margin: '2px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: vestedPt.color, flexShrink: 0 }} />
            vested: <span style={{ fontFamily: 'DM Mono, ui-monospace, monospace', fontWeight: 600 }}>{privMoney(vestedVal, isPrivate, locale, currency)}</span>
          </p>
        )}
        {totalPt?.value != null && unvestedVal > 0 && (
          <p style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 500, margin: '2px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#8aaa7a', flexShrink: 0 }} />
            unvested: <span style={{ fontFamily: 'DM Mono, ui-monospace, monospace', fontWeight: 600 }}>{privMoney(unvestedVal, isPrivate, locale, currency)}</span>
          </p>
        )}
      </div>
    );
  };

  if (!dates.length) return null;

  return (
    <div ref={containerRef} className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="cv-vested-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
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
            tickCount={4}
            width={55}
          />
          <Tooltip
            content={renderTooltip}
            cursor={{ stroke: 'var(--subtle)', strokeWidth: 1, strokeOpacity: 0.4 }}
          />
          <Area
            dataKey="vested"
            name="vested"
            type="monotone"
            stroke={color}
            strokeWidth={2}
            fill="url(#cv-vested-grad)"
            dot={false}
            activeDot={{ r: 4, fill: color, stroke: '#fff', strokeWidth: 2 }}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            dataKey="total"
            name="total"
            type="monotone"
            stroke="var(--subtle)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
