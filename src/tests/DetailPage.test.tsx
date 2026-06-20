import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUIStore } from '@/stores/ui.store';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('@/i18n', () => ({
  default: { changeLanguage: vi.fn() },
  tr: (entity: { name_en?: string; name_fr?: string }) => entity.name_en ?? entity.name_fr ?? '',
}));

vi.mock('@/queries/sheetQueries', () => ({
  useAccountsQuery: vi.fn(),
  useSnapshotsQuery: vi.fn(),
  useCategoryMetaQuery: vi.fn(),
  useConfigQuery: vi.fn(() => ({ isPending: false, isSuccess: true, data: { currency: 'CAD' } })),
  useFxRatesQuery: vi.fn(() => ({ isPending: false, isSuccess: true, data: [] })),
  usePeopleQuery: vi.fn(() => ({ isPending: false, isSuccess: true, data: [
    { id: 'self', name: 'Me', sort_order: 1, active: true, primary: true },
    { id: 'partner', name: 'Partner', sort_order: 2, active: true, primary: false },
  ] })),
}));

import {
  useAccountsQuery,
  useSnapshotsQuery,
  useCategoryMetaQuery,
} from '@/queries/sheetQueries';
import DetailPage from '@/features/accounts/detail/DetailPage';

type MockFn = ReturnType<typeof vi.fn>;

const SNAPSHOTS = [
  { date: '2024-01-15', account_id: 'self-1', balance_raw: 1000 },
  { date: '2024-01-15', account_id: 'self-2', balance_raw: 2000 },
  { date: '2024-01-15', account_id: 'partner-1', balance_raw: 5000 },
];

const ACCOUNTS = [
  { id: 'self-1', name_en: 'My TFSA', name_fr: 'Mon REER', category: 'investments', kind: 'asset', ownership: [{ person_id: 'self', share: 1 }], tags: [], active: true, sort_order: 1 },
  { id: 'self-2', name_en: 'My RRSP', name_fr: 'Mon RPA', category: 'investments', kind: 'asset', ownership: [{ person_id: 'self', share: 1 }], tags: [], active: true, sort_order: 2 },
  { id: 'partner-1', name_en: 'Partner RRSP', name_fr: 'REER Partenaire', category: 'investments', kind: 'asset', ownership: [{ person_id: 'partner', share: 1 }], tags: [], active: true, sort_order: 3 },
];

const CATEGORY_META = [
  { id: 'investments', name_en: 'Investments', name_fr: 'Placements', sort_order: 1 },
];

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function ok(data: unknown) {
  return { isPending: false, isSuccess: true, data };
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter initialEntries={['/detail']}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useUIStore.setState({ privateMode: false, lang: 'en', theme: 'system', currentViewer: 'self' });
  (useSnapshotsQuery as MockFn).mockReturnValue(ok(SNAPSHOTS));
  (useAccountsQuery as MockFn).mockReturnValue(ok(ACCOUNTS));
  (useCategoryMetaQuery as MockFn).mockReturnValue(ok(CATEGORY_META));
});

