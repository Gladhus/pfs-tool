import 'air-datepicker/air-datepicker.css';
import '../style.css';
import './core/i18n/common/en.js';
import './core/i18n/common/fr.js';

import AirDatepicker from 'air-datepicker';
import localeEn from 'air-datepicker/locale/en';
import localeFr from 'air-datepicker/locale/fr';
import { state, LS_KEY_THEME, LS_KEY_ACTIVE_TAB, HEADERS } from './core/state.js';
import { setLang, applyI18n, t, lang, registerWriteConfig } from './core/i18n/index.js';
import { els, _setToastFn } from './core/dom.js';
import { toast } from './core/toast.js';

_setToastFn(toast);
import { renderOverview } from './features/overview/index.js';
import { renderHistoryTable, renderChart, populateHistAccountSelect } from './features/history/index.js';
import { renderDetailTable } from './features/detail/index.js';
import { renderForm, saveSnapshot, onCopyPrev, onResetEntry } from './features/entry/index.js';
import {
  renderAccountsList, onAddAccount, onToggleArchived,
  saveAccountDialog, deleteAccountFromDialog, closeAccountDialog,
  onAcctTypeChange, onAcctRenameClick, onAcctTagsKeydown, onAcctTagsBlur,
  onParseImport, onClearImport, onConfirmImport, onCancelImport,
  executeMigrate, updateMigratePreview,
} from './features/settings/accounts/index.js';
import {
  configError, onSignedIn, onSignOut, onChooseSheet, onGapiLoad, initTokenClient,
  loadAndRenderForm, setActiveTab, setAccountsSubTab, applyToken, registerApplyTheme,
} from './features/auth/index.js';
import { writeConfig } from './api/index.js';
import {
  renderGroupsList, openNewGroupDialog, saveGroupDialog,
  closeGroupDialog, deleteGroupFromDialog,
} from './features/settings/groups/index.js';
import { openCompanyDialog, closeCompanyDialog, openGrantDialog, closeGrantDialog } from './features/options/index.js';

// Stamp the build version into the footer
const vEl = document.getElementById('app-version');
if (vEl) vEl.textContent = typeof __APP_VERSION__ !== 'undefined' ? `v${__APP_VERSION__}` : '';

// --- Wire up all event listeners ---

els.signinBtn.disabled = true;
els.signinBtn.addEventListener('click', () => {
  if (configError()) return;
  state.tokenClient.requestAccessToken({ prompt: 'consent' });
});
els.signoutBtn.addEventListener('click', onSignOut);
els.chooseSheetBtn?.addEventListener('click', onChooseSheet);
document.getElementById('sheet-picker-close')?.addEventListener('click', () => document.getElementById('sheet-picker-dialog')?.close());
document.getElementById('sheet-picker-cancel')?.addEventListener('click', () => document.getElementById('sheet-picker-dialog')?.close());

const parseLocalDate = (s) => { const [y, m, d] = s.split('-'); return new Date(+y, +m - 1, +d); };
state.datePicker = new AirDatepicker(els.dateInput, {
  dateFormat: 'yyyy-MM-dd',
  locale: lang() === 'fr' ? localeFr : localeEn,
  autoClose: true,
  keyboardNav: false,
  onSelect({ formattedDate }) {
    if (!formattedDate) return;
    state.currentDate = formattedDate;
    renderForm();
  },
});
els.resetEntryBtn?.addEventListener('click', onResetEntry);
els.copyPrevBtn.addEventListener('click', onCopyPrev);
els.reloadBtn.addEventListener('click', () => loadAndRenderForm());
els.saveSnapshotBtn.addEventListener('click', saveSnapshot);

// History card click — navigate to entry tab for that date
els.historyCards.addEventListener('click', (e) => {
  const row = e.target.closest('[data-date]');
  if (!row || e.target.closest('.hist-expand-btn')) return;
  state.currentDate = row.dataset.date;
  state.datePicker ? state.datePicker.selectDate(parseLocalDate(row.dataset.date), { silent: true }) : (els.dateInput.value = row.dataset.date);
  renderForm();
  setActiveTab('entry');
});

// Tab bar
els.tabBar.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.tab === 'entry' && els.dateInput) {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      state.currentDate = today;
      state.datePicker ? state.datePicker.selectDate(parseLocalDate(today), { silent: true }) : (els.dateInput.value = today);
    }
    setActiveTab(btn.dataset.tab);
  });
});

// Accounts sub-navigation
document.querySelectorAll('#accounts-subnav .subnav-btn').forEach(btn => {
  btn.addEventListener('click', () => setAccountsSubTab(btn.dataset.panel));
});
document.getElementById('accounts-gear-btn')?.addEventListener('click', () => {
  setActiveTab('accounts');
  setAccountsSubTab('manage');
});

