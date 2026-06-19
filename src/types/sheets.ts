export type Currency = 'CAD' | 'USD';

/** Daily USD→CAD exchange rate (CAD→USD = 1/usd_cad). Persisted in the fx_rates tab. */
export interface FxRate {
  date: string;
  usd_cad: number;
}

/** One person's claim on an account. Shares across an account's `ownership` array sum to 1. */
export interface OwnershipEntry {
  person_id: string;
  share: number;
}

export interface Account {
  id: string;
  type: string;
  name_fr: string;
  name_en: string;
  category: string;
  kind: 'asset' | 'debt';
  ownership: OwnershipEntry[];
  active: boolean;
  sort_order: number;
  tags: string[];
  annual_rate: number;
  /** Account's native currency. Absent on legacy rows → treated as the main currency. */
  currency?: Currency;
}

/** A household member who can own (a share of) an account. Referenced by Account.ownership entries. */
export interface Person {
  id: string;
  name: string;
  email?: string;
  color?: string;
  sort_order: number;
  active: boolean;
  /** The sheet's primary owner (seeded as 'self'). Can't be archived. */
  primary: boolean;
}

export interface Snapshot {
  date: string;
  account_id: string;
  balance_raw: number;
  comment?: string;
  entered_at?: string;
}

/** Sourced from seed/default-accounts.json — drives new-account id prefixes and defaults. */
export interface AccountType {
  id_prefix: string;
  name_fr: string;
  name_en: string;
  category: string;
  kind: 'asset' | 'debt';
  default_owner: string;
  default_ownership_share: number;
}

/** Sourced from seed/default-accounts.json, not from sheet column headers. */
export interface CategoryMeta {
  id: string;
  name_fr: string;
  name_en: string;
  kind: 'asset' | 'debt';
  sort_order: number;
  group: string;
  group_sort: number;
}

export interface Tag {
  name: string;
}

export interface Group {
  name: string;
  color: string;
  all: string[];
  any: string[];
  exclude: string[];
}

export interface AppConfig {
  language: 'en' | 'fr';
  currency: string;
  schema_version: string;
  last_imported_at?: string;
  stock_options_enabled?: boolean;
  theme?: 'system' | 'light' | 'dark';
}

export interface OptionCompany {
  id: string;
  name: string;
  ticker: string;
  active: boolean;
  /** Tags used to roll this company's equity value into matching Overview groups. */
  tags: string[];
  /** Currency of this company's FMV + strike prices. Absent → main currency. */
  currency?: Currency;
  /** The single person who owns this company's equity. Options can't be split. */
  owner: string;
}

export interface OptionGrant {
  id: string;
  company_id: string;
  label: string;
  grant_type: string;
  grant_date: string;
  total_shares: number;
  strike_price: number;
  vesting_start: string;
  cliff_months: number;
  vesting_months: number;
  vesting_interval: string;
  expiry_date: string;
}

export interface OptionFmv {
  date: string;
  company_id: string;
  fmv: number;
  note?: string;
}

export interface OptionExercise {
  id: string;
  grant_id: string;
  date: string;
  shares_exercised: number;
  price_paid: number;
  note?: string;
}
