import { state, HEADERS, OWNERS, KINDS } from './state.js';
import { t, tr } from './i18n.js';
import { fmtMoney, parseMoney } from './format.js';
import { categoriesInOrder, activeAccounts, normalizeMonth, rebuildMonthsList, parseMonthLabel, parseDelimited, suggestAccount, rememberMapping } from './utils.js';
import { els, setStatus } from './dom.js';
import { renderOverview } from './overview.js';
import { renderHistoryTable, renderChart, populateHistAccountSelect } from './history.js';
import { renderForm } from './entry.js';
import { loadAccounts as loadAccountsFromSheet } from './sheets.js';

// --- Accounts table ---

export function populateTypePicker() {
  const sel = els.newAccountType;
  if (!state.accountTypes.length) return;
  if (sel.dataset.populated === '1') return;
  sel.innerHTML = '';
  const byCat = {};
  for (const type of state.accountTypes) (byCat[type.category] ||= []).push(type);
  for (const cat of state.categoryMeta) {
    const types = byCat[cat.id];
    if (!types || !types.length) continue;
    const og = document.createElement('optgroup');
    og.label = tr(cat);
    for (const type of types) {
      const opt = document.createElement('option');
      opt.value = type.id_prefix;
      opt.textContent = `${type.name_fr} / ${type.name_en}`;
      og.appendChild(opt);
    }
    sel.appendChild(og);
  }
  sel.dataset.populated = '1';
}

export function renderAccountsTable() {
  populateTypePicker();
  const tbody = els.accountsTableBody;
  tbody.innerHTML = '';
  const catOrder = Object.fromEntries(state.categoryMeta.map(c => [c.id, c.sort_order || 0]));
  const sorted = [...state.accounts].sort((a, b) => {
    const co = (catOrder[a.category] || 99) - (catOrder[b.category] || 99);
    if (co !== 0) return co;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });
  for (const a of sorted) {
    tbody.appendChild(buildAccountRow(a, false));
  }
}

export function buildAccountRow(a, isNew) {
  const rowEl = document.createElement('tr');
  if (isNew) rowEl.classList.add('new-row');
  if (!a.active) rowEl.classList.add('inactive');
  rowEl.dataset.originalId = a.id;
  rowEl.dataset.isNew = isNew ? '1' : '0';
  rowEl.dataset.type = a.type || '';

  const td = (cls, label) => {
    const x = document.createElement('td');
    if (cls) x.className = cls;
    if (label) x.dataset.label = label;
    rowEl.appendChild(x);
    return x;
  };
  const txt = (v, cls) => {
    const i = document.createElement('input'); i.type = 'text'; i.value = v ?? ''; if (cls) i.className = cls;
    return i;
  };
  const num = (v, step = 1) => {
    const i = document.createElement('input'); i.type = 'number'; i.value = v ?? 0; i.step = step;
    return i;
  };
  const mkSel = (v, options) => {
    const s = document.createElement('select');
    for (const o of options) {
      const opt = document.createElement('option'); opt.value = o.value; opt.textContent = o.label;
      if (o.value === v) opt.selected = true;
      s.appendChild(opt);
    }
    return s;
  };

  const idInput = txt(a.id, 'id');
  if (!isNew) idInput.readOnly = true;
  td(null, 'ID').appendChild(idInput);

  td(null, 'Name (FR)').appendChild(txt(a.name_fr));
  td(null, 'Name (EN)').appendChild(txt(a.name_en));

  const catOpts = state.categoryMeta.map(c => ({ value: c.id, label: tr(c) }));
  td(null, 'Category').appendChild(mkSel(a.category, catOpts));

  td(null, 'Kind').appendChild(mkSel(a.kind, KINDS.map(k => ({ value: k, label: k }))));
  td(null, 'Owner').appendChild(mkSel(a.owner, OWNERS.map(o => ({ value: o, label: o }))));

  const share = num(Math.round((a.ownership_share || 0) * 100), 1);
  share.min = 0; share.max = 100; share.style.width = '4rem';
  td('num', 'Share %').appendChild(share);

  const activeBox = document.createElement('input');
  activeBox.type = 'checkbox'; activeBox.checked = !!a.active;
  activeBox.addEventListener('change', () => rowEl.classList.toggle('inactive', !activeBox.checked));
  td(null, 'Active').appendChild(activeBox);

  const order = num(a.sort_order || 0);
  order.style.width = '4.5rem';
  td('num', 'Order').appendChild(order);

  const actionsTd = td('actions-col');
  if (!isNew) {
    const renameBtn = document.createElement('button');
    renameBtn.type = 'button';
    renameBtn.className = 'rename-btn';
    renameBtn.textContent = 'Rename ID';
    renameBtn.title = "Rename this account's ID — also updates every historical snapshot that references it";
    renameBtn.addEventListener('click', () => onRenameAccountId(a.id));
    actionsTd.appendChild(renameBtn);
  }

  return rowEl;
}

