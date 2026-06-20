import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// react-i18next: return keys as-is so assertions are stable and readable
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));

// Mock useBreakpoint so tests control desktop vs mobile
vi.mock('@/shared/hooks/useBreakpoint', () => ({
  useBreakpoint: vi.fn(),
}));

// Mock useConfigQuery so tests control the stock_options_enabled flag
vi.mock('@/shared/io/queries/sheetQueries', () => ({
  useConfigQuery: vi.fn(),
}));

import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { useConfigQuery } from '@/shared/io/queries/sheetQueries';
import NavTabs from '@/shared/components/NavTabs';
import BottomTabBar from '@/shared/components/BottomTabBar';

const mockBreakpoint = useBreakpoint as ReturnType<typeof vi.fn>;
const mockConfigQuery = useConfigQuery as ReturnType<typeof vi.fn>;

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter initialEntries={['/overview']}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockBreakpoint.mockReturnValue(true);
  mockConfigQuery.mockReturnValue({ data: undefined, isPending: false, isSuccess: false });
});

// ── NavTabs ──────────────────────────────────────────────────────────────────

describe('NavTabs', () => {
  it('renders inline tabs (no Stock Options when flag off)', () => {
    mockConfigQuery.mockReturnValue({ data: { stock_options_enabled: false } });
    render(<NavTabs />, { wrapper: Wrapper });

    expect(screen.getByRole('link', { name: 'tab_overview' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'tab_portfolio' })).toBeInTheDocument();
    // Settings + New entry are now right-side header icon buttons, not tabs.
    expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull();
    expect(screen.queryByRole('link', { name: /new entry/i })).toBeNull();
    expect(screen.queryByRole('link', { name: 'tab_stock_options' })).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('renders Stock Options when flag is on', () => {
    mockConfigQuery.mockReturnValue({ data: { stock_options_enabled: true } });
    render(<NavTabs />, { wrapper: Wrapper });

    expect(screen.getByRole('link', { name: 'tab_stock_options' })).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });

  it('hides Stock Options when config is still loading (flag undefined)', () => {
    mockConfigQuery.mockReturnValue({ data: undefined, isPending: true });
    render(<NavTabs />, { wrapper: Wrapper });

    expect(screen.queryByRole('link', { name: 'tab_stock_options' })).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });
});

// ── BottomTabBar ──────────────────────────────────────────────────────────────

describe('BottomTabBar', () => {
  it('renders base links and the Entry FAB without Stock Options when flag off', () => {
    mockConfigQuery.mockReturnValue({ data: { stock_options_enabled: false } });
    render(<BottomTabBar />, { wrapper: Wrapper });

    expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Portfolio' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /new entry/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Stock Options' })).toBeNull();
  });

  it('shows Stock Options tab when flag is on', () => {
    mockConfigQuery.mockReturnValue({ data: { stock_options_enabled: true } });
    render(<BottomTabBar />, { wrapper: Wrapper });

    expect(screen.getByRole('link', { name: 'Stock Options' })).toBeInTheDocument();
  });

  it('has aria-label "Main navigation"', () => {
    mockConfigQuery.mockReturnValue({ data: {} });
    render(<BottomTabBar />, { wrapper: Wrapper });

    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });
});
