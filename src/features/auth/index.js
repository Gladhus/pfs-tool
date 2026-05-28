import "./en.js";
import "./fr.js";
import { state, LS_KEY_SHEET_ID, LS_KEY_TOKEN, LS_KEY_ACTIVE_TAB, TOKEN_SKEW_MS, SHEET_TITLE } from '../../core/state.js';
import { applyI18n, setLang, t } from '../../core/i18n/index.js';
import { els, setStatus, showSheetLink } from '../../core/dom.js';
import { loadAll, verifySheet, findSheetByName, createSheet, seedNewSheet } from '../../api/index.js';
import { renderOverview } from '../overview/index.js';
import { renderHistoryTable, renderChart, populateHistAccountSelect } from '../history/index.js';
import { renderForm } from '../entry/index.js';
import { renderAccountsList } from '../settings/accounts/index.js';
import { renderGroupsList } from '../settings/groups/index.js';
import { renderDetailTable } from '../detail/index.js';
import { renderOptions } from '../options/index.js';

const cfg = window.PFS_CONFIG || {};

let _applyThemeFn = null;
export function registerApplyTheme(fn) { _applyThemeFn = fn; }
function applyThemeFromSheet(mode) { _applyThemeFn?.(mode); }

let _applyStockOptionsFn = null;
export function registerApplyStockOptions(fn) { _applyStockOptionsFn = fn; }
function applyStockOptionsFromSheet(enabled) { _applyStockOptionsFn?.(enabled); }

export function configError() {
  if (!cfg.CLIENT_ID || cfg.CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
    setStatus('Edit config.js and set CLIENT_ID. See docs/SETUP.md.', 'warn');
    els.signinBtn.disabled = true;
    return true;
  }
  return false;
}

// --- Google API client (gapi) ---
export function onGapiLoad() {
  gapi.load('client', async () => {
    await gapi.client.init({
      discoveryDocs: [
        'https://sheets.googleapis.com/$discovery/rest?version=v4',
        'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
      ],
    });
    state.gapiReady = true;
    maybeEnableSignIn();
  });
}

// --- Google Identity Services ---
export function initTokenClient() {
  state.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: cfg.CLIENT_ID,
    scope: cfg.SCOPES,
    callback: (resp) => {
      if (resp.error) {
        if (state.silentInFlight) {
          state.silentInFlight = false;
          setStatus("Ready. Click 'Sign in with Google' to continue.");
          return;
        }
        setStatus('Sign-in failed: ' + resp.error, 'warn');
        return;
      }
      state.silentInFlight = false;
      applyToken(resp.access_token, resp.expires_in);
      onSignedIn();
    },
  });
  state.gisReady = true;
  maybeEnableSignIn();
}

export function applyToken(accessToken, expiresInSec) {
  state.accessToken = accessToken;
  gapi.client.setToken({ access_token: accessToken });
  const expiresAt = Date.now() + (Number(expiresInSec) || 3600) * 1000;
  try {
    localStorage.setItem(LS_KEY_TOKEN, JSON.stringify({ access_token: accessToken, expires_at: expiresAt }));
  } catch (_) {}
}

export function loadCachedToken() {
  try {
    const raw = localStorage.getItem(LS_KEY_TOKEN);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached.access_token || !cached.expires_at) return null;
    if (cached.expires_at - Date.now() < TOKEN_SKEW_MS) return null;
    return cached;
  } catch (_) { return null; }
}

export function clearCachedToken() {
  try { localStorage.removeItem(LS_KEY_TOKEN); } catch (_) {}
}

export async function tryRestoreSession() {
  const cached = loadCachedToken();
  if (cached) {
    state.accessToken = cached.access_token;
    gapi.client.setToken({ access_token: cached.access_token });
    setStatus('Restoring session…');
    try {
      await onSignedIn();
      return true;
    } catch (err) {
      console.warn('Cached token rejected:', err);
      clearCachedToken();
      gapi.client.setToken(null);
      state.accessToken = null;
    }
  }

  if (state.tokenClient) {
    state.silentInFlight = true;
    setStatus('Refreshing Google session…');
    state.tokenClient.requestAccessToken({ prompt: '' });
    return true;
  }
  return false;
}

export function maybeEnableSignIn() {
  if (state.gapiReady && state.gisReady && !configError()) {
    els.signinBtn.disabled = false;
    setStatus("Ready. Click 'Sign in with Google' to continue.");
    if (!state.sessionRestoreAttempted) {
      state.sessionRestoreAttempted = true;
      tryRestoreSession();
    }
  }
}

export async function onSignedIn() {
  els.signinBtn.hidden = true;
  els.signoutBtn.hidden = false;
  els.signedOut.hidden = true;
  els.signedIn.hidden = false;

  const email = await fetchUserEmail();
  if (email) {
    els.userEmail.hidden = false;
    els.userEmail.textContent = email;
  }
  setStatus('Signed in. Locating your PFS sheet…');
  try {
    await bootstrapSheet();
  } catch (err) {
    console.error(err);
    setStatus('Bootstrap failed: ' + (err.result?.error?.message || err.message || err), 'warn');
  }
}

