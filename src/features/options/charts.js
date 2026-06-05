import { state } from '../../core/state.js';
import { t } from '../../core/i18n/index.js';
import { fmtMoney, hexToRgba } from '../../core/format.js';
import { privMoney, privShares, MASK } from '../../core/privacy.js';
import { chartTooltip, moneyTooltipLabel, moneyTickFmt, sharesTickFmt, swapChart, chartColors } from '../../core/chartOptions.js';
import {
  computeIntrinsicValue, computeUnvestedValue,
  computeVestedShares,
  getEffectiveFmv,
  grantFullyVestedDate, generateMonthlyDates,
} from '../../utils/options.js';
import { fmtMonth, yearStartIndices } from '../../utils/dates.js';

const GRANT_COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e', '#3b82f6', '#ec4899', '#eab308'];
const COMPANY_COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#f43f5e', '#3b82f6', '#10b981', '#ec4899'];

export { GRANT_COLORS, COMPANY_COLORS };

// --- Summary chart: options value over time (historical) ---

export function renderSummaryChart(now) {
  const canvas       = document.getElementById('opt-summary-canvas');
  const chartSection = document.getElementById('opt-chart-section');
  if (!canvas || !chartSection) return;

  const companies = state.optionCompanies.filter(c => c.active !== false);
  const allFmvDates = state.optionFmv.map(f => f.date).sort();

  if (!companies.length || !allFmvDates.length) {
    chartSection.hidden = true;
    if (state.optionSummaryChart) { state.optionSummaryChart.destroy(); state.optionSummaryChart = null; }
    return;
  }
  chartSection.hidden = false;

  const startDate = allFmvDates[0];
  const allDates = generateMonthlyDates(startDate, now);
  if (allDates.length < 2) return;

  const { muted, grid: gridCol } = chartColors();

  // Use null (not 0) when a company has no FMV data yet for a date.
  // This prevents mid-month FMV entries from producing a false zero on the
  // month-01 date that precedes them.
  const allCompanyValues = companies.map(c => {
    const grants = state.optionGrants.filter(g => g.company_id === c.id);
    return allDates.map(d => {
      const entry = getEffectiveFmv(c.id, d);
      if (!entry) return null;
      return grants.reduce((sum, g) => sum + computeIntrinsicValue(g, entry.fmv, d), 0);
    });
  });

  // Trim leading dates where every company has null (no data at all yet)
  let trimStart = 0;
  while (trimStart < allDates.length && allCompanyValues.every(v => v[trimStart] === null)) trimStart++;
  const dates = allDates.slice(trimStart);
  const companyValues = allCompanyValues.map(v => v.slice(trimStart));

  if (dates.length < 2) return;

  const datasets = companies.map((company, ci) => {
    const color = COMPANY_COLORS[ci % COMPANY_COLORS.length];
    // cumulative: sum of this company and all previous; null if all are still null
    const cumData = dates.map((_, di) => {
      const vals = companyValues.slice(0, ci + 1).map(arr => arr[di]);
      if (vals.every(v => v === null)) return null;
      return vals.reduce((s, v) => s + (v ?? 0), 0);
    });
    return {
      label: company.ticker ? `${company.name} (${company.ticker})` : company.name,
      data: cumData,
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

  const tickCallback = moneyTickFmt({ mask: MASK.short });

  // x-axis ticks: one per year
  const yearTicks = yearStartIndices(dates);

  swapChart(state, 'optionSummaryChart', canvas, {
    type: 'line',
    data: { labels: dates, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: chartTooltip({ labelFn: moneyTooltipLabel }),
      },
      scales: {
        y: {
          grid: { color: gridCol, drawTicks: false },
          border: { display: false },
          ticks: { color: muted, font: { size: 11 }, padding: 10, maxTicksLimit: 5, callback: tickCallback },
        },
        x: {
          grid: { display: false }, border: { display: false },
          ticks: {
            color: muted, font: { size: 11 }, maxRotation: 0, autoSkip: false,
            callback: (_, idx) => {
              if (!yearTicks.has(idx)) return null;
              return new Date(dates[idx] + 'T12:00:00').getFullYear();
            },
          },
        },
      },
    },
  });
}

// --- Per-company value-over-time chart ---

export function renderCompanyValueChart(canvas, company, grants, color, now) {
  const fmvHistory = (state.optionFmv || [])
    .filter(f => f.company_id === company.id)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (fmvHistory.length < 1) return false;

  const dates = generateMonthlyDates(fmvHistory[0].date, now);
  if (dates.length < 2) return false;

  const vestedData   = dates.map(d => {
    const e = getEffectiveFmv(company.id, d);
    return e ? grants.reduce((s, g) => s + computeIntrinsicValue(g, e.fmv, d), 0) : null;
  });
  const unvestedData = dates.map(d => {
    const e = getEffectiveFmv(company.id, d);
    return e ? grants.reduce((s, g) => s + computeUnvestedValue(g, e.fmv, d), 0) : null;
  });

  const { muted, grid: gridCol } = chartColors();

  const tickCallback = moneyTickFmt({ prefix: '$', mask: MASK.short, smallFmt: fmtMoney });

  const yearTicks = yearStartIndices(dates);

  const companyId = company.id + '_value';
  const totalData = vestedData.map((v, i) => {
    const u = unvestedData[i];
    return (v !== null && u !== null) ? v + u : (v ?? u);
  });

  swapChart(state.optionCompanyCharts, companyId, canvas, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        {
          label: t('opt_vested_label'),
          data: vestedData,
          borderColor: color,
          backgroundColor: hexToRgba(color, 0.18),
          borderWidth: 2,
          fill: 'origin',
          tension: 0.2,
          pointRadius: 0,
          pointHoverRadius: 4,
          spanGaps: true,
        },
        {
          label: t('opt_unvested_label'),
          data: totalData,
          borderColor: muted,
          backgroundColor: hexToRgba(muted, 0.10),
          borderWidth: 1.5,
          borderDash: [4, 3],
          fill: '-1',
          tension: 0.2,
          pointRadius: 0,
          pointHoverRadius: 4,
          spanGaps: true,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a', titleColor: '#94a3b8', bodyColor: '#f1f5f9',
          padding: 10, cornerRadius: 8,
          callbacks: {
            title: items => fmtMonth(dates[items[0].dataIndex], { style: 'short' }),
            label: ctx => {
              const di = ctx.dataIndex;
              if (ctx.datasetIndex === 0) return `  ${t('opt_vested_label')}: ${privMoney(vestedData[di] ?? 0)}`;
              const unvested = (totalData[di] ?? 0) - (vestedData[di] ?? 0);
              return `  ${t('opt_unvested_label')}: ${privMoney(unvested)}`;
            },
          },
        },
      },
      scales: {
        y: {
          grid: { color: gridCol, drawTicks: false },
          border: { display: false },
          ticks: { color: muted, font: { size: 11 }, padding: 8, maxTicksLimit: 4, callback: tickCallback },
        },
        x: {
          grid: { display: false }, border: { display: false },
          ticks: {
            color: muted, font: { size: 11 }, maxRotation: 0, autoSkip: false,
            callback: (_, idx) => {
              if (!yearTicks.has(idx)) return null;
              return new Date(dates[idx] + 'T12:00:00').getFullYear();
            },
          },
        },
      },
    },
  });
  return true;
}

