import "../en.js";
import "../fr.js";
import "./en.js";
import "./fr.js";
import { state, HEADERS, OWNERS, KINDS } from '../../../core/state.js';
import { t, tr, lang } from '../../../core/i18n/index.js';
import { parseMoney } from '../../../core/format.js';
import { privMoney } from '../../../core/privacy.js';
import { categoriesInOrder, activeAccounts } from '../../../utils/balance.js';
import { normalizeDate, rebuildDatesList, parseMonthLabel } from '../../../utils/dates.js';
import { parseDelimited, suggestAccount, rememberMapping } from '../../../utils/import.js';
import { els, setStatus, escapeHtml } from '../../../core/dom.js';
import { icon, categoryIcon, categoryKey } from '../../../core/icons.js';
import { renderOverview } from '../../overview/index.js';
import { renderHistoryTable, renderChart, populateHistAccountSelect } from '../../history/index.js';
import { renderForm } from '../../entry/index.js';
import { loadAccounts as loadAccountsFromSheet } from '../../../api/accounts.js';
import { writeTagsCatalog } from '../../../api/tags.js';
import { attachAutocomplete } from '../../../core/autocomplete.js';

// --- Helpers ---

function setStatusMsg(msg, level = '') {
  els.accountsStatus.textContent = msg;
  els.accountsStatus.style.color =
    level === 'ok'   ? 'var(--ok)' :
    level === 'warn' ? 'var(--warn)' : 'var(--muted)';
}

function latestBalanceFor(accountId) {
  let best = null;
  for (const s of state.snapshots) {
    if (s.account_id !== accountId) continue;
    if (!best || s.date > best.date) best = s;
  }
  return best;
}

function sortedAccounts(list) {
  const catOrder = Object.fromEntries(state.categoryMeta.map(c => [c.id, c.sort_order || 0]));
  return [...list].sort((a, b) => {
    const co = (catOrder[a.category] ?? 99) - (catOrder[b.category] ?? 99);
    if (co !== 0) return co;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });
}

function ownerLabel(o) {
  return { self: t('owner_self'), partner: t('owner_partner'), joint: t('owner_joint') }[o] || o;
}

// --- Account list rendering ---

export function renderAccountsTable() { renderAccountsList(); } // back-compat alias

export function renderAccountsList() {
  const list = els.accountsList;
  const archived = els.accountsArchived;
  list.innerHTML = '';
  archived.innerHTML = '';

  const active = sortedAccounts(state.accounts.filter(a => a.active));
  const inactive = sortedAccounts(state.accounts.filter(a => !a.active));

  // Group active accounts by category
  let lastCat = null;
  for (const a of active) {
    if (a.category !== lastCat) {
      const header = document.createElement('div');
      header.className = `accounts-group-header cat-${categoryKey(a.category)}`;
      const cat = state.categoryMeta.find(c => c.id === a.category);
      header.innerHTML = `
        <span class="cat-icon">${icon(categoryIcon(a.category), { size: 16 })}</span>
        <span class="accounts-group-name">${cat ? tr(cat) : a.category}</span>
      `;
      list.appendChild(header);
      lastCat = a.category;
    }
    list.appendChild(buildAccountCard(a));
  }

  if (inactive.length) {
    els.toggleArchivedBtn.hidden = false;
    updateArchivedToggleLabel(inactive.length);
    for (const a of inactive) {
      archived.appendChild(buildAccountCard(a));
    }
  } else {
    els.toggleArchivedBtn.hidden = true;
    archived.hidden = true;
  }
}

function updateArchivedToggleLabel(n) {
  const isOpen = !els.accountsArchived.hidden;
  els.toggleArchivedBtn.textContent = isOpen
    ? `Hide archived (${n})`
    : `Show archived (${n})`;
}

export function onToggleArchived() {
  const nextHidden = !els.accountsArchived.hidden;
  els.accountsArchived.hidden = nextHidden;
  const n = state.accounts.filter(a => !a.active).length;
  updateArchivedToggleLabel(n);
}

