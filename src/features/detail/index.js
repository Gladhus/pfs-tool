import "./en.js";
import "./fr.js";
import { state } from '../../core/state.js';
import { getActivePeriod } from '../../core/pills.js';
import { t, tr } from '../../core/i18n/index.js';
import { privMoney, privDelta, privPct } from '../../core/privacy.js';
import { escapeHtml } from '../../core/dom.js';
import { buildEffectiveBalances } from '../../utils/stats.js';
import { categoriesInOrder, accountsForCategory } from '../../utils/balance.js';
import { icon, categoryIcon, categoryKey } from '../../core/icons.js';

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

// Creates a table cell showing the value and, if prev is known, an inline delta below it.
function mkValueCell(curr, prev) {
  const td = document.createElement('td');
  if (curr === null) {
    td.className = 'detail-value';
    td.textContent = '—';
    return td;
  }
  td.className = 'detail-value' + (curr < 0 ? ' negative' : '');
  const valDiv = document.createElement('div');
  valDiv.className = 'detail-cell-value';
  valDiv.textContent = privMoney(curr);
  td.appendChild(valDiv);
  if (prev !== null) {
    const d = curr - prev;
    const pct = privPct(d, Math.abs(prev));
    const deltaDiv = document.createElement('div');
    deltaDiv.className = 'detail-cell-delta ' + (d >= 0 ? 'up' : 'down');
    deltaDiv.textContent = privDelta(d) + (pct ? ` (${pct})` : '');
    td.appendChild(deltaDiv);
  }
  return td;
}

export function renderDetailTable() {
  const container = document.getElementById('detail-table-wrap');
  if (!container) return;

  const period = getActivePeriod('detail-period-pills');
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

    // Category header row — label only, different background
    const catHR = document.createElement('tr');
    catHR.className = `detail-cat-header cat-${categoryKey(cat.id)}`;
    const catNameTd = document.createElement('td');
    catNameTd.className = 'detail-cat-name';
    catNameTd.innerHTML = `<span class="detail-cat-name-content"><span class="cat-icon">${icon(categoryIcon(cat.id), { size: 13 })}</span>${escapeHtml(tr(cat))}</span>`;
    catHR.appendChild(catNameTd);
    for (let yi = 0; yi < years.length; yi++) {
      catHR.appendChild(document.createElement('td'));
    }
    tbody.appendChild(catHR);

    // Account rows (only shown when category has multiple accounts)
    if (catRows.length > 1) {
      for (const { acct, vals } of catRows) {
        const row = document.createElement('tr');
        row.className = 'detail-acct-row';
        const nameTd = document.createElement('td');
        nameTd.className = 'detail-acct-name';
        nameTd.textContent = tr(acct);
        row.appendChild(nameTd);
        for (let yi = 0; yi < years.length; yi++) {
          const y = years[yi];
          const prev = yi > 0 ? vals[years[yi - 1]] : null;
          row.appendChild(mkValueCell(vals[y], prev));
        }
        tbody.appendChild(row);
      }
    }

    // Category total row
    const totalR = document.createElement('tr');
    totalR.className = 'detail-cat-total';
    const totalNameTd = document.createElement('td');
    totalNameTd.className = 'detail-acct-name';
    totalNameTd.textContent = t('detail_total');
    totalR.appendChild(totalNameTd);
    for (let yi = 0; yi < years.length; yi++) {
      const y = years[yi];
      const prev = yi > 0 ? catByYear[years[yi - 1]] : null;
      totalR.appendChild(mkValueCell(catByYear[y], prev));
    }
    tbody.appendChild(totalR);
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
  for (let yi = 0; yi < years.length; yi++) {
    const y = years[yi];
    const curr = netHasData[y] ? netByYear[y] : null;
    const prevY = yi > 0 ? years[yi - 1] : null;
    const prev = prevY && netHasData[prevY] ? netByYear[prevY] : null;
    netR.appendChild(mkValueCell(curr, prev));
  }
  tbody.appendChild(netR);

  table.appendChild(tbody);
  container.innerHTML = '';
  container.appendChild(table);
}
