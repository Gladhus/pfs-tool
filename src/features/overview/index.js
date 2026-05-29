import "./en.js";
import "./fr.js";
import Chart from 'chart.js/auto';
import { state } from '../../core/state.js';
import { lang, t, tFn, tr } from '../../core/i18n/index.js';
import { fmtMoney, fmtDelta, fmtPct } from '../../core/format.js';
import { computeDateStats, buildEffectiveBalances, buildBalanceSweep, buildXAxisTicks } from '../../utils/stats.js';
import { computeTotalEquityValue } from '../../utils/options.js';
import { getDatesForPeriod } from '../../utils/dates.js';
import { els } from '../../core/dom.js';
import { icon, categoryIcon, categoryKey } from '../../core/icons.js';

const LS_KEY_SERIES = 'pfs_ov_series_visible';
const LS_KEY_VIEW   = 'pfs_ov_view';   // 'category' | 'group'

function getView() {
  const v = localStorage.getItem(LS_KEY_VIEW);
  return v === 'category' ? 'category' : 'group';
}
function setView(v) {
  try { localStorage.setItem(LS_KEY_VIEW, v); } catch {}
}

// Palette for tag swatches (cycles)
export const TAG_PALETTE = [
  '#3b82f6', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6',
  '#06b6d4', '#ec4899', '#eab308', '#22c55e', '#6366f1',
];
function hashColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return TAG_PALETTE[Math.abs(h) % TAG_PALETTE.length];
}
export function tagColor(name) {
  return hashColor(name);
}

export function groupColor(group) {
  return group.color || hashColor(group.name);
}

// In-app, real-estate net = real_estate + real_estate_debt. We fold the
// `real_estate_debt` category into `real_estate` everywhere (donut, chart, etc.)
const REAL_ESTATE_DEBT = 'real_estate_debt';
const REAL_ESTATE      = 'real_estate';

function foldCategoryId(id) {
  return id === REAL_ESTATE_DEBT ? REAL_ESTATE : id;
}

