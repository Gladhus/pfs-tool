import "./en.js";
import "./fr.js";
import { state } from '../../../core/state.js';
import { t } from '../../../core/i18n/index.js';
import { escapeHtml } from '../../../core/dom.js';
import { renderTagChips } from '../../../core/components/TagChips.js';
import { attachTagInput } from '../../../core/components/TagInput.js';
import { allKnownTags } from '../../../utils/tags.js';
import { getUserMessage } from '../../../core/errors.js';
import { writeGroupsCatalog } from '../../../api/groups.js';
import { groupColor, TAG_PALETTE, renderOverview } from '../../overview/index.js';
import { toast } from '../../../core/toast.js';

const GROUP_COLORS = TAG_PALETTE;

let _editingIdx = null;  // index in groupsCatalog, or null for new
let _selectedColor = GROUP_COLORS[0];

// Per-section chip state
const _chips = { all: [], any: [], exclude: [] };

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
  renderTagChips(el, _chips[section], (tag) => {
    _chips[section] = _chips[section].filter(t => t !== tag);
    renderChips(section);
  });
}

function setupSectionInput(section) {
  const input = document.getElementById(`group-${section}-input`);
  if (!input) return;
  attachTagInput(input, {
    getTags:          () => _chips[section],
    onAdd:            (tag) => { _chips[section].push(tag); renderChips(section); },
    onPop:            () => { _chips[section].pop(); renderChips(section); },
    getAvailableTags: () => allKnownTags().filter(t => !_chips[section].includes(t)),
  });
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
  setupSectionInput('all');
  setupSectionInput('any');
  setupSectionInput('exclude');

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
    toast(`${t('group_save_failed')}: ${getUserMessage(err)}`, { level: 'warn' });
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
    toast(`${t('group_save_failed')}: ${getUserMessage(err)}`, { level: 'warn' });
  } finally {
    if (deleteBtn) deleteBtn.disabled = false;
  }
}
