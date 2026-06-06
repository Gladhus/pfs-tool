import { create } from 'zustand';

interface EntryState {
  currentDate: string;
  importParsed: unknown | null;
  setCurrentDate: (date: string) => void;
  setImportParsed: (data: unknown | null) => void;
}

const defaultDate = () => new Date().toISOString().slice(0, 7) + '-01';

export const useEntryStore = create<EntryState>((set) => ({
  currentDate: defaultDate(),
  importParsed: null,
  setCurrentDate: (currentDate) => set({ currentDate }),
  setImportParsed: (importParsed) => set({ importParsed }),
}));
