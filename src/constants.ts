import type { Person, SpendingCategory } from './types/sheets';
import cfg from './config';

export const SHEET_TITLE = cfg.SHEET_TITLE || 'Net Worth Tracker';

export const KINDS  = ['asset', 'debt'] as const;

/** Seeded the first time a sheet (new or legacy, pre-people-tab) is loaded. */
export const DEFAULT_PEOPLE: Person[] = [
  { id: 'self',    name: 'Me',      sort_order: 10, active: true, primary: true },
  { id: 'partner', name: 'Partner', sort_order: 20, active: true, primary: false },
];

/** Starter spending categories, seeded the first time the spending_categories tab is empty. */
export const DEFAULT_SPENDING_CATEGORIES: SpendingCategory[] = [
  { id: 'groceries',     name_fr: 'Épicerie',       name_en: 'Groceries',     color: '#4d8f2c', icon: 'cash',        sort_order: 10,  active: true },
  { id: 'dining',        name_fr: 'Restaurants',    name_en: 'Dining',        color: '#c47a24', icon: 'cash',        sort_order: 20,  active: true },
  { id: 'transport',     name_fr: 'Transport',      name_en: 'Transport',     color: '#4878b0', icon: 'wallet',      sort_order: 30,  active: true },
  { id: 'housing',       name_fr: 'Logement',       name_en: 'Housing',       color: '#a5604a', icon: 'realestate',  sort_order: 40,  active: true },
  { id: 'utilities',     name_fr: 'Services',       name_en: 'Utilities',     color: '#2a8a7a', icon: 'settings',    sort_order: 50,  active: true },
  { id: 'health',        name_fr: 'Santé',          name_en: 'Health',        color: '#c23838', icon: 'helpCircle',  sort_order: 60,  active: true },
  { id: 'entertainment', name_fr: 'Divertissement', name_en: 'Entertainment', color: '#7b5aaa', icon: 'pieChart',    sort_order: 70,  active: true },
  { id: 'shopping',      name_fr: 'Achats',         name_en: 'Shopping',      color: '#8a7a2a', icon: 'inbox',       sort_order: 80,  active: true },
  { id: 'travel',        name_fr: 'Voyages',        name_en: 'Travel',        color: '#5a6a8a', icon: 'trendingUp',  sort_order: 90,  active: true },
  { id: 'other',         name_fr: 'Autres',         name_en: 'Other',         color: '#5a8a5a', icon: 'other',       sort_order: 100, active: true },
];

export const HEADERS = {
  accounts:         ['id', 'type', 'name_fr', 'name_en', 'category', 'kind', 'ownership', 'active', 'sort_order', 'tags', 'annual_rate', 'currency'],
  snapshots:        ['date', 'account_id', 'balance_raw', 'comment', 'entered_at'],
  config:           ['key', 'value'],
  tags:             ['name'],
  people:           ['id', 'name', 'email', 'color', 'sort_order', 'active', 'primary'],
  groups:           ['name', 'color', 'all', 'any', 'exclude'],
  option_companies: ['id', 'name', 'ticker', 'active', 'tags', 'currency', 'owner'],
  option_grants:    ['id', 'company_id', 'label', 'grant_type', 'grant_date', 'total_shares', 'strike_price', 'vesting_start', 'cliff_months', 'vesting_months', 'vesting_interval', 'expiry_date'],
  option_fmv:       ['date', 'company_id', 'fmv', 'note'],
  option_exercises: ['id', 'grant_id', 'date', 'shares_exercised', 'price_paid', 'note'],
  fx_rates:         ['date', 'usd_cad'],
  spending_categories:  ['id', 'name_fr', 'name_en', 'color', 'icon', 'sort_order', 'active'],
  spendings:            ['id', 'date', 'amount', 'currency', 'category_id', 'ownership', 'comment', 'entered_at'],
  spending_recurrences: ['id', 'label', 'amount', 'currency', 'category_id', 'ownership', 'frequency', 'interval', 'start_date', 'end_date', 'active', 'comment'],
} as const;

export const LS_KEY_IMPORT_MAP = 'pfs_import_mappings';
export const LS_KEY_LANG       = 'pfs_lang';
export const LS_KEY_PRIVATE    = 'pfs_private';
export const LS_KEY_THEME      = 'pfs_theme';
export const LS_KEY_SHEET_ID   = 'pfs_sheet_id';
export const LS_KEY_USER_HINT  = 'pfs_user_hint';
