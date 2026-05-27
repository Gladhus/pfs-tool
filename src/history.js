import Chart from 'chart.js/auto';
import { state } from './state.js';
import { t, tFn, tr } from './i18n.js';
import { fmtMoney, fmtDelta, fmtPct } from './format.js';
import { getDatesForPeriod, buildBalanceSweep, activeAccounts } from './utils.js';
import { els } from './dom.js';
import { icon } from './icons.js';

export function getHistFilteredDates() {
  const btn = document.querySelector('#hist-period-pills .period-btn.active');
  return getDatesForPeriod(btn?.dataset.period || 'all');
}

export function computeSeries(filteredDates) {
  const dates = filteredDates || state.datesSorted;
  if (!dates.length) return { dates: [], net: [], investments: [], realEstateNet: [] };
  const acctById = Object.fromEntries(state.accounts.map(a => [a.id, a]));
  const sweep = buildBalanceSweep(dates);
  const outDates = [], net = [], investments = [], realEstateNet = [];
  for (let i = 0; i < dates.length; i++) {
    const balances = sweep[i];
    if (!Object.keys(balances).length) continue;
    let n = 0, inv = 0, re = 0, red = 0;
    for (const [id, balance_raw] of Object.entries(balances)) {
      const a = acctById[id];
      if (!a) continue;
      const signed = balance_raw * (a.ownership_share || 1) * (a.kind === 'debt' ? -1 : 1);
      n += signed;
      if (a.category === 'investments') inv += signed;
      else if (a.category === 'real_estate') re += signed;
      else if (a.category === 'real_estate_debt') red += signed;
    }
    outDates.push(dates[i]);
    net.push(n);
    investments.push(inv);
    realEstateNet.push(re + red);
  }
  return { dates: outDates, net, investments, realEstateNet };
}

export function populateHistAccountSelect() {
  const sel = els.histAccountSelect;
  if (!sel || !state.accounts.length) return;
  const currentVal = sel.value;
  sel.innerHTML = '';
  const ovOpt = document.createElement('option');
  ovOpt.value = '';
  ovOpt.textContent = t('overview_option');
  sel.appendChild(ovOpt);
  const catOrder = Object.fromEntries(state.categoryMeta.map(c => [c.id, c.sort_order || 0]));
  const sorted = [...state.accounts].filter(a => a.active).sort((a, b) => {
    const co = (catOrder[a.category] || 99) - (catOrder[b.category] || 99);
    return co !== 0 ? co : (a.sort_order || 0) - (b.sort_order || 0);
  });
  const byCat = {};
  for (const a of sorted) (byCat[a.category] ||= []).push(a);
  for (const cat of state.categoryMeta.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))) {
    const accts = byCat[cat.id];
    if (!accts?.length) continue;
    const og = document.createElement('optgroup');
    og.label = tr(cat);
    for (const a of accts) {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = tr(a);
      og.appendChild(opt);
    }
    sel.appendChild(og);
  }
  if (currentVal && [...sel.options].some(o => o.value === currentVal)) sel.value = currentVal;
}

function fmtMonthHeading(yyyymm) {
  const [y, m] = yyyymm.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString(
    document.documentElement.lang === 'fr' ? 'fr-CA' : 'en-CA',
    { year: 'numeric', month: 'long' }
  );
}

