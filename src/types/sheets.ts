export interface Account {
  id: string;
  type: string;
  name_fr: string;
  name_en: string;
  category: string;
  kind: 'asset' | 'debt';
  owner: string;
  ownership_share: number;
  active: boolean;
  sort_order: number;
  tags: string[];
  annual_rate: number;
}

export interface Snapshot {
  date: string;
  account_id: string;
  balance_raw: number;
  comment?: string;
  entered_at?: string;
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
}

export interface OptionCompany {
  id: string;
  name: string;
  ticker: string;
  active: boolean;
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
  vesting_interval: number;
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
