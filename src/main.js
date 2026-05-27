import { state } from './state.js';
import { setLang, applyI18n, t } from './i18n.js';
import { els } from './dom.js';
import { renderOverview } from './overview.js';
import { renderHistoryTable, renderChart, populateHistAccountSelect } from './history.js';
import { renderForm, saveSnapshot, onCopyPrev } from './entry.js';
import {
  renderAccountsTable, onAddAccount, onSaveAccounts, onReloadAccounts,
  onParseImport, onClearImport, onConfirmImport, onCancelImport,
  executeMigrate, updateMigratePreview, populateTypePicker,
} from './accounts.js';
import {
  configError, onSignedIn, onSignOut, onResetSheetLink, onGapiLoad, initTokenClient,
  loadAndRenderForm, setActiveTab, applyToken,
} from './auth.js';

// --- Wire up all event listeners ---

els.signinBtn.disabled = true;
els.signinBtn.addEventListener('click', () => {
  if (configError()) return;
  state.tokenClient.requestAccessToken({ prompt: 'consent' });
});
els.signoutBtn.addEventListener('click', onSignOut);
els.resetSheetBtn.addEventListener('click', onResetSheetLink);

els.monthInput.addEventListener('change', () => {
  state.currentMonth = els.monthInput.value;
  renderForm();
});
els.copyPrevBtn.addEventListener('click', onCopyPrev);
els.reloadBtn.addEventListener('click', () => loadAndRenderForm());
els.saveSnapshotBtn.addEventListener('click', saveSnapshot);

// History table row click — navigate to entry tab for that month
els.historyTableBody.addEventListener('click', (e) => {
  const row = e.target.closest('tr[data-month]');
  if (!row) return;
  state.currentMonth = row.dataset.month;
  els.monthInput.value = row.dataset.month;
  renderForm();
  setActiveTab('entry');
});

// Tab bar
els.tabBar.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
});

// Overview period pills
document.querySelectorAll('#ov-period-pills .period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#ov-period-pills .period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (els.ovFrom) els.ovFrom.value = '';
    if (els.ovTo)   els.ovTo.value   = '';
    renderOverview();
  });
});
if (els.ovFrom) {
  els.ovFrom.addEventListener('change', () => {
    document.querySelectorAll('#ov-period-pills .period-btn').forEach(b => b.classList.remove('active'));
    renderOverview();
  });
}
if (els.ovTo) {
  els.ovTo.addEventListener('change', () => {
    document.querySelectorAll('#ov-period-pills .period-btn').forEach(b => b.classList.remove('active'));
    renderOverview();
  });
}

// History chart period pills + account select
document.querySelectorAll('#hist-period-pills .period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#hist-period-pills .period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderChart();
  });
});
if (els.histAccountSelect) {
  els.histAccountSelect.addEventListener('change', renderChart);
}

// Series toggles
els.showNet?.addEventListener('change', renderChart);
els.showInvestments?.addEventListener('change', renderChart);
els.showRealEstate?.addEventListener('change', renderChart);

// Accounts management
els.addAccountBtn.addEventListener('click', onAddAccount);
els.saveAccountsBtn.addEventListener('click', onSaveAccounts);
els.reloadAccountsBtn.addEventListener('click', onReloadAccounts);

// Import
els.parseImportBtn.addEventListener('click', onParseImport);
els.clearImportBtn.addEventListener('click', onClearImport);
els.confirmImportBtn.addEventListener('click', onConfirmImport);
els.cancelImportBtn.addEventListener('click', onCancelImport);

// Migrate ID dialog
const migrateDialog = () => document.getElementById('migrate-id-dialog');
document.getElementById('migrate-confirm-btn')?.addEventListener('click', executeMigrate);
document.getElementById('migrate-cancel-btn')?.addEventListener('click', () => migrateDialog()?.close());
document.getElementById('migrate-close-btn')?.addEventListener('click',  () => migrateDialog()?.close());
document.getElementById('migrate-type-select')?.addEventListener('change', updateMigratePreview);
migrateDialog()?.addEventListener('click', (e) => { if (e.target === migrateDialog()) migrateDialog().close(); });

// Language toggle — re-render everything after changing lang
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setLang(btn.dataset.lang);
    if (els.newAccountType) delete els.newAccountType.dataset.populated;
    if (!state.monthsSorted.length) return;
    populateHistAccountSelect();
    renderHistoryTable();
    renderChart();
    renderOverview();
    if (state.currentMonth) renderForm();
    renderAccountsTable();
  });
});

// Private mode toggle
els.privateModeBtn?.addEventListener('click', () => {
  state.privateMode = !state.privateMode;
  try { localStorage.setItem('pfs_private', state.privateMode ? '1' : '0'); } catch (_) {}
  renderOverview();
});

// --- Bootstrap: poll for Google APIs (both load async via CDN) ---
let gapiStarted = false;
let gisStarted  = false;
const poll = setInterval(() => {
  if (!gapiStarted && typeof gapi !== 'undefined') {
    gapiStarted = true;
    onGapiLoad();
  }
  if (!gisStarted && typeof google !== 'undefined' && google.accounts) {
    gisStarted = true;
    initTokenClient();
  }
  if (state.gapiReady && state.gisReady) clearInterval(poll);
}, 50);

configError();
applyI18n();
