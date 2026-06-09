import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  type TooltipProps,
} from 'recharts';
import type { Account, Snapshot } from '@/types/sheets';
import { buildBalanceSweep } from '@/utils/stats';
import { moneyTickFmt } from '@/utils/chartOptions';
import { buildXAxisTicks } from '@/utils/dates';
import { fmtMoney } from '@/utils/format';
import { tr } from '@/i18n';
import { useContainerWidth } from '@/hooks/useContainerWidth';
import type { SeriesState } from './SeriesToggleBar';

export interface OverviewSeries {
  dates: string[];
  investments: (number | null)[];
  realEstateNet: (number | null)[];
  other: (number | null)[];
}

interface Props {
  filteredDates: string[];
  snapshots: Snapshot[];
  series: OverviewSeries;
  seriesVisible: SeriesState;
  hasOtherData: boolean;
  /** '' = stacked overview; account ID = single-account line */
  selectedAccount: string;
  accounts: Account[];
  locale: string;
  currency: string;
  isPrivate: boolean;
}

const TT = { background: '#0f1a0c', border: 'none', borderRadius: 10, padding: '10px 12px' };

export function HistoryChart({
  filteredDates, snapshots, series, seriesVisible, hasOtherData, selectedAccount, accounts, locale, currency, isPrivate,
}: Props) {
  const { t } = useTranslation();
  const [containerRef, width] = useContainerWidth();
  const isOverview = selectedAccount === '';

  const { data, chartDates } = useMemo(() => {
    if (isOverview) {
      const dates = series.dates;
      return {
        chartDates: dates,
        data: dates.map((date, i) => ({
          date,
          investments: series.investments[i],
          realEstate: series.realEstateNet[i],
          other: series.other[i],
        })),
      };
    }
    const sweep = buildBalanceSweep(snapshots, filteredDates);
    const pts: { date: string; value: number }[] = [];
    for (let i = 0; i < filteredDates.length; i++) {
      const bal = sweep[i]?.[selectedAccount];
      if (bal !== undefined) pts.push({ date: filteredDates[i], value: bal });
    }
    return { data: pts, chartDates: pts.map(p => p.date) };
  }, [isOverview, series, filteredDates, snapshots, selectedAccount]);

  const { tickSet, xFmt } = useMemo(
    () => buildXAxisTicks(chartDates, width, locale),
    [chartDates, width, locale],
  );
  const xTicks = useMemo(() => chartDates.filter((_, i) => tickSet.has(i)), [chartDates, tickSet]);
  const tickFmt = useMemo(() => moneyTickFmt({ isPrivate }), [isPrivate]);

  const acct = !isOverview ? accounts.find(a => a.id === selectedAccount) : undefined;
  const acctColor = acct?.kind === 'debt' ? 'var(--cat-debts)' : 'var(--accent)';

  const renderTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const items = payload.filter(p => p.value != null && p.value !== 0);
    if (!items.length) return null;
    return (
      <div style={TT}>
        {items.map(p => (
          <p key={p.dataKey as string} style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 500, margin: '2px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
            {p.name}: <span style={{ fontFamily: 'DM Mono, ui-monospace, monospace', fontWeight: 600 }}>{isPrivate ? '••••••' : fmtMoney(p.value!, locale, currency)}</span>
          </p>
        ))}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            {isOverview ? (
              <>
                <linearGradient id="hc-invest-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--cat-investments)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--cat-investments)" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="hc-re-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--cat-real-estate)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--cat-real-estate)" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="hc-other-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--cat-cash)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--cat-cash)" stopOpacity={0.05} />
                </linearGradient>
              </>
            ) : (
              <linearGradient id="hc-acct-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={acctColor} stopOpacity={0.18} />
                <stop offset="100%" stopColor={acctColor} stopOpacity={0} />
              </linearGradient>
            )}
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
            tickCount={6}
            width={55}
          />
          <Tooltip
            content={renderTooltip}
            cursor={{ stroke: 'var(--subtle)', strokeWidth: 1, strokeOpacity: 0.4 }}
          />
          {isOverview ? (
            <>
              {seriesVisible.investments && (
                <Area dataKey="investments" name={t('show_investments')} type="monotone" stackId="s"
                  stroke="var(--cat-investments)" strokeWidth={2} fill="url(#hc-invest-grad)"
                  dot={false} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
              )}
              {seriesVisible.realEstate && (
                <Area dataKey="realEstate" name={t('show_real_estate')} type="monotone" stackId="s"
                  stroke="var(--cat-real-estate)" strokeWidth={2} fill="url(#hc-re-grad)"
                  dot={false} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
              )}
              {hasOtherData && seriesVisible.other && (
                <Area dataKey="other" name={t('show_other')} type="monotone" stackId="s"
                  stroke="var(--cat-cash)" strokeWidth={2} fill="url(#hc-other-grad)"
                  dot={false} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
              )}
            </>
          ) : (
            <Area dataKey="value" name={acct ? tr(acct) : selectedAccount} type="monotone"
              stroke={acctColor} strokeWidth={2} fill="url(#hc-acct-grad)"
              dot={false} activeDot={{ r: 5, fill: acctColor, stroke: '#fff', strokeWidth: 2 }}
              isAnimationActive={false} />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
