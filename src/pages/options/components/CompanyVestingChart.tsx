import { useMemo, Fragment } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
  type TooltipProps,
} from 'recharts';
import { sharesTickFmt } from '@/utils/chartOptions';
import { privShares } from '@/utils/privacy';
import { fmtMonth, buildXAxisTicks } from '@/utils/dates';
import { computeVestedShares, grantFullyVestedDate, generateMonthlyDates } from '@/utils/options';
import { useContainerWidth } from '@/hooks/useContainerWidth';
import { GRANT_COLORS } from './charts';
import type { OptionGrant } from '@/types/sheets';

interface Props {
  grants: OptionGrant[];
  now: string;
  locale: string;
  isPrivate: boolean;
}

const TT = { background: '#0f172a', border: 'none', borderRadius: 10, padding: '10px 12px' };

export function CompanyVestingChart({ grants, now, locale, isPrivate }: Props) {
  const [containerRef, width] = useContainerWidth();

  const { dates, data, todayDate, grantValues } = useMemo(() => {
    if (!grants.length) return { dates: [] as string[], data: [], todayDate: null, grantValues: [] as number[][] };

    const starts = grants.map(g => g.vesting_start || g.grant_date).filter(Boolean).sort();
    const ends = grants.map(g => grantFullyVestedDate(g)).filter((d): d is string => !!d).sort();
    if (!starts.length || !ends.length) return { dates: [] as string[], data: [], todayDate: null, grantValues: [] as number[][] };
    if (ends[ends.length - 1] < starts[0]) return { dates: [] as string[], data: [], todayDate: null, grantValues: [] as number[][] };

    const startDt = new Date(starts[0] + 'T12:00:00');
    startDt.setMonth(startDt.getMonth() - 1);
    const endDt = new Date(ends[ends.length - 1] + 'T12:00:00');
    endDt.setMonth(endDt.getMonth() + 1);
    const dates = generateMonthlyDates(startDt.toISOString().slice(0, 10), endDt.toISOString().slice(0, 10));
    if (dates.length < 2) return { dates: [] as string[], data: [], todayDate: null, grantValues: [] as number[][] };

    let todayIdx = -1;
    for (let i = 0; i < dates.length; i++) if (dates[i] <= now) todayIdx = i;

    const grantValues = grants.map(g => dates.map(d => computeVestedShares(g, d)));

    // g{i}  — raw value for past solid areas (null after todayIdx)
    // gf{i} — raw value for future dashed areas (null before todayIdx)
    // Both include todayIdx so the two stacks meet seamlessly.
    const data = dates.map((date, di) => {
      const pt: Record<string, number | string | null> = { date };
      const isPast = todayIdx < 0 ? false : di <= todayIdx;
      const isFuture = todayIdx < 0 ? true : di >= todayIdx;
      grants.forEach((_, gi) => {
        pt[`g${gi}`] = isPast ? grantValues[gi][di] : null;
        pt[`gf${gi}`] = isFuture ? grantValues[gi][di] : null;
      });
      return pt;
    });

    return { dates, data, todayDate: todayIdx >= 0 ? dates[todayIdx] : null, grantValues };
  }, [grants, now]);

  const { tickSet, xFmt } = useMemo(
    () => buildXAxisTicks(dates, width, locale),
    [dates, width, locale],
  );
  const xTicks = useMemo(() => dates.filter((_, i) => tickSet.has(i)), [dates, tickSet]);
  const tickFmt = useMemo(() => sharesTickFmt({ isPrivate }), [isPrivate]);

  const renderTooltip = ({ active, label }: TooltipProps<number, string>) => {
    if (!active || !label) return null;
    const dateStr = String(label);
    const di = dates.indexOf(dateStr);
    if (di < 0) return null;
    return (
      <div style={TT}>
        <p style={{ color: '#94a3b8', fontSize: 11, margin: '0 0 4px' }}>
          {fmtMonth(dateStr.slice(0, 7), { locale, style: 'short' })}
        </p>
        {grants.map((grant, gi) => (
          <p key={gi} style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 600, margin: '2px 0' }}>
            {grant.label || grant.grant_type || `Grant ${gi + 1}`}: {privShares(grantValues[gi][di], isPrivate)}
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
