import { state } from '../../core/state.js';
import { getUserMessage } from '../../core/errors.js';
import { t } from '../../core/i18n/index.js';
import { fmtMoney } from '../../core/format.js';
import { setStatus, escapeHtml } from '../../core/dom.js';
import { renderTagChips } from '../../core/components/TagChips.js';
import { attachTagInput } from '../../core/components/TagInput.js';
import { allKnownTags } from '../../utils/tags.js';
import { todayISO } from '../../utils/dates.js';
import { writeOptionFmv } from '../../api/options.js';
import { writeConfig } from '../../api/config.js';
import { GRANT_COLORS, COMPANY_COLORS } from './charts.js';
import { openCompanyDialog, openGrantDialog } from './dialogs.js';
import { buildGrantExercisesBlock } from './components/CompanyCard.js';

// --- Manage sub-panel ---

export function renderOptionsManage() {
  const list = document.getElementById('opt-manage-list');
  if (!list) return;
  list.innerHTML = '';

  // Equity tags row — controls which groups equity is included in
  const tagsRow = document.createElement('section');
  tagsRow.className = 'opt-manage-section';
  tagsRow.style.cssText = 'margin-bottom:1.5rem';
  tagsRow.innerHTML = `
    <header class="section-header" style="margin-bottom:0.5rem">
      <h2>${escapeHtml(t('opt_equity_tags'))}</h2>
    </header>
    <p class="hint" style="margin:0 0 0.75rem">${escapeHtml(t('opt_equity_tags_hint'))}</p>
    <div class="tag-input-wrap" id="opt-equity-tags-wrap">
      <div id="opt-equity-tags-chips" class="tag-chips"></div>
      <input type="text" id="opt-equity-tags-input" autocomplete="off" placeholder="Add tag…">
    </div>`;
  list.appendChild(tagsRow);

  const chipsEl = tagsRow.querySelector('#opt-equity-tags-chips');
  const tagInput = tagsRow.querySelector('#opt-equity-tags-input');
  let _equityTags = [...(state.configEquityTags || [])];

  async function saveEquityTags() {
    state.configEquityTags = [..._equityTags];
    try {
      await writeConfig('equity_tags', _equityTags.join(','));
    } catch (err) {
      setStatus(`${t('opt_save_failed')}: ${getUserMessage(err)}`, 'warn');
    }
  }

  function renderEquityTagChips() {
    renderTagChips(chipsEl, _equityTags, (tag) => {
      _equityTags = _equityTags.filter(t => t !== tag);
      renderEquityTagChips();
      saveEquityTags();
    });
  }

  attachTagInput(tagInput, {
    getTags:          () => _equityTags,
    onAdd:            (tag) => { _equityTags.push(tag); renderEquityTagChips(); saveEquityTags(); },
    getAvailableTags: () => allKnownTags().filter(tag => !_equityTags.includes(tag)),
  });

  renderEquityTagChips();

  const allCompanies = state.optionCompanies;
  if (!allCompanies.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.style.margin = '1rem 0';
    empty.textContent = t('opt_no_companies');
    list.appendChild(empty);
    return;
  }

  allCompanies.forEach((company, ci) => {
    const section = buildCompanyManageSection(company, ci);
    list.appendChild(section);
  });
}

