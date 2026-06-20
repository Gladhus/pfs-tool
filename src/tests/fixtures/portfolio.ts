import type {
  Account, Snapshot, CategoryMeta, Group, Person, FxRate,
  OptionCompany, OptionGrant, OptionFmv, OptionExercise, Currency,
} from '@/types/sheets';
import { deriveDatesSorted } from '@/utils/dates';
import { fxMap as buildFxMap } from '@/utils/currency';
import type { EquityData } from '@/features/options/data/equity.selectors';

/**
 * One realistic portfolio that exercises every edge the data layer must preserve
 * across the `src/core/` migration. It is the fixture behind the golden-master
 * tests (`src/tests/golden/`): change it only with intent, and re-bless the
 * snapshots in the same commit.
 *
 * Coverage baked in:
 *  - two people; a 50/50 joint account and a single-owner account
 *  - a USD account (FX conversion) and a debt (negative sign)
 *  - real-estate asset + real-estate-debt (the foldCategoryId case)
 *  - a partner-only account on the earliest date → leading viewer-empty trim for `self`
 *  - stock options: one USD company (owner `self`), a grant with cliff + monthly
 *    vesting, an FMV step-up, and a partial exercise
 *  - a tag-based group ("Tech") matching one account and the company
 */

export const PEOPLE: Person[] = [
  { id: 'self',    name: 'Me',      sort_order: 1, active: true, primary: true },
  { id: 'partner', name: 'Partner', sort_order: 2, active: true, primary: false },
];

const acct = (a: Partial<Account> & { id: string; category: string; kind: 'asset' | 'debt'; ownership: Account['ownership'] }): Account => ({
  type: '', name_fr: a.id, name_en: a.id, active: true, sort_order: 0, tags: [], annual_rate: 0, ...a,
});

export const ACCOUNTS: Account[] = [
  acct({ id: 'inv_self',    category: 'investments',      kind: 'asset', ownership: [{ person_id: 'self', share: 1 }], tags: ['tech'], sort_order: 1 }),
  acct({ id: 'inv_joint',   category: 'investments',      kind: 'asset', ownership: [{ person_id: 'self', share: 0.5 }, { person_id: 'partner', share: 0.5 }], sort_order: 2 }),
  acct({ id: 'cash_usd',    category: 'cash',             kind: 'asset', ownership: [{ person_id: 'self', share: 1 }], currency: 'USD', sort_order: 3 }),
  acct({ id: 'house',       category: 'real_estate',      kind: 'asset', ownership: [{ person_id: 'self', share: 0.5 }, { person_id: 'partner', share: 0.5 }], sort_order: 4 }),
  acct({ id: 'mortgage',    category: 'real_estate_debt', kind: 'debt',  ownership: [{ person_id: 'self', share: 0.5 }, { person_id: 'partner', share: 0.5 }], sort_order: 5 }),
  acct({ id: 'partner_inv', category: 'investments',      kind: 'asset', ownership: [{ person_id: 'partner', share: 1 }], sort_order: 6 }),
];

export const SNAPSHOTS: Snapshot[] = [
  // 2021 — partner only: a leading date that should trim away for the `self` viewer.
  { date: '2021-03-15', account_id: 'partner_inv', balance_raw: 10000 },
  // 2022 — self joins.
  { date: '2022-02-01', account_id: 'inv_self',  balance_raw: 20000 },
  { date: '2022-02-01', account_id: 'inv_joint', balance_raw: 8000 },
  { date: '2022-02-01', account_id: 'cash_usd',  balance_raw: 1000 },
  { date: '2022-02-01', account_id: 'house',     balance_raw: 400000 },
  { date: '2022-02-01', account_id: 'mortgage',  balance_raw: 300000 },
  // 2023.
  { date: '2023-05-10', account_id: 'inv_self',  balance_raw: 25000 },
  { date: '2023-05-10', account_id: 'inv_joint', balance_raw: 9000 },
  { date: '2023-05-10', account_id: 'cash_usd',  balance_raw: 1200 },
  { date: '2023-05-10', account_id: 'mortgage',  balance_raw: 290000 },
  // 2024.
  { date: '2024-06-01', account_id: 'inv_self',    balance_raw: 30000 },
  { date: '2024-06-01', account_id: 'house',       balance_raw: 420000 },
  { date: '2024-06-01', account_id: 'partner_inv', balance_raw: 15000 },
];

