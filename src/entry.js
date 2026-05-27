import { state, HEADERS } from './state.js';
import { t, tr } from './i18n.js';
import { fmtMoney, fmtDelta, fmtPct, parseMoney } from './format.js';
import { categoriesInOrder, accountsForCategory, activeAccounts, snapshotForDate, prevDate, computeNetWorthFromSnapshots, normalizeDate, rebuildDatesList } from './utils.js';
import { els, setStatus } from './dom.js';
import { icon, categoryIcon, categoryKey } from './icons.js';
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
      balWrap.appendChild(bal);
      const prevVal = prevData?.balances[a.id];
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
  const byCategory = {};
  let netWorth = 0;
  let filledCount = 0;
  let totalCount = 0;

  for (const a of activeAccounts()) {
    totalCount++;
    const v = values[a.id];
    if (!v || v.balance === null || Number.isNaN(v.balance)) continue;
    filledCount++;
    const signed = v.balance * (a.ownership_share || 1) * (a.kind === 'debt' ? -1 : 1);
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