// Stock Options gear
document.getElementById('opt-settings-btn')?.addEventListener('click', () => {
  const panel = document.getElementById('opt-settings-panel');
  const btn   = document.getElementById('opt-settings-btn');
  if (!panel) return;
  panel.hidden = !panel.hidden;
  btn?.classList.toggle('active', !panel.hidden);
});

// Stock Options enable/disable
const _stockOptTabBtn = els.tabBar.querySelector('[data-tab="options"]');
const _enableStockOptsCb = document.getElementById('enable-stock-options');
function _applyStockOptions(enabled, persist = true) {
  if (persist) try { localStorage.setItem('pfs_stock_options', enabled ? '1' : '0'); } catch (_) {}
  if (_stockOptTabBtn) _stockOptTabBtn.hidden = !enabled;
  if (!enabled && localStorage.getItem(LS_KEY_ACTIVE_TAB) === 'options') setActiveTab('overview');
}
const _stockOptEnabled = localStorage.getItem('pfs_stock_options') === '1';
if (_enableStockOptsCb) _enableStockOptsCb.checked = _stockOptEnabled;
_applyStockOptions(_stockOptEnabled, false);
_enableStockOptsCb?.addEventListener('change', () => _applyStockOptions(_enableStockOptsCb.checked));

// Overview period pills
document.querySelectorAll('#ov-period-pills .period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#ov-period-pills .period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderOverview();
  });
});

// Overview view toggle (Category | Group)
els.ovViewToggle?.querySelectorAll('.ov-view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    try { localStorage.setItem('pfs_ov_view', view); } catch {}
    renderOverview();
  });
});

// Detail period pills
document.querySelectorAll('#detail-period-pills .period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#detail-period-pills .period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderDetailTable();
  });
});

// History chart period pills + account select
document.querySelectorAll('#hist-period-pills .period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#hist-period-pills .period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderChart();
  });
});
// Close custom account select when clicking outside
document.addEventListener('click', () => {
  const wrap = els.histAccountSelect;
  if (!wrap) return;
  const menu = wrap.querySelector('.custom-select-menu');
  if (menu && !menu.hidden) { menu.hidden = true; wrap.classList.remove('open'); }
});

// Series toggles
els.showNet?.addEventListener('change', renderChart);
els.showInvestments?.addEventListener('change', renderChart);
els.showRealEstate?.addEventListener('change', renderChart);

// Accounts management
els.addAccountBtn.addEventListener('click', onAddAccount);
els.toggleArchivedBtn?.addEventListener('click', onToggleArchived);

// Account edit dialog
els.acctSaveBtn?.addEventListener('click', saveAccountDialog);
els.acctCancelBtn?.addEventListener('click', closeAccountDialog);
els.acctDlgClose?.addEventListener('click', closeAccountDialog);
els.acctDeleteBtn?.addEventListener('click', deleteAccountFromDialog);
els.acctTypeSelect?.addEventListener('change', onAcctTypeChange);
els.acctRenameBtn?.addEventListener('click', onAcctRenameClick);
els.acctTagsInput?.addEventListener('keydown', onAcctTagsKeydown);
els.acctTagsInput?.addEventListener('blur', onAcctTagsBlur);
els.acctDialog?.addEventListener('click', (e) => {
  if (e.target === els.acctDialog) closeAccountDialog();
});

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
    state.datePicker?.update({ locale: btn.dataset.lang === 'fr' ? localeFr : localeEn });
    if (!state.datesSorted.length) return;
    populateHistAccountSelect();
    renderHistoryTable();
    renderChart();
    renderOverview();
    renderDetailTable();
    if (state.currentDate) renderForm();
    renderAccountsList();
    renderGroupsList();
  });
});

// Private mode toggle
els.privateModeBtn?.addEventListener('click', () => {
  state.privateMode = !state.privateMode;
  try { localStorage.setItem('pfs_private', state.privateMode ? '1' : '0'); } catch (_) {}
  renderOverview();
});

// Settings sub-tabs
els.settingsSubtabs?.querySelectorAll('.subtab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.subtab;
    els.settingsSubtabs.querySelectorAll('.subtab-btn').forEach(b =>
      b.classList.toggle('active', b === btn));
    document.querySelectorAll('#tab-settings .subtab-panel').forEach(p =>
      p.hidden = (p.dataset.subtab !== target));
  });
});