export const FX_RATES: FxRate[] = [
  { date: '2022-01-01', usd_cad: 1.30 },
  { date: '2023-01-01', usd_cad: 1.35 },
  { date: '2024-01-01', usd_cad: 1.40 },
];

export const CATEGORY_META: CategoryMeta[] = [
  { id: 'investments',      name_en: 'Investments',  name_fr: 'Placements',  kind: 'asset', sort_order: 1, group: 'assets', group_sort: 1 },
  { id: 'cash',             name_en: 'Cash',         name_fr: 'Liquidités',  kind: 'asset', sort_order: 2, group: 'assets', group_sort: 1 },
  { id: 'real_estate',      name_en: 'Real Estate',  name_fr: 'Immobilier',  kind: 'asset', sort_order: 3, group: 'assets', group_sort: 1 },
  { id: 'real_estate_debt', name_en: 'RE Debt',      name_fr: 'Dette imm.',  kind: 'debt',  sort_order: 4, group: 'debt',   group_sort: 2 },
];

export const GROUPS: Group[] = [
  { name: 'Tech', color: '#4878b0', all: [], any: ['tech'], exclude: [] },
];

export const OPTION_COMPANIES: OptionCompany[] = [
  { id: 'optco', name: 'OptCo', ticker: 'OPT', active: true, tags: ['tech'], currency: 'USD', owner: 'self' },
];

export const OPTION_GRANTS: OptionGrant[] = [
  {
    id: 'g1', company_id: 'optco', label: 'Grant 1', grant_type: 'iso',
    grant_date: '2022-01-01', total_shares: 1000, strike_price: 1,
    vesting_start: '2022-01-01', cliff_months: 12, vesting_months: 48,
    vesting_interval: 'monthly', expiry_date: '2032-01-01',
  },
];

export const OPTION_FMV: OptionFmv[] = [
  { date: '2022-01-01', company_id: 'optco', fmv: 5 },
  { date: '2024-01-01', company_id: 'optco', fmv: 10 },
];

export const OPTION_EXERCISES: OptionExercise[] = [
  { id: 'e1', grant_id: 'g1', date: '2024-02-01', shares_exercised: 100, price_paid: 1 },
];

export const OPTION_DATA: EquityData = {
  companies: OPTION_COMPANIES,
  grants: OPTION_GRANTS,
  fmv: OPTION_FMV,
  exercises: OPTION_EXERCISES,
};

export const MAIN: Currency = 'CAD';
export const DATES_SORTED = deriveDatesSorted(SNAPSHOTS);
export const FX_MAP = buildFxMap(FX_RATES);

/** Full params for `useOverviewStats`, with sensible defaults the goldens can override. */
export function overviewParams(over: {
  view?: 'category' | 'group' | 'person';
  viewer?: string;
  filteredDates?: string[];
  seriesVisible?: Record<string, boolean>;
  stockOptEnabled?: boolean;
} = {}) {
  return {
    snapshots: SNAPSHOTS,
    accounts: ACCOUNTS,
    categoryMeta: CATEGORY_META,
    groups: GROUPS,
    people: PEOPLE,
    optionData: OPTION_DATA,
    filteredDates: over.filteredDates ?? DATES_SORTED,
    datesSorted: DATES_SORTED,
    view: over.view ?? 'category',
    seriesVisible: over.seriesVisible ?? {},
    stockOptEnabled: over.stockOptEnabled ?? true,
    main: MAIN,
    fxMap: FX_MAP,
    viewer: over.viewer ?? 'self',
  } as const;
}
