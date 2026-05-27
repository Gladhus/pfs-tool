import Chart from 'chart.js/auto';
import { state } from './state.js';
import { t, tFn, tr } from './i18n.js';
import { fmtMoney, fmtDelta, fmtPct } from './format.js';
import { getDatesForPeriod } from './utils.js';
import { els } from './dom.js';

export function getHistFilteredDates() {
  const btn = document.querySelector('#hist-period-pills .period-btn.active');
  return getDatesForPeriod(btn?.dataset.period || 'all');
}

export function computeSeries(filteredDates) {
  const dates = filteredDates || state.datesSorted;
  const dateSet = new Set(dates);
  const acctById = Object.fromEntries(state.accounts.map(a => [a.id, a]));
  const byDate = new Map();
  for (const s of state.snapshots) {
    if (s.account_id === '__day__') continue;
    if (!dateSet.has(s.date)) continue;
    const a = acctById[s.account_id];
    if (!a) continue;
    const signed = s.balance_raw * (a.ownership_share || 1) * (a.kind === 'debt' ? -1 : 1);
    const m = byDate.get(s.date) || { net: 0, investments: 0, realEstateAssets: 0, realEstateDebts: 0 };
    m.net += signed;
    if (a.category === 'investments') m.investments += signed;
    else if (a.category === 'real_estate') m.realEstateAssets += signed;
    else if (a.category === 'real_estate_debt') m.realEstateDebts += signed;
    byDate.set(s.date, m);
  }
  for (const d of dates) if (!byDate.has(d)) byDate.set(d, { net: 0, investments: 0, realEstateAssets: 0, realEstateDebts: 0 });
  const sorted = dates.filter(d => byDate.has(d)).sort();
  return {
    dates: sorted,
    net:           sorted.map(d => byDate.get(d).net),
    investments:   sorted.map(d => byDate.get(d).investments),
    realEstateNet: sorted.map(d => byDate.get(d).realEstateAssets + byDate.get(d).realEstateDebts),
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

function fmtMonthHeading(yyyymm) {
  const [y, m] = yyyymm.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString(
    document.documentElement.lang === 'fr' ? 'fr-CA' : 'en-CA',
    { year: 'numeric', month: 'long' }
  );
}

export function renderHistoryTable() {
  const acctById = Object.fromEntries(state.accounts.map(a => [a.id, a]));

  // Build per-date aggregates
  const byDate = new Map();
  for (const s of state.snapshots) {
    if (s.account_id === '__day__') continue;
    const a = acctById[s.account_id];
    if (!a) continue;
    const signed = s.balance_raw * (a.ownership_share || 1) * (a.kind === 'debt' ? -1 : 1);
    const m = byDate.get(s.date) || { investments: 0, realEstate: 0, realEstateDebts: 0, debts: 0, net: 0 };
    m.net += signed;
    if (a.kind === 'debt') m.debts += signed;
    if (a.category === 'investments') m.investments += signed;
    else if (a.category === 'real_estate') m.realEstate += signed;
    else if (a.category === 'real_estate_debt') m.realEstateDebts += signed;
    byDate.set(s.date, m);
  }

  const allDates = [...byDate.keys()].sort();
  if (!allDates.length) { els.historySection.hidden = true; return; }
  els.historySection.hidden = false;
  els.historySummary.textContent = tFn('history_summary', allDates.length, allDates[0], allDates[allDates.length - 1]);

  // Group dates by YYYY-MM, months descending, days within month descending
  const byMonth = new Map();
  for (const d of allDates) {
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
    const prevIdx = allDates.indexOf(latestDate) - 1;
    const prevDateKey = prevIdx >= 0 ? allDates[prevIdx] : null;
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

    const mkStat = (label, val) => {
      const el = document.createElement('span');
      el.className = 'hist-stat';
      el.innerHTML = `<span class="hist-stat-label">${label}</span> ${fmtMoney(val)}`;
      return el;
    };
    stats.appendChild(mkStat(t('investments'), latest.investments));
    stats.appendChild(mkStat(t('real_estate_net'), reNet));
    stats.appendChild(mkStat(t('debts'), latest.debts));

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
        const prevI = allDates.indexOf(date) - 1;
        const prevK = prevI >= 0 ? allDates[prevI] : null;
        const dDelta = prevK ? d.net - byDate.get(prevK).net : null;

        const row = document.createElement('div');
        row.className = 'hist-older-row';
        row.dataset.date = date;
        if (date === state.currentDate) row.classList.add('current');

        const rDate = document.createElement('span');
        rDate.className = 'hist-older-date';
        rDate.textContent = date;

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

  const datasets = [];
  const chartCtx = els.chartCanvas.getContext('2d');
  const makeGradient = (r, g, b) => {
    const h = els.chartCanvas.offsetHeight || 300;
    const gr = chartCtx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, `rgba(${r},${g},${b},0.18)`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    return gr;
  };

  let chartDates;
  if (isOverview) {
    const data = computeSeries(filteredDates);
    if (!data.dates.length) { els.chartSection.hidden = true; return; }
    chartDates = data.dates;
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
    const dateSet = new Set(filteredDates);
    const snapByDate = Object.fromEntries(
      state.snapshots.filter(s => s.account_id === selectedAccount && dateSet.has(s.date))
        .map(s => [s.date, s.balance_raw])
    );
    chartDates = filteredDates.filter(d => snapByDate[d] !== undefined);
    if (!chartDates.length) { els.chartSection.hidden = true; return; }
    const values = chartDates.map(d => snapByDate[d]);
    const color = acct.kind === 'debt' ? '#e11d48' : '#059669';
    const [r, g, b] = acct.kind === 'debt' ? [225, 29, 72] : [5, 150, 105];
    datasets.push({ label: tr(acct), data: values, borderColor: color, backgroundColor: makeGradient(r, g, b), borderWidth: 2, fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: color, pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2 });
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
