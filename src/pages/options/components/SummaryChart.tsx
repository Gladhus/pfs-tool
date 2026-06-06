import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { chartColors, chartTooltip, moneyTickFmt } from '@/utils/chartOptions';
import { hexToRgba, fmtMoney } from '@/utils/format';
import { buildXAxisTicks } from '@/utils/dates';
import { generateMonthlyDates, getEffectiveFmv, computeIntrinsicValue } from '@/utils/options';
import { toMain, rateFor } from '@/utils/currency';
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
  /** Clamp the chart's start to this date (period filter). */
  fromDate?: string;
  /** Company ids to hide (legend toggle); colors stay keyed to the full active list. */
  hiddenIds?: Set<string>;
  main: Currency;
  fxMap: Map<string, number>;
}

export function SummaryChart({ companies, grants, fmv, now, locale, currency, isPrivate, fromDate, hiddenIds, main, fxMap }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const active = companies.filter(c => c.active !== false);
    const shown = active.filter(c => !hiddenIds?.has(c.id));
    const fmvDates = fmv.map(f => f.date).sort();
    if (!shown.length || !fmvDates.length) return;

    const start = fromDate && fromDate > fmvDates[0] ? fromDate : fmvDates[0];
    const allDates = generateMonthlyDates(start, now);
    if (allDates.length < 2) return;

    const shownValues = shown.map(c => {
      const cGrants = grants.filter(g => g.company_id === c.id);
      return allDates.map(d => {
        const entry = getEffectiveFmv(fmv, c.id, d);
        if (!entry) return null;
        // Only count grants that exist by this date — no equity data before the first grant.
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
    if (dates.length < 2) return;

    const colors = chartColors();
    const datasets = shown.map((company, ci) => {
      const color = COMPANY_COLORS[active.findIndex(a => a.id === company.id) % COMPANY_COLORS.length];
      const cum = dates.map((_, di) => {
        const vals = values.slice(0, ci + 1).map(arr => arr[di]);
        if (vals.every(v => v === null)) return null;
        return vals.reduce<number>((s, v) => s + (v ?? 0), 0);
      });
      return {
        label: company.ticker ? `${company.name} (${company.ticker})` : company.name,
        data: cum,
        borderColor: color,
        backgroundColor: hexToRgba(color, ci === 0 ? 0.18 : 0.14),
        borderWidth: 2,
        fill: ci === 0 ? 'origin' : '-1',
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        spanGaps: false,
      };
    });

    const { tickSet: xTickSet, xFmt } = buildXAxisTicks(dates, canvas.parentElement?.offsetWidth ?? 600, locale);
    const tickFmt = moneyTickFmt({ isPrivate });

    chartRef.current?.destroy();
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: { labels: dates, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: chartTooltip({
            labelFn: (ctx) => `${ctx.dataset.label}: ${isPrivate ? '••••••' : fmtMoney(ctx.parsed.y, locale, currency)}`,
          }),
        },
        scales: {
          y: {
            grid: { color: colors.grid, drawTicks: false },
            border: { display: false },
            ticks: { color: colors.muted, font: { size: 11 }, padding: 10, maxTicksLimit: 5, callback: tickFmt },
          },
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: colors.muted, font: { size: 11 }, maxRotation: 0, autoSkip: false,
              callback: (_, idx) => (xTickSet.has(idx) ? xFmt(new Date(dates[idx] + 'T12:00:00')) : null),
            },
          },
        },
      },
    });
  }, [companies, grants, fmv, now, locale, currency, isPrivate, fromDate, hiddenIds, main, fxMap]);

  useEffect(() => () => { chartRef.current?.destroy(); chartRef.current = null; }, []);

  return (
    <div className="h-[280px] relative">
      <canvas ref={canvasRef} />
    </div>
  );
}