function buildCompanyManageSection(company, ci) {
  const color = COMPANY_COLORS[ci % COMPANY_COLORS.length];
  const grants = state.optionGrants.filter(g => g.company_id === company.id);
  const companyFmv = state.optionFmv
    .filter(f => f.company_id === company.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const section = document.createElement('div');
  section.className = 'opt-manage-section';
  section.style.setProperty('--opt-color', color);

  // Company header
  const header = document.createElement('div');
  header.className = 'opt-manage-header';
  header.innerHTML = `
    <div class="opt-card-title">
      <span class="opt-company-dot"></span>
      <strong>${escapeHtml(company.name)}</strong>
      ${company.ticker ? `<span class="opt-ticker">${escapeHtml(company.ticker)}</span>` : ''}
      ${company.active === false ? `<span class="opt-inactive-badge">${t('opt_inactive')}</span>` : ''}
    </div>
    <button type="button" class="link-btn opt-manage-edit-company">${t('edit_label')}</button>`;
  section.appendChild(header);
  header.querySelector('.opt-manage-edit-company').addEventListener('click', () => openCompanyDialog(company.id));

  // FMV history block
  const fmvBlock = document.createElement('div');
  fmvBlock.className = 'opt-manage-block';

  const fmvTitle = document.createElement('div');
  fmvTitle.className = 'opt-manage-subtitle';
  fmvTitle.textContent = t('opt_fmv_history');
  fmvBlock.appendChild(fmvTitle);

  if (companyFmv.length) {
    const table = document.createElement('table');
    table.className = 'opt-fmv-table';
    table.innerHTML = `<thead><tr>
      <th>${t('opt_fmv_date_col')}</th>
      <th>${t('opt_fmv_value_col')}</th>
      <th>${t('opt_fmv_note_col')}</th>
      <th></th>
    </tr></thead>`;
    const tbody = document.createElement('tbody');

    companyFmv.forEach((entry) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(entry.date)}</td>
        <td>${fmtMoney(Number(entry.fmv))}</td>
        <td class="opt-fmv-note-cell">${escapeHtml(entry.note || '')}</td>
        <td class="opt-fmv-actions">
          <button type="button" class="link-btn fmv-edit-btn">${t('edit_label')}</button>
          <button type="button" class="link-btn fmv-delete-btn" style="color:var(--danger)">✕</button>
        </td>`;
      tr.querySelector('.fmv-edit-btn').addEventListener('click', () => editFmvRow(tbody, tr, company.id, entry));
      tr.querySelector('.fmv-delete-btn').addEventListener('click', () => deleteFmvEntry(company.id, entry));
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    fmvBlock.appendChild(table);
  } else {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.style.margin = '0.25rem 0 0.5rem';
    hint.textContent = t('opt_no_fmv_history');
    fmvBlock.appendChild(hint);
  }

  // Add FMV form
  const addForm = document.createElement('div');
  addForm.className = 'opt-fmv-manage-add';
  const nowStr = todayISO();
  addForm.innerHTML = `
    <input type="date" class="fmv-add-date" value="${nowStr}">
    <input type="number" class="fmv-add-val" placeholder="${escapeHtml(t('opt_fmv_placeholder'))}" step="0.01" min="0">
    <input type="text" class="fmv-add-note" placeholder="${escapeHtml(t('opt_note_placeholder'))}">
    <button type="button" class="fmv-add-btn primary">${t('opt_fmv_add')}</button>`;
  const addBtn = addForm.querySelector('.fmv-add-btn');
  addBtn.addEventListener('click', () => saveFmvEntryFromManage(
    company.id,
    addForm.querySelector('.fmv-add-date'),
    addForm.querySelector('.fmv-add-val'),
    addForm.querySelector('.fmv-add-note'),
    addBtn,
  ));
  fmvBlock.appendChild(addForm);
  section.appendChild(fmvBlock);

  // Grants block
  const grantsBlock = document.createElement('div');
  grantsBlock.className = 'opt-manage-block';

  const grantsTitle = document.createElement('div');
  grantsTitle.className = 'opt-manage-subtitle';
  grantsTitle.textContent = t('opt_grants_label');
  grantsBlock.appendChild(grantsTitle);

  if (grants.length) {
    grants.forEach((grant, gi) => {
      const gColor = GRANT_COLORS[gi % GRANT_COLORS.length];
      const row = document.createElement('div');
      row.className = 'opt-manage-grant-row';
      row.innerHTML = `
        <span class="opt-grant-dot" style="background:${gColor}; width:8px; height:8px; flex-shrink:0"></span>
        <span class="opt-manage-meta">${escapeHtml(grant.label || grant.grant_type || 'Grant')}
          <span class="opt-grant-type-badge">${escapeHtml(grant.grant_type || '')}</span>
          <span class="opt-manage-meta-detail">${(Number(grant.total_shares)||0).toLocaleString()} shares · strike ${fmtMoney(Number(grant.strike_price)||0)}</span>
        </span>
        <button type="button" class="link-btn manage-edit-grant-btn">${t('edit_label')}</button>`;
      row.querySelector('.manage-edit-grant-btn').addEventListener('click', () => openGrantDialog(grant.id, company.id));
      grantsBlock.appendChild(row);
      grantsBlock.appendChild(buildGrantExercisesBlock(grant));
    });
  } else {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.style.margin = '0.25rem 0 0.5rem';
    hint.textContent = t('opt_no_grants');
    grantsBlock.appendChild(hint);
  }

  const addGrantBtn = document.createElement('button');
  addGrantBtn.type = 'button';
  addGrantBtn.className = 'link-btn';
  addGrantBtn.textContent = t('opt_add_grant');
  addGrantBtn.addEventListener('click', () => openGrantDialog(null, company.id));
  grantsBlock.appendChild(addGrantBtn);

  section.appendChild(grantsBlock);
  return section;
}

function editFmvRow(tbody, tr, companyId, entry) {
  tr.innerHTML = `
    <td><input type="date" class="fmv-edit-date" value="${entry.date}"></td>
    <td><input type="number" class="fmv-edit-val" value="${entry.fmv}" step="0.01" min="0" style="width:6rem"></td>
    <td><input type="text" class="fmv-edit-note" value="${escapeHtml(entry.note || '')}" style="width:100%"></td>
    <td class="opt-fmv-actions">
      <button type="button" class="fmv-save-edit primary">✓</button>
      <button type="button" class="link-btn fmv-cancel-edit">✕</button>
    </td>`;

  tr.querySelector('.fmv-save-edit').addEventListener('click', async () => {
    const date = tr.querySelector('.fmv-edit-date').value;
    const fmv  = parseFloat(tr.querySelector('.fmv-edit-val').value);
    const note = tr.querySelector('.fmv-edit-note').value.trim();
    if (!date || !Number.isFinite(fmv) || fmv < 0) return;
    const updated = state.optionFmv.map(f =>
      (f.company_id === companyId && f.date === entry.date && Number(f.fmv) === Number(entry.fmv) && (f.note||'') === (entry.note||''))
        ? { ...f, date, fmv, note }
        : f
    ).sort((a, b) => a.date.localeCompare(b.date));
    try {
      setStatus('Saving…');
      await writeOptionFmv(updated);
      setStatus('Saved.', 'ok');
    } catch (err) {
      setStatus(`${t('opt_save_failed')}: ${getUserMessage(err)}`, 'warn');
    }
    renderOptionsManage();
  });

  tr.querySelector('.fmv-cancel-edit').addEventListener('click', () => renderOptionsManage());
}

async function deleteFmvEntry(companyId, entry) {
  const newFmv = state.optionFmv.filter(f =>
    !(f.company_id === companyId && f.date === entry.date && Number(f.fmv) === Number(entry.fmv) && (f.note||'') === (entry.note||''))
  );
  try {
    setStatus('Deleting…');
    await writeOptionFmv(newFmv);
    setStatus('Deleted.', 'ok');
  } catch (err) {
    setStatus(`${t('opt_save_failed')}: ${getUserMessage(err)}`, 'warn');
  }
  renderOptionsManage();
}

async function saveFmvEntryFromManage(companyId, dateInput, amtInput, noteInput, btn) {
  const date = dateInput.value.trim();
  const fmv  = parseFloat(amtInput.value);
  if (!date || !Number.isFinite(fmv) || fmv < 0) { amtInput.focus(); return; }

  btn.disabled = true;
  const newFmv = [...state.optionFmv, { date, company_id: companyId, fmv, note: noteInput.value.trim() }]
    .sort((a, b) => a.date.localeCompare(b.date));
  try {
    setStatus('Saving FMV…');
    await writeOptionFmv(newFmv);
    amtInput.value = '';
    noteInput.value = '';
    setStatus('FMV saved.', 'ok');
  } catch (err) {
    setStatus(`${t('opt_save_failed')}: ${getUserMessage(err)}`, 'warn');
  } finally {
    btn.disabled = false;
  }
  renderOptionsManage();
}
