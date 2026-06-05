import { state } from '../../core/state.js';
import { getUserMessage } from '../../core/errors.js';
import { t } from '../../core/i18n/index.js';
import { setStatus, attachDialogHandler } from '../../core/dom.js';
import {
  computeVestedShares,
} from '../../utils/options.js';
import { slugify } from '../../utils/import.js';
import { todayISO } from '../../utils/dates.js';
import {
  writeOptionCompanies, writeOptionGrants,
  writeOptionExercises,
} from '../../api/options.js';

// --- Callback injection to avoid circular imports ---

let _onRenderOptions = () => {};
let _onRenderManage  = () => {};

export function setRenderCallbacks(onRenderOptions, onRenderManage) {
  _onRenderOptions = onRenderOptions;
  _onRenderManage  = onRenderManage;
}

// --- Dialog state ---
let _editingCompanyId = null;   // null = new
let _editingGrantId   = null;   // null = new
let _editingGrantCoId = null;   // which company the grant belongs to
let _editingExerciseId      = null;  // null = new
let _editingExerciseGrantId = null;  // which grant the exercise belongs to

// --- Company dialog ---

export function openCompanyDialog(companyId) {
  _editingCompanyId = companyId || null;
  const dlg = document.getElementById('opt-company-dialog');
  if (!dlg) return;

  const title = dlg.querySelector('#opt-company-dlg-title');
  const nameInput   = dlg.querySelector('#opt-company-name');
  const tickerInput = dlg.querySelector('#opt-company-ticker');
  const activeInput = dlg.querySelector('#opt-company-active');
  const deleteBtn   = dlg.querySelector('#opt-company-delete-btn');

  const existing = companyId ? state.optionCompanies.find(c => c.id === companyId) : null;
  title.textContent = existing ? t('opt_edit_company_title') : t('opt_new_company');
  nameInput.value   = existing?.name   || '';
  tickerInput.value = existing?.ticker || '';
  activeInput.checked = existing ? existing.active !== false : true;
  deleteBtn.hidden  = !existing;

  const saveBtn = dlg.querySelector('#opt-company-save-btn');
  attachDialogHandler(saveBtn,   () => saveCompanyDialog());
  attachDialogHandler(deleteBtn, () => deleteCompany(companyId));

  dlg.showModal();
  nameInput.focus();
}

async function saveCompanyDialog() {
  const dlg       = document.getElementById('opt-company-dialog');
  const nameInput = dlg.querySelector('#opt-company-name');
  const ticker    = dlg.querySelector('#opt-company-ticker').value.trim().toUpperCase();
  const active    = dlg.querySelector('#opt-company-active').checked;
  const name      = nameInput.value.trim();
  if (!name) { nameInput.focus(); return; }

  const companies = [...state.optionCompanies];
  if (_editingCompanyId) {
    const idx = companies.findIndex(c => c.id === _editingCompanyId);
    if (idx >= 0) companies[idx] = { ...companies[idx], name, ticker, active };
  } else {
    const id = slugify(name) + '_' + Date.now().toString(36).slice(-4);
    companies.push({ id, name, ticker, active });
  }

  dlg.querySelector('#opt-company-save-btn').disabled = true;
  try {
    setStatus('Saving…');
    await writeOptionCompanies(companies);
    dlg.close();
    setStatus('Saved.', 'ok');
    _onRenderOptions();
  } catch (err) {
    setStatus(`${t('opt_save_failed')}: ${getUserMessage(err)}`, 'warn');
  } finally {
    dlg.querySelector('#opt-company-save-btn').disabled = false;
  }
}

async function deleteCompany(companyId) {
  const companies = state.optionCompanies.filter(c => c.id !== companyId);
  const grants    = state.optionGrants.filter(g => g.company_id !== companyId);
  const dlg       = document.getElementById('opt-company-dialog');
  try {
    setStatus('Deleting…');
    await writeOptionCompanies(companies);
    await writeOptionGrants(grants);
    dlg.close();
    setStatus('Deleted.', 'ok');
    _onRenderOptions();
  } catch (err) {
    setStatus(`${t('opt_save_failed')}: ${getUserMessage(err)}`, 'warn');
  }
}

export function closeCompanyDialog() {
  document.getElementById('opt-company-dialog')?.close();
}

// --- Grant dialog ---

