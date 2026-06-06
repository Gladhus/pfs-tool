import cfg from './config';

export const SHEET_TITLE = cfg.SHEET_TITLE || 'Net Worth Tracker';

export const OWNERS = ['self', 'partner', 'joint'] as const;
export const KINDS  = ['asset', 'debt'] as const;

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
} as const;

export const LS_KEY_IMPORT_MAP = 'pfs_import_mappings';
export const LS_KEY_LANG       = 'pfs_lang';
export const LS_KEY_PRIVATE    = 'pfs_private';
export const LS_KEY_THEME      = 'pfs_theme';
export const LS_KEY_SHEET_ID   = 'pfs_sheet_id';
export const LS_KEY_USER_HINT  = 'pfs_user_hint';
