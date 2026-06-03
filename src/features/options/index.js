import './en.js';
import './fr.js';
import Chart from 'chart.js/auto';
import { state } from '../../core/state.js';
import { t, lang } from '../../core/i18n/index.js';
import { fmtMoney } from '../../core/format.js';
import { privMoney, privShares, MASK } from '../../core/privacy.js';
import { chartTooltip, moneyTooltipLabel, moneyTickFmt, sharesTickFmt } from '../../core/chartOptions.js';
import { setStatus } from '../../core/dom.js';
import { attachAutocomplete } from '../../core/autocomplete.js';
import {
  computeVestedShares, computeUnvestedShares,
  computeIntrinsicValue, computeUnvestedValue,
  getEffectiveFmv, computeCompanyEquityValue, computeCompanyUnvestedValue,
  computeTotalEquityValue, computeTotalUnvestedValue,
  grantFullyVestedDate, grantFirstVestDate, generateMonthlyDates,
} from '../../utils/options.js';
import {
  writeOptionCompanies, writeOptionGrants, addOptionFmvEntry, writeOptionFmv,
} from '../../api/options.js';
import { writeConfig } from '../../api/config.js';

const GRANT_COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e', '#3b82f6', '#ec4899', '#eab308'];
const COMPANY_COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#f43f5e', '#3b82f6', '#10b981', '#ec4899'];

function today() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function hexToRgba(hex, a) {
  const m = hex.trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return hex;
  let h = m[1];
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}

function fmtShortDate(yyyymmdd) {
  if (!yyyymmdd) return '—';
  const [y, m] = yyyymmdd.split('-');
  return new Date(+y, +m-1, 1).toLocaleDateString(lang() === 'fr' ? 'fr-CA' : 'en-CA', { month: 'short', year: 'numeric' });
}

// --- Dialog state ---
let _editingCompanyId = null;   // null = new
let _editingGrantId   = null;   // null = new
let _editingGrantCoId = null;   // which company the grant belongs to

// --- Sub-tab state ---
let _optSubTab = 'main';

export function setOptionsSubTab(panel) {
  _optSubTab = panel;
  for (const p of ['main', 'manage']) {
    const el = document.getElementById(`opt-sub-${p}`);
    if (el) el.hidden = (p !== panel);
  }
  document.querySelectorAll('#options-sidebar .section-sidebar-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.panel === panel);
  });
  if (panel === 'main')   _renderOptionsMain();
  if (panel === 'manage') renderOptionsManage();
}

export function renderOptions() {
  setOptionsSubTab(_optSubTab);
}

// --- Main sub-panel ---

function _renderOptionsMain() {
  const now = today();
  const companies = state.optionCompanies.filter(c => c.active !== false);
  const totalVested   = computeTotalEquityValue(now);
  const totalUnvested = computeTotalUnvestedValue(now);

  const vestedEl   = document.getElementById('opt-vested-value');
  const unvestedEl = document.getElementById('opt-unvested-value');
  if (vestedEl)   vestedEl.textContent   = privMoney(totalVested);
  if (unvestedEl) unvestedEl.textContent = privMoney(totalUnvested);

  renderSummaryChart(now);

  const list = document.getElementById('opt-companies-list');
  if (!list) return;
  list.innerHTML = '';

  if (!companies.length) {
    list.innerHTML = `
      <div class="opt-empty-state">
        <p class="opt-empty-title">${escapeHtml(t('opt_no_companies'))}</p>
        <p class="hint">${escapeHtml(t('opt_no_companies_hint'))}</p>
      </div>`;
    return;
  }

  companies.forEach((company, ci) => {
    const card = buildCompanyCard(company, ci, now);
    list.appendChild(card);
  });
}

// --- Summary chart: options value over time (historical) ---

