import "./en.js";
import "./fr.js";
import { state, setCurrentDate, REFRESH_MODE, LS_KEY_SHEET_ID, LS_KEY_USER_HINT, SHEET_TITLE } from '../../core/state.js';
import { applyI18n, setLang, t } from '../../core/i18n/index.js';
import { els, setStatus, showSheetLink } from '../../core/dom.js';
import { getUserMessage } from '../../core/errors.js';
import { loadAll, verifySheet, findSheetByName, createSheet, seedNewSheet } from '../../api/index.js';
import { showTabBar } from '../../core/router.js';
import { todayISO } from '../../utils/dates.js';

const cfg = window.PFS_CONFIG || {};

let _applyThemeFn = null;
export function registerApplyTheme(fn) { _applyThemeFn = fn; }
function applyThemeFromSheet(mode) { _applyThemeFn?.(mode); }

let _applyStockOptionsFn = null;
export function registerApplyStockOptions(fn) { _applyStockOptionsFn = fn; }
function applyStockOptionsFromSheet(enabled) { _applyStockOptionsFn?.(enabled); }

// One-time cleanup: remove any token previously cached in localStorage
try { localStorage.removeItem('pfs_token'); } catch {}

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
      const mode = state.tokenRefreshMode;
      state.tokenRefreshMode = REFRESH_MODE.IDLE;
      if (resp.error) {
        if (mode === REFRESH_MODE.PROACTIVE) {
          console.warn('Proactive token refresh failed:', resp.error);
          return;
        }
        if (mode === REFRESH_MODE.SILENT) {
          setStatus("Ready. Click 'Sign in with Google' to continue.");
          return;
        }
        setStatus('Sign-in failed: ' + resp.error, 'warn');
        return;
      }
      if (mode === REFRESH_MODE.PROACTIVE) {
        applyToken(resp.access_token, resp.expires_in);
        return;
      }
      applyToken(resp.access_token, resp.expires_in);
      onSignedIn();
    },
  });
  state.gisReady = true;
  maybeEnableSignIn();
}

function getLoginHint() {
  try { return localStorage.getItem(LS_KEY_USER_HINT) || ''; } catch { return ''; }
}

const TOKEN_SKEW_MS = 5 * 60 * 1000; // refresh when within 5 min of expiry

let _refreshTimer = null;
let _bootstrapFailed = false;

function scheduleTokenRefresh(expiresAt) {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  const delay = expiresAt - Date.now() - 5 * 60 * 1000;
  if (delay <= 0) return;
  _refreshTimer = setTimeout(() => {
    _refreshTimer = null;
    if (!state.tokenClient || !state.accessToken) return;
    state.tokenRefreshMode = REFRESH_MODE.PROACTIVE;
    const opts = { prompt: '' };
    const hint = getLoginHint();
    if (hint) opts.login_hint = hint;
    state.tokenClient.requestAccessToken(opts);
  }, delay);
}

export function applyToken(accessToken, expiresInSec) {
  state.accessToken = accessToken;
  gapi.client.setToken({ access_token: accessToken });
  const expiresAt = Date.now() + (Number(expiresInSec) || 3600) * 1000;
  state.tokenExpiresAt = expiresAt;
  scheduleTokenRefresh(expiresAt);
}

// Browsers throttle setTimeout in backgrounded tabs; refresh the token
// proactively when the user returns to a tab with a stale/near-expiry token.
// Also retries sheet bootstrap if the previous attempt failed (e.g. brief
// network dropout on mobile).
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !state.tokenClient || !state.accessToken) return;
  const tokenNearExpiry = !state.tokenExpiresAt || state.tokenExpiresAt - Date.now() < TOKEN_SKEW_MS;
  if (tokenNearExpiry) {
    state.tokenRefreshMode = REFRESH_MODE.PROACTIVE;
    const opts = { prompt: '' };
    const hint = getLoginHint();
    if (hint) opts.login_hint = hint;
    state.tokenClient.requestAccessToken(opts);
  } else if (_bootstrapFailed) {
    _bootstrapFailed = false;
    bootstrapSheet().catch(err => {
      _bootstrapFailed = true;
      console.error(err);
      setStatus(`${t('bootstrap_failed')}: ${getUserMessage(err)}`, 'warn');
    });
  }
});

export async function tryRestoreSession() {
  if (state.tokenClient) {
    state.tokenRefreshMode = REFRESH_MODE.SILENT;
    setStatus('Refreshing Google session…');
    const opts = { prompt: '' };
    const hint = getLoginHint();
    if (hint) opts.login_hint = hint;
    state.tokenClient.requestAccessToken(opts);
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
    const settingsEmail = document.getElementById('settings-user-email-display');
    const settingsUserRow = document.getElementById('settings-user-row');
    if (settingsEmail) settingsEmail.textContent = email;
    if (settingsUserRow) settingsUserRow.hidden = false;
  }
  setStatus('Signed in. Locating your PFS sheet…');
  _bootstrapFailed = false;
  try {
    await bootstrapSheet();
  } catch (err) {
    _bootstrapFailed = true;
    console.error(err);
    setStatus(`${t('bootstrap_failed')}: ${getUserMessage(err)}`, 'warn');
  }
}

export async function fetchUserEmail() {
  try {
    const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + state.accessToken },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.email) {
      try { localStorage.setItem(LS_KEY_USER_HINT, data.email); } catch (_) {}
    }
    return data.email || null;
  } catch { return null; }
}

export function onSignOut() {
  if (_refreshTimer) { clearTimeout(_refreshTimer); _refreshTimer = null; }
  if (state.accessToken) {
    google.accounts.oauth2.revoke(state.accessToken, () => {});
  }
  state.accessToken = null;
  state.tokenExpiresAt = null;
  gapi.client.setToken(null);
  els.signinBtn.hidden = false;
  els.signoutBtn.hidden = true;
  els.userEmail.hidden = true;
  els.userEmail.textContent = '';
  els.signedOut.hidden = false;
  els.signedIn.hidden = true;
  els.sheetInfo.hidden = true;
  els.entryForm.hidden = true;
  if (els.privateModeBtn) els.privateModeBtn.hidden = true;
  const bottomBar = document.getElementById('bottom-tab-bar');
  if (bottomBar) bottomBar.hidden = true;
  document.body.classList.remove('is-signed-in');
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

  if (sheetId) {
    try {
      if (!(await verifySheet(sheetId))) {
        // Sheet confirmed gone (403/404) — clear and search for another.
        sheetId = null;
        localStorage.removeItem(LS_KEY_SHEET_ID);
      }
    } catch {
      // verifySheet threw a network/unknown error — keep the cached sheetId
      // and attempt to load. If the sheet is truly gone, loadAll will surface
      // a more specific error. This avoids wiping a valid cached ID on a blip.
    }
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

  setCurrentDate(todayISO());
  if (!state.datePicker) els.dateInput.value = state.currentDate;

  els.entryForm.hidden = false;
  showTabBar();
  applyI18n();
  setStatus('Loaded.', 'ok');
}