export function openGrantDialog(grantId, companyId) {
  _editingGrantId   = grantId || null;
  _editingGrantCoId = companyId;
  const dlg = document.getElementById('opt-grant-dialog');
  if (!dlg) return;

  const existing = grantId ? state.optionGrants.find(g => g.id === grantId) : null;
  dlg.querySelector('#opt-grant-dlg-title').textContent = existing ? t('opt_edit_grant') : t('opt_new_grant');

  dlg.querySelector('#opt-grant-label').value           = existing?.label           || '';
  dlg.querySelector('#opt-grant-type').value            = existing?.grant_type      || 'ISO';
  dlg.querySelector('#opt-grant-date').value            = existing?.grant_date      || '';
  dlg.querySelector('#opt-grant-shares').value          = existing?.total_shares    || '';
  dlg.querySelector('#opt-grant-strike').value          = existing?.strike_price    ?? '';
  dlg.querySelector('#opt-grant-vesting-start').value   = existing?.vesting_start   || existing?.grant_date || '';
  dlg.querySelector('#opt-grant-cliff').value           = existing?.cliff_months    ?? 12;
  dlg.querySelector('#opt-grant-vesting-months').value  = existing?.vesting_months  || 48;
  dlg.querySelector('#opt-grant-interval').value        = existing?.vesting_interval || 'monthly';
  dlg.querySelector('#opt-grant-expiry').value          = existing?.expiry_date     || '';

  const deleteBtn = dlg.querySelector('#opt-grant-delete-btn');
  deleteBtn.hidden = !existing;

  const saveBtn = dlg.querySelector('#opt-grant-save-btn');
  attachDialogHandler(saveBtn,   () => saveGrantDialog());
  attachDialogHandler(deleteBtn, () => deleteGrant(grantId, companyId));

  // Auto-fill vesting_start from grant_date
  const grantDateInput   = dlg.querySelector('#opt-grant-date');
  const vestingStartInput = dlg.querySelector('#opt-grant-vesting-start');
  grantDateInput.addEventListener('change', () => {
    if (!vestingStartInput.value) vestingStartInput.value = grantDateInput.value;
  }, { once: true });

  dlg.showModal();
  dlg.querySelector('#opt-grant-label').focus();
}

async function saveGrantDialog() {
  const dlg = document.getElementById('opt-grant-dialog');
  const label         = dlg.querySelector('#opt-grant-label').value.trim();
  const grant_type    = dlg.querySelector('#opt-grant-type').value;
  const grant_date    = dlg.querySelector('#opt-grant-date').value;
  const total_shares  = Number(dlg.querySelector('#opt-grant-shares').value);
  const strike_price  = Number(dlg.querySelector('#opt-grant-strike').value) || 0;
  const vesting_start = dlg.querySelector('#opt-grant-vesting-start').value || grant_date;
  const cliff_months  = Number(dlg.querySelector('#opt-grant-cliff').value) || 0;
  const vesting_months = Number(dlg.querySelector('#opt-grant-vesting-months').value);
  const vesting_interval = dlg.querySelector('#opt-grant-interval').value;
  const expiry_date   = dlg.querySelector('#opt-grant-expiry').value || '';

  if (!grant_date || !total_shares || !vesting_months) {
    setStatus('Please fill in grant date, shares, and vesting duration.', 'warn');
    return;
  }

  const grants = [...state.optionGrants];
  if (_editingGrantId) {
    const idx = grants.findIndex(g => g.id === _editingGrantId);
    if (idx >= 0) grants[idx] = { ...grants[idx], label, grant_type, grant_date, total_shares, strike_price, vesting_start, cliff_months, vesting_months, vesting_interval, expiry_date };
  } else {
    const id = `${_editingGrantCoId}_grant_${Date.now().toString(36).slice(-6)}`;
    grants.push({ id, company_id: _editingGrantCoId, label, grant_type, grant_date, total_shares, strike_price, vesting_start, cliff_months, vesting_months, vesting_interval, expiry_date });
  }

  dlg.querySelector('#opt-grant-save-btn').disabled = true;
  try {
    setStatus('Saving grant…');
    await writeOptionGrants(grants);
    dlg.close();
    setStatus('Saved.', 'ok');
    _onRenderOptions();
  } catch (err) {
    setStatus(`${t('opt_save_failed')}: ${getUserMessage(err)}`, 'warn');
  } finally {
    dlg.querySelector('#opt-grant-save-btn').disabled = false;
  }
}

async function deleteGrant(grantId, _companyId) {
  const grants = state.optionGrants.filter(g => g.id !== grantId);
  const dlg = document.getElementById('opt-grant-dialog');
  try {
    setStatus('Deleting grant…');
    await writeOptionGrants(grants);
    dlg.close();
    setStatus('Deleted.', 'ok');
    _onRenderOptions();
  } catch (err) {
    setStatus(`${t('opt_save_failed')}: ${getUserMessage(err)}`, 'warn');
  }
}

export function closeGrantDialog() {
  document.getElementById('opt-grant-dialog')?.close();
}

// --- Exercise dialog ---

