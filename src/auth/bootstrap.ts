import { verifySheet, findSheetByName, createSheet, seedNewSheet } from '@/shared/io/api/drive';
import { useAuthStore } from '@/shared/stores/auth.store';
import { setStatus } from '@/shared/stores/status.store';
import { queryClient } from '@/shared/io/queryClient';
import { SHEET_TITLE, LS_KEY_SHEET_ID } from '@/constants';
import { SheetsDatasource } from '@/shared/io/datasource/sheets';
import { useDatasourceStore } from '@/shared/stores/datasource.store';

let _bootstrapping = false;

export async function bootstrapSheet(): Promise<void> {
  if (_bootstrapping) return;
  _bootstrapping = true;

  const { setSheetId, setIsBootstrapping, setIsDataLoaded } = useAuthStore.getState();
  setIsBootstrapping(true);

  try {
    let sheetId = localStorage.getItem(LS_KEY_SHEET_ID);

    if (sheetId) {
      try {
        if (!(await verifySheet(sheetId))) {
          sheetId = null;
          localStorage.removeItem(LS_KEY_SHEET_ID);
        }
      } catch {
        // Network blip — keep the cached ID and attempt to load
      }
    }

    if (!sheetId) sheetId = await findSheetByName(SHEET_TITLE);

    let created = false;
    if (!sheetId) {
      setStatus('Creating your sheet in Google Drive…');
      sheetId = await createSheet();
      created = true;
    }

    if (created) {
      setStatus('Seeding accounts and config…');
      await seedNewSheet(sheetId);
    }

    setSheetId(sheetId);
    useDatasourceStore.getState().setDatasource(new SheetsDatasource(sheetId, queryClient));
    queryClient.invalidateQueries({ queryKey: ['sheet', sheetId] });
    setIsDataLoaded(true);
    setStatus(created ? 'Sheet created.' : 'Sheet linked.', 'ok');
  } finally {
    _bootstrapping = false;
    setIsBootstrapping(false);
  }
}
