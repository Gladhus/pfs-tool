import { useRef, useEffect } from 'react';
import Chart from 'chart.js/auto';
import type { Account, Snapshot } from '@/types/sheets';
import { buildBalanceSweep } from '@/utils/stats';
import { chartColors, chartTooltip, moneyTickFmt } from '@/utils/chartOptions';
import { buildXAxisTicks } from '@/utils/dates';
import { hexToRgba, fmtMoney } from '@/utils/format';
import { tr } from '@/i18n';
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
  /** '' = stacked overview; account ID = single-account line */
  selectedAccount: string;
  accounts: Account[];
  locale: string;
  currency: string;
  isPrivate: boolean;
}

export function HistoryChart({
  filteredDates, snapshots, series, seriesVisible, selectedAccount, accounts, locale, currency, isPrivate,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const prevModeRef = useRef(selectedAccount === '' ? 'overview' : selectedAccount);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isOverview = selectedAccount === '';
    const modeKey = isOverview ? 'overview' : selectedAccount;
    const modeChanged = prevModeRef.current !== modeKey;
    prevModeRef.current = modeKey;

    const colors = chartColors();
    const ctx = canvas.getContext('2d')!;
    const h = canvas.parentElement?.offsetHeight || 300;
    const makeGrad = (hex: string) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, hexToRgba(hex, 0.18));
      g.addColorStop(1, hexToRgba(hex, 0));
      return g;
    };

    const datasets: Chart['data']['datasets'] = [];
    let chartDates: string[] = [];

    if (isOverview) {
      if (!series.dates.length) return;
      chartDates = series.dates;
      const runningTotal = new Array(chartDates.length).fill(0);
      let stackIdx = 0;

      const pushArea = (rawData: (number | null)[], hex: string, labelKey: string) => {
        const cumulative = rawData.map((v, i) => {
          runningTotal[i] += v ?? 0;
          return runningTotal[i];
        });
        datasets.push({
          label: labelKey,
          data: cumulative,
          _rawData: rawData,
          borderColor: hex,
          backgroundColor: hexToRgba(hex, 0.4),
          borderWidth: 2,
          fill: stackIdx === 0 ? 'origin' : '-1',
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 5,
          spanGaps: true,
        } as any);
        stackIdx++;
      };

      if (seriesVisible.investments) pushArea(series.investments, colors.invest,     'show_investments');
      if (seriesVisible.realEstate)  pushArea(series.realEstateNet, colors.realEstate, 'show_real_estate');
      if (seriesVisible.other)       pushArea(series.other, colors.cash,              'show_other');

      if (!datasets.length) return;
    } else {
      const acct = accounts.find(a => a.id === selectedAccount);
      if (!acct) return;
      const sweep = buildBalanceSweep(snapshots, filteredDates);
      const tempDates: string[] = [];
      const values: number[] = [];
      for (let i = 0; i < filteredDates.length; i++) {
        const bal = sweep[i]?.[selectedAccount];
        if (bal === undefined) continue;
        tempDates.push(filteredDates[i]);
        values.push(bal);
      }
      if (!tempDates.length) return;
      chartDates = tempDates;
      const hex = acct.kind === 'debt' ? colors.debt : colors.accent;
      datasets.push({
        label: tr(acct),
        data: values,
        borderColor: hex,
        backgroundColor: makeGrad(hex),
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 5,
      });
    }

    const containerWidth = containerRef.current?.offsetWidth ?? 600;
    const { tickSet: xTickSet, xFmt } = buildXAxisTicks(chartDates, containerWidth, locale);
    const tickFmt = moneyTickFmt({ isPrivate });
    const newData = { labels: chartDates, datasets };

    if (chartRef.current && !modeChanged) {
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
              const raw = (ctx.dataset as any)._rawData;
              const v = raw
                ? (raw[(ctx as any).dataIndex] ?? (ctx.parsed as any).y)
                : (ctx.parsed as any).y;
              if (isPrivate) return '••••••';
              return `${ctx.dataset.label}: ${fmtMoney(v, locale, currency)}`;
            },
          }),
        },
        scales: {
          y: {
            grid: { color: colors.grid, drawTicks: false },
            border: { display: false },
            ticks: { color: colors.muted, font: { size: 11 }, padding: 10, maxTicksLimit: 6, callback: tickFmt },
          },
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: colors.muted, font: { size: 11 }, maxRotation: 0, autoSkip: false,
              callback: (_, idx) => {
                if (!xTickSet.has(idx)) return null;
                return xFmt(new Date(chartDates[idx] + 'T12:00:00'));
              },
            },
          },
        },
      },
    });
  });

  useEffect(() => {
    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, []);

  return (
    <div ref={containerRef} className="h-[280px] relative">
      <canvas ref={canvasRef} />
    </div>
  );
}