function buildAccountCard(a) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = `account-card cat-${categoryKey(a.category)}`;
  if (!a.active) card.classList.add('inactive');
  card.dataset.id = a.id;

  const latest = latestBalanceFor(a.id);
  const sharePct = Math.round((a.ownership_share || 1) * 100);
  const metaBits = [ownerLabel(a.owner)];
  if (sharePct !== 100) metaBits.push(`${sharePct}%`);

  card.innerHTML = `
    <span class="cat-icon">${icon(categoryIcon(a.category), { size: 16 })}</span>
    <div class="account-card-main">
      <div class="account-card-name">${escapeHtml(tr(a))}</div>
      <div class="account-card-meta">${metaBits.map(escapeHtml).join(' · ')}</div>
    </div>
    <div class="account-card-balance">
      ${latest ? `<div class="account-card-amount">${privMoney(latest.balance_raw)}</div>
                  <div class="account-card-date">${latest.date}</div>`
               : `<div class="account-card-empty">No data</div>`}
    </div>
    <span class="account-card-chevron">${icon('chevronRight', { size: 16 })}</span>
  `;
  card.addEventListener('click', () => openAccountDialog(a.id));
  return card;
}


// --- Account edit dialog ---

let _editingId = null;  // id of account being edited, or null when creating

function populateAcctTypeSelect() {
  const sel = els.acctTypeSelect;
  sel.innerHTML = '';
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
      opt.textContent = lang() === 'fr' ? type.name_fr : type.name_en;
      og.appendChild(opt);
    }
    sel.appendChild(og);
  }
}

function populateSelect(sel, options, value) {
  sel.innerHTML = '';
  for (const o of options) {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    if (o.value === value) opt.selected = true;
    sel.appendChild(opt);
  }
}

let _dialogTags = [];
let _tagsAC = null;

function setupTagsAutocomplete() {
  if (_tagsAC) return;
  _tagsAC = attachAutocomplete(els.acctTagsInput, {
    getOptions: () => allKnownTags().filter(t => !_dialogTags.includes(t)),
    onPick: (tag) => {
      if (!_dialogTags.includes(tag)) {
        _dialogTags.push(tag);
        renderDialogTagChips();
      }
    },
  });
}

function fillDialogFromAccount(a, { isNew }) {
  els.acctDlgTitle.textContent = isNew ? '+ Add account' : 'Edit account';
  els.acctTypeWrap.hidden = !isNew;
  els.acctIdField.hidden = isNew;
  els.acctDeleteBtn.hidden = isNew || hasHistory(a.id);

  if (isNew) populateAcctTypeSelect();
  if (isNew && a.type) els.acctTypeSelect.value = a.type;

  els.acctNameFr.value = a.name_fr || '';
  els.acctNameEn.value = a.name_en || '';

  const catOpts = state.categoryMeta.map(c => ({ value: c.id, label: tr(c) }));
  populateSelect(els.acctCategory, catOpts, a.category);
  populateSelect(els.acctKind,     KINDS.map(k => ({ value: k, label: k })), a.kind);
  populateSelect(els.acctOwner,    OWNERS.map(o => ({ value: o, label: ownerLabel(o) })), a.owner);

  els.acctShare.value = Math.round((a.ownership_share || 1) * 100);
  els.acctOrder.value = a.sort_order || 0;
  els.acctGrowthRate.value = a.annual_rate ? (a.annual_rate * 100).toFixed(4).replace(/\.?0+$/, '') : '';
  els.acctId.textContent = a.id || '—';
  els.acctActive.checked = a.active !== false;

  _dialogTags = Array.isArray(a.tags) ? [...a.tags] : [];
  els.acctTagsInput.value = '';
  renderDialogTagChips();
  setupTagsAutocomplete();
}