function readAccountsTable() {
  const rows = [...els.accountsTableBody.querySelectorAll('tr')];
  const out = [];
  const seenIds = new Set();
  for (const rowEl of rows) {
    const inputs = rowEl.querySelectorAll('input, select');
    const [idEl, nameFr, nameEn, cat, kind, owner, share, active, order] = inputs;
    const id = (idEl.value || '').trim();
    if (!id) continue;
    if (seenIds.has(id)) throw new Error(`Duplicate account id: "${id}"`);
    seenIds.add(id);
    out.push({
      id,
      type: rowEl.dataset.type || '',
      name_fr: nameFr.value.trim(),
      name_en: nameEn.value.trim(),
      category: cat.value,
      kind: kind.value,
      owner: owner.value,
      ownership_share: Math.max(0, Math.min(100, Number(share.value) || 0)) / 100,
      active: active.checked,
      sort_order: Number(order.value) || 0,
    });
  }
  return out;
}

export function onAddAccount() {
  const prefix = els.newAccountType.value;
  if (!prefix) { els.accountsStatus.textContent = 'Pick an account type first.'; els.accountsStatus.style.color = 'var(--warn)'; return; }
  const type = state.accountTypes.find(t => t.id_prefix === prefix);
  if (!type) { els.accountsStatus.textContent = 'Unknown account type.'; els.accountsStatus.style.color = 'var(--warn)'; return; }

  const existingIds = new Set(state.accounts.map(a => a.id));
  els.accountsTableBody.querySelectorAll('tr').forEach(rowEl => {
    const v = rowEl.querySelector('input.id')?.value;
    if (v) existingIds.add(v);
  });
  let n = 1;
  while (existingIds.has(`${prefix}_${n}`)) n++;
  const newId = `${prefix}_${n}`;

  const orderInCat = state.accounts.filter(a => a.category === type.category).map(a => a.sort_order || 0);
  const nextOrder = (orderInCat.length ? Math.max(...orderInCat) : 0) + 10;

  const blank = {
    id: newId, type: prefix,
    name_fr: `${type.name_fr} ${n}`, name_en: `${type.name_en} ${n}`,
    category: type.category, kind: type.kind,
    owner: type.default_owner || 'self',
    ownership_share: type.default_ownership_share ?? 1,
    active: true, sort_order: nextOrder,
  };
  els.accountsTableBody.appendChild(buildAccountRow(blank, true));
  els.accountsStatus.style.color = 'var(--muted)';
  els.accountsStatus.textContent = `Added ${newId} — remember to Save changes.`;
  const newRow = els.accountsTableBody.lastElementChild;
  const inputs = newRow.querySelectorAll('input');
  inputs[1].focus(); inputs[1].select();
  newRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export async function onSaveAccounts() {
  if (!state.sheetId) return;
  let next;
  try {
    next = readAccountsTable();
  } catch (err) {
    els.accountsStatus.textContent = err.message;
    els.accountsStatus.style.color = 'var(--warn)';
    return;
  }
  if (!next.length) {
    els.accountsStatus.textContent = 'Add at least one account.';
    els.accountsStatus.style.color = 'var(--warn)';
    return;
  }
  const newIds = new Set(next.map(a => a.id));
  const removed = state.accounts.filter(a => !newIds.has(a.id));
  const usedRemoved = removed.filter(a => state.snapshots.some(s => s.account_id === a.id));
  if (usedRemoved.length) {
    const names = usedRemoved.map(a => a.id).join(', ');
    els.accountsStatus.textContent = `Cannot remove accounts with history: ${names}. Mark them inactive instead.`;
    els.accountsStatus.style.color = 'var(--warn)';
    return;
  }

  els.accountsStatus.style.color = 'var(--muted)';
  els.accountsStatus.textContent = 'Saving…';
  els.saveAccountsBtn.disabled = true;
  try {
    const rows = [HEADERS.accounts, ...next.map(a => HEADERS.accounts.map(h => a[h] ?? ''))];
    await gapi.client.sheets.spreadsheets.values.clear({ spreadsheetId: state.sheetId, range: 'accounts!A:Z' });
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: state.sheetId, range: 'accounts!A1',
      valueInputOption: 'RAW', resource: { values: rows },
    });
    state.accounts = next;
    renderAccountsTable();
    renderForm();
    renderHistoryTable();
    renderChart();
    renderOverview();
    els.accountsStatus.textContent = `Saved ${next.length} accounts.`;
    els.accountsStatus.style.color = 'var(--ok)';
  } catch (err) {
    console.error(err);
    els.accountsStatus.textContent = 'Save failed: ' + (err.result?.error?.message || err.message || err);
    els.accountsStatus.style.color = 'var(--warn)';
  } finally {
    els.saveAccountsBtn.disabled = false;
  }
}

