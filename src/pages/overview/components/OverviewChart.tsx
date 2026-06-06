import { useRef, useEffect } from 'react';
import Chart from 'chart.js/auto';
import { chartColors, chartTooltip, moneyTickFmt } from '@/utils/chartOptions';
import { buildXAxisTicks } from '@/utils/dates';
import { hexToRgba, fmtMoney } from '@/utils/format';
import { categoryKey } from '@/utils/icons';
import type { BucketData } from '../hooks/useOverviewStats';

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
  dates, netData, buckets, seriesVisible, locale, currency, isPrivate, netLabel, view,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const prevViewRef = useRef(view);

  const isVis = (key: string) => seriesVisible[key] !== false;

  // Data + view effect — updates chart in place; no cleanup returned (chart lives until unmount effect)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dates.length) return;

    const viewChanged = prevViewRef.current !== view;
    prevViewRef.current = view;

    const colors = chartColors();
    const cs = getComputedStyle(document.documentElement);
    const catColor = (id?: string): string => {
      if (!id || id === 'equity') {
        return cs.getPropertyValue('--cat-equity').trim() || '#06b6d4';
      }
      return cs.getPropertyValue('--cat-' + categoryKey(id)).trim() || colors.accent;
    };

    const ctx = canvas.getContext('2d')!;
    const h = canvas.parentElement?.offsetHeight || 280;
    const netGrad = ctx.createLinearGradient(0, 0, 0, h);
    netGrad.addColorStop(0, hexToRgba(colors.accent, 0.22));
    netGrad.addColorStop(1, hexToRgba(colors.accent, 0));

    const datasets: Chart['data']['datasets'] = [];

    if (isVis('net')) {
      datasets.push({
        label: netLabel,
        data: netData,
        borderColor: colors.accent,
        backgroundColor: netGrad,
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: colors.accent,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        spanGaps: true,
        order: 0,
      });
    }

    for (const b of buckets) {
      if (!b.data.some(v => v !== null && v !== 0)) continue;
      if (!isVis(b.key)) continue;
      const col = b.color ?? catColor(b.catId);
      datasets.push({
        label: b.label,
        data: b.data,
        borderColor: col,
        backgroundColor: col,
        borderWidth: 1.5,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: col,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        spanGaps: true,
        order: 1,
      });
    }

    const containerWidth = containerRef.current?.offsetWidth ?? 600;
    const { tickSet: xTickSet, xFmt } = buildXAxisTicks(dates, containerWidth, locale);
    const tickFmt = moneyTickFmt({ isPrivate });

    const newData = { labels: dates, datasets };

    if (chartRef.current && !viewChanged) {
      chartRef.current.data = newData;
      chartRef.current.update('none');
      return;
    }

    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: newData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: chartTooltip({
            labelFn: (ctx) => {
              if (isPrivate) return '••••••';
              const v = ctx.parsed.y;
              return `${ctx.dataset.label}: ${fmtMoney(v, locale, currency)}`;
            },
          }),
        },
        scales: {
          y: {
            grid: { color: colors.grid, drawTicks: false },
            border: { display: false },
            ticks: {
              color: colors.muted,
              font: { size: 11 },
              padding: 10,
              maxTicksLimit: 5,
              callback: tickFmt,
            },
          },
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: colors.muted,
              font: { size: 11 },
              maxRotation: 0,
              autoSkip: false,
              callback: (_, idx) => {
                if (!xTickSet.has(idx)) return null;
                return xFmt(new Date(dates[idx] + 'T12:00:00'));
              },
            },
          },
        },
      },
    });
  });

  // Unmount-only cleanup — prevents chart leak on route navigation
  useEffect(() => {
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, []);

  return (
    <div ref={containerRef} className="h-[320px] relative">
      <canvas ref={canvasRef} />
    </div>
  );
}
