import Chart from 'chart.js/auto';
import { state } from './state.js';
import { t, tFn, tr } from './i18n.js';
import { fmtMoney, fmtDelta, fmtPct } from './format.js';
import { getMonthsForPeriod } from './utils.js';
import { els } from './dom.js';

export function getHistFilteredMonths() {
  const btn = document.querySelector('#hist-period-pills .period-btn.active');
  return getMonthsForPeriod(btn?.dataset.period || 'all');
}

export function computeSeries(filteredMonths) {
  const months = filteredMonths || state.monthsSorted;
  const monthSet = new Set(months);
  const acctById = Object.fromEntries(state.accounts.map(a => [a.id, a]));
  const byMonth = new Map();
  for (const s of state.snapshots) {
    if (s.account_id === '__month__') continue;
    if (!monthSet.has(s.month)) continue;
    const a = acctById[s.account_id];
    if (!a) continue;
    const signed = s.balance_raw * (a.ownership_share || 1) * (a.kind === 'debt' ? -1 : 1);
    const m = byMonth.get(s.month) || { net: 0, investments: 0, realEstateAssets: 0, realEstateDebts: 0 };
    m.net += signed;
    if (a.category === 'investments') m.investments += signed;
    else if (a.category === 'real_estate') m.realEstateAssets += signed;
    else if (a.category === 'real_estate_debt') m.realEstateDebts += signed;
    byMonth.set(s.month, m);
  }
  for (const mo of months) if (!byMonth.has(mo)) byMonth.set(mo, { net: 0, investments: 0, realEstateAssets: 0, realEstateDebts: 0 });
  const sorted = months.filter(m => byMonth.has(m)).sort();
  return {
    months: sorted,
    net:           sorted.map(m => byMonth.get(m).net),
    investments:   sorted.map(m => byMonth.get(m).investments),
    realEstateNet: sorted.map(m => byMonth.get(m).realEstateAssets + byMonth.get(m).realEstateDebts),
  };
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

export function renderHistoryTable() {
  const labels = {
    month: t('month'),
    investments: t('investments'),
    realEstateNet: t('real_estate_net'),
    debts: t('debts'),
    netWorth: t('net_worth'),
    delta: t('delta'),
  };
  const acctById = Object.fromEntries(state.accounts.map(a => [a.id, a]));
  const byMonth = new Map();
  for (const s of state.snapshots) {
    if (s.account_id === '__month__') continue;
    const a = acctById[s.account_id];
    if (!a) continue;
    const signed = s.balance_raw * (a.ownership_share || 1) * (a.kind === 'debt' ? -1 : 1);
    const m = byMonth.get(s.month) || { investments: 0, realEstate: 0, realEstateDebts: 0, debts: 0, net: 0 };
    m.net += signed;
    if (a.kind === 'debt') m.debts += signed;
    if (a.category === 'investments') m.investments += signed;
    else if (a.category === 'real_estate') m.realEstate += signed;
    else if (a.category === 'real_estate_debt') m.realEstateDebts += signed;
    byMonth.set(s.month, m);
  }
  for (const s of state.snapshots) {
    if (s.account_id === '__month__' && !byMonth.has(s.month)) {
      byMonth.set(s.month, { investments: 0, realEstate: 0, realEstateDebts: 0, debts: 0, net: 0 });
    }
  }

  const months = [...byMonth.keys()].sort().reverse();
  if (!months.length) { els.historySection.hidden = true; return; }
  els.historySection.hidden = false;
  els.historySummary.textContent = tFn('history_summary', months.length, months[months.length - 1], months[0]);

  const tbody = els.historyTableBody;
  tbody.innerHTML = '';
  const sortedAsc = [...months].reverse();
  const prevByMonth = {};
  for (let i = 0; i < sortedAsc.length; i++) {
    prevByMonth[sortedAsc[i]] = i > 0 ? sortedAsc[i - 1] : null;
  }

  for (const month of months) {
    const m = byMonth.get(month);
    const reNet = m.realEstate + m.realEstateDebts;
    const prev = prevByMonth[month];
    const delta = prev ? m.net - byMonth.get(prev).net : null;

    const rowEl = document.createElement('tr');
    if (month === state.currentMonth) rowEl.classList.add('current');
    rowEl.dataset.month = month;

    const cMonth = document.createElement('td'); cMonth.textContent = month;
    const cInv   = document.createElement('td'); cInv.className = 'num';   cInv.textContent = fmtMoney(m.investments);
    const cRE    = document.createElement('td'); cRE.className = 'num';    cRE.textContent  = fmtMoney(reNet);
    const cDebt  = document.createElement('td'); cDebt.className = 'num';  cDebt.textContent = fmtMoney(m.debts);
    const cNet   = document.createElement('td'); cNet.className = 'num';   cNet.textContent = fmtMoney(m.net);
    const cDelta = document.createElement('td'); cDelta.className = 'num delta';
    cMonth.dataset.label = labels.month;
    cInv.dataset.label   = labels.investments;
    cRE.dataset.label    = labels.realEstateNet;
    cDebt.dataset.label  = labels.debts;
    cNet.dataset.label   = labels.netWorth;
    cDelta.dataset.label = labels.delta;
    if (delta !== null) {
      const pct = fmtPct(delta, byMonth.get(prev).net);
      cDelta.textContent = fmtDelta(delta) + (pct ? ` (${pct})` : '');
      cDelta.classList.add(delta >= 0 ? 'up' : 'down');
    } else {
      cDelta.textContent = '—';
    }

    rowEl.appendChild(cMonth); rowEl.appendChild(cInv); rowEl.appendChild(cRE);
    rowEl.appendChild(cDebt);  rowEl.appendChild(cNet); rowEl.appendChild(cDelta);
    tbody.appendChild(rowEl);
  }
}

export function renderChart() {
  const filteredMonths = getHistFilteredMonths();
  const selectedAccount = els.histAccountSelect?.value || '';
  const isOverview = selectedAccount === '';

  if (els.histChartToggles) els.histChartToggles.hidden = !isOverview;

  const datasets = [];
  const chartCtx = els.chartCanvas.getContext('2d');
  const makeGradient = (r, g, b) => {
    const h = els.chartCanvas.offsetHeight || 300;
    const gr = chartCtx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, `rgba(${r},${g},${b},0.18)`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    return gr;
  };

  let chartMonths;
  if (isOverview) {
    const data = computeSeries(filteredMonths);
    if (!data.months.length) { els.chartSection.hidden = true; return; }
    chartMonths = data.months;
    if (els.showNet?.checked) {
      datasets.push({ label: t('net_worth_chart'), data: data.net, borderColor: '#0f172a', backgroundColor: makeGradient(15, 23, 42), borderWidth: 2, fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#0f172a', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2 });
    }
    if (els.showInvestments?.checked) {
      datasets.push({ label: t('investments'), data: data.investments, borderColor: '#059669', backgroundColor: makeGradient(5, 150, 105), borderWidth: 2, fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#059669', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2 });
    }
    if (els.showRealEstate?.checked) {
      datasets.push({ label: t('real_estate_net'), data: data.realEstateNet, borderColor: '#0284c7', backgroundColor: makeGradient(2, 132, 199), borderWidth: 2, fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#0284c7', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2 });
    }
  } else {
    const acct = state.accounts.find(a => a.id === selectedAccount);
    if (!acct) { els.chartSection.hidden = true; return; }
    const monthSet = new Set(filteredMonths);
    const snapByMonth = Object.fromEntries(
      state.snapshots.filter(s => s.account_id === selectedAccount && monthSet.has(s.month))
        .map(s => [s.month, s.balance_raw])
    );
    chartMonths = filteredMonths.filter(m => snapByMonth[m] !== undefined);
    if (!chartMonths.length) { els.chartSection.hidden = true; return; }
    const values = chartMonths.map(m => snapByMonth[m]);
    const color = acct.kind === 'debt' ? '#e11d48' : '#059669';
    const [r, g, b] = acct.kind === 'debt' ? [225, 29, 72] : [5, 150, 105];
    datasets.push({ label: tr(acct), data: values, borderColor: color, backgroundColor: makeGradient(r, g, b), borderWidth: 2, fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: color, pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2 });
  }

  if (!datasets.length) { els.chartSection.hidden = true; return; }
  els.chartSection.hidden = false;

  const config = {
    type: 'line',
    data: { labels: chartMonths, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { color: '#475569', font: { size: 12, family: "'Inter', sans-serif" }, padding: 24, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8 } },
        tooltip: {
          backgroundColor: '#0f172a', titleColor: '#94a3b8', bodyColor: '#f1f5f9',
          padding: 12, cornerRadius: 10, titleFont: { size: 11 },
          bodyFont: { size: 13, weight: '600' },
          callbacks: { label: (ctx) => `  ${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y)}` },
        },
      },
      scales: {
        y: {
          grid: { color: 'rgba(15,23,42,.04)', drawTicks: false }, border: { display: false },
          ticks: { color: '#94a3b8', font: { size: 11, family: "'Inter', sans-serif" }, padding: 10, maxTicksLimit: 6,
            callback: (v) => { const abs = Math.abs(v); if (abs >= 1000000) return (v/1000000).toFixed(1)+'M $'; if (abs >= 1000) return (v/1000).toFixed(0)+'k $'; return v+' $'; },
          },
        },
        x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 12, color: '#94a3b8', font: { size: 11, family: "'Inter', sans-serif" }, maxRotation: 0 } },
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