export function openExerciseDialog(exerciseId, grantId) {
  _editingExerciseId      = exerciseId || null;
  _editingExerciseGrantId = grantId;
  const dlg = document.getElementById('opt-exercise-dialog');
  if (!dlg) return;

  const grant    = state.optionGrants.find(g => g.id === grantId);
  const existing = exerciseId ? state.optionExercises.find(e => e.id === exerciseId) : null;

  dlg.querySelector('#opt-exercise-dlg-title').textContent =
    existing ? t('opt_edit_exercise') : t('opt_new_exercise');
  dlg.querySelector('#opt-exercise-context').textContent =
    t('opt_exercise_for').replace('{grant}', grant?.label || grant?.grant_type || 'grant');

  dlg.querySelector('#opt-exercise-date').value   = existing?.date || todayISO();
  dlg.querySelector('#opt-exercise-shares').value = existing?.shares_exercised ?? '';
  // Pre-fill the price paid with the grant's strike price for new exercises.
  dlg.querySelector('#opt-exercise-price').value  =
    existing?.price_paid ?? (Number(grant?.strike_price) || 0);
  dlg.querySelector('#opt-exercise-note').value   = existing?.note || '';

  const deleteBtn = dlg.querySelector('#opt-exercise-delete-btn');
  deleteBtn.hidden = !existing;

  const saveBtn = dlg.querySelector('#opt-exercise-save-btn');
  attachDialogHandler(saveBtn,   () => saveExerciseDialog());
  attachDialogHandler(deleteBtn, () => deleteExercise(exerciseId));

  dlg.showModal();
  dlg.querySelector('#opt-exercise-shares').focus();
}

async function saveExerciseDialog() {
  const dlg    = document.getElementById('opt-exercise-dialog');
  const grant  = state.optionGrants.find(g => g.id === _editingExerciseGrantId);
  const date   = dlg.querySelector('#opt-exercise-date').value;
  const shares = Number(dlg.querySelector('#opt-exercise-shares').value);
  const price  = Number(dlg.querySelector('#opt-exercise-price').value) || 0;
  const note   = dlg.querySelector('#opt-exercise-note').value.trim();

  if (!date || !Number.isFinite(shares) || shares <= 0) {
    setStatus(t('opt_exercise_invalid'), 'warn');
    return;
  }

  // Hard block: cannot exercise more than the shares that are vested-but-not-yet
  // exercised as of the exercise date (excluding the row being edited). This also
  // blocks exercising before the cliff, since vested === 0 there.
  const vested = computeVestedShares(grant, date);
  let used = 0;
  for (const ex of state.optionExercises) {
    if (ex.grant_id !== _editingExerciseGrantId) continue;
    if (ex.id === _editingExerciseId) continue;
    if (ex.date > date) continue;
    used += Number(ex.shares_exercised) || 0;
  }
  const maxShares = Math.max(0, vested - used);
  if (shares > maxShares) {
    setStatus(t('opt_exercise_too_many').replace('{max}', Math.round(maxShares).toLocaleString()), 'warn');
    return;
  }

  const exercises = [...state.optionExercises];
  if (_editingExerciseId) {
    const idx = exercises.findIndex(e => e.id === _editingExerciseId);
    if (idx >= 0) exercises[idx] = { ...exercises[idx], grant_id: _editingExerciseGrantId, date, shares_exercised: shares, price_paid: price, note };
  } else {
    const id = `${_editingExerciseGrantId}_ex_${Date.now().toString(36).slice(-6)}`;
    exercises.push({ id, grant_id: _editingExerciseGrantId, date, shares_exercised: shares, price_paid: price, note });
  }
  exercises.sort((a, b) => a.date.localeCompare(b.date));

  dlg.querySelector('#opt-exercise-save-btn').disabled = true;
  try {
    setStatus('Saving exercise…');
    await writeOptionExercises(exercises);
    dlg.close();
    setStatus('Saved.', 'ok');
    _onRenderOptions();
  } catch (err) {
    setStatus(`${t('opt_save_failed')}: ${getUserMessage(err)}`, 'warn');
  } finally {
    dlg.querySelector('#opt-exercise-save-btn').disabled = false;
  }
}

async function deleteExercise(exerciseId) {
  const exercises = state.optionExercises.filter(e => e.id !== exerciseId);
  const dlg = document.getElementById('opt-exercise-dialog');
  try {
    setStatus('Deleting exercise…');
    await writeOptionExercises(exercises);
    dlg.close();
    setStatus('Deleted.', 'ok');
    _onRenderOptions();
  } catch (err) {
    setStatus(`${t('opt_save_failed')}: ${getUserMessage(err)}`, 'warn');
  }
}

export function closeExerciseDialog() {
  document.getElementById('opt-exercise-dialog')?.close();
}
