import { state, HEADERS } from './state.js';
import { t, tFn, tr } from './i18n.js';
import { fmtMoney, fmtDelta, fmtPct, parseMoney } from './format.js';
import { categoriesInOrder, accountsForCategory, activeAccounts, snapshotForMonth, prevMonth, computeNetWorthFromSnapshots, normalizeMonth, rebuildMonthsList } from './utils.js';
import { els, setStatus } from './dom.js';
import { renderOverview } from './overview.js';
import { renderHistoryTable, renderChart } from './history.js';

export function renderForm() {
  const month = els.monthInput.value || state.currentMonth;
  state.currentMonth = month;

  const existing = snapshotForMonth(month);
  const isEditing = state.monthsSorted.includes(month);
  const prevMo = prevMonth(month);
  const prevData = prevMo ? snapshotForMonth(prevMo) : null;

  if (isEditing) {
    els.monthBadge.hidden = false;
    els.monthBadge.textContent = t('existing_month');
  } else if (prevMo) {
    els.monthBadge.hidden = false;
    els.monthBadge.textContent = tFn('new_prefilled', prevMo);
  } else {
    els.monthBadge.hidden = false;
    els.monthBadge.textContent = t('new_month');
  }

  els.monthCommentEl.value = existing.monthComment || '';

  els.categoriesEl.innerHTML = '';
  for (const cat of categoriesInOrder()) {
    const block = document.createElement('div');
    block.className = 'category';
    block.dataset.categoryId = cat.id;

    const h = document.createElement('h3');
    const lbl = document.createElement('span');
    lbl.textContent = tr(cat);
    const sub = document.createElement('span');
    sub.className = 'subtotal';
    h.appendChild(lbl);
    h.appendChild(sub);
    block.appendChild(h);

    for (const a of accountsForCategory(cat.id)) {
      const row = document.createElement('div');
      row.className = 'account-row';
      row.dataset.accountId = a.id;

      const name = document.createElement('div');
      name.className = 'name';
      const nameMain = document.createElement('span');
      nameMain.textContent = tr(a);
      name.appendChild(nameMain);
      const meta = document.createElement('span');
      meta.className = 'meta';
      const ownerLbl = { self: t('owner_self'), partner: t('owner_partner'), joint: t('owner_joint') }[a.owner] || a.owner;
      const sharePct = Math.round((a.ownership_share || 1) * 100);
      meta.textContent = `${ownerLbl} · ${sharePct}%`;
      name.appendChild(meta);

      const bal = document.createElement('input');
      bal.type = 'text';
      bal.inputMode = 'decimal';
      bal.autocomplete = 'off';
      bal.className = 'balance';
      bal.placeholder = fmtMoney(0);

      const seedVal = existing.balances[a.id];
      const prevVal = prevData ? prevData.balances[a.id] : undefined;
      const initial = seedVal !== undefined ? seedVal : prevVal !== undefined ? prevVal : null;
      if (initial !== null) bal.value = fmtMoney(initial);

      bal.addEventListener('focus', () => {
        const n = parseMoney(bal.value);
        bal.value = n === null ? '' : String(n);
        bal.select();
      });
      bal.addEventListener('blur', () => {
        const n = parseMoney(bal.value);
        bal.value = n === null ? '' : fmtMoney(n);
        recomputeTotals();
      });
      bal.addEventListener('input', recomputeTotals);

      const com = document.createElement('input');
      com.type = 'text';
      com.className = 'comment';
      com.placeholder = t('comment_placeholder');
      com.value = existing.comments[a.id] || '';
      com.tabIndex = -1;

      row.appendChild(name);
      row.appendChild(bal);
      row.appendChild(com);
      block.appendChild(row);
    }
    els.categoriesEl.appendChild(block);
  }

  recomputeTotals();
}

export function readFormValues() {
  const out = {};
  els.categoriesEl.querySelectorAll('.account-row').forEach(row => {
    const id = row.dataset.accountId;
    const balance = parseMoney(row.querySelector('input.balance').value);
    const comment = row.querySelector('input.comment').value.trim();
    out[id] = { balance, comment };
  });
  return out;
}

