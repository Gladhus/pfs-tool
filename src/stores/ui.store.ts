import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TabName = 'overview' | 'history' | 'detail' | 'entry' | 'settings';
export type Theme = 'system' | 'light' | 'dark';
export type Lang = 'fr' | 'en';

interface UIState {
  activeTab: TabName;
  privateMode: boolean;
  lang: Lang;
  theme: Theme;
  ovSeriesVisible: Record<string, boolean>;
  ovView: 'category' | 'group';

  setActiveTab: (tab: TabName) => void;
  togglePrivateMode: () => void;
  setLang: (lang: Lang) => void;
  setTheme: (theme: Theme) => void;
  setOvSeriesVisible: (series: Record<string, boolean>) => void;
  setOvView: (view: 'category' | 'group') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeTab: 'overview',
      privateMode: false,
      lang: 'fr',
      theme: 'system',
      ovSeriesVisible: {},
      ovView: 'category',

      setActiveTab: (activeTab) => set({ activeTab }),
      togglePrivateMode: () => set((s) => ({ privateMode: !s.privateMode })),
      setLang: (lang) => set({ lang }),
      setTheme: (theme) => set({ theme }),
      setOvSeriesVisible: (ovSeriesVisible) => set({ ovSeriesVisible }),
      setOvView: (ovView) => set({ ovView }),
    }),
    {
      name: 'pfs_ui',
      partialize: (s) => ({
        privateMode: s.privateMode,
        lang: s.lang,
        theme: s.theme,
        ovSeriesVisible: s.ovSeriesVisible,
        ovView: s.ovView,
      }),
    },
  ),
);
