import { useMemo, Fragment } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
  type TooltipContentProps,
} from 'recharts';
import { sharesTickFmt } from '@/utils/chartOptions';
import { TT } from '@/components/ChartTooltip';
import { privShares } from '@/utils/privacy';
import { fmtMonth, buildXAxisTicks } from '@/utils/dates';
import { buildVestingSeries } from '@/features/options/data/selectors';
import { useContainerWidth } from '@/hooks/useContainerWidth';
import { GRANT_COLORS } from './charts';
import type { OptionGrant } from '@/types/sheets';

interface Props {
  grants: OptionGrant[];
  now: string;
  locale: string;
  isPrivate: boolean;
}

export function CompanyVestingChart({ grants, now, locale, isPrivate }: Props) {
  const [containerRef, width] = useContainerWidth();

  const { dates, data, todayDate, grantValues } = useMemo(() => buildVestingSeries(grants, now), [grants, now]);

  const { tickSet, xFmt } = useMemo(
    () => buildXAxisTicks(dates, width, locale),
    [dates, width, locale],
  );
  const xTicks = useMemo(() => dates.filter((_, i) => tickSet.has(i)), [dates, tickSet]);
  const tickFmt = useMemo(() => sharesTickFmt({ isPrivate }), [isPrivate]);

  const renderTooltip = ({ active, label }: TooltipContentProps) => {
    if (!active || !label) return null;
    const dateStr = String(label);
    const di = dates.indexOf(dateStr);
    if (di < 0) return null;
    return (
      <div style={TT}>
        <p style={{ color: '#8aaa7a', fontSize: 11, margin: '0 0 4px' }}>
          {fmtMonth(dateStr.slice(0, 7), { locale, style: 'short' })}
        </p>
        {grants.map((grant, gi) => (
          <p key={gi} style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 500, margin: '2px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: GRANT_COLORS[gi % GRANT_COLORS.length], flexShrink: 0 }} />
            {grant.label || grant.grant_type || `Grant ${gi + 1}`}: <span style={{ fontFamily: 'DM Mono, ui-monospace, monospace', fontWeight: 600 }}>{privShares(grantValues[gi][di], isPrivate)}</span>
          </p>
        ))}
      </div>
    );
  };

  if (!dates.length) return null;

  const hasFuture = todayDate !== null && todayDate < dates[dates.length - 1];

  return (
    <div ref={containerRef} className="h-[200px]">
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
            tickCount={4}
            width={45}
          />
          <Tooltip
            content={renderTooltip}
            cursor={{ stroke: 'var(--subtle)', strokeWidth: 1, strokeOpacity: 0.4 }}
          />
          {todayDate && (
            <ReferenceLine x={todayDate} stroke="var(--subtle)" strokeDasharray="4 3" strokeWidth={1} />
          )}
          {grants.map((grant, gi) => {
            const color = GRANT_COLORS[gi % GRANT_COLORS.length];
            const name = grant.label || grant.grant_type || `Grant ${gi + 1}`;
            return (
              <Fragment key={gi}>
                <Area
                  dataKey={`g${gi}`}
                  name={name}
                  type="monotone"
                  stackId="past"
                  stroke={color}
                  strokeWidth={2}
                  fill={color}
                  fillOpacity={0.15}
                  dot={false}
                  activeDot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                  legendType="none"
                />
                {hasFuture && (
                  <Area
                    dataKey={`gf${gi}`}
                    name={name}
                    type="monotone"
                    stackId="future"
                    stroke={color}
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    fill={color}
                    fillOpacity={0.06}
                    dot={false}
                    activeDot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                    legendType="none"
                  />
                )}
              </Fragment>
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