describe('DetailPage', () => {
  it('hides account rows the current viewer has 0% ownership of', () => {
    render(<DetailPage />, { wrapper: Wrapper });
    expect(screen.getByText('My TFSA')).toBeTruthy();
    expect(screen.getByText('My RRSP')).toBeTruthy();
    expect(screen.queryByText('Partner RRSP')).toBeNull();
  });

  it('shows the partner-owned account when viewing as household', () => {
    useUIStore.setState({ currentViewer: '__household__' });
    render(<DetailPage />, { wrapper: Wrapper });
    expect(screen.getByText('Partner RRSP')).toBeTruthy();
  });

  // A category with a 50/50 account plus a solely-owned one drops to a single visible row
  // for whichever viewer doesn't own the solely-owned account. Line items must still show
  // for that viewer (not collapse to "total only" just because they see fewer of the
  // category's accounts than someone else does).
  it('still shows the line item when viewer filtering leaves only one visible account in a multi-account category', () => {
    (useAccountsQuery as MockFn).mockReturnValue(ok([
      { id: 'house', name_en: 'House', name_fr: 'Maison', category: 'real_estate', kind: 'asset', ownership: [{ person_id: 'self', share: 0.5 }, { person_id: 'partner', share: 0.5 }], tags: [], active: true, sort_order: 1 },
      { id: 'mortgage', name_en: 'Mortgage', name_fr: 'Hypothèque', category: 'real_estate', kind: 'debt', ownership: [{ person_id: 'partner', share: 1 }], tags: [], active: true, sort_order: 2 },
    ]));
    (useSnapshotsQuery as MockFn).mockReturnValue(ok([
      { date: '2024-01-15', account_id: 'house', balance_raw: 100000 },
      { date: '2024-01-15', account_id: 'mortgage', balance_raw: -40000 },
    ]));
    (useCategoryMetaQuery as MockFn).mockReturnValue(ok([
      { id: 'real_estate', name_en: 'Real Estate', name_fr: 'Immobilier', sort_order: 1 },
    ]));

    // self only owns the house (50%) here — mortgage is filtered out — yet the category
    // still has 2 accounts overall, so the House line item must still render.
    render(<DetailPage />, { wrapper: Wrapper });
    expect(screen.getByText('House')).toBeTruthy();
    expect(screen.queryByText('Mortgage')).toBeNull();
    // The category total would just repeat the single visible House row, so it's suppressed.
    expect(screen.queryByText('detail_total')).toBeNull();
  });

  // A viewer who joined later should not see a run of empty leading year columns
  // that belong solely to someone else's earlier history.
  it('drops leading years that have no data for the current viewer', () => {
    (useAccountsQuery as MockFn).mockReturnValue(ok([
      { id: 'self-1', name_en: 'My TFSA', name_fr: 'Mon REER', category: 'investments', kind: 'asset', ownership: [{ person_id: 'self', share: 1 }], tags: [], active: true, sort_order: 1 },
      { id: 'partner-1', name_en: 'Partner RRSP', name_fr: 'REER Partenaire', category: 'investments', kind: 'asset', ownership: [{ person_id: 'partner', share: 1 }], tags: [], active: true, sort_order: 2 },
    ]));
    (useSnapshotsQuery as MockFn).mockReturnValue(ok([
      // Partner has years of history before self joins…
      { date: '2019-12-31', account_id: 'partner-1', balance_raw: 5000 },
      { date: '2020-12-31', account_id: 'partner-1', balance_raw: 5000 },
      // …self's first stake lands at end of 2020, with a 2021 snapshot keeping 2021 a column.
      { date: '2020-12-31', account_id: 'self-1', balance_raw: 1000 },
      { date: '2021-06-01', account_id: 'self-1', balance_raw: 1000 },
    ]));

    useUIStore.setState({ currentViewer: 'self' });
    render(<DetailPage />, { wrapper: Wrapper });

    // Self has data carried into 2021, so that column shows…
    expect(screen.getByText('2021')).toBeTruthy();
    // …but 2019/2020 belong only to the partner and must be trimmed for this viewer.
    expect(screen.queryByText('2019')).toBeNull();
    expect(screen.queryByText('2020')).toBeNull();
  });

  it('shows a viewer-specific empty state when the viewer owns none of the accounts', () => {
    useUIStore.setState({ currentViewer: 'partner' });
    (useAccountsQuery as MockFn).mockReturnValue(ok([
      { id: 'self-1', name_en: 'My TFSA', name_fr: 'Mon REER', category: 'investments', kind: 'asset', ownership: [{ person_id: 'self', share: 1 }], tags: [], active: true, sort_order: 1 },
    ]));
    (useSnapshotsQuery as MockFn).mockReturnValue(ok([
      { date: '2024-01-15', account_id: 'self-1', balance_raw: 1000 },
    ]));
    render(<DetailPage />, { wrapper: Wrapper });
    expect(screen.getByText('viewer_empty_title')).toBeTruthy();
    // Not the generic "no data" state — there IS data, just none for this viewer.
    expect(screen.queryByText('empty_detail_title')).toBeNull();
  });
});