// Groups editor
els.addGroupBtn?.addEventListener('click', openNewGroupDialog);
document.getElementById('group-save-btn')?.addEventListener('click', saveGroupDialog);
document.getElementById('group-cancel-btn')?.addEventListener('click', closeGroupDialog);
document.getElementById('group-dlg-close')?.addEventListener('click', closeGroupDialog);
document.getElementById('group-delete-btn')?.addEventListener('click', deleteGroupFromDialog);
document.getElementById('group-edit-dialog')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('group-edit-dialog')) closeGroupDialog();
});

// Options tab
document.getElementById('opt-add-company-btn')?.addEventListener('click', () => openCompanyDialog(null));
document.getElementById('opt-company-cancel-btn')?.addEventListener('click', closeCompanyDialog);
document.getElementById('opt-company-dlg-close')?.addEventListener('click', closeCompanyDialog);
document.getElementById('opt-grant-cancel-btn')?.addEventListener('click', closeGrantDialog);
document.getElementById('opt-grant-dlg-close')?.addEventListener('click', closeGrantDialog);
document.getElementById('opt-company-dialog')?.addEventListener('click', e => { if (e.target === document.getElementById('opt-company-dialog')) closeCompanyDialog(); });
document.getElementById('opt-grant-dialog')?.addEventListener('click', e => { if (e.target === document.getElementById('opt-grant-dialog')) closeGrantDialog(); });

// Theme picker
function applyTheme(mode, { persist = true } = {}) {
  state.theme = mode;
  try { localStorage.setItem(LS_KEY_THEME, mode); } catch (_) {}
  if (mode === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', mode);
  document.querySelectorAll('.theme-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.theme === mode));
  if (persist) writeConfig('theme', mode);
}
registerApplyTheme((mode) => applyTheme(mode, { persist: false }));
registerWriteConfig(writeConfig);
document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
});
applyTheme(state.theme);

// CSV export
els.exportCsvBtn?.addEventListener('click', () => {
  const rows = [HEADERS.snapshots, ...state.snapshots.map(s =>
    [s.date, s.account_id, s.balance_raw, s.comment || '', s.entered_at || '']
  )];
  const csv = rows.map(r => r.map(cell => {
    const s = String(cell ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const _n = new Date();
  const _d = `${_n.getFullYear()}-${String(_n.getMonth()+1).padStart(2,'0')}-${String(_n.getDate()).padStart(2,'0')}`;
  a.href = url; a.download = `pfs-snapshots-${_d}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});

// Dismiss chart tooltips when tapping outside a canvas (touch devices have no
// mouseout, so Chart.js tooltips stay pinned otherwise)
function dismissChartTooltips() {
  const optCharts = Object.values(state.optionCompanyCharts || {});
  for (const c of [state.chart, state.overviewChart, state.optionSummaryChart, ...optCharts]) {
    if (!c) continue;
    c.setActiveElements([]);
    if (c.tooltip) c.tooltip.setActiveElements([], { x: 0, y: 0 });
    c.update();
  }
}
document.addEventListener('touchstart', (e) => {
  if (e.target?.tagName !== 'CANVAS') dismissChartTooltips();
}, { passive: true });
document.addEventListener('click', (e) => {
  if (e.target?.tagName !== 'CANVAS') dismissChartTooltips();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Skip if user is typing in an input/textarea/select/contenteditable
  const tgt = e.target;
  const inEditable = tgt && (tgt.matches('input, textarea, select') || tgt.isContentEditable);
  if (inEditable) return;
  if (e.altKey || e.ctrlKey || e.metaKey) return;

  const key = e.key.toLowerCase();
  if (key === '1') { document.querySelector('.tab-btn[data-tab="overview"]')?.click(); e.preventDefault(); }
  else if (key === '2') { setActiveTab('accounts'); setAccountsSubTab('detail'); e.preventDefault(); }
  else if (key === '3') { setActiveTab('accounts'); setAccountsSubTab('history'); e.preventDefault(); }
  else if (key === '4' && localStorage.getItem('pfs_stock_options') === '1') { document.querySelector('.tab-btn[data-tab="options"]')?.click(); e.preventDefault(); }
  else if (key === 'n') { document.querySelector('.tab-btn[data-tab="entry"]')?.click(); setTimeout(() => els.dateInput?.focus(), 50); e.preventDefault(); }
  else if (key === 's' && !els.saveSnapshotBtn.disabled && !document.getElementById('tab-entry').hidden) { els.saveSnapshotBtn?.click(); e.preventDefault(); }
  else if (key === 'p') { els.privateModeBtn?.click(); e.preventDefault(); }
  else if (key === '?') { toast('Shortcuts: 1 overview · 2 accounts · 3 history · 4 stock options · n entry · s save · p private', { timeout: 5000 }); e.preventDefault(); }
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
