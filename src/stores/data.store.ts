import { create } from 'zustand';

// Mirrors the shape from the existing vanilla JS codebase.
// Types will be fleshed out as features are migrated in Phases 2–8.

export interface Account {
  id: string;
  name_fr: string;
  name_en: string;
  category: string;
  kind: 'asset' | 'debt';
  owner: string;
  ownership_share: number;
  sort_order: number;
  growth_rate: number | null;
  active: boolean;
  type?: string;
}

export interface Snapshot {
  date: string;
  account_id: string;
  balance: number;
}

export interface CategoryMeta {
  category: string;
  label_fr: string;
  label_en: string;
  color: string;
  sort_order: number;
}

export interface Tag {
  name: string;
}

export interface Group {
  name: string;
  color: string;
  all: string[];
  any: string[];
  exclude: string[];
}

interface DataState {
  accounts: Account[];
  snapshots: Snapshot[];
  categoryMeta: CategoryMeta[];
  tagsCatalog: Tag[];
  groupsCatalog: Group[];
  datesSorted: string[];
  currentDate: string | null;
  importParsed: unknown | null;
  isLoading: boolean;
  error: string | null;

  setAccounts: (accounts: Account[]) => void;
  setSnapshots: (snapshots: Snapshot[]) => void;
  setCategoryMeta: (meta: CategoryMeta[]) => void;
  setTagsCatalog: (tags: Tag[]) => void;
  setGroupsCatalog: (groups: Group[]) => void;
  setDatesSorted: (dates: string[]) => void;
  setCurrentDate: (date: string | null) => void;
  setImportParsed: (data: unknown | null) => void;
  setLoading: (v: boolean) => void;
  setError: (msg: string | null) => void;
}

export const useDataStore = create<DataState>((set) => ({
  accounts: [],
  snapshots: [],
  categoryMeta: [],
  tagsCatalog: [],
  groupsCatalog: [],
  datesSorted: [],
  currentDate: null,
  importParsed: null,
  isLoading: false,
  error: null,

  setAccounts: (accounts) => set({ accounts }),
  setSnapshots: (snapshots) => set({ snapshots }),
  setCategoryMeta: (categoryMeta) => set({ categoryMeta }),
  setTagsCatalog: (tagsCatalog) => set({ tagsCatalog }),
  setGroupsCatalog: (groupsCatalog) => set({ groupsCatalog }),
  setDatesSorted: (datesSorted) => set({ datesSorted }),
  setCurrentDate: (currentDate) => set({ currentDate }),
  setImportParsed: (importParsed) => set({ importParsed }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
