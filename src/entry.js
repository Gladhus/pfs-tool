import { state, HEADERS } from './state.js';
import { t, tr } from './i18n.js';
import { fmtMoney, fmtDelta, fmtPct, parseMoney } from './format.js';
import { categoriesInOrder, accountsForCategory, activeAccounts, snapshotForDate, prevDate, computeNetWorthFromSnapshots, normalizeDate, rebuildDatesList } from './utils.js';
import { els, setStatus } from './dom.js';
import { renderOverview } from './overview.js';
import { renderHistoryTable, renderChart } from './history.js';

export function renderForm() {
  const date = els.dateInput.value || state.currentDate;
  state.currentDate = date;

  const existing = snapshotForDate(date);
  const isEditing = state.datesSorted.includes(date);
  const prevD = prevDate(date);
  const prevData = prevD ? snapshotForDate(prevD) : null;
  els.dateBadge.hidden = false;
  els.dateBadge.textContent = isEditing ? t('existing_date') : t('new_date');

  els.dayCommentEl.value = existing.dayComment || '';

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
      if (seedVal !== undefined) bal.value = fmtMoney(seedVal);

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

      const balWrap = document.createElement('div');
      balWrap.className = 'bal-wrap';
      balWrap.appendChild(bal);
      const prevVal = prevData?.balances[a.id];
      if (prevVal !== undefined) {
        const hint = document.createElement('span');
        hint.className = 'prev-val';
        hint.textContent = fmtMoney(prevVal);
        balWrap.appendChild(hint);
      }

      const com = document.createElement('input');
      com.type = 'text';
      com.className = 'comment';
      com.placeholder = t('comment_placeholder');
      com.value = existing.comments[a.id] || '';
      com.tabIndex = -1;

      row.appendChild(name);
      row.appendChild(balWrap);
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

  const prevD = prevDate(state.currentDate);
  if (prevD) {
    const prevNet = computeNetWorthFromSnapshots(prevD);
    const delta = netWorth - prevNet;
    const pct = fmtPct(delta, prevNet);
    els.netWorthDelta.textContent = `${fmtDelta(delta)}${pct ? ` (${pct})` : ''} vs ${prevD}`;
    els.netWorthDelta.className = 'delta ' + (delta >= 0 ? 'up' : 'down');
  } else {
    els.netWorthDelta.textContent = '';
    els.netWorthDelta.className = 'delta';
  }
}

export async function saveSnapshot() {
  if (!state.sheetId) return;
  const date = els.dateInput.value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    setStatus('Pick a valid date (YYYY-MM-DD).', 'warn');
    return;
  }

  const values = readFormValues();
  const enteredAt = new Date().toISOString();
  const newRows = [];

  for (const a of activeAccounts()) {
    const v = values[a.id];
    if (!v || v.balance === null || Number.isNaN(v.balance)) continue;
    newRows.push([date, a.id, v.balance, v.comment || '', enteredAt]);
  }
  const dayComment = els.dayCommentEl.value.trim();
  if (dayComment) {
    newRows.push([date, '__day__', 0, dayComment, enteredAt]);
  }

  if (!newRows.length) {
    setStatus('Nothing to save — all balances are empty.', 'warn');
    return;
  }

  setStatus('Saving snapshot…');
  els.saveSnapshotBtn.disabled = true;
  try {
    const keep = state.snapshots.filter(s => s.date !== date);
    const allRows = [HEADERS.snapshots];
    for (const s of keep) {
      allRows.push([s.date, s.account_id, s.balance_raw, s.comment || '', s.entered_at || '']);
    }
    for (const r of newRows) allRows.push(r);

    await gapi.client.sheets.spreadsheets.values.clear({ spreadsheetId: state.sheetId, range: 'snapshots!A:Z' });
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: state.sheetId, range: 'snapshots!A1',
      valueInputOption: 'RAW', resource: { values: allRows },
    });

    state.snapshots = allRows.slice(1).map(r => ({
      date: normalizeDate(r[0]), account_id: r[1], balance_raw: Number(r[2]) || 0,
      comment: r[3] || '', entered_at: r[4] || '',
    }));
    rebuildDatesList();
    renderForm();
    renderHistoryTable();
    renderChart();
    renderOverview();
    setStatus(`Saved snapshot for ${date}.`, 'ok');
  } catch (err) {
    console.error(err);
    setStatus('Save failed: ' + (err.result?.error?.message || err.message || err), 'warn');
  } finally {
    els.saveSnapshotBtn.disabled = false;
  }
}

export function onCopyPrev() {
  const prevD = prevDate(els.dateInput.value);
  if (!prevD) {
    setStatus('No previous entry to copy from.', 'warn');
    return;
  }
  const prev = snapshotForDate(prevD);
  els.categoriesEl.querySelectorAll('.account-row').forEach(row => {
    const id = row.dataset.accountId;
    const v = prev.balances[id];
    if (v !== undefined) row.querySelector('input.balance').value = fmtMoney(v);
  });
  recomputeTotals();
  setStatus(`Pre-filled from ${prevD}.`);
}
