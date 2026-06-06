import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import cfg, { hasValidClientId } from '@/config';
import { useAuthStore, selectApisReady } from '@/stores/auth.store';
import { setStatus } from '@/stores/status.store';
import { bootstrapSheet } from './bootstrap';
import { LS_KEY_USER_HINT } from '@/constants';
import { classifyApiError } from '@/core/errors';
import i18n from '@/i18n/index';

// Module-level guard: prevents initTokenClient from being called a second time
// under React StrictMode's double-effect invocation.
let _tokenClientInitialized = false;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface AuthContextValue {
  signIn: () => void;
  signOut: () => void;
  canSignIn: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

// ---------------------------------------------------------------------------
// Hook — all Google API side-effects live here
// ---------------------------------------------------------------------------

type RefreshMode = 'idle' | 'silent' | 'proactive';

function useGoogleAuth(): AuthContextValue {
  const {
    setGapiReady, setGisReady,
    setToken, clearToken,
    setUserEmail,
    setSessionRestoreAttempted,
    setBootstrapError,
  } = useAuthStore();

  const apisReady = useAuthStore(selectApisReady);

  const tokenClientRef   = useRef<TokenClient | null>(null);
  const refreshTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshModeRef   = useRef<RefreshMode>('idle');
  const bootstrapRunning = useRef(false);

  // ---- helpers ------------------------------------------------------------

  const getLoginHint = useCallback(() => {
    try { return localStorage.getItem(LS_KEY_USER_HINT) ?? ''; } catch { return ''; }
  }, []);

  const scheduleRefresh = useCallback((expiresAt: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const delay = expiresAt - Date.now() - 5 * 60 * 1000;
    if (delay <= 0) return;
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      const tc = tokenClientRef.current;
      if (!tc || !useAuthStore.getState().accessToken) return;
      refreshModeRef.current = 'proactive';
      const opts: { prompt: string; login_hint?: string } = { prompt: '' };
      const hint = getLoginHint();
      if (hint) opts.login_hint = hint;
      tc.requestAccessToken(opts);
    }, delay);
  }, [getLoginHint]);

  const applyToken = useCallback((accessToken: string, expiresInSec: string | number) => {
    gapi.client.setToken({ access_token: accessToken });
    const expiresAt = Date.now() + (Number(expiresInSec) || 3600) * 1000;
    setToken(accessToken, expiresAt);
    scheduleRefresh(expiresAt);
  }, [setToken, scheduleRefresh]);

  const fetchAndStoreEmail = useCallback(async (token: string): Promise<string | null> => {
    try {
      const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!resp.ok) return null;
      const data = await resp.json() as { email?: string };
      if (data.email) {
        try { localStorage.setItem(LS_KEY_USER_HINT, data.email); } catch { /* noop */ }
        setUserEmail(data.email);
        return data.email;
      }
      return null;
    } catch { return null; }
  }, [setUserEmail]);

  const onSignedIn = useCallback(async (token: string) => {
    if (bootstrapRunning.current) return;
    bootstrapRunning.current = true;
    await fetchAndStoreEmail(token);
    setStatus('Signed in. Locating your sheet…');
    try {
      await bootstrapSheet();
    } catch (err) {
      const key = classifyApiError(err);
      const msg = i18n.t('err_' + key);
      setBootstrapError(msg);
      setStatus(msg, 'warn');
    } finally {
      bootstrapRunning.current = false;
    }
  }, [fetchAndStoreEmail, setBootstrapError]);

  // ---- GIS token callback -------------------------------------------------

  const handleTokenResponse = useCallback((resp: {
    access_token?: string;
    expires_in?: string | number;
    error?: string;
  }) => {
    const mode = refreshModeRef.current;
    refreshModeRef.current = 'idle';

    if (resp.error) {
      if (mode === 'proactive') {
        console.warn('Proactive token refresh failed:', resp.error);
        return;
      }
      if (mode === 'silent') {
        setStatus("Ready. Click 'Sign in with Google' to continue.");
        return;
      }
      setStatus('Sign-in failed: ' + resp.error, 'warn');
      return;
    }

    const token = resp.access_token!;
    applyToken(token, resp.expires_in ?? 3600);

    if (mode !== 'proactive') {
      void onSignedIn(token);
    }
  }, [applyToken, onSignedIn]);

  // ---- gapi init ----------------------------------------------------------

  const initGapi = useCallback(() => {
    gapi.load('client', async () => {
      await gapi.client.init({
        discoveryDocs: [
          'https://sheets.googleapis.com/$discovery/rest?version=v4',
          'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
        ],
      });
      setGapiReady(true);
    });
  }, [setGapiReady]);

  // ---- GIS init -----------------------------------------------------------

  const initGis = useCallback(() => {
    // Module-level flag prevents double-init under StrictMode's double-effect invocation
    if (_tokenClientInitialized) return;
    _tokenClientInitialized = true;
    tokenClientRef.current = google.accounts.oauth2.initTokenClient({
      client_id: cfg.CLIENT_ID,
      scope: cfg.SCOPES,
      callback: handleTokenResponse,
    });
    setGisReady(true);
  }, [handleTokenResponse, setGisReady]);

  // ---- Onload-based API readiness (replaces setInterval polling) ----------

  useEffect(() => {
    // Remove legacy token cache left by the vanilla app
    try { localStorage.removeItem('pfs_token'); } catch { /* noop */ }

    // Gapi: check if already loaded, or register callback for ?onload=__onGapiLoad in index.html
    if (typeof gapi !== 'undefined') {
      initGapi();
    } else {
      (window as Window & { __onGapiLoad?: () => void }).__onGapiLoad = initGapi;
    }

    // GIS: check if already loaded, or attach a load listener to the script element
    if (typeof google !== 'undefined') {
      initGis();
    } else {
      const gisEl = document.querySelector<HTMLScriptElement>('script[src*="accounts.google.com/gsi"]');
      const handleGisLoad = () => initGis();
      gisEl?.addEventListener('load', handleGisLoad, { once: true });
      return () => {
        const w = window as Window & { __onGapiLoad?: () => void };
        delete w.__onGapiLoad;
        gisEl?.removeEventListener('load', handleGisLoad);
      };
    }

    return () => {
      const w = window as Window & { __onGapiLoad?: () => void };
      delete w.__onGapiLoad;
    };
  }, [initGapi, initGis]);

  // ---- Attempt session restore once both APIs are ready ------------------

  useEffect(() => {
    if (!apisReady) return;
    if (!hasValidClientId()) {
      setStatus('Edit config.js and set CLIENT_ID. See docs/SETUP.md.', 'warn');
      return;
    }
    const { sessionRestoreAttempted } = useAuthStore.getState();
    if (sessionRestoreAttempted) return;
    setSessionRestoreAttempted(true);
    setStatus("Refreshing session…");
    refreshModeRef.current = 'silent';
    const opts: { prompt: string; login_hint?: string } = { prompt: '' };
    const hint = getLoginHint();
    if (hint) opts.login_hint = hint;
    tokenClientRef.current?.requestAccessToken(opts);
  }, [apisReady, getLoginHint, setSessionRestoreAttempted]);

  // ---- Visibility change: proactive refresh + retry bootstrap  ------------

  useEffect(() => {
    const TOKEN_SKEW_MS = 5 * 60 * 1000;
    const onVisibilityChange = () => {
      if (document.hidden) return;
      const { accessToken, expiresAt, bootstrapError, isDataLoaded, isBootstrapping } = useAuthStore.getState();

      // Proactive token refresh when near expiry
      if (tokenClientRef.current && accessToken) {
        const nearExpiry = !expiresAt || expiresAt - Date.now() < TOKEN_SKEW_MS;
        if (nearExpiry) {
          refreshModeRef.current = 'proactive';
          const opts: { prompt: string; login_hint?: string } = { prompt: '' };
          const hint = getLoginHint();
          if (hint) opts.login_hint = hint;
          tokenClientRef.current.requestAccessToken(opts);
        }
      }

      // Retry bootstrap if it failed while the tab was hidden
      if (bootstrapError !== null && !isDataLoaded && !isBootstrapping && accessToken) {
        useAuthStore.getState().setBootstrapError(null);
        void (async () => {
          try {
            await bootstrapSheet();
          } catch (err) {
            const key = classifyApiError(err);
            const msg = i18n.t('err_' + key);
            useAuthStore.getState().setBootstrapError(msg);
            setStatus(msg, 'warn');
          }
        })();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [getLoginHint]);

  // ---- Cleanup refresh timer on unmount -----------------------------------

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  // ---- Public API ---------------------------------------------------------

  const signIn = useCallback(() => {
    if (!tokenClientRef.current) return;
    refreshModeRef.current = 'idle';
    const opts: { prompt: string; login_hint?: string } = { prompt: '' };
    const hint = getLoginHint();
    if (hint) opts.login_hint = hint;
    tokenClientRef.current.requestAccessToken(opts);
  }, [getLoginHint]);

  const signOut = useCallback(() => {
    if (refreshTimerRef.current) { clearTimeout(refreshTimerRef.current); refreshTimerRef.current = null; }
    const { accessToken } = useAuthStore.getState();
    if (accessToken) {
      google.accounts.oauth2.revoke(accessToken, () => {});
    }
    gapi.client.setToken(null);
    clearToken();
    setUserEmail(null);
    setStatus('Signed out.');
  }, [clearToken, setUserEmail]);

  return {
    signIn,
    signOut,
    canSignIn: apisReady && hasValidClientId(),
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const value = useGoogleAuth();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
