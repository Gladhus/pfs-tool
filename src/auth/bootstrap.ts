import { verifySheet, findSheetByName, createSheet, seedNewSheet } from '@/api/drive';
import { useAuthStore } from '@/stores/auth.store';
import { setStatus } from '@/stores/status.store';
import { SHEET_TITLE, LS_KEY_SHEET_ID } from '@/constants';

export async function bootstrapSheet(): Promise<void> {
  const { setSheetId, setIsBootstrapping, setIsDataLoaded } = useAuthStore.getState();
  setIsBootstrapping(true);

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
  setIsBootstrapping(false);
  setIsDataLoaded(true);
  setStatus(created ? 'Sheet created.' : 'Sheet linked.', 'ok');
}