function renderDialogTagChips() {
  const wrap = els.acctTagsChips;
  wrap.innerHTML = '';
  for (const tag of _dialogTags) {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `${escapeHtml(tag)}<button type="button" aria-label="Remove">&times;</button>`;
    chip.querySelector('button').addEventListener('click', () => {
      _dialogTags = _dialogTags.filter(t => t !== tag);
      renderDialogTagChips();
    });
    wrap.appendChild(chip);
  }
}

function allKnownTags() {
  // Pulled from the catalog (canonical source), supplemented with anything
  // currently assigned to an account that might not yet be in the catalog.
  const set = new Set((state.tagsCatalog || []).map(t => t.name));
  for (const a of state.accounts) {
    if (Array.isArray(a.tags)) a.tags.forEach(t => t && set.add(t));
  }
  return [...set].sort();
}

function commitTagInput() {
  const raw = els.acctTagsInput.value.trim();
  if (!raw) return;
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
  for (const p of parts) if (!_dialogTags.includes(p)) _dialogTags.push(p);
  els.acctTagsInput.value = '';
  renderDialogTagChips();
}

export function onAcctTagsKeydown(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    commitTagInput();
  } else if (e.key === 'Backspace' && !els.acctTagsInput.value && _dialogTags.length) {
    _dialogTags.pop();
    renderDialogTagChips();
  }
}

export function onAcctTagsBlur() {
  commitTagInput();
}

function hasHistory(id) {
  return state.snapshots.some(s => s.account_id === id);
}

export function openAccountDialog(id) {
  const a = state.accounts.find(x => x.id === id);
  if (!a) return;
  _editingId = id;
  fillDialogFromAccount(a, { isNew: false });
  els.acctDialog.showModal();
  setTimeout(() => els.acctNameFr.focus(), 0);
}

export function openNewAccountDialog() {
  if (!state.accountTypes.length) {
    setStatusMsg('Account types not loaded yet.', 'warn');
    return;
  }
  _editingId = null;
  const firstType = state.accountTypes[0];
  const blank = {
    id: '', type: firstType.id_prefix,
    name_fr: '', name_en: '',
    category: firstType.category, kind: firstType.kind,
    owner: firstType.default_owner || 'self',
    ownership_share: firstType.default_ownership_share ?? 1,
    active: true, sort_order: 0,
  };
  fillDialogFromAccount(blank, { isNew: true });
  applyTypeDefaultsToDialog(); // sync category/kind/share/order from selected type
  els.acctDialog.showModal();
  setTimeout(() => els.acctNameFr.focus(), 0);
}

// When user picks a different type while creating, pre-fill category/kind/share/order
function applyTypeDefaultsToDialog() {
  const prefix = els.acctTypeSelect.value;
  const type = state.accountTypes.find(t => t.id_prefix === prefix);
  if (!type) return;
  els.acctCategory.value = type.category;
  els.acctKind.value = type.kind;
  els.acctOwner.value = type.default_owner || 'self';
  els.acctShare.value = Math.round((type.default_ownership_share ?? 1) * 100);
  // Suggest a default name based on next-available index
  const existingIds = new Set(state.accounts.map(a => a.id));
  let n = 1;
  while (existingIds.has(`${prefix}_${n}`)) n++;
  if (!els.acctNameFr.value) els.acctNameFr.value = `${type.name_fr} ${n}`;
  if (!els.acctNameEn.value) els.acctNameEn.value = `${type.name_en} ${n}`;
  // Suggest next sort_order in this category
  const orderInCat = state.accounts.filter(a => a.category === type.category).map(a => a.sort_order || 0);
  els.acctOrder.value = (orderInCat.length ? Math.max(...orderInCat) : 0) + 10;
}

export function closeAccountDialog() {
  els.acctDialog.close();
  _editingId = null;
}