export async function onReloadAccounts() {
  els.accountsStatus.textContent = 'Reloading from sheet…';
  await loadAccountsFromSheet();
  renderAccountsTable();
  els.accountsStatus.textContent = 'Reverted to last saved.';
  els.accountsStatus.style.color = 'var(--muted)';
}

// --- Migrate ID dialog ---

const migrateDialog   = () => document.getElementById('migrate-id-dialog');
const migrateTypeSel  = () => document.getElementById('migrate-type-select');
const migrateCurrentId = () => document.getElementById('migrate-current-id');
const migrateNewId    = () => document.getElementById('migrate-new-id');
const migrateNote     = () => document.getElementById('migrate-snapshots-note');

let _migrateOldId = null;

function onRenameAccountId(oldId) {
  openMigrateDialog(oldId);
}

export function openMigrateDialog(oldId) {
  _migrateOldId = oldId;
  const dialog = migrateDialog();
  const selEl = migrateTypeSel();

  migrateCurrentId().textContent = oldId;
  selEl.innerHTML = '';
  const byCat = {};
  for (const type of state.accountTypes) (byCat[type.category] ||= []).push(type);
  for (const cat of state.categoryMeta) {
    const types = byCat[cat.id];
    if (!types?.length) continue;
    const og = document.createElement('optgroup');
    og.label = tr(cat);
    for (const type of types) {
      const opt = document.createElement('option');
      opt.value = type.id_prefix;
      opt.textContent = `${type.name_fr} / ${type.name_en}`;
      og.appendChild(opt);
    }
    selEl.appendChild(og);
  }
  const acct = state.accounts.find(a => a.id === oldId);
  if (acct?.type) selEl.value = acct.type;
  updateMigratePreview();
  dialog.showModal();
}

export function updateMigratePreview() {
  const prefix = migrateTypeSel()?.value;
  if (!prefix) return;
  const existingIds = new Set(state.accounts.map(a => a.id).filter(id => id !== _migrateOldId));
  let n = 1;
  while (existingIds.has(`${prefix}_${n}`)) n++;
  const newId = `${prefix}_${n}`;
  migrateNewId().textContent = newId;
  const affected = state.snapshots.filter(s => s.account_id === _migrateOldId).length;
  migrateNote().textContent = `${affected} historical snapshot row(s) will be updated.`;
}

