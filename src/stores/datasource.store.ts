import { create } from 'zustand';
import type { Datasource } from '@/datasource/types';
import { XlsxDatasource } from '@/datasource/xlsx';

interface DatasourceState {
  datasource: Datasource | null;
  setDatasource(ds: Datasource | null): void;
}

export const useDatasourceStore = create<DatasourceState>((set) => ({
  datasource: XlsxDatasource.restoreSession(),
  setDatasource: (datasource) => {
    if (datasource instanceof XlsxDatasource) {
      datasource.saveToSession();
    } else if (datasource === null) {
      XlsxDatasource.clearSession();
    }
    set({ datasource });
  },
}));