function renderSummaryChart(now) {
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

  const cs = getComputedStyle(document.documentElement);
  const muted   = cs.getPropertyValue('--subtle').trim() || '#94a3b8';
  const gridCol = cs.getPropertyValue('--border').trim() || 'rgba(15,23,42,.06)';

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
  const yearTicks = new Set();
  dates.forEach((d, i) => { if (i === 0 || d.slice(0,4) !== dates[i-1].slice(0,4)) yearTicks.add(i); });

  if (state.optionSummaryChart) { state.optionSummaryChart.destroy(); state.optionSummaryChart = null; }
  state.optionSummaryChart = new Chart(canvas, {
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

// --- Per-company card ---

function buildCompanyCard(company, ci, now) {
  const grants         = state.optionGrants.filter(g => g.company_id === company.id);
  const fmvEntry       = getEffectiveFmv(company.id, now);
  const fmv            = fmvEntry?.fmv ?? null;
  const vestedVal      = fmv !== null ? grants.reduce((s,g) => s + computeIntrinsicValue(g, fmv, now), 0) : null;
  const unvestedVal    = fmv !== null ? grants.reduce((s,g) => s + computeUnvestedValue(g, fmv, now), 0) : null;
  const vestedShares   = grants.reduce((s,g) => s + computeVestedShares(g, now), 0);
  const unvestedShares = grants.reduce((s,g) => s + computeUnvestedShares(g, now), 0);
  const color          = COMPANY_COLORS[ci % COMPANY_COLORS.length];

  const card = document.createElement('div');
  card.className = 'opt-company-card';
  card.style.setProperty('--opt-color', color);

  // --- Header ---
  const header = document.createElement('div');
  header.className = 'opt-card-header';

  // Title row: company name left, pill right
  const titleRow = document.createElement('div');
  titleRow.className = 'opt-card-title-row';

  const titleEl = document.createElement('div');
  titleEl.className = 'opt-card-title';
  titleEl.innerHTML = `
    <span class="opt-company-dot"></span>
    <strong>${escapeHtml(company.name)}</strong>
    ${company.ticker ? `<span class="opt-ticker">${escapeHtml(company.ticker)}</span>` : ''}
  `;

  const pillEl = document.createElement('div');
  pillEl.className = 'opt-chart-pill';
  pillEl.innerHTML = `
    <button class="opt-pill-btn active" data-view="vesting">${t('opt_pill_vesting')}</button>
    <button class="opt-pill-btn" data-view="value">${t('opt_pill_value')}</button>
  `;

  titleRow.appendChild(titleEl);
  titleRow.appendChild(pillEl);

  const metaEl = document.createElement('div');
  metaEl.className = 'opt-card-meta';
  metaEl.innerHTML = fmv !== null
    ? `<span class="opt-fmv-display">${t('opt_last_fmv')} ${fmtMoney(fmv)}</span><span class="opt-fmv-date">${fmtShortDate(fmvEntry.date)}</span>`
    : `<span class="opt-no-fmv hint">${t('opt_no_fmv')}</span>`;

  const valuesEl = document.createElement('div');
  valuesEl.className = 'opt-card-values';

  function renderCardValues(view) {
    if (view === 'vesting') {
      valuesEl.innerHTML = `
        <span class="opt-vested-val">${privShares(vestedShares)} <span class="opt-val-label">${t('opt_shares_vested')}</span></span>
        <span class="opt-unvested-val">${privShares(unvestedShares)} <span class="opt-val-label">${t('opt_shares_unvested')}</span></span>
      `;
    } else {
      valuesEl.innerHTML = `
        ${vestedVal !== null ? `<span class="opt-vested-val">${privMoney(vestedVal)} <span class="opt-val-label">${t('opt_vested_label')}</span></span>` : ''}
        ${unvestedVal !== null ? `<span class="opt-unvested-val">${privMoney(unvestedVal)} <span class="opt-val-label">${t('opt_unvested_label')}</span></span>` : ''}
      `;
    }
  }
  renderCardValues('vesting');

  header.appendChild(titleRow);
  header.appendChild(metaEl);
  header.appendChild(valuesEl);
  card.appendChild(header);

  // --- Charts (two canvases, toggled by pill) ---
  let vestingWrap = null, valueWrap = null;
  if (grants.length) {
    vestingWrap = document.createElement('div');
    vestingWrap.className = 'opt-chart-wrap';
    const vestingCanvas = document.createElement('canvas');
    vestingCanvas.className = 'opt-company-canvas';
    vestingWrap.appendChild(vestingCanvas);
    card.appendChild(vestingWrap);

    valueWrap = document.createElement('div');
    valueWrap.className = 'opt-chart-wrap';
    valueWrap.hidden = true;
    const valueCanvas = document.createElement('canvas');
    valueCanvas.className = 'opt-company-canvas';
    valueWrap.appendChild(valueCanvas);
    card.appendChild(valueWrap);

    requestAnimationFrame(() => {
      renderCompanyVestingChart(vestingCanvas, company, grants, fmv, now);
      const rendered = renderCompanyValueChart(valueCanvas, company, grants, color, now);
      if (!rendered) {
        valueCanvas.remove();
        const hint = document.createElement('p');
        hint.className = 'hint';
        hint.style.cssText = 'padding: 2rem 1.25rem; text-align: center; margin: 0;';
        hint.textContent = t('opt_no_fmv_history');
        valueWrap.appendChild(hint);
      }
    });
  }

  // --- Grants list ---
  const grantsList = document.createElement('div');
  grantsList.className = 'opt-grants-list';
  if (grants.length) {
    grants.forEach((grant, gi) => {
      const gColor          = GRANT_COLORS[gi % GRANT_COLORS.length];
      const vested          = computeVestedShares(grant, now);
      const total           = Number(grant.total_shares) || 0;
      const pct             = total ? Math.min(100, (vested / total) * 100) : 0;
      const vestVal         = fmv !== null ? computeIntrinsicValue(grant, fmv, now) : null;
      const unvestedGrantVal = fmv !== null ? computeUnvestedValue(grant, fmv, now) : null;
      const totalGrantVal   = vestVal !== null && unvestedGrantVal !== null ? vestVal + unvestedGrantVal : null;
      const fullyVested     = vested >= total;
      const firstVest       = grantFirstVestDate(grant);
      const cliffPending    = !fullyVested && firstVest && firstVest > now;
      const cliffMonths     = cliffPending ? Math.ceil(
        (new Date(firstVest+'T12:00:00') - new Date(now+'T12:00:00')) / (1000*60*60*24*30.44)
      ) : 0;

      const valueHtml = vestVal !== null
        ? `<span class="opt-grant-value">${privMoney(vestVal)}${totalGrantVal !== null ? `<span class="opt-grant-unvested-val"> / ${privMoney(totalGrantVal)}</span>` : ''}</span>`
        : '';

      const row = document.createElement('div');
      row.className = 'opt-grant-row';
      row.innerHTML = `
        <div class="opt-grant-header">
          <span class="opt-grant-dot" style="background:${gColor}"></span>
          <span class="opt-grant-name">${escapeHtml(grant.label || grant.grant_type || 'Grant')}</span>
          <span class="opt-grant-type-badge">${escapeHtml(grant.grant_type || '')}</span>
        </div>
        <div class="opt-grant-progress-wrap">
          <div class="opt-grant-progress-bar">
            <div class="opt-grant-progress-fill" style="width:${pct.toFixed(1)}%;background:${gColor}"></div>
          </div>
          <span class="opt-grant-pct">${Math.round(pct)}%</span>
        </div>
        <div class="opt-grant-meta">
          <span>${fullyVested ? t('opt_fully_vested') : cliffPending ? t('opt_cliff_pending').replace('{months}', cliffMonths) : `${privShares(vested)} / ${privShares(total)} ${t('opt_shares_vested')}`}</span>
          ${valueHtml}
        </div>`;
      grantsList.appendChild(row);
    });
  } else {
    grantsList.innerHTML = `<p class="hint" style="margin:.5rem 0">${t('opt_no_grants')}</p>`;
  }
  card.appendChild(grantsList);

  // --- Pill toggle wiring ---
  pillEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.opt-pill-btn');
    if (!btn || btn.classList.contains('active')) return;
    const view = btn.dataset.view;
    pillEl.querySelectorAll('.opt-pill-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderCardValues(view);
    if (vestingWrap) vestingWrap.hidden = (view !== 'vesting');
    if (valueWrap)   valueWrap.hidden   = (view !== 'value');
  });

  return card;
}

// --- Per-company value-over-time chart ---

function renderCompanyValueChart(canvas, company, grants, color, now) {
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

  const cs      = getComputedStyle(document.documentElement);
  const muted   = cs.getPropertyValue('--subtle').trim()  || '#94a3b8';
  const gridCol = cs.getPropertyValue('--border').trim()  || 'rgba(15,23,42,.06)';

  const tickCallback = moneyTickFmt({ prefix: '$', mask: MASK.short, smallFmt: fmtMoney });

  const yearTicks = new Set();
  dates.forEach((d, i) => { if (i === 0 || d.slice(0,4) !== dates[i-1].slice(0,4)) yearTicks.add(i); });

  const companyId = company.id + '_value';
  if (state.optionCompanyCharts[companyId]) {
    state.optionCompanyCharts[companyId].destroy();
    delete state.optionCompanyCharts[companyId];
  }

  const totalData = vestedData.map((v, i) => {
    const u = unvestedData[i];
    return (v !== null && u !== null) ? v + u : (v ?? u);
  });

  state.optionCompanyCharts[companyId] = new Chart(canvas, {
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
            title: items => fmtShortDate(dates[items[0].dataIndex]),
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

function renderCompanyVestingChart(canvas, company, grants, currentFmv, now) {
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

  const cs = getComputedStyle(document.documentElement);
  const muted   = cs.getPropertyValue('--subtle').trim() || '#94a3b8';
  const gridCol = cs.getPropertyValue('--border').trim() || 'rgba(15,23,42,.06)';

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
  const yearTicks = new Set();
  dates.forEach((d, i) => { if (i === 0 || d.slice(0,4) !== dates[i-1].slice(0,4)) yearTicks.add(i); });

  const companyId = company.id;
  if (state.optionCompanyCharts[companyId]) {
    state.optionCompanyCharts[companyId].destroy();
    delete state.optionCompanyCharts[companyId];
  }

  state.optionCompanyCharts[companyId] = new Chart(canvas, {
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
            title: items => fmtShortDate(dates[items[0].dataIndex]),
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

// --- Manage sub-panel ---

export function renderOptionsManage() {
  const list = document.getElementById('opt-manage-list');
  if (!list) return;
  list.innerHTML = '';

  // Equity tags row — controls which groups equity is included in
  const tagsRow = document.createElement('section');
  tagsRow.className = 'opt-manage-section';
  tagsRow.style.cssText = 'margin-bottom:1.5rem';
  tagsRow.innerHTML = `
    <header class="section-header" style="margin-bottom:0.5rem">
      <h2>${escapeHtml(t('opt_equity_tags'))}</h2>
    </header>
    <p class="hint" style="margin:0 0 0.75rem">${escapeHtml(t('opt_equity_tags_hint'))}</p>
    <div class="tag-input-wrap" id="opt-equity-tags-wrap">
      <div id="opt-equity-tags-chips" class="tag-chips"></div>
      <input type="text" id="opt-equity-tags-input" autocomplete="off" placeholder="Add tag…">
    </div>`;
  list.appendChild(tagsRow);

  const chipsEl = tagsRow.querySelector('#opt-equity-tags-chips');
  const tagInput = tagsRow.querySelector('#opt-equity-tags-input');
  let _equityTags = [...(state.configEquityTags || [])];

  async function saveEquityTags() {
    state.configEquityTags = [..._equityTags];
    try {
      await writeConfig('equity_tags', _equityTags.join(','));
    } catch (err) {
      setStatus('Error: ' + (err.result?.error?.message || err.message || err), 'warn');
    }
  }

  function renderEquityTagChips() {
    chipsEl.innerHTML = '';
    for (const tag of _equityTags) {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `${escapeHtml(tag)}<button type="button" aria-label="Remove">&times;</button>`;
      chip.querySelector('button').addEventListener('click', () => {
        _equityTags = _equityTags.filter(t => t !== tag);
        renderEquityTagChips();
        saveEquityTags();
      });
      chipsEl.appendChild(chip);
    }
  }

  function allKnownTags() {
    const set = new Set((state.tagsCatalog || []).map(t => t.name));
    for (const a of state.accounts) {
      if (Array.isArray(a.tags)) a.tags.forEach(tag => tag && set.add(tag));
    }
    return [...set].sort();
  }

  attachAutocomplete(tagInput, {
    getOptions: () => allKnownTags().filter(tag => !_equityTags.includes(tag)),
    onPick: (tag) => {
      if (!_equityTags.includes(tag)) {
        _equityTags.push(tag);
        renderEquityTagChips();
        saveEquityTags();
      }
    },
  });

  tagInput.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.value.trim()) {
      e.preventDefault();
      const tag = tagInput.value.trim().replace(/,$/, '');
      if (tag && !_equityTags.includes(tag)) {
        _equityTags.push(tag);
        renderEquityTagChips();
        saveEquityTags();
      }
      tagInput.value = '';
    }
  });

  renderEquityTagChips();

  const allCompanies = state.optionCompanies;
  if (!allCompanies.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.style.margin = '1rem 0';
    empty.textContent = t('opt_no_companies');
    list.appendChild(empty);
    return;
  }

  allCompanies.forEach((company, ci) => {
    const section = buildCompanyManageSection(company, ci);
    list.appendChild(section);
  });
}

function buildCompanyManageSection(company, ci) {
  const color = COMPANY_COLORS[ci % COMPANY_COLORS.length];
  const grants = state.optionGrants.filter(g => g.company_id === company.id);
  const companyFmv = state.optionFmv
    .filter(f => f.company_id === company.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const section = document.createElement('div');
  section.className = 'opt-manage-section';
  section.style.setProperty('--opt-color', color);

  // Company header
  const header = document.createElement('div');
  header.className = 'opt-manage-header';
  header.innerHTML = `
    <div class="opt-card-title">
      <span class="opt-company-dot"></span>
      <strong>${escapeHtml(company.name)}</strong>
      ${company.ticker ? `<span class="opt-ticker">${escapeHtml(company.ticker)}</span>` : ''}
      ${company.active === false ? `<span class="opt-inactive-badge">${t('opt_inactive')}</span>` : ''}
    </div>
    <button type="button" class="link-btn opt-manage-edit-company">${t('edit_label')}</button>`;
  section.appendChild(header);
  header.querySelector('.opt-manage-edit-company').addEventListener('click', () => openCompanyDialog(company.id));

  // FMV history block
  const fmvBlock = document.createElement('div');
  fmvBlock.className = 'opt-manage-block';

  const fmvTitle = document.createElement('div');
  fmvTitle.className = 'opt-manage-subtitle';
  fmvTitle.textContent = t('opt_fmv_history');
  fmvBlock.appendChild(fmvTitle);

  if (companyFmv.length) {
    const table = document.createElement('table');
    table.className = 'opt-fmv-table';
    table.innerHTML = `<thead><tr>
      <th>${t('opt_fmv_date_col')}</th>
      <th>${t('opt_fmv_value_col')}</th>
      <th>${t('opt_fmv_note_col')}</th>
      <th></th>
    </tr></thead>`;
    const tbody = document.createElement('tbody');

    companyFmv.forEach((entry) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(entry.date)}</td>
        <td>${fmtMoney(Number(entry.fmv))}</td>
        <td class="opt-fmv-note-cell">${escapeHtml(entry.note || '')}</td>
        <td class="opt-fmv-actions">
          <button type="button" class="link-btn fmv-edit-btn">${t('edit_label')}</button>
          <button type="button" class="link-btn fmv-delete-btn" style="color:var(--danger)">✕</button>
        </td>`;
      tr.querySelector('.fmv-edit-btn').addEventListener('click', () => editFmvRow(tbody, tr, company.id, entry));
      tr.querySelector('.fmv-delete-btn').addEventListener('click', () => deleteFmvEntry(company.id, entry));
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    fmvBlock.appendChild(table);
  } else {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.style.margin = '0.25rem 0 0.5rem';
    hint.textContent = t('opt_no_fmv_history');
    fmvBlock.appendChild(hint);
  }

  // Add FMV form
  const addForm = document.createElement('div');
  addForm.className = 'opt-fmv-manage-add';
  const nowStr = today();
  addForm.innerHTML = `
    <input type="date" class="fmv-add-date" value="${nowStr}">
    <input type="number" class="fmv-add-val" placeholder="${escapeHtml(t('opt_fmv_placeholder'))}" step="0.01" min="0">
    <input type="text" class="fmv-add-note" placeholder="${escapeHtml(t('opt_note_placeholder'))}">
    <button type="button" class="fmv-add-btn primary">${t('opt_fmv_add')}</button>`;
  const addBtn = addForm.querySelector('.fmv-add-btn');
  addBtn.addEventListener('click', () => saveFmvEntryFromManage(
    company.id,
    addForm.querySelector('.fmv-add-date'),
    addForm.querySelector('.fmv-add-val'),
    addForm.querySelector('.fmv-add-note'),
    addBtn,
  ));
  fmvBlock.appendChild(addForm);
  section.appendChild(fmvBlock);

  // Grants block
  const grantsBlock = document.createElement('div');
  grantsBlock.className = 'opt-manage-block';

  const grantsTitle = document.createElement('div');
  grantsTitle.className = 'opt-manage-subtitle';
  grantsTitle.textContent = t('opt_grants_label');
  grantsBlock.appendChild(grantsTitle);

  if (grants.length) {
    grants.forEach((grant, gi) => {
      const gColor = GRANT_COLORS[gi % GRANT_COLORS.length];
      const row = document.createElement('div');
      row.className = 'opt-manage-grant-row';
      row.innerHTML = `
        <span class="opt-grant-dot" style="background:${gColor}; width:8px; height:8px; flex-shrink:0"></span>
        <span class="opt-manage-meta">${escapeHtml(grant.label || grant.grant_type || 'Grant')}
          <span class="opt-grant-type-badge">${escapeHtml(grant.grant_type || '')}</span>
          <span class="opt-manage-meta-detail">${(Number(grant.total_shares)||0).toLocaleString()} shares · strike ${fmtMoney(Number(grant.strike_price)||0)}</span>
        </span>
        <button type="button" class="link-btn manage-edit-grant-btn">${t('edit_label')}</button>`;
      row.querySelector('.manage-edit-grant-btn').addEventListener('click', () => openGrantDialog(grant.id, company.id));
      grantsBlock.appendChild(row);
    });
  } else {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.style.margin = '0.25rem 0 0.5rem';
    hint.textContent = t('opt_no_grants');
    grantsBlock.appendChild(hint);
  }

  const addGrantBtn = document.createElement('button');
  addGrantBtn.type = 'button';
  addGrantBtn.className = 'link-btn';
  addGrantBtn.textContent = t('opt_add_grant');
  addGrantBtn.addEventListener('click', () => openGrantDialog(null, company.id));
  grantsBlock.appendChild(addGrantBtn);

  section.appendChild(grantsBlock);
  return section;
}

function editFmvRow(tbody, tr, companyId, entry) {
  tr.innerHTML = `
    <td><input type="date" class="fmv-edit-date" value="${entry.date}"></td>
    <td><input type="number" class="fmv-edit-val" value="${entry.fmv}" step="0.01" min="0" style="width:6rem"></td>
    <td><input type="text" class="fmv-edit-note" value="${escapeHtml(entry.note || '')}" style="width:100%"></td>
    <td class="opt-fmv-actions">
      <button type="button" class="fmv-save-edit primary">✓</button>
      <button type="button" class="link-btn fmv-cancel-edit">✕</button>
    </td>`;

  tr.querySelector('.fmv-save-edit').addEventListener('click', async () => {
    const date = tr.querySelector('.fmv-edit-date').value;
    const fmv  = parseFloat(tr.querySelector('.fmv-edit-val').value);
    const note = tr.querySelector('.fmv-edit-note').value.trim();
    if (!date || !Number.isFinite(fmv) || fmv < 0) return;
    const updated = state.optionFmv.map(f =>
      (f.company_id === companyId && f.date === entry.date && Number(f.fmv) === Number(entry.fmv) && (f.note||'') === (entry.note||''))
        ? { ...f, date, fmv, note }
        : f
    ).sort((a, b) => a.date.localeCompare(b.date));
    try {
      setStatus('Saving…');
      await writeOptionFmv(updated);
      setStatus('Saved.', 'ok');
    } catch (err) {
      setStatus('Error: ' + (err.result?.error?.message || err.message || err), 'warn');
    }
    renderOptionsManage();
  });

  tr.querySelector('.fmv-cancel-edit').addEventListener('click', () => renderOptionsManage());
}

async function deleteFmvEntry(companyId, entry) {
  const newFmv = state.optionFmv.filter(f =>
    !(f.company_id === companyId && f.date === entry.date && Number(f.fmv) === Number(entry.fmv) && (f.note||'') === (entry.note||''))
  );
  try {
    setStatus('Deleting…');
    await writeOptionFmv(newFmv);
    setStatus('Deleted.', 'ok');
  } catch (err) {
    setStatus('Error: ' + (err.result?.error?.message || err.message || err), 'warn');
  }
  renderOptionsManage();
}

async function saveFmvEntryFromManage(companyId, dateInput, amtInput, noteInput, btn) {
  const date = dateInput.value.trim();
  const fmv  = parseFloat(amtInput.value);
  if (!date || !Number.isFinite(fmv) || fmv < 0) { amtInput.focus(); return; }

  btn.disabled = true;
  const newFmv = [...state.optionFmv, { date, company_id: companyId, fmv, note: noteInput.value.trim() }]
    .sort((a, b) => a.date.localeCompare(b.date));
  try {
    setStatus('Saving FMV…');
    await writeOptionFmv(newFmv);
    amtInput.value = '';
    noteInput.value = '';
    setStatus('FMV saved.', 'ok');
  } catch (err) {
    setStatus('Error: ' + (err.result?.error?.message || err.message || err), 'warn');
  } finally {
    btn.disabled = false;
  }
  renderOptionsManage();
}

// --- Company dialog ---

let _companySaveHandler   = null;
let _companyDeleteHandler = null;

export function openCompanyDialog(companyId) {
  _editingCompanyId = companyId || null;
  const dlg = document.getElementById('opt-company-dialog');
  if (!dlg) return;

  const title = dlg.querySelector('#opt-company-dlg-title');
  const nameInput   = dlg.querySelector('#opt-company-name');
  const tickerInput = dlg.querySelector('#opt-company-ticker');
  const activeInput = dlg.querySelector('#opt-company-active');
  const deleteBtn   = dlg.querySelector('#opt-company-delete-btn');

  const existing = companyId ? state.optionCompanies.find(c => c.id === companyId) : null;
  title.textContent = existing ? t('opt_edit_company_title') : t('opt_new_company');
  nameInput.value   = existing?.name   || '';
  tickerInput.value = existing?.ticker || '';
  activeInput.checked = existing ? existing.active !== false : true;
  deleteBtn.hidden  = !existing;

  // Remove old handlers
  const saveBtn   = dlg.querySelector('#opt-company-save-btn');
  const cancelBtn = dlg.querySelector('#opt-company-cancel-btn');
  if (_companySaveHandler)   saveBtn.removeEventListener('click', _companySaveHandler);
  if (_companyDeleteHandler) deleteBtn.removeEventListener('click', _companyDeleteHandler);

  _companySaveHandler = () => saveCompanyDialog();
  _companyDeleteHandler = () => deleteCompany(companyId);
  saveBtn.addEventListener('click', _companySaveHandler);
  deleteBtn.addEventListener('click', _companyDeleteHandler);

  dlg.showModal();
  nameInput.focus();
}

async function saveCompanyDialog() {
  const dlg       = document.getElementById('opt-company-dialog');
  const nameInput = dlg.querySelector('#opt-company-name');
  const ticker    = dlg.querySelector('#opt-company-ticker').value.trim().toUpperCase();
  const active    = dlg.querySelector('#opt-company-active').checked;
  const name      = nameInput.value.trim();
  if (!name) { nameInput.focus(); return; }

  const companies = [...state.optionCompanies];
  if (_editingCompanyId) {
    const idx = companies.findIndex(c => c.id === _editingCompanyId);
    if (idx >= 0) companies[idx] = { ...companies[idx], name, ticker, active };
  } else {
    const id = slugify(name) + '_' + Date.now().toString(36).slice(-4);
    companies.push({ id, name, ticker, active });
  }

  dlg.querySelector('#opt-company-save-btn').disabled = true;
  try {
    setStatus('Saving…');
    await writeOptionCompanies(companies);
    dlg.close();
    setStatus('Saved.', 'ok');
    renderOptions();
  } catch (err) {
    setStatus('Error: ' + (err.result?.error?.message || err.message || err), 'warn');
  } finally {
    dlg.querySelector('#opt-company-save-btn').disabled = false;
  }
}

async function deleteCompany(companyId) {
  const companies = state.optionCompanies.filter(c => c.id !== companyId);
  const grants    = state.optionGrants.filter(g => g.company_id !== companyId);
  const dlg       = document.getElementById('opt-company-dialog');
  try {
    setStatus('Deleting…');
    await writeOptionCompanies(companies);
    await writeOptionGrants(grants);
    dlg.close();
    setStatus('Deleted.', 'ok');
    renderOptions();
  } catch (err) {
    setStatus('Error: ' + (err.result?.error?.message || err.message || err), 'warn');
  }
}

export function closeCompanyDialog() {
  document.getElementById('opt-company-dialog')?.close();
}

// --- Grant dialog ---

let _grantSaveHandler   = null;
let _grantDeleteHandler = null;

export function openGrantDialog(grantId, companyId) {
  _editingGrantId   = grantId || null;
  _editingGrantCoId = companyId;
  const dlg = document.getElementById('opt-grant-dialog');
  if (!dlg) return;

  const existing = grantId ? state.optionGrants.find(g => g.id === grantId) : null;
  dlg.querySelector('#opt-grant-dlg-title').textContent = existing ? t('opt_edit_grant') : t('opt_new_grant');

  dlg.querySelector('#opt-grant-label').value           = existing?.label           || '';
  dlg.querySelector('#opt-grant-type').value            = existing?.grant_type      || 'ISO';
  dlg.querySelector('#opt-grant-date').value            = existing?.grant_date      || '';
  dlg.querySelector('#opt-grant-shares').value          = existing?.total_shares    || '';
  dlg.querySelector('#opt-grant-strike').value          = existing?.strike_price    ?? '';
  dlg.querySelector('#opt-grant-vesting-start').value   = existing?.vesting_start   || existing?.grant_date || '';
  dlg.querySelector('#opt-grant-cliff').value           = existing?.cliff_months    ?? 12;
  dlg.querySelector('#opt-grant-vesting-months').value  = existing?.vesting_months  || 48;
  dlg.querySelector('#opt-grant-interval').value        = existing?.vesting_interval || 'monthly';
  dlg.querySelector('#opt-grant-expiry').value          = existing?.expiry_date     || '';

  const deleteBtn = dlg.querySelector('#opt-grant-delete-btn');
  deleteBtn.hidden = !existing;

  const saveBtn   = dlg.querySelector('#opt-grant-save-btn');
  const cancelBtn = dlg.querySelector('#opt-grant-cancel-btn');
  if (_grantSaveHandler)   saveBtn.removeEventListener('click', _grantSaveHandler);
  if (_grantDeleteHandler) deleteBtn.removeEventListener('click', _grantDeleteHandler);

  _grantSaveHandler   = () => saveGrantDialog();
  _grantDeleteHandler = () => deleteGrant(grantId, companyId);
  saveBtn.addEventListener('click', _grantSaveHandler);
  deleteBtn.addEventListener('click', _grantDeleteHandler);

  // Auto-fill vesting_start from grant_date
  const grantDateInput   = dlg.querySelector('#opt-grant-date');
  const vestingStartInput = dlg.querySelector('#opt-grant-vesting-start');
  grantDateInput.addEventListener('change', () => {
    if (!vestingStartInput.value) vestingStartInput.value = grantDateInput.value;
  }, { once: true });

  dlg.showModal();
  dlg.querySelector('#opt-grant-label').focus();
}

async function saveGrantDialog() {
  const dlg = document.getElementById('opt-grant-dialog');
  const label         = dlg.querySelector('#opt-grant-label').value.trim();
  const grant_type    = dlg.querySelector('#opt-grant-type').value;
  const grant_date    = dlg.querySelector('#opt-grant-date').value;
  const total_shares  = Number(dlg.querySelector('#opt-grant-shares').value);
  const strike_price  = Number(dlg.querySelector('#opt-grant-strike').value) || 0;
  const vesting_start = dlg.querySelector('#opt-grant-vesting-start').value || grant_date;
  const cliff_months  = Number(dlg.querySelector('#opt-grant-cliff').value) || 0;
  const vesting_months = Number(dlg.querySelector('#opt-grant-vesting-months').value);
  const vesting_interval = dlg.querySelector('#opt-grant-interval').value;
  const expiry_date   = dlg.querySelector('#opt-grant-expiry').value || '';

  if (!grant_date || !total_shares || !vesting_months) {
    setStatus('Please fill in grant date, shares, and vesting duration.', 'warn');
    return;
  }

  const grants = [...state.optionGrants];
  if (_editingGrantId) {
    const idx = grants.findIndex(g => g.id === _editingGrantId);
    if (idx >= 0) grants[idx] = { ...grants[idx], label, grant_type, grant_date, total_shares, strike_price, vesting_start, cliff_months, vesting_months, vesting_interval, expiry_date };
  } else {
    const id = `${_editingGrantCoId}_grant_${Date.now().toString(36).slice(-6)}`;
    grants.push({ id, company_id: _editingGrantCoId, label, grant_type, grant_date, total_shares, strike_price, vesting_start, cliff_months, vesting_months, vesting_interval, expiry_date });
  }

  dlg.querySelector('#opt-grant-save-btn').disabled = true;
  try {
    setStatus('Saving grant…');
    await writeOptionGrants(grants);
    dlg.close();
    setStatus('Saved.', 'ok');
    renderOptions();
  } catch (err) {
    setStatus('Error: ' + (err.result?.error?.message || err.message || err), 'warn');
  } finally {
    dlg.querySelector('#opt-grant-save-btn').disabled = false;
  }
}

async function deleteGrant(grantId, companyId) {
  const grants = state.optionGrants.filter(g => g.id !== grantId);
  const dlg = document.getElementById('opt-grant-dialog');
  try {
    setStatus('Deleting grant…');
    await writeOptionGrants(grants);
    dlg.close();
    setStatus('Deleted.', 'ok');
    renderOptions();
  } catch (err) {
    setStatus('Error: ' + (err.result?.error?.message || err.message || err), 'warn');
  }
}

export function closeGrantDialog() {
  document.getElementById('opt-grant-dialog')?.close();
}
