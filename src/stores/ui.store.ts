import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Theme = 'system' | 'light' | 'dark';
export type Lang = 'fr' | 'en';

interface UIState {
  privateMode: boolean;
  lang: Lang;
  theme: Theme;
  ovSeriesVisible: Record<string, boolean>;
  ovView: 'category' | 'group';

  togglePrivateMode: () => void;
  setLang: (lang: Lang) => void;
  setTheme: (theme: Theme) => void;
  setOvSeriesVisible: (series: Record<string, boolean>) => void;
  setOvView: (view: 'category' | 'group') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      privateMode: false,
      lang: 'en',
      theme: 'system',
      ovSeriesVisible: {},
      ovView: 'category',

      togglePrivateMode: () => set((s) => ({ privateMode: !s.privateMode })),
      setLang: (lang) => set({ lang }),
      setTheme: (theme) => set({ theme }),
      setOvSeriesVisible: (ovSeriesVisible) => set({ ovSeriesVisible }),
      setOvView: (ovView) => set({ ovView }),
    }),
    {
      name: 'pfs_ui',
      storage: createJSONStorage(() => localStorage),
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
