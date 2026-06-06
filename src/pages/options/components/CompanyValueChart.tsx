import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { chartColors, moneyTickFmt, TOOLTIP_STYLE } from '@/utils/chartOptions';
import { hexToRgba } from '@/utils/format';
import { privMoney } from '@/utils/privacy';
import { fmtMonth, buildXAxisTicks } from '@/utils/dates';
import { generateMonthlyDates, getEffectiveFmv, computeIntrinsicValue, computeUnvestedValue } from '@/utils/options';
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

export function CompanyValueChart({ company, grants, fmv, exercises, color, now, locale, currency, isPrivate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const history = fmv.filter(f => f.company_id === company.id).sort((a, b) => a.date.localeCompare(b.date));
    if (!history.length) return;
    const allDates = generateMonthlyDates(history[0].date, now);
    if (allDates.length < 2) return;

    // Null before the first grant exists so the chart starts at actual data, not first FMV.
    const grantedAt = (d: string) => grants.filter(g => g.grant_date.slice(0, 7) <= d.slice(0, 7));
    const vestedAll = allDates.map(d => {
      const e = getEffectiveFmv(fmv, company.id, d);
      const granted = grantedAt(d);
      if (!e || !granted.length) return null;
      return granted.reduce((s, g) => s + computeIntrinsicValue(g, exercises, e.fmv, d), 0);
    });
    const totalAll = allDates.map((d, i) => {
      const e = getEffectiveFmv(fmv, company.id, d);
      const granted = grantedAt(d);
      if (!e || !granted.length) return null;
      const unv = granted.reduce((s, g) => s + computeUnvestedValue(g, e.fmv, d), 0);
      return (vestedAll[i] ?? 0) + unv;
    });

    let trim = 0;
    while (trim < allDates.length && vestedAll[trim] === null && totalAll[trim] === null) trim++;
    const dates = allDates.slice(trim);
    const vested = vestedAll.slice(trim);
    const total = totalAll.slice(trim);
    if (dates.length < 2) return;

    const colors = chartColors();
    const { tickSet: xTickSet, xFmt } = buildXAxisTicks(dates, canvas.parentElement?.offsetWidth ?? 600, locale);
    const tickFmt = moneyTickFmt({ prefix: '$', isPrivate });

    chartRef.current?.destroy();
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [
          {
            label: 'vested', data: vested,
            borderColor: color, backgroundColor: hexToRgba(color, 0.18),
            borderWidth: 2, fill: 'origin', tension: 0.2, pointRadius: 0, pointHoverRadius: 4, spanGaps: true,
          },
          {
            label: 'total', data: total,
            borderColor: colors.muted, backgroundColor: hexToRgba(colors.muted, 0.10),
            borderWidth: 1.5, borderDash: [4, 3], fill: '-1', tension: 0.2, pointRadius: 0, pointHoverRadius: 4, spanGaps: true,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...TOOLTIP_STYLE,
            callbacks: {
              title: items => fmtMonth(dates[items[0].dataIndex].slice(0, 7), { locale, style: 'short' }),
              label: ctx => {
                const di = ctx.dataIndex;
                if (ctx.datasetIndex === 0) return `  vested: ${privMoney(vested[di] ?? 0, isPrivate, locale, currency)}`;
                const unv = (total[di] ?? 0) - (vested[di] ?? 0);
                return `  unvested: ${privMoney(unv, isPrivate, locale, currency)}`;
              },
            },
          },
        },
        scales: {
          y: {
            grid: { color: colors.grid, drawTicks: false },
            border: { display: false },
            ticks: { color: colors.muted, font: { size: 11 }, padding: 8, maxTicksLimit: 4, callback: tickFmt },
          },
          x: {
            grid: { display: false }, border: { display: false },
            ticks: {
              color: colors.muted, font: { size: 11 }, maxRotation: 0, autoSkip: false,
              callback: (_, idx) => (xTickSet.has(idx) ? xFmt(new Date(dates[idx] + 'T12:00:00')) : null),
            },
          },
        },
      },
    });
  }, [company, grants, fmv, exercises, color, now, locale, currency, isPrivate]);

  useEffect(() => () => { chartRef.current?.destroy(); chartRef.current = null; }, []);

  return (
    <div className="h-[200px] relative">
      <canvas ref={canvasRef} />
    </div>
  );
}
