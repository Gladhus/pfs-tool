import { state } from '../../../core/state.js';
import { t } from '../../../core/i18n/index.js';
import { els } from '../../../core/dom.js';
import { writeGroupsCatalog } from '../../../api/groups.js';
import { attachAutocomplete } from '../../../core/autocomplete.js';
import { groupColor, TAG_PALETTE, renderOverview } from '../../overview/index.js';
import { toast } from '../../../core/toast.js';

const GROUP_COLORS = TAG_PALETTE;

let _editingIdx = null;  // index in groupsCatalog, or null for new
let _selectedColor = GROUP_COLORS[0];

// Per-section chip state
const _chips = { all: [], any: [], exclude: [] };

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function allKnownTags() {
  const set = new Set((state.tagsCatalog || []).map(t => t.name));
  for (const a of state.accounts) {
    if (Array.isArray(a.tags)) a.tags.forEach(t => t && set.add(t));
  }
  return [...set].sort();
}

// --- Group list rendering ---

export function renderGroupsList() {
  const list = document.getElementById('groups-list');
  if (!list) return;
  list.innerHTML = '';
  const groups = state.groupsCatalog || [];
  if (!groups.length) {
    list.innerHTML = `<p class="hint" style="padding: 12px 0">${escapeHtml(t('no_groups_hint'))}</p>`;
    return;
  }
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const color = groupColor(g);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'group-list-card';
    card.style.setProperty('--group-color', color);

    const filterParts = [];
    if (g.all?.length)     filterParts.push(`All: ${g.all.join(', ')}`);
    if (g.any?.length)     filterParts.push(`Any: ${g.any.join(', ')}`);
    if (g.exclude?.length) filterParts.push(`Excl: ${g.exclude.join(', ')}`);
    const filterText = filterParts.join(' · ') || t('group_no_filter');

    card.innerHTML = `
      <span class="group-list-dot"></span>
      <div class="group-list-info">
        <div class="group-list-name">${escapeHtml(g.name)}</div>
        <div class="group-list-filter">${escapeHtml(filterText)}</div>
      </div>
      <span class="group-list-chevron">›</span>
    `;
    card.addEventListener('click', () => openGroupDialog(i));
    list.appendChild(card);
  }
}

// --- Dialog ---

function renderColorSwatches() {
  const wrap = document.getElementById('group-color-swatches');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (const c of GROUP_COLORS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'color-swatch' + (c === _selectedColor ? ' active' : '');
    btn.style.background = c;
    btn.title = c;
    btn.addEventListener('click', () => {
      _selectedColor = c;
      renderColorSwatches();
    });
    wrap.appendChild(btn);
  }
}

function renderChips(section) {
  const el = document.getElementById(`group-${section}-chips`);
  if (!el) return;
  el.innerHTML = '';
  for (const tag of _chips[section]) {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `${escapeHtml(tag)}<button type="button" aria-label="Remove">&times;</button>`;
    chip.querySelector('button').addEventListener('click', () => {
      _chips[section] = _chips[section].filter(t => t !== tag);
      renderChips(section);
    });
    el.appendChild(chip);
  }
}

function setupSectionAutocomplete(section) {
  const input = document.getElementById(`group-${section}-input`);
  if (!input || input._acAttached) return;
  input._acAttached = true;

  // Commit on Enter or comma
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitChipInput(section);
    } else if (e.key === 'Backspace' && !input.value && _chips[section].length) {
      _chips[section].pop();
      renderChips(section);
    }
  });
  input.addEventListener('blur', () => commitChipInput(section));

  attachAutocomplete(input, {
    getOptions: () => allKnownTags().filter(t => !_chips[section].includes(t)),
    onPick: (tag) => {
      if (!_chips[section].includes(tag)) {
        _chips[section].push(tag);
        renderChips(section);
      }
    },
  });
}

function commitChipInput(section) {
  const input = document.getElementById(`group-${section}-input`);
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) return;
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
  for (const p of parts) if (!_chips[section].includes(p)) _chips[section].push(p);
  input.value = '';
  renderChips(section);
}

function fillGroupDialog(group) {
  const nameEl = document.getElementById('group-name');
  if (nameEl) nameEl.value = group ? group.name : '';
  _selectedColor = (group && group.color) || GROUP_COLORS[_editingIdx != null ? _editingIdx % GROUP_COLORS.length : 0];
  _chips.all     = group ? [...(group.all || [])]     : [];
  _chips.any     = group ? [...(group.any || [])]     : [];
  _chips.exclude = group ? [...(group.exclude || [])] : [];

  renderColorSwatches();
  renderChips('all');
  renderChips('any');
  renderChips('exclude');
  setupSectionAutocomplete('all');
  setupSectionAutocomplete('any');
  setupSectionAutocomplete('exclude');

  const titleEl = document.getElementById('group-dlg-title');
  if (titleEl) titleEl.textContent = group ? t('edit_group') : t('add_group');
  const deleteBtn = document.getElementById('group-delete-btn');
  if (deleteBtn) deleteBtn.hidden = (_editingIdx === null);
}

export function openGroupDialog(idx) {
  _editingIdx = (idx !== undefined && idx !== null) ? idx : null;
  const group = _editingIdx !== null ? (state.groupsCatalog || [])[_editingIdx] : null;
  fillGroupDialog(group);
  const dialog = document.getElementById('group-edit-dialog');
  dialog?.showModal();
  setTimeout(() => document.getElementById('group-name')?.focus(), 0);
}

export function openNewGroupDialog() {
  openGroupDialog(null);
}

export function closeGroupDialog() {
  document.getElementById('group-edit-dialog')?.close();
  _editingIdx = null;
}

export async function saveGroupDialog() {
  const nameEl = document.getElementById('group-name');
  const name = nameEl?.value.trim();
  if (!name) { nameEl?.focus(); return; }

  // Flush any uncommitted chip inputs
  ['all', 'any', 'exclude'].forEach(commitChipInput);

  const group = {
    name,
    color: _selectedColor,
    all:     [..._chips.all],
    any:     [..._chips.any],
    exclude: [..._chips.exclude],
  };

  const saveBtn = document.getElementById('group-save-btn');
  if (saveBtn) saveBtn.disabled = true;
  try {
    const next = [...(state.groupsCatalog || [])];
    if (_editingIdx !== null) next[_editingIdx] = group;
    else next.push(group);

    await writeGroupsCatalog(next);
    state.groupsCatalog = next;
    renderGroupsList();
    renderOverview();
    closeGroupDialog();
    toast(t('group_saved'), { level: 'ok' });
  } catch (err) {
    console.error(err);
    toast(t('group_save_failed') + ': ' + (err.result?.error?.message || err.message || err), { level: 'warn' });
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

export async function deleteGroupFromDialog() {
  if (_editingIdx === null) return;
  const g = (state.groupsCatalog || [])[_editingIdx];
  if (!g || !confirm(`Delete group "${g.name}"?`)) return;

  const deleteBtn = document.getElementById('group-delete-btn');
  if (deleteBtn) deleteBtn.disabled = true;
  try {
    const next = (state.groupsCatalog || []).filter((_, i) => i !== _editingIdx);
    await writeGroupsCatalog(next);
    state.groupsCatalog = next;
    renderGroupsList();
    renderOverview();
    closeGroupDialog();
    toast(t('group_deleted'), { level: 'ok' });
  } catch (err) {
    console.error(err);
    toast(t('group_save_failed') + ': ' + (err.result?.error?.message || err.message || err), { level: 'warn' });
  } finally {
    if (deleteBtn) deleteBtn.disabled = false;
  }
}
