const cfg: PFSConfig = (window as Window & { PFS_CONFIG?: PFSConfig }).PFS_CONFIG ?? {
  CLIENT_ID: '',
  SCOPES: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
  LANGUAGE: 'fr',
  CURRENCY: 'CAD',
  SHEET_TITLE: 'Net Worth Tracker',
};

export default cfg;

export function hasValidClientId(): boolean {
  return Boolean(cfg.CLIENT_ID) && cfg.CLIENT_ID !== 'YOUR_CLIENT_ID_HERE';
}
