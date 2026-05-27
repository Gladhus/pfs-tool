import { state, LS_KEY_THEME, HEADERS } from './state.js';
import { setLang, applyI18n, t } from './i18n.js';
import { els, _setToastFn } from './dom.js';
import { toast } from './toast.js';

_setToastFn(toast);
import { renderOverview } from './overview.js';
import { renderHistoryTable, renderChart, populateHistAccountSelect } from './history.js';
import { renderDetailTable } from './detail.js';
import { renderForm, saveSnapshot, onCopyPrev } from './entry.js';
import {
  renderAccountsList, onAddAccount, onToggleArchived,
  saveAccountDialog, deleteAccountFromDialog, closeAccountDialog,
  onAcctTypeChange, onAcctRenameClick, onAcctTagsKeydown, onAcctTagsBlur,
  onParseImport, onClearImport, onConfirmImport, onCancelImport,
  executeMigrate, updateMigratePreview,
} from './accounts.js';
import {
  configError, onSignedIn, onSignOut, onResetSheetLink, onGapiLoad, initTokenClient,
  loadAndRenderForm, setActiveTab, applyToken,
} from './auth.js';
import {
  renderGroupsList, openNewGroupDialog, saveGroupDialog,
  closeGroupDialog, deleteGroupFromDialog,
} from './groups.js';

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
els.resetSheetBtn.addEventListener('click', onResetSheetLink);

els.dateInput.addEventListener('change', () => {
  state.currentDate = els.dateInput.value;
  renderForm();
});
els.copyPrevBtn.addEventListener('click', onCopyPrev);
els.reloadBtn.addEventListener('click', () => loadAndRenderForm());
els.saveSnapshotBtn.addEventListener('click', saveSnapshot);

// History card click — navigate to entry tab for that date
els.historyCards.addEventListener('click', (e) => {
  const row = e.target.closest('[data-date]');
  if (!row || e.target.closest('.hist-expand-btn')) return;
  state.currentDate = row.dataset.date;
  els.dateInput.value = row.dataset.date;
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
if (els.histAccountSelect) {
  els.histAccountSelect.addEventListener('change', renderChart);
}

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
    if (!state.datesSorted.length) return;
    populateHistAccountSelect();
    renderHistoryTable();
    renderChart();
    renderOverview();
    renderDetailTable();
    if (state.currentDate) renderForm();
    renderAccountsList();
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
    if (target === 'groups') renderGroupsList();
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

// Theme picker
function applyTheme(mode) {
  state.theme = mode;
  try { localStorage.setItem(LS_KEY_THEME, mode); } catch (_) {}
  if (mode === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', mode);
  document.querySelectorAll('.theme-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.theme === mode));
}
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
  a.href = url; a.download = `pfs-snapshots-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});

// Dismiss chart tooltips when tapping outside a canvas (touch devices have no
// mouseout, so Chart.js tooltips stay pinned otherwise)
function dismissChartTooltips() {
  for (const c of [state.chart, state.overviewChart]) {
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
  else if (key === '2') { document.querySelector('.tab-btn[data-tab="history"]')?.click(); e.preventDefault(); }
  else if (key === '3') { document.querySelector('.tab-btn[data-tab="detail"]')?.click(); e.preventDefault(); }
  else if (key === 'n') { document.querySelector('.tab-btn[data-tab="entry"]')?.click(); setTimeout(() => els.dateInput?.focus(), 50); e.preventDefault(); }
  else if (key === 's' && !els.saveSnapshotBtn.disabled && !document.getElementById('tab-entry').hidden) { els.saveSnapshotBtn?.click(); e.preventDefault(); }
  else if (key === 'p') { els.privateModeBtn?.click(); e.preventDefault(); }
  else if (key === '?') { toast('Shortcuts: 1-3 tabs · n entry · s save · p private · ? help', { timeout: 5000 }); e.preventDefault(); }
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