export async function fetchUserEmail() {
  try {
    const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + state.accessToken },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.email || null;
  } catch (_) { return null; }
}

export function onSignOut() {
  if (state.accessToken) {
    google.accounts.oauth2.revoke(state.accessToken, () => {});
  }
  state.accessToken = null;
  gapi.client.setToken(null);
  clearCachedToken();
  els.signinBtn.hidden = false;
  els.signoutBtn.hidden = true;
  els.userEmail.hidden = true;
  els.userEmail.textContent = '';
  els.signedOut.hidden = false;
  els.signedIn.hidden = true;
  els.sheetInfo.hidden = true;
  els.entryForm.hidden = true;
  setStatus('Signed out.');
}

export async function onChooseSheet() {
  const dlg = document.getElementById('sheet-picker-dialog');
  const listEl = document.getElementById('sheet-picker-list');
  listEl.innerHTML = `<p class="hint">${t('loading')}</p>`;
  dlg.showModal();

  try {
    const resp = await gapi.client.drive.files.list({
      q: `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
      fields: 'files(id,name,modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: 30,
    });
    const files = resp.result.files || [];
    listEl.innerHTML = '';

    if (!files.length) {
      listEl.innerHTML = `<p class="hint">${t('no_sheets_found')}</p>`;
      return;
    }

    for (const f of files) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sheet-picker-item';
      btn.textContent = f.name;
      btn.addEventListener('click', async () => {
        dlg.close();
        state.sheetId = f.id;
        localStorage.setItem(LS_KEY_SHEET_ID, f.id);
        showSheetLink(f.id);
        setStatus(t('sheet_linked'));
        await loadAndRenderForm();
      });
      listEl.appendChild(btn);
    }
  } catch (err) {
    listEl.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = err.result?.error?.message || err.message || String(err);
    listEl.appendChild(p);
  }
}

// --- Sheet bootstrap ---

export async function bootstrapSheet() {
  let sheetId = localStorage.getItem(LS_KEY_SHEET_ID);

  if (sheetId && !(await verifySheet(sheetId))) {
    sheetId = null;
    localStorage.removeItem(LS_KEY_SHEET_ID);
  }

  if (!sheetId) sheetId = await findSheetByName(SHEET_TITLE);

  let created = false;
  if (!sheetId) {
    setStatus('Creating your PFS sheet in Google Drive…');
    sheetId = await createSheet();
    created = true;
  }

  if (created) {
    setStatus('Seeding accounts and config…');
    await seedNewSheet(sheetId);
  }

  state.sheetId = sheetId;
  localStorage.setItem(LS_KEY_SHEET_ID, sheetId);
  showSheetLink(sheetId);
  setStatus(created ? 'Sheet created and seeded.' : 'Sheet linked.', 'ok');

  await loadAndRenderForm();
}

export async function loadAndRenderForm() {
  await loadAll();

  if (state.configLang)  setLang(state.configLang, { persist: false });
  if (state.configTheme) applyThemeFromSheet(state.configTheme);
  if (state.configStockOptions !== null) applyStockOptionsFromSheet(state.configStockOptions);

  const now = new Date();
  state.currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [y, m, d] = state.currentDate.split('-');
  state.datePicker ? state.datePicker.selectDate(new Date(+y, +m - 1, +d), { silent: true }) : (els.dateInput.value = state.currentDate);

  renderForm();
  els.entryForm.hidden = false;
  populateHistAccountSelect();
  renderHistoryTable();
  renderChart();
  renderOverview();
  showTabBar();
  applyI18n();
  setStatus('Loaded.', 'ok');
}

let _accountsSubTab = 'detail';

export function setAccountsSubTab(panel) {
  _accountsSubTab = panel;
  const panels = ['detail', 'history', 'manage'];
  for (const p of panels) {
    const el = document.getElementById(`acct-sub-${p}`);
    if (el) el.hidden = (p !== panel);
  }
  document.querySelectorAll('#accounts-subnav .subnav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.panel === panel);
  });
  const gear = document.getElementById('accounts-gear-btn');
  if (gear) gear.classList.toggle('active', panel === 'manage');
  if (panel === 'detail')  renderDetailTable();
  if (panel === 'history') { populateHistAccountSelect(); renderHistoryTable(); renderChart(); }
  if (panel === 'manage')  { renderAccountsList(); renderGroupsList(); }
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
  localStorage.setItem(LS_KEY_ACTIVE_TAB, name);
  if (name === 'overview') renderOverview();
  if (name === 'accounts') setAccountsSubTab(_accountsSubTab);
  if (name === 'options')  renderOptions();
}

export function showTabBar() {
  els.tabBar.hidden = false;
  let saved = localStorage.getItem(LS_KEY_ACTIVE_TAB) || 'overview';
  if (saved === 'detail')  { _accountsSubTab = 'detail';  saved = 'accounts'; }
  if (saved === 'history') { _accountsSubTab = 'history'; saved = 'accounts'; }
  if (saved === 'options' && localStorage.getItem('pfs_stock_options') !== '1') saved = 'overview';
  setActiveTab(saved);
}
