import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { chartColors, sharesTickFmt, TOOLTIP_STYLE } from '@/utils/chartOptions';
import { hexToRgba } from '@/utils/format';
import { privShares } from '@/utils/privacy';
import { fmtMonth, buildXAxisTicks } from '@/utils/dates';
import { computeVestedShares, grantFullyVestedDate, generateMonthlyDates } from '@/utils/options';
import { GRANT_COLORS } from './charts';
import type { OptionGrant } from '@/types/sheets';

interface Props {
  grants: OptionGrant[];
  now: string;
  locale: string;
  isPrivate: boolean;
}

export function CompanyVestingChart({ grants, now, locale, isPrivate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grants.length) return;

    const starts = grants.map(g => g.vesting_start || g.grant_date).filter(Boolean).sort();
    const ends = grants.map(g => grantFullyVestedDate(g)).filter((d): d is string => !!d).sort();
    if (!starts.length || !ends.length) return;
    const rangeStart = starts[0];
    const rangeEnd = ends[ends.length - 1];
    if (rangeEnd < rangeStart) return;

    const startDt = new Date(rangeStart + 'T12:00:00');
    startDt.setMonth(startDt.getMonth() - 1);
    const endDt = new Date(rangeEnd + 'T12:00:00');
    endDt.setMonth(endDt.getMonth() + 1);
    const dates = generateMonthlyDates(startDt.toISOString().slice(0, 10), endDt.toISOString().slice(0, 10));
    if (dates.length < 2) return;

    let todayIdx = -1;
    for (let i = 0; i < dates.length; i++) if (dates[i] <= now) todayIdx = i;

    const colors = chartColors();
    const grantValues = grants.map(g => dates.map(d => computeVestedShares(g, d)));

    const datasets = grants.map((grant, gi) => {
      const color = GRANT_COLORS[gi % GRANT_COLORS.length];
      const cum = dates.map((_, di) => grantValues.slice(0, gi + 1).reduce((s, arr) => s + arr[di], 0));
      return {
        label: grant.label || grant.grant_type || `Grant ${gi + 1}`,
        data: cum,
        borderColor: color,
        backgroundColor: hexToRgba(color, 0.15),
        borderWidth: 2,
        fill: gi === 0 ? 'origin' : '-1',
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 4,
        spanGaps: true,
        segment: {
          borderDash: (ctx: { p0DataIndex: number }) =>
            (todayIdx >= 0 && ctx.p0DataIndex > todayIdx ? [5, 3] : undefined),
          backgroundColor: (ctx: { p0DataIndex: number }) =>
            hexToRgba(color, todayIdx < 0 || ctx.p0DataIndex <= todayIdx ? 0.15 : 0.06),
        },
      };
    });

    const todayLinePlugin = {
      id: 'todayLine',
      afterDatasetsDraw(chart: Chart) {
        if (todayIdx < 0) return;
        const { ctx, chartArea, scales } = chart;
        const x = scales.x.getPixelForValue(todayIdx);
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = colors.muted;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
        ctx.restore();
      },
    };

    const { tickSet: xTickSet, xFmt } = buildXAxisTicks(dates, canvas.parentElement?.offsetWidth ?? 600, locale);
    const tickFmt = sharesTickFmt({ isPrivate });

    chartRef.current?.destroy();
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: { labels: dates, datasets },
      plugins: [todayLinePlugin],
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...TOOLTIP_STYLE,
            callbacks: {
              title: items => fmtMonth(dates[items[0].dataIndex].slice(0, 7), { locale, style: 'short' }),
              label: ctx => `  ${ctx.dataset.label}: ${privShares(grantValues[ctx.datasetIndex][ctx.dataIndex], isPrivate)}`,
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
  }, [grants, now, locale, isPrivate]);

  useEffect(() => () => { chartRef.current?.destroy(); chartRef.current = null; }, []);

  return (
    <div className="h-[200px] relative">
      <canvas ref={canvasRef} />
    </div>
  );
}
