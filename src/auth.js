import { state, LS_KEY_SHEET_ID, LS_KEY_TOKEN, LS_KEY_ACTIVE_TAB, TOKEN_SKEW_MS, SHEET_TITLE } from './state.js';
import { applyI18n } from './i18n.js';
import { els, setStatus, showSheetLink } from './dom.js';
import { loadAll, verifySheet, findSheetByName, createSheet, seedNewSheet } from './sheets.js';
import { renderOverview } from './overview.js';
import { renderHistoryTable, renderChart, populateHistAccountSelect } from './history.js';
import { renderForm } from './entry.js';
import { renderAccountsList } from './accounts.js';
import { renderDetailTable } from './detail.js';

const cfg = window.PFS_CONFIG || {};

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

export async function onResetSheetLink() {
  if (!confirm('Forget the linked sheet? A new one will be created on next sign-in if no matching sheet is found. The existing sheet in Drive is NOT deleted.')) return;
  localStorage.removeItem(LS_KEY_SHEET_ID);
  state.sheetId = null;
  els.sheetInfo.hidden = true;
  setStatus('Sheet link cleared. Sign out and sign back in to re-link or create a new one.');
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

export function setActiveTab(name) {
  const tabs = ['overview', 'history', 'detail', 'entry', 'settings'];
  if (!tabs.includes(name)) name = 'overview';
  for (const tab of tabs) {
    const btn = els.tabBar.querySelector(`[data-tab="${tab}"]`);
    const panel = document.getElementById(`tab-${tab}`);
    btn?.classList.toggle('active', tab === name);
    if (panel) panel.hidden = (tab !== name);
  }
  localStorage.setItem(LS_KEY_ACTIVE_TAB, name);
  if (name === 'overview') renderOverview();
  if (name === 'detail') renderDetailTable();
  if (name === 'settings') renderAccountsList();
}

export function showTabBar() {
  els.tabBar.hidden = false;
  const saved = localStorage.getItem(LS_KEY_ACTIVE_TAB) || 'overview';
  setActiveTab(saved);
}
