import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUIStore } from '@/stores/ui.store';

// react-i18next: return keys as-is so assertions are stable and readable
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

// i18n module: stub tr() for CategoryMeta
vi.mock('@/i18n', () => ({
  default: { changeLanguage: vi.fn() },
  tr: (entity: { name_en?: string; name_fr?: string }) => entity.name_en ?? entity.name_fr ?? '',
}));

// OverviewChart uses Chart.js + canvas — stub the whole component at the page level
vi.mock('@/pages/overview/components/OverviewChart', () => ({
  OverviewChart: () => <div data-testid="overview-chart" />,
}));

// Mock all sheet queries
vi.mock('@/queries/sheetQueries', () => ({
  useAccountsQuery: vi.fn(),
  useSnapshotsQuery: vi.fn(),
  useCategoryMetaQuery: vi.fn(),
  useGroupsQuery: vi.fn(),
  useConfigQuery: vi.fn(),
  useOptionCompaniesQuery: vi.fn(),
  useOptionGrantsQuery: vi.fn(),
  useOptionFmvQuery: vi.fn(),
  useOptionExercisesQuery: vi.fn(),
}));

import {
  useAccountsQuery,
  useSnapshotsQuery,
  useCategoryMetaQuery,
  useGroupsQuery,
  useConfigQuery,
  useOptionCompaniesQuery,
  useOptionGrantsQuery,
  useOptionFmvQuery,
  useOptionExercisesQuery,
} from '@/queries/sheetQueries';

import OverviewPage from '@/pages/overview/OverviewPage';

type MockFn = ReturnType<typeof vi.fn>;

const SNAPSHOTS = [
  { date: '2024-01-01', account_id: 'a1', balance_raw: 50000 },
  { date: '2024-06-01', account_id: 'a1', balance_raw: 60000 },
  { date: '2024-12-01', account_id: 'a1', balance_raw: 70000 },
];

const ACCOUNTS = [
  { id: 'a1', name: 'TFSA', category: 'investments', kind: 'asset', ownership_share: 1, tags: [] },
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
      <MemoryRouter initialEntries={['/overview']}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function setDefaultMocks() {
  (useSnapshotsQuery as MockFn).mockReturnValue(ok(SNAPSHOTS));
  (useAccountsQuery as MockFn).mockReturnValue(ok(ACCOUNTS));
  (useCategoryMetaQuery as MockFn).mockReturnValue(ok(CATEGORY_META));
  (useGroupsQuery as MockFn).mockReturnValue(ok([]));
  (useConfigQuery as MockFn).mockReturnValue(ok({ stock_options_enabled: false, currency: 'CAD', language: 'en' }));
  (useOptionCompaniesQuery as MockFn).mockReturnValue(ok([]));
  (useOptionGrantsQuery as MockFn).mockReturnValue(ok([]));
  (useOptionFmvQuery as MockFn).mockReturnValue(ok([]));
  (useOptionExercisesQuery as MockFn).mockReturnValue(ok([]));
}

beforeEach(() => {
  vi.clearAllMocks();
  useUIStore.setState({ privateMode: false, lang: 'en', theme: 'system', ovView: 'category', ovSeriesVisible: {} });
  setDefaultMocks();
});

describe('OverviewPage', () => {
  it('renders skeleton while data is pending', () => {
    (useSnapshotsQuery as MockFn).mockReturnValue(pending());
    (useAccountsQuery as MockFn).mockReturnValue(pending());
    const { container } = render(<OverviewPage />, { wrapper: Wrapper });
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('shows empty state when no snapshots', () => {
    (useSnapshotsQuery as MockFn).mockReturnValue(ok([]));
    render(<OverviewPage />, { wrapper: Wrapper });
    // t() returns key in this test environment
    expect(screen.getByText('empty_overview_title')).toBeTruthy();
    expect(screen.getByText('empty_overview_cta')).toBeTruthy();
  });

  it('renders allocation section and period pills with data', () => {
    render(<OverviewPage />, { wrapper: Wrapper });
    expect(screen.getByText('allocation_title')).toBeTruthy();
    // Period pill is a radio button — target it by role to avoid matching delta labels
    expect(screen.getByRole('radio', { name: 'period_1y' })).toBeTruthy();
  });

  it('renders view toggle buttons', () => {
    render(<OverviewPage />, { wrapper: Wrapper });
    expect(screen.getByRole('radio', { name: 'view_by_category' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'view_by_group' })).toBeTruthy();
  });

  it('clicking group view updates ovView store', () => {
    render(<OverviewPage />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole('radio', { name: 'view_by_group' }));
    expect(useUIStore.getState().ovView).toBe('group');
  });

  it('shows EmptyGroupsState when group view has no groups', () => {
    useUIStore.setState({ ovView: 'group' });
    render(<OverviewPage />, { wrapper: Wrapper });
    expect(screen.getByText('no_groups_title')).toBeTruthy();
  });

  it('does not render equity_label when stock options disabled', () => {
    render(<OverviewPage />, { wrapper: Wrapper });
    expect(screen.queryByText('equity_label')).toBeNull();
  });

  it('equity stat card absent when equityValue = 0 (no grants)', () => {
    (useConfigQuery as MockFn).mockReturnValue(ok({ stock_options_enabled: true }));
    (useOptionCompaniesQuery as MockFn).mockReturnValue(ok([{ id: 'c1', name: 'ACME', active: true }]));
    (useOptionGrantsQuery as MockFn).mockReturnValue(ok([]));
    (useOptionFmvQuery as MockFn).mockReturnValue(ok([{ company_id: 'c1', date: '2024-12-01', fmv: 10 }]));
    (useOptionExercisesQuery as MockFn).mockReturnValue(ok([]));
    render(<OverviewPage />, { wrapper: Wrapper });
    // SeriesToggle shows equity_label as a chart legend chip (correct)
    // Stat card inside the allocation grid only renders when equityValue > 0
    // With no grants: equity = 0 → card absent; only the legend chip exists
    const labels = screen.queryAllByText('equity_label');
    // None of the matching nodes should be inside the allocation grid's stat card
    const gridCard = labels.find(el => el.closest('.rounded-lg.bg-surface-1'));
    expect(gridCard).toBeUndefined();
  });

  it('masks values in private mode', () => {
    useUIStore.setState({ privateMode: true });
    render(<OverviewPage />, { wrapper: Wrapper });
    expect(document.body.textContent).toMatch(/•/);
  });

  it('renders category stat cards for data present', () => {
    render(<OverviewPage />, { wrapper: Wrapper });
    // tr() returns name_en; may appear in both SeriesToggle and StatCard
    expect(screen.getAllByText('Investments').length).toBeGreaterThan(0);
  });
});
