export const els = {
  signinBtn:         document.getElementById('signin-btn'),
  signoutBtn:        document.getElementById('signout-btn'),
  userEmail:         document.getElementById('user-email'),
  signedOut:         document.getElementById('signed-out-state'),
  signedIn:          document.getElementById('signed-in-state'),
  sheetInfo:         document.getElementById('sheet-info'),
  sheetLink:         document.getElementById('sheet-link'),
  sheetLink2:        document.getElementById('sheet-link-2'),
  resetSheetBtn:     document.getElementById('reset-sheet-btn'),
  exportCsvBtn:      document.getElementById('export-csv-btn'),
  settingsSubtabs:   document.getElementById('settings-subtabs'),
  status:            document.getElementById('status'),
  entryForm:         document.getElementById('entry-form'),
  dateInput:         document.getElementById('date-input'),
  dateBadge:         document.getElementById('date-badge'),
  resetEntryBtn:     document.getElementById('reset-entry-btn'),
  copyPrevBtn:       document.getElementById('copy-prev-btn'),
  categoriesEl:      document.getElementById('categories'),
  dayCommentEl:      document.getElementById('day-comment-input'),
  totalsGrid:        document.getElementById('totals-grid'),
  netWorthVal:       document.getElementById('net-worth-val'),
  netWorthDelta:     document.getElementById('net-worth-delta'),
  saveSnapshotBtn:   document.getElementById('save-snapshot-btn'),
  reloadBtn:         document.getElementById('reload-btn'),
  historySection:    document.getElementById('history-section'),
  historySummary:    document.getElementById('history-summary'),
  historyCards:      document.getElementById('history-cards'),
  chartSection:      document.getElementById('chart-section'),
  chartCanvas:       document.getElementById('net-worth-chart'),
  showNet:           document.getElementById('show-net'),
  showInvestments:   document.getElementById('show-investments'),
  showRealEstate:    document.getElementById('show-realestate'),
  tabBar:            document.getElementById('tab-bar'),
  accountsSection:   document.getElementById('accounts-section'),
  accountsList:      document.getElementById('accounts-list'),
  accountsArchived:  document.getElementById('accounts-archived-list'),
  toggleArchivedBtn: document.getElementById('toggle-archived-btn'),
  addAccountBtn:     document.getElementById('add-account-btn'),
  accountsStatus:    document.getElementById('accounts-status'),
  // Account edit dialog
  acctDialog:        document.getElementById('account-edit-dialog'),
  acctDlgTitle:      document.getElementById('acct-dlg-title'),
  acctDlgClose:      document.getElementById('acct-dlg-close'),
  acctTypeWrap:      document.getElementById('acct-type-wrap'),
  acctTypeSelect:    document.getElementById('acct-type-select'),
  acctNameFr:        document.getElementById('acct-name-fr'),
  acctNameEn:        document.getElementById('acct-name-en'),
  acctCategory:      document.getElementById('acct-category'),
  acctKind:          document.getElementById('acct-kind'),
  acctOwner:         document.getElementById('acct-owner'),
  acctShare:         document.getElementById('acct-share'),
  acctOrder:         document.getElementById('acct-order'),
  acctIdField:       document.getElementById('acct-id-field'),
  acctId:            document.getElementById('acct-id'),
  acctRenameBtn:     document.getElementById('acct-rename-btn'),
  acctActive:        document.getElementById('acct-active'),
  acctTagsChips:     document.getElementById('acct-tags-chips'),
  acctTagsInput:     document.getElementById('acct-tags-input'),
  acctTagsSuggest:   document.getElementById('acct-tags-suggest'),
  acctSaveBtn:       document.getElementById('acct-save-btn'),
  acctCancelBtn:     document.getElementById('acct-cancel-btn'),
  acctDeleteBtn:     document.getElementById('acct-delete-btn'),
  importSection:     document.getElementById('import-section'),
  importInput:       document.getElementById('import-input'),
  parseImportBtn:    document.getElementById('parse-import-btn'),
  clearImportBtn:    document.getElementById('clear-import-btn'),
  importPreview:     document.getElementById('import-preview'),
  importSummary:     document.getElementById('import-summary'),
  mappingTableBody:  document.querySelector('#mapping-table tbody'),
  overwriteExisting: document.getElementById('overwrite-existing'),
  confirmImportBtn:  document.getElementById('confirm-import-btn'),
  cancelImportBtn:   document.getElementById('cancel-import-btn'),
  ovNetWorth:        document.getElementById('ov-net-worth'),
  ovDelta:           document.getElementById('ov-delta'),
  ovAsOf:            document.getElementById('ov-as-of'),
  ovCards:           document.getElementById('ov-cards'),
  ovChartCanvas:     document.getElementById('overview-chart'),
  ovDonutWrap:       document.getElementById('ov-donut-wrap'),
  ovDonutCanvas:     document.getElementById('overview-donut'),
  ovAllocLegend:     document.getElementById('ov-allocation-legend'),
  ovSeriesToggles:   document.getElementById('ov-series-toggles'),
  ovViewToggle:      document.getElementById('ov-view-toggle'),
  privateModeBtn:    document.getElementById('private-mode-btn'),
  // Groups editor
  addGroupBtn:       document.getElementById('add-group-btn'),
  groupsList:        document.getElementById('groups-list'),
  histAccountSelect: document.getElementById('hist-account-select'),
  histChartToggles:  document.getElementById('hist-chart-toggles'),
};

