import { state } from './state.js';
import { t, tr } from './i18n.js';
import { fmtMoney, fmtDelta, fmtPct } from './format.js';
import { buildEffectiveBalances, categoriesInOrder, accountsForCategory } from './utils.js';
import { icon, categoryIcon, categoryKey } from './icons.js';

function getDetailYears(period) {
  const currentYear = String(new Date().getFullYear());
  const seen = new Set(state.datesSorted.map(d => d.slice(0, 4)));
  seen.add(currentYear);
  let sorted = [...seen].sort().filter(y => Object.keys(buildEffectiveBalances(y + '-01-01')).length > 0);
  const limit = { '3Y': 3, '5Y': 5 }[period];
  if (limit && sorted.length > limit) sorted = sorted.slice(-limit);
  return sorted;
}

function signed(balance_raw, acct) {
  return balance_raw * (acct.ownership_share || 1) * (acct.kind === 'debt' ? -1 : 1);
}

function fmtCell(v, pm) {
  if (v === null) return '—';
  if (pm) return '••••••';
  return fmtMoney(v);
}

function mkDeltaCell(curr, prev, pm) {
  const td = document.createElement('td');
  td.className = 'detail-delta-cell';
  if (curr !== null && prev !== null) {
    const d = curr - prev;
    const pct = fmtPct(d, Math.abs(prev));
    td.textContent = (pm ? '••••••' : fmtDelta(d)) + (pct ? ` (${pct})` : '');
    td.classList.add(d >= 0 ? 'up' : 'down');
  } else {
    td.textContent = '—';
  }
  return td;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function renderDetailTable() {
  const container = document.getElementById('detail-table-wrap');
  if (!container) return;

  const periodBtn = document.querySelector('#detail-period-pills .period-btn.active');
  const period = periodBtn?.dataset.period || 'all';
  const years = getDetailYears(period);

  if (!years.length || !state.accounts.length) {
    container.innerHTML = `<div class="empty-state">
      <h3 class="empty-state-title">${t('empty_detail_title')}</h3>
      <p class="empty-state-body">${t('empty_detail_body')}</p>
    </div>`;
    return;
  }

  const yearBals = {};
  for (const y of years) yearBals[y] = buildEffectiveBalances(y + '-01-01');

  const latestY = years[years.length - 1];
  const prevY = years.length >= 2 ? years[years.length - 2] : null;
  const totalCols = years.length + 2;
  const pm = state.privateMode;

  const getVal = (acct, year) => {
    const raw = yearBals[year][acct.id];
    return raw !== undefined ? signed(raw, acct) : null;
  };

  const table = document.createElement('table');
  table.className = 'detail-table';

  // thead
  const thead = document.createElement('thead');
  const hrow = document.createElement('tr');
  const thAcct = document.createElement('th');
  thAcct.className = 'detail-acct-col';
  thAcct.textContent = t('detail_account');
  hrow.appendChild(thAcct);
  for (const y of years) {
    const th = document.createElement('th');
    th.className = 'detail-year-col';
    th.textContent = y;
    hrow.appendChild(th);
  }
  const thD = document.createElement('th');
  thD.className = 'detail-delta-col';
  thD.textContent = prevY ? `${prevY.slice(2)}→${latestY.slice(2)}` : 'Δ';
  hrow.appendChild(thD);
  thead.appendChild(hrow);
  table.appendChild(thead);

  // tbody
  const tbody = document.createElement('tbody');
  const netByYear = Object.fromEntries(years.map(y => [y, 0]));
  const netHasData = Object.fromEntries(years.map(y => [y, false]));
  let anyData = false;

  for (const cat of categoriesInOrder()) {
    const accts = accountsForCategory(cat.id);
    if (!accts.length) continue;

    const catByYear = Object.fromEntries(years.map(y => [y, null]));
    const catRows = [];

    for (const acct of accts) {
      const vals = Object.fromEntries(years.map(y => [y, getVal(acct, y)]));
      if (!years.some(y => vals[y] !== null)) continue;
      for (const y of years) {
        if (vals[y] !== null) {
          catByYear[y] = (catByYear[y] ?? 0) + vals[y];
          netByYear[y] += vals[y];
          netHasData[y] = true;
          anyData = true;
        }
      }
      catRows.push({ acct, vals });
    }
    if (!catRows.length) continue;

    // Category header row
    const catHR = document.createElement('tr');
    catHR.className = `detail-cat-header cat-${categoryKey(cat.id)}`;
    const catTd = document.createElement('td');
    catTd.colSpan = totalCols;
    catTd.innerHTML = `<span class="cat-icon">${icon(categoryIcon(cat.id), { size: 13 })}</span>${escapeHtml(tr(cat))}`;
    catHR.appendChild(catTd);
    tbody.appendChild(catHR);

    // Account rows
    for (const { acct, vals } of catRows) {
      const row = document.createElement('tr');
      row.className = 'detail-acct-row';
      const nameTd = document.createElement('td');
      nameTd.className = 'detail-acct-name';
      nameTd.textContent = tr(acct);
      row.appendChild(nameTd);
      for (const y of years) {
        const td = document.createElement('td');
        td.className = 'detail-value' + (vals[y] !== null && vals[y] < 0 ? ' negative' : '');
        td.textContent = fmtCell(vals[y], pm);
        row.appendChild(td);
      }
      row.appendChild(mkDeltaCell(vals[latestY], prevY ? vals[prevY] : null, pm));
      tbody.appendChild(row);
    }

    // Category total row (only if multiple accounts had data)
    if (catRows.length > 1) {
      const totalR = document.createElement('tr');
      totalR.className = 'detail-cat-total';
      const tTd = document.createElement('td');
      tTd.className = 'detail-acct-name';
      tTd.textContent = t('detail_total');
      totalR.appendChild(tTd);
      for (const y of years) {
        const td = document.createElement('td');
        td.className = 'detail-value' + (catByYear[y] !== null && catByYear[y] < 0 ? ' negative' : '');
        td.textContent = fmtCell(catByYear[y], pm);
        totalR.appendChild(td);
      }
      totalR.appendChild(mkDeltaCell(catByYear[latestY], prevY ? catByYear[prevY] : null, pm));
      tbody.appendChild(totalR);
    }
  }

  if (!anyData) {
    container.innerHTML = `<div class="empty-state">
      <h3 class="empty-state-title">${t('empty_detail_title')}</h3>
      <p class="empty-state-body">${t('empty_detail_body')}</p>
    </div>`;
    return;
  }

  // Net worth row
  const netR = document.createElement('tr');
  netR.className = 'detail-net-row';
  const nTd = document.createElement('td');
  nTd.className = 'detail-acct-name';
  nTd.textContent = t('net_worth');
  netR.appendChild(nTd);
  for (const y of years) {
    const td = document.createElement('td');
    td.className = 'detail-value';
    td.textContent = fmtCell(netHasData[y] ? netByYear[y] : null, pm);
    netR.appendChild(td);
  }
  netR.appendChild(mkDeltaCell(
    netHasData[latestY] ? netByYear[latestY] : null,
    prevY && netHasData[prevY] ? netByYear[prevY] : null,
    pm
  ));
  tbody.appendChild(netR);

  table.appendChild(tbody);
  container.innerHTML = '';
  container.appendChild(table);
}
