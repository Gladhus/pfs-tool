import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUIStore } from '@/stores/ui.store';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, opts?: any) => {
    if (opts && typeof opts === 'object') {
      return Object.entries(opts).reduce(
        (s, [key, val]) => (s as string).replace(`{{${key}}}`, String(val)),
        k,
      );
    }
    return k;
  }, i18n: { language: 'en' } }),
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

vi.mock('@/queries/sheetMutations', () => ({
  useSaveMonthMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

import {
  useAccountsQuery,
  useSnapshotsQuery,
  useCategoryMetaQuery,
} from '@/queries/sheetQueries';
import EntryPage from '@/pages/entry/EntryPage';

type MockFn = ReturnType<typeof vi.fn>;

const SNAPSHOTS = [
  { date: '2024-01-15', account_id: 'self-1', balance_raw: 1000 },
  { date: '2024-01-15', account_id: 'partner-1', balance_raw: 5000 },
];

const ACCOUNTS = [
  { id: 'self-1', type: 'tfsa', name_en: 'My TFSA', name_fr: 'Mon REER', category: 'investments', kind: 'asset', ownership: [{ person_id: 'self', share: 1 }], tags: [], active: true, sort_order: 1, annual_rate: 0 },
  { id: 'partner-1', type: 'rrsp', name_en: 'Partner RRSP', name_fr: 'REER Partenaire', category: 'investments', kind: 'asset', ownership: [{ person_id: 'partner', share: 1 }], tags: [], active: true, sort_order: 2, annual_rate: 0 },
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
      <MemoryRouter initialEntries={['/entry/2024-01-15']}>
        <Routes>
          <Route path="/entry/:date" element={children} />
        </Routes>
      </MemoryRouter>
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

describe('EntryPage viewer filtering', () => {
  it('hides accounts the current viewer has 0% ownership of', () => {
    render(<EntryPage />, { wrapper: Wrapper });
    expect(screen.getByText('My TFSA')).toBeTruthy();
    expect(screen.queryByText('Partner RRSP')).toBeNull();
  });

  it('shows all accounts when viewing as household', () => {
    useUIStore.setState({ currentViewer: '__household__' });
    render(<EntryPage />, { wrapper: Wrapper });
    expect(screen.getByText('My TFSA')).toBeTruthy();
    expect(screen.getByText('Partner RRSP')).toBeTruthy();
  });

  it('shows an empty state when the viewer owns no accounts', () => {
    useUIStore.setState({ currentViewer: 'ghost' });
    render(<EntryPage />, { wrapper: Wrapper });
    expect(screen.getByText('viewer_empty_title')).toBeTruthy();
    expect(screen.queryByText('My TFSA')).toBeNull();
  });
});