let _statusTimer = null;
let _toastFn = null;
export function _setToastFn(fn) { _toastFn = fn; }

export function setStatus(msg, level = '') {
  if (_statusTimer) { clearTimeout(_statusTimer); _statusTimer = null; }
  els.status.textContent = msg;
  els.status.className = 'status' + (level ? ' ' + level : '');
  if (level === 'ok' || level === 'warn') {
    // Surface ok/warn as toasts too — easier to notice
    _toastFn?.(msg, { level });
    if (level === 'ok') {
      _statusTimer = setTimeout(() => {
        els.status.textContent = '';
        els.status.className = 'status';
        _statusTimer = null;
      }, 3000);
    }
  }
}

// Global fixed tooltip — escapes all overflow: hidden containers
const _tip = document.createElement('div');
_tip.id = 'pfs-tooltip';
document.body.appendChild(_tip);

function _showTip(anchor) {
  _tip.textContent = anchor.dataset.tooltip;
  _tip.style.opacity = '0';
  _tip.style.display = 'block';
  const r = anchor.getBoundingClientRect();
  const tw = _tip.offsetWidth;
  const th = _tip.offsetHeight;
  let top = r.top - th - 8;
  if (top < 8) top = r.bottom + 8;
  let left = r.left + r.width / 2 - tw / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
  _tip.style.top = top + 'px';
  _tip.style.left = left + 'px';
  _tip.style.opacity = '1';
}

document.addEventListener('mouseover', (e) => {
  const el = e.target.closest('[data-tooltip]');
  if (el) _showTip(el);
});
document.addEventListener('mouseout', (e) => {
  const el = e.target.closest('[data-tooltip]');
  if (el && !el.contains(e.relatedTarget)) _tip.style.opacity = '0';
});

// Generic confirm dialog — returns Promise<boolean>
const _confirmDlg    = document.getElementById('confirm-dialog');
const _confirmMsg    = document.getElementById('confirm-message');
const _confirmList   = document.getElementById('confirm-list');
const _confirmOkBtn  = document.getElementById('confirm-ok-btn');
const _confirmCanBtn = document.getElementById('confirm-cancel-btn');

export function showConfirm({ message, items = [], okLabel = 'OK', cancelLabel = 'Cancel' }) {
  _confirmMsg.textContent = message;
  _confirmList.innerHTML = '';
  _confirmList.hidden = !items.length;
  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = item;
    _confirmList.appendChild(li);
  }
  _confirmOkBtn.textContent = okLabel;
  _confirmCanBtn.textContent = cancelLabel;
  _confirmDlg.showModal();
  return new Promise(resolve => {
    const cleanup = (result) => {
      _confirmDlg.close();
      _confirmOkBtn.removeEventListener('click', onOk);
      _confirmCanBtn.removeEventListener('click', onCancel);
      resolve(result);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    _confirmOkBtn.addEventListener('click', onOk);
    _confirmCanBtn.addEventListener('click', onCancel);
  });
}

export function showSheetLink(id) {
  els.sheetInfo.hidden = false;
  const url = `https://docs.google.com/spreadsheets/d/${id}/edit`;
  els.sheetLink.href = url;
  if (els.sheetLink2) els.sheetLink2.href = url;
}