export async function executeMigrate() {
  const oldId = _migrateOldId;
  const newId = migrateNewId()?.textContent?.trim();
  if (!oldId || !newId || oldId === newId) { migrateDialog().close(); return; }
  if (state.accounts.some(a => a.id === newId)) {
    migrateNote().textContent = `ID "${newId}" already exists. Choose a different type.`;
    return;
  }
  const affected = state.snapshots.filter(s => s.account_id === oldId).length;

  migrateDialog().close();
  els.accountsStatus.style.color = 'var(--muted)';
  els.accountsStatus.textContent = `Renaming ${oldId} → ${newId}…`;

  try {
    const acct = state.accounts.find(a => a.id === oldId);
    if (acct) { acct.id = newId; acct.type = migrateTypeSel()?.value || acct.type; }
    for (const s of state.snapshots) if (s.account_id === oldId) s.account_id = newId;

    const accountsRows = [HEADERS.accounts, ...state.accounts.map(a => HEADERS.accounts.map(h => a[h] ?? ''))];
    await gapi.client.sheets.spreadsheets.values.clear({ spreadsheetId: state.sheetId, range: 'accounts!A:Z' });
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: state.sheetId, range: 'accounts!A1',
      valueInputOption: 'RAW', resource: { values: accountsRows },
    });

    if (affected > 0) {
      const snapshotRows = [HEADERS.snapshots, ...state.snapshots.map(s => [s.month, s.account_id, s.balance_raw, s.comment || '', s.entered_at || ''])];
      await gapi.client.sheets.spreadsheets.values.clear({ spreadsheetId: state.sheetId, range: 'snapshots!A:Z' });
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: state.sheetId, range: 'snapshots!A1',
        valueInputOption: 'RAW', resource: { values: snapshotRows },
      });
    }

    renderAccountsTable();
    renderForm();
    renderHistoryTable();
    renderChart();
    renderOverview();
    els.accountsStatus.style.color = 'var(--ok)';
    els.accountsStatus.textContent = `Renamed ${oldId} → ${newId}. ${affected} snapshot row(s) updated.`;
  } catch (err) {
    console.error(err);
    els.accountsStatus.style.color = 'var(--warn)';
    els.accountsStatus.textContent = 'Rename failed: ' + (err.result?.error?.message || err.message || err);
  }
}

// --- Import ---

export function onParseImport() {
  const raw = els.importInput.value;
  if (!raw.trim()) { setStatus('Paste data first.', 'warn'); return; }
  const grid = parseDelimited(raw);
  if (!grid.length) { setStatus('Could not parse the paste.', 'warn'); return; }

  let headerIdx = -1, monthCols = null;
  for (let i = 0; i < Math.min(grid.length, 10); i++) {
    const row = grid[i];
    const cols = row.map((c, idx) => ({ idx, month: parseMonthLabel(c) })).filter(x => x.month);
    if (cols.length >= 2) { headerIdx = i; monthCols = cols; break; }
  }
  if (headerIdx < 0) {
    setStatus("Couldn't find a row with month labels (e.g., 'Sep 2020').", 'warn');
    return;
  }

  const firstMonthCol = monthCols[0].idx;
  const rows = [];
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const r = grid[i];
    let label = '';
    for (let c = firstMonthCol - 1; c >= 0; c--) {
      if (r[c] && r[c].trim()) { label = r[c].trim(); break; }
    }
    if (!label) continue;
    const values = monthCols.map(mc => ({
      month: mc.month, raw: r[mc.idx] || '',
      num: parseMoney(r[mc.idx]),
    }));
    if (!values.some(v => v.num !== null)) continue;
    rows.push({ label, values, mapping: suggestAccount(label) || '__skip__' });
  }

  state.importParsed = { months: monthCols.map(m => m.month), rows };
  renderImportPreview();
}

