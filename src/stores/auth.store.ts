import { create } from 'zustand';

interface AuthState {
  gapiReady: boolean;
  gisReady: boolean;
  accessToken: string | null;
  expiresAt: number | null;
  sheetId: string | null;
  silentInFlight: boolean;
  proactiveRefreshInFlight: boolean;

  setGapiReady: (ready: boolean) => void;
  setGisReady: (ready: boolean) => void;
  setToken: (token: string, expiresAt: number) => void;
  clearToken: () => void;
  setSheetId: (id: string | null) => void;
  setSilentInFlight: (v: boolean) => void;
  setProactiveRefreshInFlight: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  gapiReady: false,
  gisReady: false,
  accessToken: null,
  expiresAt: null,
  sheetId: localStorage.getItem('pfs_sheet_id'),
  silentInFlight: false,
  proactiveRefreshInFlight: false,

  setGapiReady: (ready) => set({ gapiReady: ready }),
  setGisReady: (ready) => set({ gisReady: ready }),
  setToken: (accessToken, expiresAt) => set({ accessToken, expiresAt }),
  clearToken: () => set({ accessToken: null, expiresAt: null }),
  setSheetId: (sheetId) => {
    if (sheetId) localStorage.setItem('pfs_sheet_id', sheetId);
    else localStorage.removeItem('pfs_sheet_id');
    set({ sheetId });
  },
  setSilentInFlight: (v) => set({ silentInFlight: v }),
  setProactiveRefreshInFlight: (v) => set({ proactiveRefreshInFlight: v }),
}));

export const selectIsSignedIn = (s: AuthState) => s.accessToken !== null;
export const selectApisReady = (s: AuthState) => s.gapiReady && s.gisReady;
