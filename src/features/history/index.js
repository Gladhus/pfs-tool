import "./en.js";
import "./fr.js";
import Chart from 'chart.js/auto';
import { state } from '../../core/state.js';
import { t, tFn, tr, lang } from '../../core/i18n/index.js';
import { fmtMoney, fmtDelta, fmtPct } from '../../core/format.js';
import { getDatesForPeriod } from '../../utils/dates.js';
import { buildBalanceSweep, buildXAxisTicks } from '../../utils/stats.js';
import { activeAccounts } from '../../utils/balance.js';
import { els } from '../../core/dom.js';
import { icon } from '../../core/icons.js';

export function getHistFilteredDates() {
  const btn = document.querySelector('#hist-period-pills .period-btn.active');
  return getDatesForPeriod(btn?.dataset.period || 'all');
}

export function computeSeries(filteredDates) {
  const dates = filteredDates || state.datesSorted;
  if (!dates.length) return { dates: [], net: [], investments: [], realEstateNet: [], other: [] };
  const acctById = Object.fromEntries(state.accounts.map(a => [a.id, a]));
  const sweep = buildBalanceSweep(dates);
  const outDates = [], net = [], investments = [], realEstateNet = [], other = [];
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
    other.push(n - inv - (re + red));
  }
  const nullBeforeFirst = arr => {
    const first = arr.findIndex(v => v !== 0);
    return first <= 0 ? arr : arr.map((v, i) => i < first ? null : v);
  };
  return {
    dates: outDates, net,
    investments: nullBeforeFirst(investments),
    realEstateNet: nullBeforeFirst(realEstateNet),
    other: nullBeforeFirst(other),
  };
}

export function populateHistAccountSelect() {
  const wrap = els.histAccountSelect;
  if (!wrap || !state.accounts.length) return;

  const currentVal = wrap.dataset.value || '';

  // Build flat option list with group separators
  const items = [{ value: '', label: t('overview_option') }];
  const catOrder = Object.fromEntries(state.categoryMeta.map(c => [c.id, c.sort_order || 0]));
  const sorted = [...state.accounts].filter(a => a.active).sort((a, b) => {
    const co = (catOrder[a.category] || 99) - (catOrder[b.category] || 99);
    return co !== 0 ? co : (a.sort_order || 0) - (b.sort_order || 0);
  });
  const byCat = {};
  for (const a of sorted) (byCat[a.category] ||= []).push(a);
  for (const cat of [...state.categoryMeta].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))) {
    const accts = byCat[cat.id];
    if (!accts?.length) continue;
    items.push({ isGroup: true, label: tr(cat) });
    for (const a of accts) items.push({ value: a.id, label: tr(a) });
  }

  const selectedItem = items.find(o => !o.isGroup && o.value === currentVal) || items[0];

  wrap.innerHTML = '';

  // Trigger button
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'custom-select-trigger';
  trigger.innerHTML = `<span class="custom-select-label">${selectedItem.label}</span>${icon('chevronDown', { size: 14 })}`;
  wrap.appendChild(trigger);

  // Dropdown menu
  const menu = document.createElement('div');
  menu.className = 'custom-select-menu';
  menu.hidden = true;

  for (const item of items) {
    if (item.isGroup) {
      const g = document.createElement('div');
      g.className = 'custom-select-group';
      g.textContent = item.label;
      menu.appendChild(g);
    } else {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'custom-select-item' + (item.value === currentVal ? ' selected' : '');
      btn.textContent = item.label;
      if (item.value === currentVal) {
        const esc = String(item.label).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        btn.innerHTML = `${esc}<span class="custom-select-check">${icon('check', { size: 12 })}</span>`;
      }
      btn.dataset.label = item.label;
      btn.addEventListener('click', () => {
        wrap.dataset.value = item.value;
        trigger.querySelector('.custom-select-label').textContent = item.label;
        // Update selected state in menu without rebuilding
        menu.querySelectorAll('.custom-select-item').forEach(b => {
          const isSel = b === btn;
          b.classList.toggle('selected', isSel);
          const lbl = b.dataset.label || '';
          const esc = lbl.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
          b.innerHTML = isSel
            ? `${esc}<span class="custom-select-check">${icon('check', { size: 12 })}</span>`
            : esc;
        });
        menu.hidden = true;
        wrap.classList.remove('open');
        renderChart();
      });
      menu.appendChild(btn);
    }
  }
  wrap.appendChild(menu);

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    const opening = menu.hidden;
    menu.hidden = !opening;
    wrap.classList.toggle('open', opening);
  });
}

function fmtMonthHeading(yyyymm) {
  const [y, m] = yyyymm.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString(
    document.documentElement.lang === 'fr' ? 'fr-CA' : 'en-CA',
    { year: 'numeric', month: 'long' }
  );
}

const HIST_PAGE_SIZE = 12;
let _histPage = 0;