export async function saveAccountDialog() {
  if (!state.sheetId) return;
  const isNew = _editingId === null;
  const nameFr = els.acctNameFr.value.trim();
  const nameEn = els.acctNameEn.value.trim();
  if (!nameFr && !nameEn) {
    setStatusMsg('Add at least one name.', 'warn');
    return;
  }

  let id = _editingId;
  let type = '';
  if (isNew) {
    const prefix = els.acctTypeSelect.value;
    type = prefix;
    const existingIds = new Set(state.accounts.map(a => a.id));
    let n = 1;
    while (existingIds.has(`${prefix}_${n}`)) n++;
    id = `${prefix}_${n}`;
  } else {
    type = state.accounts.find(a => a.id === id)?.type || '';
  }

  // Flush any text still in the tag input
  commitTagInput();

  const next = {
    id, type,
    name_fr: nameFr || nameEn,
    name_en: nameEn || nameFr,
    category: els.acctCategory.value,
    kind: els.acctKind.value,
    owner: els.acctOwner.value,
    ownership_share: Math.max(0, Math.min(100, Number(els.acctShare.value) || 0)) / 100,
    active: els.acctActive.checked,
    sort_order: Number(els.acctOrder.value) || 0,
    annual_rate: Number(els.acctGrowthRate.value) / 100 || 0,
    tags: [..._dialogTags],
  };

  const nextAll = isNew
    ? [...state.accounts, next]
    : state.accounts.map(a => a.id === id ? { ...a, ...next } : a);

  // Persist any new tags to the catalog
  const existingNames = new Set((state.tagsCatalog || []).map(t => t.name));
  const newCatalogEntries = [];
  for (const t of next.tags) if (!existingNames.has(t)) {
    existingNames.add(t);
    newCatalogEntries.push({ name: t });
  }

  els.acctSaveBtn.disabled = true;
  setStatusMsg('Saving…');
  try {
    await writeAccountsToSheet(nextAll);
    if (newCatalogEntries.length) {
      state.tagsCatalog = [...state.tagsCatalog, ...newCatalogEntries];
      try { await writeTagsCatalog(state.tagsCatalog); }
      catch (err) { console.warn('[pfs] tags catalog write failed', err); }
    }
    state.accounts = nextAll;
    renderAccountsList();
    renderForm();
    renderHistoryTable();
    renderChart();
    renderOverview();
    populateHistAccountSelect();
    setStatusMsg(isNew ? `Created ${id}.` : `Saved ${id}.`, 'ok');
    closeAccountDialog();
  } catch (err) {
    console.error(err);
    setStatusMsg('Save failed: ' + (err.result?.error?.message || err.message || err), 'warn');
  } finally {
    els.acctSaveBtn.disabled = false;
  }
}

export async function deleteAccountFromDialog() {
  if (_editingId === null) return;
  const id = _editingId;
  if (hasHistory(id)) {
    setStatusMsg('Cannot delete an account with history — archive it instead.', 'warn');
    return;
  }
  if (!confirm(`Delete account "${id}"? This cannot be undone.`)) return;
  const nextAll = state.accounts.filter(a => a.id !== id);
  els.acctDeleteBtn.disabled = true;
  setStatusMsg('Deleting…');
  try {
    await writeAccountsToSheet(nextAll);
    state.accounts = nextAll;
    renderAccountsList();
    renderForm();
    populateHistAccountSelect();
    setStatusMsg(`Deleted ${id}.`, 'ok');
    closeAccountDialog();
  } catch (err) {
    console.error(err);
    setStatusMsg('Delete failed: ' + (err.result?.error?.message || err.message || err), 'warn');
  } finally {
    els.acctDeleteBtn.disabled = false;
  }
}

async function writeAccountsToSheet(rows) {
  const sheetRows = [HEADERS.accounts, ...rows.map(a => HEADERS.accounts.map(h => {
    if (h === 'tags') return Array.isArray(a.tags) ? a.tags.join(', ') : (a.tags || '');
    return a[h] ?? '';
  }))];
  await gapi.client.sheets.spreadsheets.values.clear({ spreadsheetId: state.sheetId, range: 'accounts!A:Z' });
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: state.sheetId, range: 'accounts!A1',
    valueInputOption: 'RAW', resource: { values: sheetRows },
  });
}

export function onAddAccount() {
  openNewAccountDialog();
}

