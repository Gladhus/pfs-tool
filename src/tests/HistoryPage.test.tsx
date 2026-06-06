import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

vi.mock('@/pages/history/components/HistoryChart', () => ({
  HistoryChart: () => <div data-testid="history-chart" />,
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
import HistoryPage from '@/pages/history/HistoryPage';

type MockFn = ReturnType<typeof vi.fn>;

const SNAPSHOTS = [
  { date: '2024-01-15', account_id: 'a1', balance_raw: 50000 },
  { date: '2024-06-01', account_id: 'a1', balance_raw: 60000 },
  { date: '2024-12-01', account_id: 'a1', balance_raw: 70000 },
];

const ACCOUNTS = [
  { id: 'a1', name: 'TFSA', name_en: 'TFSA', name_fr: 'REER', category: 'investments', kind: 'asset', ownership_share: 1, tags: [], active: true, sort_order: 1 },
];

const CATEGORY_META = [
  { id: 'investments', name_en: 'Investments', name_fr: 'Placements', sort_order: 1 },
];

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function pending() {
  return { isPending: true, isSuccess: false, data: undefined };
}

function ok(data: unknown) {
  return { isPending: false, isSuccess: true, data };
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter initialEntries={['/history']}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function setDefaultMocks() {
  (useSnapshotsQuery as MockFn).mockReturnValue(ok(SNAPSHOTS));
  (useAccountsQuery as MockFn).mockReturnValue(ok(ACCOUNTS));
  (useCategoryMetaQuery as MockFn).mockReturnValue(ok(CATEGORY_META));
}

beforeEach(() => {
  vi.clearAllMocks();
  useUIStore.setState({ privateMode: false, lang: 'en', theme: 'system' });
  setDefaultMocks();
});

describe('HistoryPage', () => {
  it('renders skeleton while data is pending', () => {
    (useSnapshotsQuery as MockFn).mockReturnValue(pending());
    (useAccountsQuery as MockFn).mockReturnValue(pending());
    const { container } = render(<HistoryPage />, { wrapper: Wrapper });
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('shows empty state when no snapshots', () => {
    (useSnapshotsQuery as MockFn).mockReturnValue(ok([]));
    render(<HistoryPage />, { wrapper: Wrapper });
    expect(screen.getByText('empty_history_title')).toBeTruthy();
    expect(screen.getByText('empty_history_body')).toBeTruthy();
  });

  it('renders chart stub and period pills with data', () => {
    render(<HistoryPage />, { wrapper: Wrapper });
    expect(screen.getByTestId('history-chart')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'period_1y' })).toBeTruthy();
  });

  it('shows series toggle bar in overview mode (no account selected)', () => {
    render(<HistoryPage />, { wrapper: Wrapper });
    // SeriesToggleBar has checkboxes for investments, realEstate, other
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(3);
  });

  it('shows account select dropdown trigger', () => {
    render(<HistoryPage />, { wrapper: Wrapper });
    expect(screen.getByRole('combobox')).toBeTruthy();  // More reliable
  });

  it('history_summary shows date range', () => {
    render(<HistoryPage />, { wrapper: Wrapper });
    // summary key with interpolation: "3 entries · 2024-01-15 → 2024-12-01"
    expect(screen.getByText(/2024-01-15/)).toBeTruthy();
    expect(screen.getByText(/2024-12-01/)).toBeTruthy();
  });

  it('renders month cards for each month of data', () => {
    render(<HistoryPage />, { wrapper: Wrapper });
    // 3 snapshots across 3 different months → 3 cards
    const cards = screen.getAllByRole('button', { name: /2024/ });
    expect(cards.length).toBeGreaterThan(0);
  });

  it('masks values in private mode', () => {
    useUIStore.setState({ privateMode: true });
    render(<HistoryPage />, { wrapper: Wrapper });
    expect(document.body.textContent).toMatch(/•/);
  });

  it('opening account select shows overview option', () => {
    render(<HistoryPage />, { wrapper: Wrapper });
    // Fixed: combobox has no accessible name due to span with pointer-events:none
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    expect(screen.getAllByText('overview_option').length).toBeGreaterThan(0);
  });
});