export function resetHistPage() { _histPage = 0; }

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
    if (els.histPagination) els.histPagination.hidden = true;
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
  const totalPages = Math.ceil(monthsDesc.length / HIST_PAGE_SIZE);
  if (_histPage >= totalPages) _histPage = Math.max(0, totalPages - 1);
  const pageMonths = monthsDesc.slice(_histPage * HIST_PAGE_SIZE, (_histPage + 1) * HIST_PAGE_SIZE);

  const container = els.historyCards;
  container.innerHTML = '';

  const redact = v => state.privateMode ? '••••••' : fmtMoney(v);
  const redactDelta = d => state.privateMode ? '••' : fmtDelta(d);

  for (const mo of pageMonths) {
    const datesInMonth = byMonth.get(mo).slice().reverse(); // newest first
    const latestDate = datesInMonth[0];
    const latest = byDate.get(latestDate);
    const reNet = latest.realEstate + latest.realEstateDebts;

    // Delta: latest in this month vs latest in the previous month
    const prevMoKey = monthsDesc[monthsDesc.indexOf(mo) + 1];
    const prevMoLatest = prevMoKey ? byMonth.get(prevMoKey).slice().sort().pop() : null;
    const prevDateKey = prevMoLatest || null;
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
    netEl.textContent = redact(latest.net);

    const deltaEl = document.createElement('div');
    deltaEl.className = 'hist-card-delta';
    if (delta !== null) {
      const pct = fmtPct(delta, byDate.get(prevDateKey).net);
      deltaEl.textContent = redactDelta(delta) + (pct ? ` (${pct})` : '');
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
        rNet.textContent = redact(d.net);

        const rDelta = document.createElement('span');
        rDelta.className = 'hist-older-delta';
        if (dDelta !== null) {
          const pct = fmtPct(dDelta, byDate.get(prevK).net);
          rDelta.textContent = redactDelta(dDelta) + (pct ? ` (${pct})` : '');
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

  _renderHistPagination(totalPages);
}

function _renderHistPagination(totalPages) {
  const el = els.histPagination;
  if (!el) return;
  el.innerHTML = '';
  if (totalPages <= 1) { el.hidden = true; return; }
  el.hidden = false;

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'hist-page-btn';
  prevBtn.textContent = '← ' + t('hist_newer');
  prevBtn.disabled = _histPage === 0;
  prevBtn.addEventListener('click', () => { _histPage--; renderHistoryTable(); });

  const info = document.createElement('span');
  info.className = 'hist-page-info';
  info.textContent = `${_histPage + 1} / ${totalPages}`;

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'hist-page-btn';
  nextBtn.textContent = t('hist_older') + ' →';
  nextBtn.disabled = _histPage >= totalPages - 1;
  nextBtn.addEventListener('click', () => { _histPage++; renderHistoryTable(); });

  el.appendChild(prevBtn);
  el.appendChild(info);
  el.appendChild(nextBtn);
}

export function renderChart() {
  const filteredDates = getHistFilteredDates();
  const selectedAccount = els.histAccountSelect?.dataset.value || '';
  const isOverview = selectedAccount === '';

  if (els.histChartToggles) els.histChartToggles.hidden = !isOverview;

  const cs = getComputedStyle(document.documentElement);
  const color = (name, fallback) => (cs.getPropertyValue(name).trim() || fallback);
  const COLOR_INVEST = color('--cat-investments', '#3b82f6');
  const COLOR_RE     = color('--cat-real-estate', '#f59e0b');
  const COLOR_ASSET  = color('--accent', '#10b981');
  const COLOR_DEBT   = color('--cat-debts', '#f43f5e');
  const COLOR_MUTED  = color('--subtle', '#94a3b8');
  const COLOR_GRID   = color('--border', 'rgba(15,23,42,.06)');

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

    // Build stacked areas using cumulative values (like vesting chart)
    let cumData = new Array(chartDates.length).fill(0);
    let si = 0;
    const pushArea = (label, rawData, hex) => {
      cumData = cumData.map((acc, i) => acc + (rawData[i] ?? 0));
      datasets.push({
        label,
        data: [...cumData],
        _rawData: rawData,
        borderColor: hex,
        backgroundColor: hexToRgba(hex, 0.4),
        borderWidth: 2,
        fill: si === 0 ? 'origin' : '-1',
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 5,
        spanGaps: true,
      });
      si++;
    };

    const COLOR_OTHER = color('--cat-cash', '#10b981');
    if (els.showInvestments?.checked) pushArea(t('investments'),     data.investments,   COLOR_INVEST);
    if (els.showRealEstate?.checked)  pushArea(t('real_estate_net'), data.realEstateNet, COLOR_RE);
    if (els.showOther?.checked)       pushArea(t('show_other'),      data.other,         COLOR_OTHER);
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

  const locale = lang() === 'fr' ? 'fr-CA' : 'en-CA';
  const { tickSet: xTickSet, xFmt } = buildXAxisTicks(chartDates, els.chartCanvas.parentElement?.offsetWidth || 600, locale);

  const config = {
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
          bodyFont: { size: 13, weight: '600' },
          callbacks: {
            label: (ctx) => {
              const val = ctx.dataset._rawData ? (ctx.dataset._rawData[ctx.dataIndex] ?? ctx.parsed.y) : ctx.parsed.y;
              return `  ${ctx.dataset.label}: ${state.privateMode ? '••••••' : fmtMoney(val)}`;
            },
          },
        },
      },
      scales: {
        y: {
          grid: { color: COLOR_GRID, drawTicks: false }, border: { display: false },
          ticks: { color: COLOR_MUTED, font: { size: 11, family: "'Inter', sans-serif" }, padding: 10, maxTicksLimit: 6,
            callback: (v) => { if (state.privateMode) return '••••'; const abs = Math.abs(v); if (abs >= 1000000) return (v/1000000).toFixed(1)+'M $'; if (abs >= 1000) return (v/1000).toFixed(0)+'k $'; return v+' $'; },
          },
        },
        x: {
          grid: { display: false }, border: { display: false },
          ticks: {
            color: COLOR_MUTED, font: { size: 11, family: "'Inter', sans-serif" }, maxRotation: 0,
            autoSkip: false,
            callback: (_, idx) => {
              if (!xTickSet.has(idx)) return null;
              return xFmt(new Date(chartDates[idx] + 'T12:00:00'));
            },
          },
        },
      },
    },
  };

  if (state.chart) { state.chart.destroy(); state.chart = null; }
  state.chart = new Chart(els.chartCanvas, config);
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
