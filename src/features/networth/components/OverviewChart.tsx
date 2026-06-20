import { useMemo } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { moneyTickFmt } from '@/utils/chartOptions';
import { buildXAxisTicks } from '@/utils/dates';
import { seriesTooltip } from '@/components/ChartTooltip';
import { categoryKey } from '@/utils/icons';
import { useContainerWidth } from '@/hooks/useContainerWidth';
import type { BucketData } from '../useOverviewStats';

interface Props {
  dates: string[];
  netData: (number | null)[];
  buckets: BucketData[];
  seriesVisible: Record<string, boolean>;
  locale: string;
  currency: string;
  isPrivate: boolean;
  netLabel: string;
  view: string;
}

export function OverviewChart({
  dates, netData, buckets, seriesVisible, locale, currency, isPrivate, netLabel,
}: Props) {
  const [containerRef, width] = useContainerWidth();

  const visibleBuckets = useMemo(
    () => buckets.filter(b => seriesVisible[b.key] !== false && b.data.some(v => v !== null && v !== 0)),
    [buckets, seriesVisible],
  );

  const data = useMemo(() =>
    dates.map((date, i) => {
      const pt: Record<string, number | null | string> = { date };
      if (seriesVisible['net'] !== false) pt.net = netData[i] ?? null;
      for (const b of visibleBuckets) pt[b.key] = b.data[i] ?? null;
      return pt;
    }),
    [dates, netData, visibleBuckets, seriesVisible],
  );

  const { tickSet, xFmt } = useMemo(
    () => buildXAxisTicks(dates, width, locale),
    [dates, width, locale],
  );
  const xTicks = useMemo(() => dates.filter((_, i) => tickSet.has(i)), [dates, tickSet]);
  const tickFmt = useMemo(() => moneyTickFmt({ isPrivate }), [isPrivate]);

  const catColor = (b: BucketData) =>
    b.color ?? (!b.catId || b.catId === 'equity' ? 'var(--cat-equity)' : `var(--cat-${categoryKey(b.catId)})`);

  const renderTooltip = seriesTooltip({ locale, currency, isPrivate });

  return (
    <div ref={containerRef} className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="ov-net-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
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
            tickCount={5}
            width={55}
          />
          <Tooltip
            content={renderTooltip}
            cursor={{ stroke: 'var(--subtle)', strokeWidth: 1, strokeOpacity: 0.4 }}
          />
          {seriesVisible['net'] !== false && (
            <Area
              dataKey="net"
              name={netLabel}
              type="monotone"
              stroke="var(--accent)"
              strokeWidth={2.5}
              fill="url(#ov-net-grad)"
              dot={false}
              activeDot={{ r: 5, fill: 'var(--accent)', stroke: '#fff', strokeWidth: 2 }}
              connectNulls
              isAnimationActive={false}
            />
          )}
          {visibleBuckets.map(b => {
            const color = catColor(b);
            return (
              <Line
                key={b.key}
                dataKey={b.key}
                name={b.label}
                type="monotone"
                stroke={color}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, fill: color, stroke: '#fff', strokeWidth: 2 }}
                connectNulls
                isAnimationActive={false}
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
