const cfg = window.PFS_CONFIG || {};

export const LS_KEY_IMPORT_MAP = 'pfs_import_mappings';
export const LS_KEY_ACTIVE_TAB = 'pfs_active_tab';
export const LS_KEY_LANG       = 'pfs_lang';
export const LS_KEY_PRIVATE    = 'pfs_private';
export const LS_KEY_THEME      = 'pfs_theme';
export const LS_KEY_SHEET_ID   = 'pfs_sheet_id';
export const LS_KEY_TOKEN      = 'pfs_token';
export const TOKEN_SKEW_MS     = 60 * 1000;

export const SHEET_TITLE = cfg.SHEET_TITLE || 'PFS Tool — Bilan financier';

export const HEADERS = {
  accounts:  ['id', 'type', 'name_fr', 'name_en', 'category', 'kind', 'owner', 'ownership_share', 'active', 'sort_order', 'tags', 'annual_rate'],
  snapshots: ['date', 'account_id', 'balance_raw', 'comment', 'entered_at'],
  config:    ['key', 'value'],
  tags:      ['name'],
  groups:    ['name', 'color', 'all', 'any', 'exclude'],
};

export const OWNERS = ['self', 'partner', 'joint'];
export const KINDS  = ['asset', 'debt'];

export const state = {
  tokenClient:  null,
  gapiReady:    false,
  gisReady:     false,
  accessToken:  null,
  sheetId:      null,
  accounts:     [],
  categoryMeta: [],
  accountTypes: [],
  snapshots:    [],
  tagsCatalog:   [],  // ordered list of {name} objects
  groupsCatalog: [],  // ordered list of {name, color, all, any, exclude} objects
  datesSorted:  [],
  currentDate:  null,
  importParsed: null,
  chart:        null,
  overviewChart: null,
  datePicker:   null,
  configLang:   null,
  configTheme:  null,
  lang:         localStorage.getItem(LS_KEY_LANG) || cfg.LANGUAGE || 'fr',
  privateMode:  localStorage.getItem(LS_KEY_PRIVATE) === '1',
  theme:        localStorage.getItem(LS_KEY_THEME) || 'system',
};
