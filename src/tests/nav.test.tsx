import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock useBreakpoint so tests control desktop vs mobile
vi.mock('@/hooks/useBreakpoint', () => ({
  useBreakpoint: vi.fn(),
}));

// Mock useConfigQuery so tests control the stock_options_enabled flag
vi.mock('@/queries/sheetQueries', () => ({
  useConfigQuery: vi.fn(),
}));

import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useConfigQuery } from '@/queries/sheetQueries';
import NavTabs from '@/components/NavTabs';
import BottomTabBar from '@/components/BottomTabBar';

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
  it('renders 5 base links (no Options when flag off)', () => {
    mockConfigQuery.mockReturnValue({ data: { stock_options_enabled: false } });
    render(<NavTabs />, { wrapper: Wrapper });

    expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Detail' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entry' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Options' })).toBeNull();
  });

  it('renders 6 links including Options when flag is on', () => {
    mockConfigQuery.mockReturnValue({ data: { stock_options_enabled: true } });
    render(<NavTabs />, { wrapper: Wrapper });

    expect(screen.getByRole('link', { name: 'Options' })).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(6);
  });

  it('renders 5 links when config is still loading (flag undefined)', () => {
    mockConfigQuery.mockReturnValue({ data: undefined, isPending: true });
    render(<NavTabs />, { wrapper: Wrapper });

    expect(screen.queryByRole('link', { name: 'Options' })).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(5);
  });
});

// ── BottomTabBar ──────────────────────────────────────────────────────────────

describe('BottomTabBar', () => {
  it('renders base links and the Entry FAB without Options when flag off', () => {
    mockConfigQuery.mockReturnValue({ data: { stock_options_enabled: false } });
    render(<BottomTabBar />, { wrapper: Wrapper });

    expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /new entry/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Detail' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Options' })).toBeNull();
  });

  it('shows Options tab when flag is on', () => {
    mockConfigQuery.mockReturnValue({ data: { stock_options_enabled: true } });
    render(<BottomTabBar />, { wrapper: Wrapper });

    expect(screen.getByRole('link', { name: 'Options' })).toBeInTheDocument();
  });

  it('has aria-label "Main navigation"', () => {
    mockConfigQuery.mockReturnValue({ data: {} });
    render(<BottomTabBar />, { wrapper: Wrapper });

    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });
});
