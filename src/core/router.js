import { LS_KEY_ACTIVE_TAB } from './state.js';
import { els } from './dom.js';
import { renderOverview } from '../features/overview/index.js';
import { renderHistoryTable, renderChart, populateHistAccountSelect } from '../features/history/index.js';
import { renderAccountsList } from '../features/settings/accounts/index.js';
import { renderGroupsList } from '../features/settings/groups/index.js';
import { renderDetailTable } from '../features/detail/index.js';
import { renderOptions } from '../features/options/index.js';
import { renderForm } from '../features/entry/index.js';

let _accountsSubTab = 'detail';

export function setAccountsSubTab(panel) {
  _accountsSubTab = panel;
  const panels = ['detail', 'history', 'manage'];
  for (const p of panels) {
    const el = document.getElementById(`acct-sub-${p}`);
    if (el) el.hidden = (p !== panel);
  }
  document.querySelectorAll('#accounts-sidebar .section-sidebar-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.panel === panel);
  });
  const manageSubNav = document.getElementById('manage-sub-nav');
  if (manageSubNav) manageSubNav.hidden = (panel !== 'manage');
  if (panel === 'detail')  renderDetailTable();
  if (panel === 'history') { populateHistAccountSelect(); renderHistoryTable(); renderChart(); }
  if (panel === 'manage')  { renderAccountsList(); renderGroupsList(); }
}

export function refreshCurrentTab() {
  const active = localStorage.getItem(LS_KEY_ACTIVE_TAB) || 'overview';
  if (active === 'overview') renderOverview();
  else if (active === 'accounts') setAccountsSubTab(_accountsSubTab);
  else if (active === 'options') renderOptions();
}

export function setActiveTab(name) {
  if (name === 'detail' || name === 'history') name = 'accounts';
  const tabs = ['overview', 'accounts', 'options', 'entry', 'settings'];
  if (!tabs.includes(name)) name = 'overview';
  for (const tab of tabs) {
    const btn = els.tabBar.querySelector(`[data-tab="${tab}"]`);
    const panel = document.getElementById(`tab-${tab}`);
    btn?.classList.toggle('active', tab === name);
    if (panel) panel.hidden = (tab !== name);
  }
  els.headerEntryBtn?.classList.toggle('active', name === 'entry');
  els.headerSettingsBtn?.classList.toggle('active', name === 'settings');
  document.querySelectorAll('#bottom-tab-bar .bottom-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === name);
  });
  localStorage.setItem(LS_KEY_ACTIVE_TAB, name);
  document.body.classList.toggle('has-subnav', name === 'accounts' || name === 'options');
  if (name === 'overview') renderOverview();
  if (name === 'accounts') setAccountsSubTab(_accountsSubTab);
  if (name === 'options')  renderOptions();
}

export function showTabBar() {
  els.tabBar.hidden = false;
  if (els.headerEntryBtn)    els.headerEntryBtn.hidden = false;
  if (els.headerSettingsBtn) els.headerSettingsBtn.hidden = false;
  if (els.privateModeBtn)    els.privateModeBtn.hidden = false;
  const bottomBar = document.getElementById('bottom-tab-bar');
  if (bottomBar) bottomBar.hidden = false;
  document.body.classList.add('is-signed-in');
  // Pre-render all panels so switching tabs is instant
  renderForm();
  populateHistAccountSelect();
  renderHistoryTable();
  renderChart();
  renderOverview();
  let saved = localStorage.getItem(LS_KEY_ACTIVE_TAB) || 'overview';
  if (saved === 'detail')  { _accountsSubTab = 'detail';  saved = 'accounts'; }
  if (saved === 'history') { _accountsSubTab = 'history'; saved = 'accounts'; }
  if (saved === 'options' && localStorage.getItem('pfs_stock_options') !== '1') saved = 'overview';
  setActiveTab(saved);
}