export function renderHistoryTable() {
  if (!state.datesSorted.length) {
    els.historySection.hidden = false;
    els.historySummary.textContent = '';
    els.historyCards.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">${icon('database', { size: 26 })}</span>
        <h3 class="empty-state-title">${t('empty_history_title')}</h3>
        <p class="empty-state-body">${t('empty_history_body')}</p>
      </div>`;
    return;
  }

  const acctById = Object.fromEntries(state.accounts.map(a => [a.id, a]));
  const allDates = state.datesSorted;

  // Carry-forward balances for every known date
  const sweep = buildBalanceSweep(allDates);

  // Track which accounts have exact data on each date (for incomplete flag)
  const exactByDate = new Map();
  for (const s of state.snapshots) {
    if (s.account_id === '__day__') continue;
    if (!exactByDate.has(s.date)) exactByDate.set(s.date, new Set());
    exactByDate.get(s.date).add(s.account_id);
  }
  const activeIds = new Set(activeAccounts().map(a => a.id));

  // Build per-date aggregates using carry-forward balances
  const byDate = new Map();
  for (let i = 0; i < allDates.length; i++) {
    const date = allDates[i];
    const balances = sweep[i];
    if (!Object.keys(balances).length) continue;
    const m = { investments: 0, realEstate: 0, realEstateDebts: 0, debts: 0, net: 0, incomplete: false };
    for (const [id, balance_raw] of Object.entries(balances)) {
      const a = acctById[id];
      if (!a) continue;
      const signed = balance_raw * (a.ownership_share || 1) * (a.kind === 'debt' ? -1 : 1);
      m.net += signed;
      if (a.kind === 'debt') m.debts += signed;
      if (a.category === 'investments') m.investments += signed;
      else if (a.category === 'real_estate') m.realEstate += signed;
      else if (a.category === 'real_estate_debt') m.realEstateDebts += signed;
    }
    const exact = exactByDate.get(date) || new Set();
    m.incomplete = [...activeIds].some(id => !exact.has(id));
    byDate.set(date, m);
  }
  els.historySection.hidden = false;
  const dateDates = [...byDate.keys()].sort();
  els.historySummary.textContent = tFn('history_summary', dateDates.length, dateDates[0], dateDates[dateDates.length - 1]);

  // Group dates by YYYY-MM, months descending, days within month descending
  const byMonth = new Map();
  for (const d of dateDates) {
    const mo = d.slice(0, 7);
    if (!byMonth.has(mo)) byMonth.set(mo, []);
    byMonth.get(mo).push(d);
  }
  const monthsDesc = [...byMonth.keys()].sort().reverse();

  const container = els.historyCards;
  container.innerHTML = '';

  for (const mo of monthsDesc) {
    const datesInMonth = byMonth.get(mo).slice().reverse(); // newest first
    const latestDate = datesInMonth[0];
    const latest = byDate.get(latestDate);
    const reNet = latest.realEstate + latest.realEstateDebts;

    // Delta for the latest entry vs the chronologically previous entry overall
    const prevIdx = dateDates.indexOf(latestDate) - 1;
    const prevDateKey = prevIdx >= 0 ? dateDates[prevIdx] : null;
    const delta = prevDateKey ? latest.net - byDate.get(prevDateKey).net : null;

    // ── Card ──────────────────────────────────────────────
    const card = document.createElement('div');
    card.className = 'hist-card';
    if (latestDate === state.currentDate) card.classList.add('current');

    // Card main row (clickable → entry for latest date)
    const main = document.createElement('div');
    main.className = 'hist-card-main';
    main.dataset.date = latestDate;

    const left = document.createElement('div');
    left.className = 'hist-card-left';

    const moLabel = document.createElement('div');
    moLabel.className = 'hist-card-month';
    moLabel.textContent = fmtMonthHeading(mo);

    const dateLabel = document.createElement('div');
    dateLabel.className = 'hist-card-date';
    dateLabel.textContent = latestDate;
    if (latest?.incomplete) {
      const warn = document.createElement('span');
      warn.className = 'hist-incomplete-icon';
      warn.dataset.tooltip = t('incomplete_data');
      warn.innerHTML = icon('alert', { size: 14 });
      dateLabel.appendChild(warn);
    }

    left.appendChild(moLabel);
    left.appendChild(dateLabel);

    const right = document.createElement('div');
    right.className = 'hist-card-right';

    const netEl = document.createElement('div');
    netEl.className = 'hist-card-net';
    netEl.textContent = fmtMoney(latest.net);

    const deltaEl = document.createElement('div');
    deltaEl.className = 'hist-card-delta';
    if (delta !== null) {
      const pct = fmtPct(delta, byDate.get(prevDateKey).net);
      deltaEl.textContent = fmtDelta(delta) + (pct ? ` (${pct})` : '');
      deltaEl.classList.add(delta >= 0 ? 'up' : 'down');
    }

    right.appendChild(netEl);
    right.appendChild(deltaEl);

    main.appendChild(left);
    main.appendChild(right);

    // Sub-stats row
    const stats = document.createElement('div');
    stats.className = 'hist-card-stats';

    const mkStat = (label, val, catKey) => {
      const el = document.createElement('span');
      el.className = 'hist-stat cat-' + catKey;
      el.innerHTML = `<span class="cat-dot"></span><span class="hist-stat-label">${label}</span> ${fmtMoney(val)}`;
      return el;
    };
    stats.appendChild(mkStat(t('investments'),     latest.investments, 'investments'));
    stats.appendChild(mkStat(t('real_estate_net'), reNet,              'real-estate'));
    stats.appendChild(mkStat(t('debts'),           latest.debts,       'debts'));

    card.appendChild(main);
    card.appendChild(stats);

    // ── Earlier entries (collapsible) ─────────────────────
    const olderDates = datesInMonth.slice(1);
    if (olderDates.length) {
      const expandBtn = document.createElement('button');
      expandBtn.className = 'hist-expand-btn';
      expandBtn.type = 'button';
      expandBtn.textContent = `▾ ${olderDates.length} earlier`;

      const olderList = document.createElement('div');
      olderList.className = 'hist-older-list';
      olderList.hidden = true;

      for (const date of olderDates) {
        const d = byDate.get(date);
        const prevI = dateDates.indexOf(date) - 1;
        const prevK = prevI >= 0 ? dateDates[prevI] : null;
        const dDelta = prevK ? d.net - byDate.get(prevK).net : null;

        const row = document.createElement('div');
        row.className = 'hist-older-row';
        row.dataset.date = date;
        if (date === state.currentDate) row.classList.add('current');

        const rDate = document.createElement('span');
        rDate.className = 'hist-older-date';
        rDate.textContent = date;
        if (d?.incomplete) {
          const warn = document.createElement('span');
          warn.className = 'hist-incomplete-icon';
          warn.dataset.tooltip = t('incomplete_data');
          warn.innerHTML = icon('alert', { size: 14 });
          rDate.appendChild(warn);
        }

        const rNet = document.createElement('span');
        rNet.className = 'hist-older-net';
        rNet.textContent = fmtMoney(d.net);

        const rDelta = document.createElement('span');
        rDelta.className = 'hist-older-delta';
        if (dDelta !== null) {
          const pct = fmtPct(dDelta, byDate.get(prevK).net);
          rDelta.textContent = fmtDelta(dDelta) + (pct ? ` (${pct})` : '');
          rDelta.classList.add(dDelta >= 0 ? 'up' : 'down');
        }

        row.appendChild(rDate);
        row.appendChild(rNet);
        row.appendChild(rDelta);
        olderList.appendChild(row);
      }

      expandBtn.addEventListener('click', () => {
        const open = olderList.hidden = !olderList.hidden;
        expandBtn.textContent = (open ? '▾' : '▸') + ` ${olderDates.length} earlier`;
      });

      card.appendChild(expandBtn);
      card.appendChild(olderList);
    }

    container.appendChild(card);
  }
}

export function renderChart() {
  const filteredDates = getHistFilteredDates();
  const selectedAccount = els.histAccountSelect?.value || '';
  const isOverview = selectedAccount === '';

  if (els.histChartToggles) els.histChartToggles.hidden = !isOverview;

  const cs = getComputedStyle(document.documentElement);
  const color = (name, fallback) => (cs.getPropertyValue(name).trim() || fallback);
  const COLOR_NET   = color('--fg', '#0f172a');
  const COLOR_INVEST = color('--cat-investments', '#3b82f6');
  const COLOR_RE     = color('--cat-real-estate', '#f59e0b');
  const COLOR_ASSET  = color('--accent', '#10b981');
  const COLOR_DEBT   = color('--cat-debts', '#f43f5e');
  const COLOR_MUTED  = color('--subtle', '#94a3b8');
  const COLOR_GRID   = color('--border', 'rgba(15,23,42,.06)');
  const COLOR_FG2    = color('--fg-2', '#475569');

  const datasets = [];
  const chartCtx = els.chartCanvas.getContext('2d');
  const makeGradient = (hex) => {
    const h = els.chartCanvas.offsetHeight || 300;
    const gr = chartCtx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, hexToRgba(hex, 0.18));
    gr.addColorStop(1, hexToRgba(hex, 0));
    return gr;
  };
  const lineDataset = (label, data, hex) => ({
    label, data, borderColor: hex, backgroundColor: makeGradient(hex),
    borderWidth: 2, fill: true, tension: 0.35,
    pointRadius: 0, pointHoverRadius: 5,
    pointHoverBackgroundColor: hex, pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2,
  });

  let chartDates;
  if (isOverview) {
    const data = computeSeries(filteredDates);
    if (!data.dates.length) { els.chartSection.hidden = true; return; }
    chartDates = data.dates;
    if (els.showNet?.checked)         datasets.push(lineDataset(t('net_worth_chart'), data.net,           COLOR_NET));
    if (els.showInvestments?.checked) datasets.push(lineDataset(t('investments'),     data.investments,    COLOR_INVEST));
    if (els.showRealEstate?.checked)  datasets.push(lineDataset(t('real_estate_net'), data.realEstateNet,  COLOR_RE));
  } else {
    const acct = state.accounts.find(a => a.id === selectedAccount);
    if (!acct) { els.chartSection.hidden = true; return; }
    const sweep = buildBalanceSweep(filteredDates);
    const tempDates = [], values = [];
    for (let i = 0; i < filteredDates.length; i++) {
      const bal = sweep[i][selectedAccount];
      if (bal === undefined) continue;
      tempDates.push(filteredDates[i]);
      values.push(bal);
    }
    chartDates = tempDates;
    if (!chartDates.length) { els.chartSection.hidden = true; return; }
    const hex = acct.kind === 'debt' ? COLOR_DEBT : COLOR_ASSET;
    datasets.push(lineDataset(tr(acct), values, hex));
  }

  if (!datasets.length) { els.chartSection.hidden = true; return; }
  els.chartSection.hidden = false;

  const config = {
    type: 'line',
    data: { labels: chartDates, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { color: COLOR_FG2, font: { size: 12, family: "'Inter', sans-serif" }, padding: 24, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8 } },
        tooltip: {
          backgroundColor: '#0f172a', titleColor: '#94a3b8', bodyColor: '#f1f5f9',
          padding: 12, cornerRadius: 10, titleFont: { size: 11 },
          bodyFont: { size: 13, weight: '600' },
          callbacks: { label: (ctx) => `  ${ctx.dataset.label}: ${state.privateMode ? '••••••' : fmtMoney(ctx.parsed.y)}` },
        },
      },
      scales: {
        y: {
          grid: { color: COLOR_GRID, drawTicks: false }, border: { display: false },
          ticks: { color: COLOR_MUTED, font: { size: 11, family: "'Inter', sans-serif" }, padding: 10, maxTicksLimit: 6,
            callback: (v) => { if (state.privateMode) return '••••'; const abs = Math.abs(v); if (abs >= 1000000) return (v/1000000).toFixed(1)+'M $'; if (abs >= 1000) return (v/1000).toFixed(0)+'k $'; return v+' $'; },
          },
        },
        x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 12, color: COLOR_MUTED, font: { size: 11, family: "'Inter', sans-serif" }, maxRotation: 0 } },
      },
    },
  };

  if (state.chart) {
    state.chart.data = config.data;
    state.chart.options = config.options;
    state.chart.update();
  } else {
    state.chart = new Chart(els.chartCanvas, config);
  }
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