export function onAcctTypeChange() {
  applyTypeDefaultsToDialog();
}

export function onAcctRenameClick() {
  if (_editingId === null) return;
  const id = _editingId;
  closeAccountDialog();
  openMigrateDialog(id);
}

// Legacy aliases that other modules may still reference
export async function onSaveAccounts() { /* no-op: per-card save now */ }
export async function onReloadAccounts() {
  setStatusMsg('Reloading from sheet…');
  await loadAccountsFromSheet();
  renderAccountsList();
  setStatusMsg('Reloaded.', 'ok');
}
export function populateTypePicker() { /* no-op: handled by dialog open */ }

// --- Migrate ID dialog ---

const migrateDialog   = () => document.getElementById('migrate-id-dialog');
const migrateTypeSel  = () => document.getElementById('migrate-type-select');
const migrateCurrentId = () => document.getElementById('migrate-current-id');
const migrateNewId    = () => document.getElementById('migrate-new-id');
const migrateNote     = () => document.getElementById('migrate-snapshots-note');

let _migrateOldId = null;


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
      const snapshotRows = [HEADERS.snapshots, ...state.snapshots.map(s => [s.date, s.account_id, s.balance_raw, s.comment || '', s.entered_at || ''])];
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
    const cols = row.map((c, idx) => ({ idx, date: parseMonthLabel(c) ? `${parseMonthLabel(c)}-01` : null })).filter(x => x.date);
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
      date: mc.date, raw: r[mc.idx] || '',
      num: parseMoney(r[mc.idx]),
    }));
    if (!values.some(v => v.num !== null)) continue;
    rows.push({ label, values, mapping: suggestAccount(label) || '__skip__' });
  }

  state.importParsed = { dates: monthCols.map(m => m.date), rows };
  renderImportPreview();
}

export function renderImportPreview() {
  if (!state.importParsed) { els.importPreview.hidden = true; return; }
  const { dates, rows } = state.importParsed;

  els.importSummary.textContent =
    `${rows.length} source rows · ${dates.length} months (${dates[0]} → ${dates[dates.length - 1]})`;

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
    tdSample.textContent = sample ? `${sample.date}: ${sample.raw}` : '(empty)';

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
  const datesTouched = new Set();
  for (const r of mapped) {
    for (const v of r.values) {
      if (v.num === null) continue;
      datesTouched.add(v.date);
      const acct = r.mapping === '__day__' ? null : state.accounts.find(a => a.id === r.mapping);
      let balance = v.num;
      if (acct && acct.kind === 'debt' && balance < 0) balance = -balance;

      if (r.mapping === '__day__') {
        if (v.raw && String(v.raw).trim()) {
          importedRows.push([v.date, '__day__', 0, String(v.raw).trim(), enteredAt]);
        }
      } else {
        importedRows.push([v.date, r.mapping, balance, '', enteredAt]);
      }
    }
  }

  if (!importedRows.length) { setStatus('No data to import.', 'warn'); return; }

  const overwrite = els.overwriteExisting.checked;
  const keep = state.snapshots.filter(s => {
    if (!datesTouched.has(s.date)) return true;
    return !overwrite;
  });
  const existingKeys = new Set(state.snapshots.map(s => `${s.date}|${s.account_id}`));
  const finalImported = overwrite
    ? importedRows
    : importedRows.filter(r => !existingKeys.has(`${r[0]}|${r[1]}`));

  const allRows = [
    HEADERS.snapshots,
    ...keep.map(s => [s.date, s.account_id, s.balance_raw, s.comment || '', s.entered_at || '']),
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
      date: normalizeDate(r[0]), account_id: r[1], balance_raw: Number(r[2]) || 0,
      comment: r[3] || '', entered_at: r[4] || '',
    }));
    rebuildDatesList();
    renderForm();
    renderHistoryTable();
    renderChart();
    renderOverview();
    onCancelImport();
    setStatus(`Imported ${finalImported.length} rows across ${datesTouched.size} dates.`, 'ok');
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
