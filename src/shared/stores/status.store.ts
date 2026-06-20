import { create } from 'zustand';

export type StatusLevel = '' | 'ok' | 'warn';

interface StatusState {
  message: string;
  level: StatusLevel;
  setStatus: (message: string, level?: StatusLevel) => void;
  clearStatus: () => void;
}

let _clearTimer: ReturnType<typeof setTimeout> | null = null;

export const useStatusStore = create<StatusState>((set) => ({
  message: '',
  level: '',

  setStatus: (message, level = '') => {
    if (_clearTimer) { clearTimeout(_clearTimer); _clearTimer = null; }
    set({ message, level });
    if (message && level !== 'warn') {
      const delay = level === 'ok' ? 3000 : 6000;
      _clearTimer = setTimeout(() => {
        set({ message: '', level: '' });
        _clearTimer = null;
      }, delay);
    }
  },

  clearStatus: () => {
    if (_clearTimer) { clearTimeout(_clearTimer); _clearTimer = null; }
    set({ message: '', level: '' });
  },
}));

// Convenience function usable outside React components
export const setStatus = (message: string, level: StatusLevel = '') =>
  useStatusStore.getState().setStatus(message, level);