export function recomputeTotals() {
  const values = readFormValues();
  const byCategory = {};
  let netWorth = 0;

  for (const a of activeAccounts()) {
    const v = values[a.id];
    if (!v || v.balance === null || Number.isNaN(v.balance)) continue;
    const signed = v.balance * (a.ownership_share || 1) * (a.kind === 'debt' ? -1 : 1);
    byCategory[a.category] = (byCategory[a.category] || 0) + signed;
    netWorth += signed;
  }

  els.categoriesEl.querySelectorAll('.category').forEach(block => {
    const catId = block.dataset.categoryId;
    block.querySelector('.subtotal').textContent = fmtMoney(byCategory[catId] || 0);
  });

  els.totalsGrid.innerHTML = '';
  for (const cat of categoriesInOrder()) {
    const row = document.createElement('div');
    row.className = 'row';
    const lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = tr(cat);
    const val = document.createElement('span'); val.className = 'val'; val.textContent = fmtMoney(byCategory[cat.id] || 0);
    row.appendChild(lbl); row.appendChild(val);
    els.totalsGrid.appendChild(row);
  }

  els.netWorthVal.textContent = fmtMoney(netWorth);

  const prevMo = prevMonth(state.currentMonth);
  if (prevMo) {
    const prevNet = computeNetWorthFromSnapshots(prevMo);
    const delta = netWorth - prevNet;
    const pct = fmtPct(delta, prevNet);
    els.netWorthDelta.textContent = `${fmtDelta(delta)}${pct ? ` (${pct})` : ''} vs ${prevMo}`;
    els.netWorthDelta.className = 'delta ' + (delta >= 0 ? 'up' : 'down');
  } else {
    els.netWorthDelta.textContent = '';
    els.netWorthDelta.className = 'delta';
  }
}

export async function saveSnapshot() {
  if (!state.sheetId) return;
  const month = els.monthInput.value;
  if (!/^\d{4}-\d{2}$/.test(month)) {
    setStatus('Pick a valid month (YYYY-MM).', 'warn');
    return;
  }

  const values = readFormValues();
  const enteredAt = new Date().toISOString();
  const newRows = [];

  for (const a of activeAccounts()) {
    const v = values[a.id];
    if (!v || v.balance === null || Number.isNaN(v.balance)) continue;
    newRows.push([month, a.id, v.balance, v.comment || '', enteredAt]);
  }
  const monthComment = els.monthCommentEl.value.trim();
  if (monthComment) {
    newRows.push([month, '__month__', 0, monthComment, enteredAt]);
  }

  if (!newRows.length) {
    setStatus('Nothing to save — all balances are empty.', 'warn');
    return;
  }

  setStatus('Saving snapshot…');
  els.saveSnapshotBtn.disabled = true;
  try {
    const keep = state.snapshots.filter(s => s.month !== month);
    const allRows = [HEADERS.snapshots];
    for (const s of keep) {
      allRows.push([s.month, s.account_id, s.balance_raw, s.comment || '', s.entered_at || '']);
    }
    for (const r of newRows) allRows.push(r);

    await gapi.client.sheets.spreadsheets.values.clear({ spreadsheetId: state.sheetId, range: 'snapshots!A:Z' });
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: state.sheetId, range: 'snapshots!A1',
      valueInputOption: 'RAW', resource: { values: allRows },
    });

    state.snapshots = allRows.slice(1).map(r => ({
      month: normalizeMonth(r[0]), account_id: r[1], balance_raw: Number(r[2]) || 0,
      comment: r[3] || '', entered_at: r[4] || '',
    }));
    rebuildMonthsList();
    renderForm();
    renderHistoryTable();
    renderChart();
    renderOverview();
    setStatus(`Saved snapshot for ${month}.`, 'ok');
  } catch (err) {
    console.error(err);
    setStatus('Save failed: ' + (err.result?.error?.message || err.message || err), 'warn');
  } finally {
    els.saveSnapshotBtn.disabled = false;
  }
}

export function onCopyPrev() {
  const prevMo = prevMonth(els.monthInput.value);
  if (!prevMo) {
    setStatus('No previous month to copy from.', 'warn');
    return;
  }
  const prev = snapshotForMonth(prevMo);
  els.categoriesEl.querySelectorAll('.account-row').forEach(row => {
    const id = row.dataset.accountId;
    const v = prev.balances[id];
    if (v !== undefined) row.querySelector('input.balance').value = fmtMoney(v);
  });
  recomputeTotals();
  setStatus(`Pre-filled from ${prevMo}.`);
}
