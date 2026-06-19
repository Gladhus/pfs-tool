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
}));

import {
  useAccountsQuery,
  useSnapshotsQuery,
  useCategoryMetaQuery,
} from '@/queries/sheetQueries';
import DetailPage from '@/pages/detail/DetailPage';

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
  });
});
