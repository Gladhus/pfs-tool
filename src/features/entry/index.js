import { state, HEADERS } from '../../core/state.js';
import { t, tr } from '../../core/i18n/index.js';
import { fmtMoney, fmtDelta, fmtPct, parseMoney } from '../../core/format.js';
import { categoriesInOrder, accountsForCategory, activeAccounts } from '../../utils/balance.js';
import { projectBalance } from '../../utils/balance.js';
import { snapshotForDate, computeNetWorthFromSnapshots, buildEffectiveBalances } from '../../utils/stats.js';
import { normalizeDate, rebuildDatesList, prevDate } from '../../utils/dates.js';
import { els, setStatus, showConfirm } from '../../core/dom.js';
import { icon, categoryIcon, categoryKey } from '../../core/icons.js';
import { renderOverview } from '../overview/index.js';
import { renderHistoryTable, renderChart } from '../history/index.js';

export function renderForm() {
  const date = els.dateInput.value || state.currentDate;
  state.currentDate = date;

  const existing = snapshotForDate(date);
  const isEditing = state.datesSorted.includes(date);
  const prevD = prevDate(date);
  // Use carry-forward so hints show each account's last known value, not just prevD's entries
  const prevBalances = prevD ? buildEffectiveBalances(prevD) : {};
  els.dateBadge.hidden = false;
  els.dateBadge.textContent = isEditing ? t('existing_date') : t('new_date');

  els.dayCommentEl.value = existing.dayComment || '';

  // Ensure progress strip exists (created lazily, once)
  ensureProgressStrip();

  els.categoriesEl.innerHTML = '';
  for (const cat of categoriesInOrder()) {
    const block = document.createElement('div');
    block.className = `category cat-${categoryKey(cat.id)}`;
    block.dataset.categoryId = cat.id;

    const h = document.createElement('h3');
    const iconWrap = document.createElement('span');
    iconWrap.className = 'cat-icon';
    iconWrap.innerHTML = icon(categoryIcon(cat.id), { size: 14 });
    const lbl = document.createElement('span');
    lbl.textContent = tr(cat);
    const sub = document.createElement('span');
    sub.className = 'subtotal';
    h.appendChild(iconWrap);
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
      bal.placeholder = '—';

      const seedVal = existing.balances[a.id];
      if (seedVal !== undefined) bal.value = fmtMoney(seedVal);

      const updateEmpty = () => row.classList.toggle('row-empty', bal.value.trim() === '');
      updateEmpty();

      bal.addEventListener('focus', () => {
        const n = parseMoney(bal.value);
        bal.value = n === null ? '' : String(n);
        bal.select();
      });
      bal.addEventListener('blur', () => {
        const n = parseMoney(bal.value);
        bal.value = n === null ? '' : fmtMoney(n);
        updateEmpty();
        recomputeTotals();
      });
      bal.addEventListener('input', () => { updateEmpty(); recomputeTotals(); });
      bal.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const all = [...els.categoriesEl.querySelectorAll('input.balance')];
        const idx = all.indexOf(bal);
        const next = all[(idx + 1) % all.length];
        next?.focus();
      });

      const balWrap = document.createElement('div');
      balWrap.className = 'bal-wrap';
      const balRow = document.createElement('div');
      balRow.className = 'bal-row';
      balWrap.appendChild(balRow);
      balRow.appendChild(bal);

      if (a.annual_rate) {
        const projected = projectBalance(a.id, date);
        if (projected !== null) {
          const lastSnap = state.snapshots
            .filter(s => s.account_id === a.id && s.date < date)
            .sort((x, y) => y.date.localeCompare(x.date))[0];
          const days = lastSnap
            ? Math.round((new Date(date) - new Date(lastSnap.date)) / 86400000)
            : 0;
          const ratePct = +(a.annual_rate * 100).toFixed(4);
          const calcBtn = document.createElement('button');
          calcBtn.type = 'button';
          calcBtn.className = 'calc-btn';
          calcBtn.textContent = t('calculate_value');
          calcBtn.tabIndex = -1;
          calcBtn.dataset.tooltip = `${ratePct}%/yr · ${fmtMoney(projected)} (${days}d)`;
          calcBtn.addEventListener('click', () => {
            bal.value = fmtMoney(projected);
            updateEmpty();
            recomputeTotals();
          });
          balRow.insertBefore(calcBtn, bal);
        }
      }

      const prevVal = prevBalances[a.id];
      if (prevVal !== undefined) {
        const hint = document.createElement('span');
        hint.className = 'prev-val';
        hint.dataset.prev = String(prevVal);
        const arrow = document.createElement('span');
        arrow.className = 'prev-arrow';
        hint.appendChild(arrow);
        const txt = document.createElement('span');
        txt.textContent = fmtMoney(prevVal);
        hint.appendChild(txt);
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
  const prevD = prevDate(state.currentDate);
  const fallback = prevD ? buildEffectiveBalances(prevD) : {};
  const byCategory = {};
  let netWorth = 0;
  let filledCount = 0;
  let totalCount = 0;
  let usingFallback = false;

  for (const a of activeAccounts()) {
    totalCount++;
    const v = values[a.id];
    const entered = (!v || v.balance === null || Number.isNaN(v.balance)) ? null : v.balance;
    let balance;
    if (entered !== null) {
      filledCount++;
      balance = entered;
    } else if (fallback[a.id] !== undefined) {
      balance = fallback[a.id];
      usingFallback = true;
    } else {
      continue;
    }
    const signed = balance * (a.ownership_share || 1) * (a.kind === 'debt' ? -1 : 1);
    byCategory[a.category] = (byCategory[a.category] || 0) + signed;
    netWorth += signed;
  }

  els.categoriesEl.querySelectorAll('.category').forEach(block => {
    const catId = block.dataset.categoryId;
    block.querySelector('.subtotal').textContent = fmtMoney(byCategory[catId] || 0);
  });

  // Update direction arrows next to prev-val hints
  els.categoriesEl.querySelectorAll('.account-row').forEach(row => {
    const id = row.dataset.accountId;
    const hint = row.querySelector('.prev-val');
    if (!hint) return;
    const arrow = hint.querySelector('.prev-arrow');
    if (!arrow) return;
    const prev = Number(hint.dataset.prev);
    const cur = values[id]?.balance;
    if (cur === null || Number.isNaN(cur)) {
      arrow.textContent = '';
      arrow.className = 'prev-arrow';
      return;
    }
    if (cur > prev) { arrow.textContent = '▲'; arrow.className = 'prev-arrow up'; }
    else if (cur < prev) { arrow.textContent = '▼'; arrow.className = 'prev-arrow down'; }
    else { arrow.textContent = '='; arrow.className = 'prev-arrow flat'; }
  });

  updateProgressStrip(filledCount, totalCount);

  els.totalsGrid.innerHTML = '';
  for (const cat of categoriesInOrder()) {
    const row = document.createElement('div');
    row.className = 'row';
    const lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = tr(cat);
    const val = document.createElement('span'); val.className = 'val'; val.textContent = fmtMoney(byCategory[cat.id] || 0);
    row.appendChild(lbl); row.appendChild(val);
    els.totalsGrid.appendChild(row);
  }

  const fallbackIcon = usingFallback
    ? `<span class="entry-fallback-icon" data-tooltip="${t('net_worth_fallback')}">${icon('alert', { size: 22 })}</span> `
    : '';
  els.netWorthVal.innerHTML = fallbackIcon + fmtMoney(netWorth);

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
  // __day__ is always touched so an empty textarea clears an existing day comment.
  const touched = new Set(['__day__']);

  // Accounts that already have a snapshot for this date — clearing them = delete.
  const existingOnDate = new Set(
    state.snapshots.filter(s => s.date === date && s.account_id !== '__day__').map(s => s.account_id)
  );

  for (const a of activeAccounts()) {
    const v = values[a.id];
    const hasValue = v && v.balance !== null && !Number.isNaN(v.balance);
    if (hasValue) {
      newRows.push([date, a.id, v.balance, v.comment || '', enteredAt]);
      touched.add(a.id);
    } else if (existingOnDate.has(a.id)) {
      // Field was pre-filled but user cleared it — mark touched to drop the old row.
      touched.add(a.id);
    }
  }
  const dayComment = els.dayCommentEl.value.trim();
  if (dayComment) {
    newRows.push([date, '__day__', 0, dayComment, enteredAt]);
  }

  // Existing rows for this date that weren't touched are preserved as-is.
  const keptRows = state.snapshots
    .filter(s => s.date === date && !touched.has(s.account_id))
    .map(s => [s.date, s.account_id, s.balance_raw, s.comment || '', s.entered_at || '']);

  if (!newRows.length && !keptRows.length) {
    setStatus('Nothing to save — all balances are empty.', 'warn');
    return;
  }

  // Warn if any previously saved entries for this date will be deleted.
  const acctById = Object.fromEntries(state.accounts.map(a => [a.id, a]));
  const deletedNames = [...existingOnDate]
    .filter(id => touched.has(id) && !newRows.some(r => r[1] === id))
    .map(id => { const a = acctById[id]; return a ? (a.name_fr || a.name_en) : id; });
  if (deletedNames.length) {
    const ok = await showConfirm({
      message: t('confirm_delete_entries'),
      items: deletedNames,
      okLabel: t('confirm_delete_ok'),
      cancelLabel: t('cancel'),
    });
    if (!ok) return;
  }

  setStatus('Saving snapshot…');
  els.saveSnapshotBtn.disabled = true;
  try {
    const keep = state.snapshots.filter(s => s.date !== date);
    const allRows = [HEADERS.snapshots];
    for (const s of keep) {
      allRows.push([s.date, s.account_id, s.balance_raw, s.comment || '', s.entered_at || '']);
    }
    for (const r of keptRows) allRows.push(r);
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

function ensureProgressStrip() {
  if (document.getElementById('entry-progress')) return;
  const strip = document.createElement('div');
  strip.id = 'entry-progress';
  strip.className = 'entry-progress';
  strip.innerHTML = `
    <span class="entry-progress-label"></span>
    <div class="entry-progress-bar"><div class="entry-progress-fill"></div></div>
    <span class="entry-progress-pct"></span>
  `;
  // Insert after entry-header
  const header = document.querySelector('.entry-header');
  header?.parentNode?.insertBefore(strip, header.nextSibling);
}

function updateProgressStrip(filled, total) {
  const strip = document.getElementById('entry-progress');
  if (!strip) return;
  const pct = total ? Math.round((filled / total) * 100) : 0;
  strip.querySelector('.entry-progress-label').textContent = `${filled} / ${total}`;
  strip.querySelector('.entry-progress-fill').style.width = `${pct}%`;
  strip.querySelector('.entry-progress-pct').textContent = `${pct}%`;
  strip.classList.toggle('complete', filled === total && total > 0);
}

export async function onResetEntry() {
  const ok = await showConfirm({
    message: t('confirm_reset_entry'),
    okLabel: t('reset_entry'),
    cancelLabel: t('cancel'),
  });
  if (!ok) return;
  els.categoriesEl.querySelectorAll('input.balance').forEach(inp => { inp.value = ''; });
  if (els.dayCommentEl) els.dayCommentEl.value = '';
  recomputeTotals();
  setStatus(t('reset_entry'));
}

export function onCopyPrev() {
  const prevD = prevDate(els.dateInput.value);
  if (!prevD) {
    setStatus('No previous entry to copy from.', 'warn');
    return;
  }
  const prevBalances = buildEffectiveBalances(prevD);
  els.categoriesEl.querySelectorAll('.account-row').forEach(row => {
    const id = row.dataset.accountId;
    const v = prevBalances[id];
    if (v !== undefined) row.querySelector('input.balance').value = fmtMoney(v);
  });
  recomputeTotals();
  setStatus(`Pre-filled from ${prevD}.`);
}