// Returns the ordered list of effective categories (with real_estate_debt
// folded out). Each entry retains the original meta object for its name/kind.
function effectiveCategories() {
  return [...state.categoryMeta]
    .filter(c => c.id !== REAL_ESTATE_DEBT)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

function fmtDateLong(yyyymmdd) {
  const [year, month, day] = yyyymmdd.split('-');
  return new Date(+year, +month - 1, +day).toLocaleDateString(
    lang() === 'fr' ? 'fr-CA' : 'en-CA',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );
}

export function getOvFilteredDates() {
  const btn = document.querySelector('#ov-period-pills .period-btn.active');
  return getDatesForPeriod(btn?.dataset.period || 'all');
}

// Folded category totals for a single date (real_estate_debt folded in)
function foldedStatsFor(date) {
  const raw = computeDateStats(date);
  const byCategory = {};
  for (const [k, v] of Object.entries(raw.byCategory)) {
    const fk = foldCategoryId(k);
    byCategory[fk] = (byCategory[fk] || 0) + v;
  }
  return { netWorth: raw.netWorth, byCategory };
}


function accountMatchesGroup(a, group) {
  if (!Array.isArray(a.tags)) return false;
  const tags = new Set(a.tags);
  if (group.all?.length && !group.all.every(t => tags.has(t))) return false;
  if (group.any?.length && !group.any.some(t => tags.has(t))) return false;
  if (group.exclude?.length && group.exclude.some(t => tags.has(t))) return false;
  return true;
}

function groupStatsFor(date, group) {
  const balances = buildEffectiveBalances(date);
  const acctById = Object.fromEntries(state.accounts.map(a => [a.id, a]));
  let total = 0;
  for (const [id, balance_raw] of Object.entries(balances)) {
    const a = acctById[id];
    if (!a || !accountMatchesGroup(a, group)) continue;
    total += balance_raw * (a.ownership_share || 1) * (a.kind === 'debt' ? -1 : 1);
  }
  if (state.configEquityTags?.length && accountMatchesGroup({ tags: state.configEquityTags }, group))
    total += computeTotalEquityValue(date);
  return total;
}

// --- Series visibility persistence ---
function loadSeriesVisible() {
  try { return JSON.parse(localStorage.getItem(LS_KEY_SERIES)) || {}; }
  catch { return {}; }
}
function saveSeriesVisible(v) {
  try { localStorage.setItem(LS_KEY_SERIES, JSON.stringify(v)); } catch {}
}
function isSeriesVisible(key) {
  const v = loadSeriesVisible();
  return v[key] !== false; // default true
}
function setSeriesVisible(key, on) {
  const v = loadSeriesVisible();
  v[key] = on;
  saveSeriesVisible(v);
}

export function renderOverview() {
  if (!els.ovNetWorth) return;

  const ovTab = document.getElementById('tab-overview');
  ovTab?.classList.toggle('pfs-private', state.privateMode);
  if (els.privateModeBtn) {
    els.privateModeBtn.textContent = state.privateMode ? t('private_mode_off') : t('private_mode');
  }

  if (!state.datesSorted.length) {
    els.ovNetWorth.textContent = '—';
    if (els.ovDelta) els.ovDelta.textContent = '';
    els.ovAsOf.textContent = '';
    if (els.ovDonutWrap) els.ovDonutWrap.hidden = true;
    if (els.ovAllocLegend) els.ovAllocLegend.innerHTML = '';
    if (els.ovCards) {
      els.ovCards.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <span class="empty-state-icon">${icon('inbox', { size: 28 })}</span>
          <h3 class="empty-state-title">${t('empty_overview_title')}</h3>
          <p class="empty-state-body">${t('empty_overview_body')}</p>
          <button type="button" class="primary" id="ov-empty-cta">${t('empty_overview_cta')}</button>
        </div>
      `;
      document.getElementById('ov-empty-cta')?.addEventListener('click', () => {
        document.querySelector('.tab-btn[data-tab="entry"]')?.click();
      });
    }
    return;
  }

  const filteredDates = getOvFilteredDates();
  const periodBtn = document.querySelector('#ov-period-pills .period-btn.active');

  const latestDate = filteredDates.length
    ? filteredDates[filteredDates.length - 1]
    : state.datesSorted[state.datesSorted.length - 1];

  const periodRefDate = filteredDates.length > 1 ? filteredDates[0] : null;

  const activePeriod = periodBtn?.dataset.period || 'all';
  const periodLabel = t(`period_${activePeriod.toLowerCase()}`) || activePeriod;

  const current   = foldedStatsFor(latestDate);
  const periodRef = periodRefDate ? foldedStatsFor(periodRefDate) : null;

  const redact = (formatted) => state.privateMode ? '••••••' : formatted;

  els.ovNetWorth.textContent = redact(fmtMoney(current.netWorth));
  els.ovAsOf.textContent = tFn('data_as_of', fmtDateLong(latestDate));

  if (els.ovDelta) {
    els.ovDelta.innerHTML = '';
    els.ovDelta.className = 'delta';
    if (periodRef != null) {
      const d = current.netWorth - periodRef.netWorth;
      const pct = fmtPct(d, periodRef.netWorth);
      const numSpan = document.createElement('span');
      numSpan.className = 'ov-card-delta-num ' + (d >= 0 ? 'up' : 'down');
      numSpan.textContent = `${redact(fmtDelta(d))}${pct ? ` (${pct})` : ''}`;
      els.ovDelta.appendChild(numSpan);
      if (periodLabel) {
        const perSpan = document.createElement('span');
        perSpan.className = 'ov-card-delta-period';
        perSpan.textContent = periodLabel;
        els.ovDelta.appendChild(perSpan);
      }
    }
  }

  // --- Stat cards (mode-dependent) ---
  const view = getView();
  syncViewToggleUI(view);
  if (view === 'group') {
    renderGroupCards(latestDate, periodRefDate, periodLabel, redact);
  } else {
    renderCategoryCards(current, periodRef, periodLabel, redact);
  }

  // Donut: only meaningful for category view (slices must be mutually
  // exclusive to represent net worth). Hide it in group mode.
  if (view === 'category') {
    renderOverviewDonut(current);
  } else if (els.ovDonutWrap) {
    els.ovDonutWrap.hidden = true;
    if (els.ovAllocLegend) els.ovAllocLegend.innerHTML = '';
    if (state.donutChart) { state.donutChart.destroy(); state.donutChart = null; }
  }
  renderOverviewChart();
}

function syncViewToggleUI(view) {
  if (!els.ovViewToggle) return;
  els.ovViewToggle.querySelectorAll('.ov-view-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
}

function renderCategoryCards(current, periodRef, periodLabel, redact) {
  const cards = els.ovCards;
  cards.innerHTML = '';
  const cats = effectiveCategories();
  for (const cat of cats) {
    const val = current.byCategory[cat.id];
    if (val == null) continue;
    const card = document.createElement('div');
    card.className = `ov-stat-card cat-${categoryKey(cat.id)}`;

    const head = document.createElement('div');
    head.className = 'ov-card-head';
    const iconWrap = document.createElement('span');
    iconWrap.className = 'cat-icon';
    iconWrap.innerHTML = icon(categoryIcon(cat.id), { size: 14 });
    const lbl = document.createElement('div');
    lbl.className = 'ov-card-label';
    lbl.textContent = tr(cat);
    head.appendChild(iconWrap);
    head.appendChild(lbl);

    const valEl = document.createElement('div');
    valEl.className = 'ov-card-value' + (cat.kind === 'debt' ? ' negative' : '');
    valEl.textContent = redact(fmtMoney(val));

    card.appendChild(head);
    card.appendChild(valEl);

    const spark = document.createElement('canvas');
    spark.className = 'ov-card-spark';
    spark.width = 200; spark.height = 28;
    card.appendChild(spark);
    queueSparkline(spark, { kind: 'category', id: cat.id });

    if (periodRef) {
      const prev = periodRef.byCategory[cat.id] || 0;
      const d = val - prev;
      if (d !== 0) {
        const deltaEl = document.createElement('div');
        deltaEl.className = 'ov-card-delta ' + (d >= 0 ? 'up' : 'down');
        const pct = fmtPct(d, prev);
        const label = periodLabel ? ` ${periodLabel}` : '';
        deltaEl.textContent = redact(fmtDelta(d)) + (pct ? ` (${pct})` : '') + label;
        card.appendChild(deltaEl);
      }
    }
    cards.appendChild(card);
  }

  // Equity card (stock options) — injected separately since it's not an account category
  const equityVal = current.byCategory['equity'];
  if (equityVal > 0) {
    const card = document.createElement('div');
    card.className = 'ov-stat-card cat-equity';
    const head = document.createElement('div');
    head.className = 'ov-card-head';
    const iconWrap = document.createElement('span');
    iconWrap.className = 'cat-icon';
    iconWrap.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`;
    const lbl = document.createElement('div');
    lbl.className = 'ov-card-label';
    lbl.textContent = t('equity_label');
    head.appendChild(iconWrap);
    head.appendChild(lbl);
    const valEl = document.createElement('div');
    valEl.className = 'ov-card-value';
    valEl.textContent = redact(fmtMoney(equityVal));
    card.appendChild(head);
    card.appendChild(valEl);
    const spark = document.createElement('canvas');
    spark.className = 'ov-card-spark';
    spark.width = 200; spark.height = 28;
    card.appendChild(spark);
    queueSparkline(spark, { kind: 'equity' });
    if (periodRef) {
      const prev = periodRef.byCategory['equity'] || 0;
      const d = equityVal - prev;
      if (d !== 0) {
        const deltaEl = document.createElement('div');
        deltaEl.className = 'ov-card-delta ' + (d >= 0 ? 'up' : 'down');
        const pct = fmtPct(d, prev);
        const label = periodLabel ? ` ${periodLabel}` : '';
        deltaEl.textContent = redact(fmtDelta(d)) + (pct ? ` (${pct})` : '') + label;
        card.appendChild(deltaEl);
      }
    }
    cards.appendChild(card);
  }
}

function renderGroupCards(latestDate, periodRefDate, periodLabel, redact) {
  const cards = els.ovCards;
  cards.innerHTML = '';
  const groups = state.groupsCatalog || [];

  if (!groups.length) {
    cards.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <span class="empty-state-icon">${icon('inbox', { size: 26 })}</span>
        <h3 class="empty-state-title">${t('no_groups_title')}</h3>
        <p class="empty-state-body">${t('no_groups_body')}</p>
        <button type="button" class="primary" id="ov-empty-groups-cta">${t('manage_groups')}</button>
      </div>
    `;
    document.getElementById('ov-empty-groups-cta')?.addEventListener('click', () => {
      document.querySelector('.tab-btn[data-tab="settings"]')?.click();
      setTimeout(() => document.querySelector('.subtab-btn[data-subtab="groups"]')?.click(), 50);
    });
    return;
  }

  for (const group of groups) {
    const val = groupStatsFor(latestDate, group);
    const color = groupColor(group);
    const card = document.createElement('div');
    card.className = 'ov-stat-card ov-group-card';
    card.style.setProperty('--group-color', color);

    const head = document.createElement('div');
    head.className = 'ov-card-head';
    const dot = document.createElement('span');
    dot.className = 'group-stat-dot';
    const lbl = document.createElement('div');
    lbl.className = 'ov-card-label';
    lbl.textContent = group.name;
    head.appendChild(dot);
    head.appendChild(lbl);

    const valEl = document.createElement('div');
    valEl.className = 'ov-card-value' + (val < 0 ? ' negative' : '');
    valEl.textContent = redact(fmtMoney(val));

    card.appendChild(head);
    card.appendChild(valEl);

    const spark = document.createElement('canvas');
    spark.className = 'ov-card-spark';
    spark.width = 200; spark.height = 28;
    card.appendChild(spark);
    queueSparkline(spark, { kind: 'group', group });

    if (periodRefDate) {
      const prev = groupStatsFor(periodRefDate, group);
      const d = val - prev;
      if (d !== 0) {
        const deltaEl = document.createElement('div');
        deltaEl.className = 'ov-card-delta';
        const pct = fmtPct(d, prev);
        const numSpan = document.createElement('span');
        numSpan.className = 'ov-card-delta-num ' + (d >= 0 ? 'up' : 'down');
        numSpan.textContent = redact(fmtDelta(d)) + (pct ? ` (${pct})` : '');
        deltaEl.appendChild(numSpan);
        if (periodLabel) {
          const perSpan = document.createElement('span');
          perSpan.className = 'ov-card-delta-period';
          perSpan.textContent = periodLabel;
          deltaEl.appendChild(perSpan);
        }
        card.appendChild(deltaEl);
      }
    }
    cards.appendChild(card);
  }
}

// --- Donut: asset allocation at the latest date ---
function renderOverviewDonut(current) {
  const canvas = els.ovDonutCanvas;
  const legend = els.ovAllocLegend;
  if (!canvas || !legend) return;

  // Only positive-net buckets (assets). Debts excluded.
  const cats = effectiveCategories();
  const entries = [];
  for (const cat of cats) {
    const v = current.byCategory[cat.id];
    if (v == null || v <= 0) continue;
    entries.push({ id: cat.id, label: tr(cat), value: v });
  }

  if (!entries.length) {
    els.ovDonutWrap.hidden = true;
    legend.innerHTML = '';
    if (state.donutChart) { state.donutChart.destroy(); state.donutChart = null; }
    return;
  }
  els.ovDonutWrap.hidden = false;

  // Equity slice
  const equityVal = current.byCategory['equity'];
  if (equityVal > 0) entries.push({ id: 'equity', label: t('equity_label'), value: equityVal });

  const cs = getComputedStyle(document.documentElement);
  const colorFor = (id) => {
    if (id === 'equity') return cs.getPropertyValue('--cat-equity').trim() || '#06b6d4';
    const key = categoryKey(id);
    return cs.getPropertyValue('--cat-' + key).trim() || cs.getPropertyValue('--accent').trim();
  };
  const surfaceBg = cs.getPropertyValue('--surface').trim() || '#fff';
  const total = entries.reduce((s, e) => s + e.value, 0);

  // Legend (always rebuild — small DOM)
  legend.innerHTML = '';
  for (const e of entries) {
    const row = document.createElement('div');
    row.className = 'ov-legend-row';
    const pct = total ? Math.round((e.value / total) * 100) : 0;
    row.innerHTML = `
      <span class="ov-legend-dot" style="background:${colorFor(e.id)}"></span>
      <span class="ov-legend-name">${escapeHtml(e.label)}</span>
      <span class="ov-legend-pct">${pct}%</span>
    `;
    legend.appendChild(row);
  }

  const data = {
    labels: entries.map(e => e.label),
    datasets: [{
      data: entries.map(e => e.value),
      backgroundColor: entries.map(e => colorFor(e.id)),
      borderColor: surfaceBg,
      borderWidth: 2,
      hoverOffset: 6,
    }],
  };

  if (state.donutChart) {
    state.donutChart.data = data;
    state.donutChart.update();
    return;
  }

  state.donutChart = new Chart(canvas, {
    type: 'doughnut',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a', titleColor: '#94a3b8', bodyColor: '#f1f5f9',
          padding: 10, cornerRadius: 8,
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed;
              const pct = total ? ((v / total) * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${state.privateMode ? '••••••' : fmtMoney(v)} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

// --- Main chart: net worth + per-category OR per-tag lines, with toggles ---
export function renderOverviewChart() {
  const canvas = els.ovChartCanvas;
  if (!canvas) return;

  const view = getView();
  const dates = getOvFilteredDates();
  if (!dates.length) return;
  const dateIdx = new Map(dates.map((d, i) => [d, i]));
  const acctById = Object.fromEntries(state.accounts.map(a => [a.id, a]));

  // Net worth + (categories OR groups), depending on view
  const cats = effectiveCategories();
  const groups = view === 'group' ? (state.groupsCatalog || []) : [];
  const buckets = view === 'group'
    ? groups.map(g => ({ key: 'group:' + g.name, label: g.name, color: groupColor(g), match: a => accountMatchesGroup(a, g) }))
    : cats.map(c => ({ key: c.id, label: tr(c), color: null /* filled below */, match: a => foldCategoryId(a.category) === c.id, catId: c.id }));

  // Equity (stock options) has no account/snapshot — add as its own bucket in category view
  let equityBucketIdx = -1;
  if (view === 'category' && state.optionCompanies?.length) {
    equityBucketIdx = buckets.length;
    buckets.push({ key: 'equity', label: t('equity_label'), color: null, catId: 'equity', match: () => false });
  }

  const seriesArr = buckets.map(() => new Array(dates.length).fill(0));
  const net = new Array(dates.length).fill(0);
  const hasAny = new Array(dates.length).fill(false);
  const bucketFirstSeen = new Array(buckets.length).fill(-1);

  const sweep = buildBalanceSweep(dates);
  for (let i = 0; i < dates.length; i++) {
    const balances = sweep[i];
    let dayHasAny = false;
    for (const [acctId, balance_raw] of Object.entries(balances)) {
      const a = acctById[acctId];
      if (!a) continue;
      dayHasAny = true;
      const signed = balance_raw * (a.ownership_share || 1) * (a.kind === 'debt' ? -1 : 1);
      net[i] += signed;
      for (let b = 0; b < buckets.length; b++) {
        if (buckets[b].match(a)) {
          seriesArr[b][i] += signed;
          if (bucketFirstSeen[b] === -1) bucketFirstSeen[b] = i;
        }
      }
    }
    const equity = computeTotalEquityValue(dates[i]);
    if (equity) {
      net[i] += equity;
      dayHasAny = true;
      if (equityBucketIdx >= 0) {
        seriesArr[equityBucketIdx][i] += equity;
        if (bucketFirstSeen[equityBucketIdx] === -1) bucketFirstSeen[equityBucketIdx] = i;
      }
      if (view === 'group' && state.configEquityTags?.length) {
        const vEquity = { tags: state.configEquityTags };
        for (let b = 0; b < buckets.length; b++) {
          if (buckets[b].match(vEquity)) {
            seriesArr[b][i] += equity;
            if (bucketFirstSeen[b] === -1) bucketFirstSeen[b] = i;
          }
        }
      }
    }
    hasAny[i] = dayHasAny;
  }
  const netData = net.map((v, i) => hasAny[i] ? v : null);
  const bucketData = seriesArr.map((arr, b) =>
    arr.map((v, i) => (!hasAny[i] || i < bucketFirstSeen[b]) ? null : v)
  );

  // Trim x-axis: skip leading dates where no visible series has data yet
  let trimStart = 0;
  {
    const candidates = [];
    if (isSeriesVisible('net')) candidates.push(netData);
    for (let b = 0; b < buckets.length; b++) {
      if (isSeriesVisible(buckets[b].key)) candidates.push(bucketData[b]);
    }
    if (candidates.length) {
      const firstIndices = candidates.map(arr => arr.findIndex(v => v !== null)).filter(i => i >= 0);
      if (firstIndices.length) trimStart = Math.min(...firstIndices);
    }
  }
  const chartDates = trimStart ? dates.slice(trimStart) : dates;
  const trimmedNetData = trimStart ? netData.slice(trimStart) : netData;
  const trimmedBucketData = trimStart ? bucketData.map(arr => arr.slice(trimStart)) : bucketData;

  const ctx = canvas.getContext('2d');
  const h = canvas.parentElement?.offsetHeight || 280;
  const cs = getComputedStyle(document.documentElement);
  const catColor = (id) => {
    const key = categoryKey(id);
    return cs.getPropertyValue('--cat-' + key).trim() || cs.getPropertyValue('--accent').trim();
  };
  const netColor = cs.getPropertyValue('--accent').trim() || '#10b981';
  const muted    = cs.getPropertyValue('--subtle').trim() || '#94a3b8';
  const gridCol  = cs.getPropertyValue('--border').trim() || 'rgba(15,23,42,.06)';

  // Fill in colors for category buckets now (depends on cs)
  for (const b of buckets) if (!b.color) b.color = catColor(b.catId);

  const netGrad = ctx.createLinearGradient(0, 0, 0, h);
  netGrad.addColorStop(0, hexToRgba(netColor, 0.22));
  netGrad.addColorStop(1, hexToRgba(netColor, 0));

  const datasets = [];
  if (isSeriesVisible('net')) {
    datasets.push({
      label: t('net_worth_chart'),
      data: trimmedNetData,
      borderColor: netColor,
      backgroundColor: netGrad,
      borderWidth: 2.5,
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: netColor,
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 2,
      spanGaps: true,
      order: 0,
    });
  }
  for (let b = 0; b < buckets.length; b++) {
    const data = trimmedBucketData[b];
    if (!data.some(v => v !== null && v !== 0)) continue;
    if (!isSeriesVisible(buckets[b].key)) continue;
    const col = buckets[b].color;
    datasets.push({
      label: buckets[b].label,
      data,
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

  const tickCallback = (v) => {
    if (state.privateMode) return '••••';
    const abs = Math.abs(v);
    if (abs >= 1000000) return (v / 1000000).toFixed(1) + 'M';
    if (abs >= 1000) return (v / 1000).toFixed(0) + 'k';
    return v;
  };

  const locale = lang() === 'fr' ? 'fr-CA' : 'en-CA';
  const { tickSet: xTickSet, xFmt } = buildXAxisTicks(chartDates, canvas.parentElement?.offsetWidth || 600, locale);

  if (state.overviewChart) {
    state.overviewChart.destroy();
    state.overviewChart = null;
  }
  state.overviewChart = new Chart(canvas, {
    type: 'line',
    data: { labels: chartDates, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a', titleColor: '#94a3b8', bodyColor: '#f1f5f9',
          padding: 12, cornerRadius: 10, titleFont: { size: 11 },
          bodyFont: { size: 13, weight: '600', family: "'Inter', sans-serif" },
          callbacks: { label: (c) => `  ${c.dataset.label}: ${state.privateMode ? '••••••' : fmtMoney(c.parsed.y)}` },
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
            color: muted, font: { size: 11 }, maxRotation: 0,
            autoSkip: false,
            callback: (_, idx) => {
              if (!xTickSet.has(idx)) return null;
              return xFmt(new Date(chartDates[idx] + 'T12:00:00'));
            },
          },
        },
      },
    },
  });

  renderSeriesToggles();
}

// Return the set of effective category ids that have at least one non-zero
// account-level snapshot. Used to suppress empty-data toggle pills.
function categoriesWithData() {
  const acctById = Object.fromEntries(state.accounts.map(a => [a.id, a]));
  const have = new Set();
  for (const s of state.snapshots) {
    if (s.account_id === '__day__') continue;
    if (!s.balance_raw) continue;
    const a = acctById[s.account_id];
    if (!a) continue;
    have.add(foldCategoryId(a.category));
  }
  return have;
}

function renderSeriesToggles() {
  const wrap = els.ovSeriesToggles;
  if (!wrap) return;
  const view = getView();
  wrap.innerHTML = '';

  const mkToggle = (key, label, color) => {
    const lbl = document.createElement('label');
    lbl.className = 'series-chip';
    lbl.style.setProperty('--chip-color', color);
    lbl.innerHTML = `
      <input type="checkbox" ${isSeriesVisible(key) ? 'checked' : ''}>
      <span class="cat-dot" style="background:${color}"></span>
      <span>${escapeHtml(label)}</span>
    `;
    const cb = lbl.querySelector('input');
    cb.addEventListener('change', () => {
      setSeriesVisible(key, cb.checked);
      renderOverviewChart();
    });
    return lbl;
  };

  const cs = getComputedStyle(document.documentElement);
  const netColor = cs.getPropertyValue('--accent').trim() || '#10b981';

  if (view === 'group') {
    const groups = state.groupsCatalog || [];
    if (groups.length) wrap.appendChild(mkToggle('net', t('net_worth_chart'), netColor));
    for (const g of groups) {
      wrap.appendChild(mkToggle('group:' + g.name, g.name, groupColor(g)));
    }
  } else {
    const populated = categoriesWithData();
    if (populated.size) wrap.appendChild(mkToggle('net', t('net_worth_chart'), netColor));
    for (const cat of effectiveCategories()) {
      if (!populated.has(cat.id)) continue;
      const color = cs.getPropertyValue('--cat-' + categoryKey(cat.id)).trim() || netColor;
      wrap.appendChild(mkToggle(cat.id, tr(cat), color));
    }
    if (state.optionCompanies?.length && state.optionFmv?.length) {
      const equityColor = cs.getPropertyValue('--cat-equity').trim() || '#06b6d4';
      wrap.appendChild(mkToggle('equity', t('equity_label'), equityColor));
    }
  }
}

// --- Sparklines ---
function queueSparkline(canvas, spec) {
  // Back-compat: a bare string means a category id
  const s = typeof spec === 'string' ? { kind: 'category', id: spec } : spec;
  requestAnimationFrame(() => drawSpark(canvas, s));
}

function drawSpark(canvas, spec) {
  const dates = state.datesSorted.slice(-24);
  if (dates.length < 2) return;
  const acctById = Object.fromEntries(state.accounts.map(a => [a.id, a]));

  let series;
  if (spec.kind === 'equity') {
    series = dates.map(d => computeTotalEquityValue(d));
  } else {
    const matches = (a) => {
      if (spec.kind === 'group') return accountMatchesGroup(a, spec.group);
      return foldCategoryId(a.category) === spec.id;
    };
    const sweep = buildBalanceSweep(dates);
    series = sweep.map(balances => {
      let total = 0;
      for (const [id, balance_raw] of Object.entries(balances)) {
        const a = acctById[id];
        if (!a || !matches(a)) continue;
        total += balance_raw * (a.ownership_share || 1) * (a.kind === 'debt' ? -1 : 1);
      }
      return total;
    });
  }

  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;

  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || canvas.width;
  const cssH = canvas.clientHeight || canvas.height;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  const cs = getComputedStyle(canvas);
  const stroke = cs.color || '#94a3b8';

  const stepX = cssW / (series.length - 1);
  const pad = 2;
  const usableH = cssH - pad * 2;
  ctx.beginPath();
  series.forEach((v, i) => {
    const x = i * stepX;
    const y = pad + usableH - ((v - min) / span) * usableH;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  const last = series[series.length - 1];
  const lx = (series.length - 1) * stepX;
  const ly = pad + usableH - ((last - min) / span) * usableH;
  ctx.beginPath();
  ctx.arc(lx, ly, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = stroke;
  ctx.fill();
}

function hexToRgba(hex, a) {
  const m = hex.trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return hex;
  let h = m[1];
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
