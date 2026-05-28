import { loadAccounts, loadSnapshots, loadCategoryMeta } from './accounts.js';
import { loadTagsCatalog, mergeAndSyncTagsCatalog } from './tags.js';
import { loadGroupsCatalog } from './groups.js';
import { loadConfig } from './config.js';
import { rebuildDatesList, logCoverageDiagnostic } from '../utils/dates.js';
import { setStatus } from '../core/dom.js';

export async function loadAll() {
  setStatus('Loading accounts and snapshots…');
  await Promise.all([loadAccounts(), loadSnapshots(), loadCategoryMeta(), loadTagsCatalog(), loadGroupsCatalog(), loadConfig()]);
  await mergeAndSyncTagsCatalog();
  rebuildDatesList();
  logCoverageDiagnostic();
}

export { loadAccounts, loadSnapshots, loadCategoryMeta } from './accounts.js';
export { loadConfig, writeConfig } from './config.js';
export { loadTagsCatalog, writeTagsCatalog, mergeAndSyncTagsCatalog } from './tags.js';
export { loadGroupsCatalog, writeGroupsCatalog } from './groups.js';
export { verifySheet, findSheetByName, createSheet, seedNewSheet } from './drive.js';
