import Chart from 'chart.js/auto';
import { state } from './state.js';
import { lang, t, tFn, tr } from './i18n.js';
import { fmtMoney, fmtDelta, fmtPct } from './format.js';
import { computeMonthStats, getMonthsForPeriod } from './utils.js';
import { els } from './dom.js';

function fmtMonthLong(yyyymm) {
  const [year, month] = yyyymm.split('-');
  return new Date(+year, +month - 1, 1).toLocaleDateString(
    lang() === 'fr' ? 'fr-CA' : 'en-CA',
    { year: 'numeric', month: 'long' }
  );
}

export function getOvFilteredMonths() {
  const fromVal = els.ovFrom?.value;
  const toVal   = els.ovTo?.value;
  if (fromVal || toVal) {
    return state.monthsSorted.filter(m =>
      (!fromVal || m >= fromVal) && (!toVal || m <= toVal)
    );
  }
  const btn = document.querySelector('#ov-period-pills .period-btn.active');
  return getMonthsForPeriod(btn?.dataset.period || 'all');
}

export function renderOverview() {
  if (!els.ovNetWorth) return;

  const ovTab = document.getElementById('tab-overview');
  ovTab?.classList.toggle('pfs-private', state.privateMode);
  if (els.privateModeBtn) {
    els.privateModeBtn.textContent = state.privateMode ? t('private_mode_off') : t('private_mode');
  }

  if (!state.monthsSorted.length) {
    els.ovNetWorth.textContent = '—';
    if (els.ovDelta) els.ovDelta.textContent = '';
    els.ovAsOf.textContent = '';
    if (els.ovCards) els.ovCards.innerHTML = '';
    return;
  }

  const filteredMonths = getOvFilteredMonths();
  const periodBtn = document.querySelector('#ov-period-pills .period-btn.active');

  const latestMonth = filteredMonths.length
    ? filteredMonths[filteredMonths.length - 1]
    : state.monthsSorted[state.monthsSorted.length - 1];

  // Reference = first month in the filtered window (consistent across hero + cards).
  const periodRefMonth = filteredMonths.length > 1 ? filteredMonths[0] : null;

  // Short label to append after every delta value.
  const isCustom = !!(els.ovFrom?.value || els.ovTo?.value);
  const activePeriod = periodBtn?.dataset.period || 'all';
  const periodLabel = isCustom ? '' : (activePeriod === 'all' ? t('period_all') : activePeriod);

  const current   = computeMonthStats(latestMonth);
  const periodRef = periodRefMonth ? computeMonthStats(periodRefMonth) : null;

  // In private mode replace every $ amount with ●●● but keep percentages.
  const redact = (formatted) => state.privateMode ? '••••••' : formatted;

  els.ovNetWorth.textContent = redact(fmtMoney(current.netWorth));
  els.ovAsOf.textContent = tFn('data_as_of', fmtMonthLong(latestMonth));

  if (els.ovDelta) {
    if (periodRef != null) {
      const d = current.netWorth - periodRef.netWorth;
      const pct = fmtPct(d, periodRef.netWorth);
      const label = periodLabel ? ` ${periodLabel}` : '';
      els.ovDelta.textContent = `${redact(fmtDelta(d))}${pct ? ` (${pct})` : ''}${label}`;
      els.ovDelta.className = 'delta ' + (d >= 0 ? 'up' : 'down');
    } else {
      els.ovDelta.textContent = '';
      els.ovDelta.className = 'delta';
    }
  }

  const cards = els.ovCards;
  cards.innerHTML = '';
  const sortedCats = [...state.categoryMeta].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  for (const cat of sortedCats) {
    const val = current.byCategory[cat.id];
    if (val == null) continue;
    const card = document.createElement('div');
    card.className = 'ov-stat-card';

    const lbl = document.createElement('div');
    lbl.className = 'ov-card-label';
    lbl.textContent = tr(cat);

    const valEl = document.createElement('div');
    valEl.className = 'ov-card-value' + (cat.kind === 'debt' ? ' negative' : '');
    valEl.textContent = redact(fmtMoney(val));

    card.appendChild(lbl);
    card.appendChild(valEl);

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

  renderOverviewChart();
}

export function renderOverviewChart() {
  const canvas = els.ovChartCanvas;
  if (!canvas) return;

  const months = getOvFilteredMonths();
  const acctById = Object.fromEntries(state.accounts.map(a => [a.id, a]));
  const byMonth = {};
  for (const s of state.snapshots) {
    if (s.account_id === '__month__') continue;
    if (!months.includes(s.month)) continue;
    const a = acctById[s.account_id];
    if (!a) continue;
    const signed = s.balance_raw * (a.ownership_share || 1) * (a.kind === 'debt' ? -1 : 1);
    byMonth[s.month] = (byMonth[s.month] || 0) + signed;
  }
  const values = months.map(m => byMonth[m] ?? null);

  const ctx = canvas.getContext('2d');
  const h = canvas.parentElement?.offsetHeight || 280;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(5,150,105,.22)');
  grad.addColorStop(1, 'rgba(5,150,105,0)');

  const tickCallback = (v) => {
    const abs = Math.abs(v);
    if (abs >= 1000000) return (v / 1000000).toFixed(1) + 'M';
    if (abs >= 1000) return (v / 1000).toFixed(0) + 'k';
    return v;
  };

  if (state.overviewChart) {
    state.overviewChart.destroy();
    state.overviewChart = null;
  }
  state.overviewChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: months,
      datasets: [{
        label: t('net_worth_chart'),
        data: values,
        borderColor: '#059669',
        backgroundColor: grad,
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#059669',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        spanGaps: true,
      }],
    },
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
          callbacks: { label: (ctx) => `  ${fmtMoney(ctx.parsed.y)}` },
        },
      },
      scales: {
        y: {
          grid: { color: 'rgba(15,23,42,.04)', drawTicks: false },
          border: { display: false },
          ticks: { color: '#94a3b8', font: { size: 11 }, padding: 10, maxTicksLimit: 5, callback: tickCallback },
        },
        x: {
          grid: { display: false }, border: { display: false },
          ticks: { color: '#94a3b8', font: { size: 11 }, maxRotation: 0, maxTicksLimit: months.length <= 6 ? months.length : 12 },
        },
      },
    },
  });
}
