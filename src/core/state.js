const cfg = window.PFS_CONFIG || {};

export const LS_KEY_IMPORT_MAP = 'pfs_import_mappings';
export const LS_KEY_ACTIVE_TAB = 'pfs_active_tab';
export const LS_KEY_LANG       = 'pfs_lang';
export const LS_KEY_PRIVATE    = 'pfs_private';
export const LS_KEY_THEME      = 'pfs_theme';
export const LS_KEY_SHEET_ID   = 'pfs_sheet_id';
export const LS_KEY_USER_HINT  = 'pfs_user_hint';

export const SHEET_TITLE = cfg.SHEET_TITLE || 'PFS Tool — Bilan financier';

export const HEADERS = {
  accounts:         ['id', 'type', 'name_fr', 'name_en', 'category', 'kind', 'owner', 'ownership_share', 'active', 'sort_order', 'tags', 'annual_rate'],
  snapshots:        ['date', 'account_id', 'balance_raw', 'comment', 'entered_at'],
  config:           ['key', 'value'],
  tags:             ['name'],
  groups:           ['name', 'color', 'all', 'any', 'exclude'],
  option_companies: ['id', 'name', 'ticker', 'active'],
  option_grants:    ['id', 'company_id', 'label', 'grant_type', 'grant_date', 'total_shares', 'strike_price', 'vesting_start', 'cliff_months', 'vesting_months', 'vesting_interval', 'expiry_date'],
  option_fmv:       ['date', 'company_id', 'fmv', 'note'],
  option_exercises: ['id', 'grant_id', 'date', 'shares_exercised', 'price_paid', 'note'],
};

export const OWNERS = ['self', 'partner', 'joint'];
export const KINDS  = ['asset', 'debt'];

export const state = {
  tokenClient:            null,
  gapiReady:              false,
  gisReady:               false,
  accessToken:            null,
  tokenExpiresAt:         null,
  silentInFlight:         false,
  proactiveRefreshInFlight: false,
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
  chart:               null,
  overviewChart:       null,
  optionSummaryChart:  null,
  optionCompanyCharts: {},
  datePicker:          null,
  optionCompanies:     [],
  optionGrants:        [],
  optionFmv:           [],
  optionExercises:     [],
  configLang:          null,
  configTheme:         null,
  configStockOptions:  null,
  configEquityTags:    [],
  lang:         localStorage.getItem(LS_KEY_LANG) || cfg.LANGUAGE || 'fr',
  privateMode:  localStorage.getItem(LS_KEY_PRIVATE) === '1',
  theme:        localStorage.getItem(LS_KEY_THEME) || 'system',
};
