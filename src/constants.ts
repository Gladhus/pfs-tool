import type { Person } from './types/sheets';
import cfg from './config';

export const SHEET_TITLE = cfg.SHEET_TITLE || 'Net Worth Tracker';

export const KINDS  = ['asset', 'debt'] as const;

/** Seeded the first time a sheet (new or legacy, pre-people-tab) is loaded. */
export const DEFAULT_PEOPLE: Person[] = [
  { id: 'self',    name: 'Me',      sort_order: 10, active: true },
  { id: 'partner', name: 'Partner', sort_order: 20, active: true },
];

export const HEADERS = {
  accounts:         ['id', 'type', 'name_fr', 'name_en', 'category', 'kind', 'ownership', 'active', 'sort_order', 'tags', 'annual_rate', 'currency'],
  snapshots:        ['date', 'account_id', 'balance_raw', 'comment', 'entered_at'],
  config:           ['key', 'value'],
  tags:             ['name'],
  people:           ['id', 'name', 'email', 'color', 'sort_order', 'active'],
  groups:           ['name', 'color', 'all', 'any', 'exclude'],
  option_companies: ['id', 'name', 'ticker', 'active', 'tags', 'currency'],
  option_grants:    ['id', 'company_id', 'label', 'grant_type', 'grant_date', 'total_shares', 'strike_price', 'vesting_start', 'cliff_months', 'vesting_months', 'vesting_interval', 'expiry_date'],
  option_fmv:       ['date', 'company_id', 'fmv', 'note'],
  option_exercises: ['id', 'grant_id', 'date', 'shares_exercised', 'price_paid', 'note'],
  fx_rates:         ['date', 'usd_cad'],
} as const;

export const LS_KEY_IMPORT_MAP = 'pfs_import_mappings';
export const LS_KEY_LANG       = 'pfs_lang';
export const LS_KEY_PRIVATE    = 'pfs_private';
export const LS_KEY_THEME      = 'pfs_theme';
export const LS_KEY_SHEET_ID   = 'pfs_sheet_id';
export const LS_KEY_USER_HINT  = 'pfs_user_hint';