// --- Per-company vesting chart ---

export function renderCompanyVestingChart(canvas, company, grants, currentFmv, now) {
  if (!grants.length) return;

  // Time range: earliest vesting_start to latest fully-vested date
  const starts = grants.map(g => g.vesting_start || g.grant_date).filter(Boolean).sort();
  const ends   = grants.map(g => grantFullyVestedDate(g)).filter(Boolean).sort();
  if (!starts.length || !ends.length) return;

  const rangeStart = starts[0];
  const rangeEnd   = ends[ends.length - 1];
  if (rangeEnd < rangeStart) return;

  // Extend 1 month on each side for breathing room
  const startDt = new Date(rangeStart + 'T12:00:00');
  startDt.setMonth(startDt.getMonth() - 1);
  const endDt   = new Date(rangeEnd + 'T12:00:00');
  endDt.setMonth(endDt.getMonth() + 1);

  const dates = generateMonthlyDates(
    startDt.toISOString().slice(0,10),
    endDt.toISOString().slice(0,10)
  );
  if (dates.length < 2) return;

  const todayIdx = dates.findLastIndex(d => d <= now);

  const { muted, grid: gridCol } = chartColors();

  // Build cumulative vested share counts per date
  const grantValues = grants.map(grant =>
    dates.map(d => computeVestedShares(grant, d))
  );

  const datasets = grants.map((grant, gi) => {
    const color = GRANT_COLORS[gi % GRANT_COLORS.length];
    const cumData = dates.map((_, di) =>
      grantValues.slice(0, gi + 1).reduce((s, arr) => s + arr[di], 0)
    );
    return {
      label: grant.label || grant.grant_type || `Grant ${gi+1}`,
      data: cumData,
      borderColor: color,
      backgroundColor: hexToRgba(color, 0.15),
      borderWidth: 2,
      fill: gi === 0 ? 'origin' : '-1',
      tension: 0.2,
      pointRadius: 0,
      pointHoverRadius: 4,
      spanGaps: true,
      segment: {
        borderDash: ctx => (todayIdx >= 0 && ctx.p0DataIndex > todayIdx) ? [5,3] : undefined,
        backgroundColor: ctx => {
          const isPast = todayIdx < 0 || ctx.p0DataIndex <= todayIdx;
          return hexToRgba(color, isPast ? 0.15 : 0.06);
        },
      },
    };
  });

  // "Today" vertical line via plugin
  const todayLinePlugin = {
    id: 'todayLine',
    afterDatasetsDraw(chart) {
      if (todayIdx < 0) return;
      const { ctx, chartArea, scales } = chart;
      const x = scales.x.getPixelForValue(todayIdx);
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = muted;
      ctx.lineWidth = 1;
      ctx.setLineDash([4,3]);
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
      ctx.restore();
    },
  };

  const tickCallback = sharesTickFmt();

  // x-axis: one tick per year
  const yearTicks = yearStartIndices(dates);

  const companyId = company.id;
  swapChart(state.optionCompanyCharts, companyId, canvas, {
    type: 'line',
    data: { labels: dates, datasets },
    plugins: [todayLinePlugin],
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a', titleColor: '#94a3b8', bodyColor: '#f1f5f9',
          padding: 10, cornerRadius: 8,
          callbacks: {
            title: items => fmtMonth(dates[items[0].dataIndex], { style: 'short' }),
            label: ctx => `  ${ctx.dataset.label}: ${privShares(grantValues[ctx.datasetIndex][ctx.dataIndex])} shares`,
          },
        },
      },
      scales: {
        y: {
          grid: { color: gridCol, drawTicks: false },
          border: { display: false },
          ticks: { color: muted, font: { size: 11 }, padding: 8, maxTicksLimit: 4, callback: tickCallback },
        },
        x: {
          grid: { display: false }, border: { display: false },
          ticks: {
            color: muted, font: { size: 11 }, maxRotation: 0, autoSkip: false,
            callback: (_, idx) => {
              if (!yearTicks.has(idx)) return null;
              return new Date(dates[idx] + 'T12:00:00').getFullYear();
            },
          },
        },
      },
    },
  });
}
