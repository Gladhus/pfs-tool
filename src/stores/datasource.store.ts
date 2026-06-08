import { create } from 'zustand';
import type { Datasource } from '@/datasource/types';

interface DatasourceState {
  datasource: Datasource | null;
  setDatasource(ds: Datasource | null): void;
}

export const useDatasourceStore = create<DatasourceState>((set) => ({
  datasource: null,
  setDatasource: (datasource) => set({ datasource }),
}));