export function renderImportPreview() {
  if (!state.importParsed) { els.importPreview.hidden = true; return; }
  const { months, rows } = state.importParsed;

  els.importSummary.textContent =
    `${rows.length} source rows · ${months.length} months (${months[0]} → ${months[months.length - 1]})`;

  const tbody = els.mappingTableBody;
  tbody.innerHTML = '';
  for (const row of rows) {
    const rowEl = document.createElement('tr');
    if (row.mapping === '__skip__') rowEl.classList.add('skipped');

    const tdLabel = document.createElement('td');
    tdLabel.textContent = row.label;

    const tdSample = document.createElement('td');
    tdSample.className = 'sample';
    const sample = row.values.find(v => v.num !== null);
    tdSample.textContent = sample ? `${sample.month}: ${sample.raw}` : '(empty)';

    const tdMap = document.createElement('td');
    const sel = document.createElement('select');
    sel.innerHTML = `
      <option value="__skip__">— Skip —</option>
      <option value="__month__">[Month-level comment]</option>
    `;
    const grouped = {};
    for (const a of activeAccounts()) (grouped[a.category] ||= []).push(a);
    for (const cat of categoriesInOrder()) {
      const og = document.createElement('optgroup');
      og.label = tr(cat);
      for (const a of grouped[cat.id] || []) {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = tr(a);
        og.appendChild(opt);
      }
      sel.appendChild(og);
    }
    sel.value = row.mapping;
    sel.addEventListener('change', () => {
      row.mapping = sel.value;
      rowEl.classList.toggle('skipped', row.mapping === '__skip__');
    });
    tdMap.appendChild(sel);

    rowEl.appendChild(tdLabel); rowEl.appendChild(tdSample); rowEl.appendChild(tdMap);
    tbody.appendChild(rowEl);
  }
  els.importPreview.hidden = false;
}

export async function onConfirmImport() {
  if (!state.importParsed) return;
  const { rows } = state.importParsed;

  const mapped = rows.filter(r => r.mapping !== '__skip__');
  if (!mapped.length) { setStatus('Nothing to import — all rows are skipped.', 'warn'); return; }

  for (const r of mapped) rememberMapping(r.label, r.mapping);

  const enteredAt = new Date().toISOString();
  const importedRows = [];
  const monthsTouched = new Set();
  for (const r of mapped) {
    for (const v of r.values) {
      if (v.num === null) continue;
      monthsTouched.add(v.month);
      const acct = r.mapping === '__month__' ? null : state.accounts.find(a => a.id === r.mapping);
      let balance = v.num;
      if (acct && acct.kind === 'debt' && balance < 0) balance = -balance;

      if (r.mapping === '__month__') {
        if (v.raw && String(v.raw).trim()) {
          importedRows.push([v.month, '__month__', 0, String(v.raw).trim(), enteredAt]);
        }
      } else {
        importedRows.push([v.month, r.mapping, balance, '', enteredAt]);
      }
    }
  }

  if (!importedRows.length) { setStatus('No data to import.', 'warn'); return; }

  const overwrite = els.overwriteExisting.checked;
  const keep = state.snapshots.filter(s => {
    if (!monthsTouched.has(s.month)) return true;
    return !overwrite;
  });
  const existingKeys = new Set(state.snapshots.map(s => `${s.month}|${s.account_id}`));
  const finalImported = overwrite
    ? importedRows
    : importedRows.filter(r => !existingKeys.has(`${r[0]}|${r[1]}`));

  const allRows = [
    HEADERS.snapshots,
    ...keep.map(s => [s.month, s.account_id, s.balance_raw, s.comment || '', s.entered_at || '']),
    ...finalImported,
  ];

  setStatus(`Importing ${finalImported.length} rows…`);
  els.confirmImportBtn.disabled = true;
  try {
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
    onCancelImport();
    setStatus(`Imported ${finalImported.length} rows across ${monthsTouched.size} months.`, 'ok');
  } catch (err) {
    console.error(err);
    setStatus('Import failed: ' + (err.result?.error?.message || err.message || err), 'warn');
  } finally {
    els.confirmImportBtn.disabled = false;
  }
}

export function onClearImport() {
  els.importInput.value = '';
  onCancelImport();
}

export function onCancelImport() {
  state.importParsed = null;
  els.importPreview.hidden = true;
  els.mappingTableBody.innerHTML = '';
}
