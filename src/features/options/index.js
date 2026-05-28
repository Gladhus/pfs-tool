import './en.js';
import './fr.js';
import Chart from 'chart.js/auto';
import { state } from '../../core/state.js';
import { t, lang } from '../../core/i18n/index.js';
import { fmtMoney, fmtPct } from '../../core/format.js';
import { setStatus } from '../../core/dom.js';
import {
  computeVestedShares, computeUnvestedShares,
  computeIntrinsicValue, computeUnvestedValue,
  getEffectiveFmv, computeCompanyEquityValue, computeCompanyUnvestedValue,
  computeTotalEquityValue, computeTotalUnvestedValue,
  grantFullyVestedDate, grantFirstVestDate, generateMonthlyDates,
} from '../../utils/options.js';
import {
  writeOptionCompanies, writeOptionGrants, addOptionFmvEntry,
} from '../../api/options.js';

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

// --- Main render ---

export function renderOptions() {
  const panel = document.getElementById('tab-options');
  if (!panel) return;

  const now = today();
  const companies = state.optionCompanies.filter(c => c.active !== false);
  const totalVested   = computeTotalEquityValue(now);
  const totalUnvested = computeTotalUnvestedValue(now);

  const vestedEl   = document.getElementById('opt-vested-value');
  const unvestedEl = document.getElementById('opt-unvested-value');
  if (vestedEl)   vestedEl.textContent   = fmtMoney(totalVested);
  if (unvestedEl) unvestedEl.textContent = fmtMoney(totalUnvested);

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
  const canvas = document.getElementById('opt-summary-canvas');
  const card   = document.getElementById('opt-summary-card');
  if (!canvas || !card) return;

  const companies = state.optionCompanies.filter(c => c.active !== false);
  const allFmvDates = state.optionFmv.map(f => f.date).sort();

  if (!companies.length || !allFmvDates.length) {
    card.hidden = true;
    if (state.optionSummaryChart) { state.optionSummaryChart.destroy(); state.optionSummaryChart = null; }
    return;
  }
  card.hidden = false;

  const startDate = allFmvDates[0];
  const dates = generateMonthlyDates(startDate, now);
  if (dates.length < 2) return;

  const cs = getComputedStyle(document.documentElement);
  const muted   = cs.getPropertyValue('--subtle').trim() || '#94a3b8';
  const gridCol = cs.getPropertyValue('--border').trim() || 'rgba(15,23,42,.06)';
  const locale  = lang() === 'fr' ? 'fr-CA' : 'en-CA';

  // Build cumulative datasets (one per company, stacked)
  const companyValues = companies.map(c =>
    dates.map(d => computeCompanyEquityValue(c.id, d))
  );

  const datasets = companies.map((company, ci) => {
    const color = COMPANY_COLORS[ci % COMPANY_COLORS.length];
    // cumulative: sum of this company and all previous
    const cumData = dates.map((_, di) =>
      companyValues.slice(0, ci + 1).reduce((s, arr) => s + arr[di], 0)
    );
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
      spanGaps: true,
    };
  });

  const tickCallback = v => {
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return (v/1_000_000).toFixed(1)+'M';
    if (abs >= 1_000)     return (v/1_000).toFixed(0)+'k';
    return v;
  };

  // x-axis ticks: one per year
  const years = new Set(dates.map(d => d.slice(0,4)));
  const yearTicks = new Set();
  dates.forEach((d, i) => { if (!yearTicks.size || d.slice(0,4) !== dates[i-1]?.slice(0,4)) yearTicks.add(i); });

  if (state.optionSummaryChart) { state.optionSummaryChart.destroy(); state.optionSummaryChart = null; }
  state.optionSummaryChart = new Chart(canvas, {
    type: 'line',
    data: { labels: dates, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a', titleColor: '#94a3b8', bodyColor: '#f1f5f9',
          padding: 12, cornerRadius: 10,
          callbacks: { label: ctx => `  ${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y)}` },
        },
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
  const grants     = state.optionGrants.filter(g => g.company_id === company.id);
  const fmvEntry   = getEffectiveFmv(company.id, now);
  const fmv        = fmvEntry?.fmv ?? null;
  const vestedVal  = fmv !== null ? grants.reduce((s,g) => s + computeIntrinsicValue(g, fmv, now), 0) : null;
  const unvestedVal = fmv !== null ? grants.reduce((s,g) => s + computeUnvestedValue(g, fmv, now), 0) : null;
  const color      = COMPANY_COLORS[ci % COMPANY_COLORS.length];

  const card = document.createElement('div');
  card.className = 'opt-company-card';
  card.style.setProperty('--opt-color', color);

  // Header
  const header = document.createElement('div');
  header.className = 'opt-card-header';
  header.innerHTML = `
    <div class="opt-card-title">
      <span class="opt-company-dot"></span>
      <strong>${escapeHtml(company.name)}</strong>
      ${company.ticker ? `<span class="opt-ticker">${escapeHtml(company.ticker)}</span>` : ''}
    </div>
    <div class="opt-card-meta">
      ${fmv !== null
        ? `<span class="opt-fmv-display">${t('opt_last_fmv')} ${fmtMoney(fmv)}</span><span class="opt-fmv-date">${fmtShortDate(fmvEntry.date)}</span>`
        : `<span class="opt-no-fmv hint">${t('opt_no_fmv')}</span>`}
    </div>
    <div class="opt-card-values">
      ${vestedVal !== null ? `<span class="opt-vested-val">${fmtMoney(vestedVal)} <span class="opt-val-label">${t('opt_vested_label')}</span></span>` : ''}
      ${unvestedVal !== null ? `<span class="opt-unvested-val">${fmtMoney(unvestedVal)} <span class="opt-val-label">${t('opt_unvested_label')}</span></span>` : ''}
    </div>
    <div class="opt-card-actions">
      <button type="button" class="link-btn opt-edit-company-btn">${t('opt_edit_company')}</button>
      <button type="button" class="link-btn opt-add-grant-btn">${t('opt_add_grant')}</button>
    </div>`;
  card.appendChild(header);

  // FMV log row
  const fmvRow = document.createElement('div');
  fmvRow.className = 'opt-fmv-row';
  const todayStr = now;
  fmvRow.innerHTML = `
    <label class="opt-fmv-label">${t('opt_log_fmv')}</label>
    <input type="date" class="opt-fmv-date-input" value="${todayStr}">
    <input type="number" class="opt-fmv-input" placeholder="${escapeHtml(t('opt_fmv_placeholder'))}" step="0.01" min="0">
    <input type="text" class="opt-fmv-note-input" placeholder="${escapeHtml(t('opt_note_placeholder'))}">
    <button type="button" class="opt-fmv-save-btn primary">${t('opt_log_fmv')}</button>`;
  card.appendChild(fmvRow);

  // Vesting chart
  if (grants.length) {
    const chartWrap = document.createElement('div');
    chartWrap.className = 'opt-chart-wrap';
    const canvas = document.createElement('canvas');
    canvas.className = 'opt-company-canvas';
    chartWrap.appendChild(canvas);
    card.appendChild(chartWrap);
    requestAnimationFrame(() => renderCompanyVestingChart(canvas, company, grants, fmv, now));
  }

  // Grants list
  const grantsList = document.createElement('div');
  grantsList.className = 'opt-grants-list';
  if (grants.length) {
    grants.forEach((grant, gi) => {
      const gColor = GRANT_COLORS[gi % GRANT_COLORS.length];
      const vested    = computeVestedShares(grant, now);
      const total     = Number(grant.total_shares) || 0;
      const pct       = total ? Math.min(100, (vested / total) * 100) : 0;
      const vestVal   = fmv !== null ? computeIntrinsicValue(grant, fmv, now) : null;
      const fullyVested = vested >= total;
      const firstVest = grantFirstVestDate(grant);
      const cliffPending = !fullyVested && firstVest && firstVest > now;
      const cliffMonths  = cliffPending ? Math.ceil(
        (new Date(firstVest+'T12:00:00') - new Date(now+'T12:00:00')) / (1000*60*60*24*30.44)
      ) : 0;

      const row = document.createElement('div');
      row.className = 'opt-grant-row';
      row.innerHTML = `
        <div class="opt-grant-header">
          <span class="opt-grant-dot" style="background:${gColor}"></span>
          <span class="opt-grant-name">${escapeHtml(grant.label || grant.grant_type || 'Grant')}</span>
          <span class="opt-grant-type-badge">${escapeHtml(grant.grant_type || '')}</span>
          <button type="button" class="link-btn opt-edit-grant-btn" data-grant-id="${escapeHtml(grant.id)}" data-company-id="${escapeHtml(company.id)}">Edit</button>
        </div>
        <div class="opt-grant-progress-wrap">
          <div class="opt-grant-progress-bar">
            <div class="opt-grant-progress-fill" style="width:${pct.toFixed(1)}%;background:${gColor}"></div>
          </div>
          <span class="opt-grant-pct">${Math.round(pct)}%</span>
        </div>
        <div class="opt-grant-meta">
          <span>${fullyVested ? t('opt_fully_vested') : cliffPending ? t('opt_cliff_pending').replace('{months}', cliffMonths) : `${Math.round(vested).toLocaleString()} / ${total.toLocaleString()} ${t('opt_vested_label')}`}</span>
          ${vestVal !== null ? `<span class="opt-grant-value">${fmtMoney(vestVal)}</span>` : ''}
        </div>`;
      grantsList.appendChild(row);
    });
  } else {
    grantsList.innerHTML = `<p class="hint" style="margin:.5rem 0">${t('opt_no_grants')}</p>`;
  }
  card.appendChild(grantsList);

  // Wire up buttons
  header.querySelector('.opt-edit-company-btn').addEventListener('click', () => openCompanyDialog(company.id));
  header.querySelector('.opt-add-grant-btn').addEventListener('click', () => openGrantDialog(null, company.id));
  grantsList.querySelectorAll('.opt-edit-grant-btn').forEach(btn => {
    btn.addEventListener('click', () => openGrantDialog(btn.dataset.grantId, btn.dataset.companyId));
  });
  fmvRow.querySelector('.opt-fmv-save-btn').addEventListener('click', () => saveFmvEntry(company.id, fmvRow));

  return card;
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

  const tickCallback = v => {
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return (v/1_000_000).toFixed(1)+'M';
    if (abs >= 1_000)     return (v/1_000).toFixed(0)+'k';
    return Math.round(v);
  };

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
            label: ctx => `  ${ctx.dataset.label}: ${Math.round(ctx.parsed.y).toLocaleString()} shares`,
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

// --- FMV save ---

async function saveFmvEntry(companyId, fmvRow) {
  const dateInput = fmvRow.querySelector('.opt-fmv-date-input');
  const amtInput  = fmvRow.querySelector('.opt-fmv-input');
  const noteInput = fmvRow.querySelector('.opt-fmv-note-input');
  const btn       = fmvRow.querySelector('.opt-fmv-save-btn');

  const date = dateInput.value.trim();
  const fmv  = parseFloat(amtInput.value);
  if (!date || !Number.isFinite(fmv) || fmv < 0) {
    amtInput.focus();
    return;
  }

  btn.disabled = true;
  try {
    setStatus('Saving FMV…');
    await addOptionFmvEntry({ date, company_id: companyId, fmv, note: noteInput.value.trim() });
    amtInput.value = '';
    noteInput.value = '';
    setStatus('FMV saved.', 'ok');
    renderOptions();
  } catch (err) {
    setStatus('Error saving FMV: ' + (err.result?.error?.message || err.message || err), 'warn');
  } finally {
    btn.disabled = false;
  }
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
