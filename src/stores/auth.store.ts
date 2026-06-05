import { create } from 'zustand';

interface AuthState {
  gapiReady: boolean;
  gisReady: boolean;
  accessToken: string | null;
  expiresAt: number | null;
  sheetId: string | null;
  userEmail: string | null;
  isBootstrapping: boolean;
  isDataLoaded: boolean;
  sessionRestoreAttempted: boolean;
  bootstrapError: string | null;

  setGapiReady: (ready: boolean) => void;
  setGisReady: (ready: boolean) => void;
  setToken: (token: string, expiresAt: number) => void;
  clearToken: () => void;
  setSheetId: (id: string | null) => void;
  setUserEmail: (email: string | null) => void;
  setIsBootstrapping: (v: boolean) => void;
  setIsDataLoaded: (v: boolean) => void;
  setSessionRestoreAttempted: (v: boolean) => void;
  setBootstrapError: (err: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  gapiReady: false,
  gisReady: false,
  accessToken: null,
  expiresAt: null,
  sheetId: localStorage.getItem('pfs_sheet_id'),
  userEmail: null,
  isBootstrapping: false,
  isDataLoaded: false,
  sessionRestoreAttempted: false,
  bootstrapError: null,

  setGapiReady: (gapiReady) => set({ gapiReady }),
  setGisReady: (gisReady) => set({ gisReady }),
  setToken: (accessToken, expiresAt) => set({ accessToken, expiresAt }),
  clearToken: () => set({ accessToken: null, expiresAt: null }),
  setSheetId: (sheetId) => {
    if (sheetId) localStorage.setItem('pfs_sheet_id', sheetId);
    else localStorage.removeItem('pfs_sheet_id');
    set({ sheetId });
  },
  setUserEmail: (userEmail) => set({ userEmail }),
  setIsBootstrapping: (isBootstrapping) => set({ isBootstrapping }),
  setIsDataLoaded: (isDataLoaded) => set({ isDataLoaded }),
  setSessionRestoreAttempted: (sessionRestoreAttempted) => set({ sessionRestoreAttempted }),
  setBootstrapError: (bootstrapError) => set({ bootstrapError }),
}));

export const selectIsSignedIn = (s: AuthState) => s.accessToken !== null;
export const selectApisReady = (s: AuthState) => s.gapiReady && s.gisReady;
