import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useUIStore } from '@/shared/stores/ui.store';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));

vi.mock('@/app/auth/AuthProvider', () => ({
  useAuth: () => ({ signIn: vi.fn(), canSignIn: true }),
}));

vi.mock('@/shared/stores/auth.store', () => ({
  useAuthStore: () => false,
  selectIsSignedIn: (s: unknown) => s,
}));

vi.mock('@/shared/stores/datasource.store', () => ({
  useDatasourceStore: () => true,
}));

vi.mock('@/shared/components/NavTabs', () => ({ default: () => null }));

vi.mock('@/shared/io/queries/sheetQueries', () => ({
  usePeopleQuery: vi.fn(),
}));

import { usePeopleQuery } from '@/shared/io/queries/sheetQueries';
import Header from '@/shared/components/Header';

type MockFn = ReturnType<typeof vi.fn>;

const TWO_PEOPLE = [
  { id: 'self', name: 'Me', sort_order: 1, active: true, primary: true },
  { id: 'partner', name: 'Partner', sort_order: 2, active: true, primary: false },
];

function people(data: unknown) {
  return { isPending: false, isSuccess: true, data };
}

function renderHeader() {
  return render(
    <MemoryRouter initialEntries={['/overview']}>
      <Header />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (usePeopleQuery as MockFn).mockReturnValue(people(TWO_PEOPLE));
});

describe('Header viewer guard', () => {
  it('resets a stale viewer (archived/unknown person) to the primary person', () => {
    useUIStore.setState({ currentViewer: 'ghost' });
    renderHeader();
    expect(useUIStore.getState().currentViewer).toBe('self');
  });

  it('falls back to the first active person when none is primary', () => {
    useUIStore.setState({ currentViewer: 'ghost' });
    (usePeopleQuery as MockFn).mockReturnValue(people([
      { id: 'alice', name: 'Alice', sort_order: 1, active: true, primary: false },
      { id: 'bob', name: 'Bob', sort_order: 2, active: true, primary: false },
    ]));
    renderHeader();
    expect(useUIStore.getState().currentViewer).toBe('alice');
  });

  it('leaves a valid person viewer untouched', () => {
    useUIStore.setState({ currentViewer: 'partner' });
    renderHeader();
    expect(useUIStore.getState().currentViewer).toBe('partner');
  });

  it('leaves the household viewer untouched', () => {
    useUIStore.setState({ currentViewer: '__household__' });
    renderHeader();
    expect(useUIStore.getState().currentViewer).toBe('__household__');
  });

  it('does not reset before people have loaded', () => {
    useUIStore.setState({ currentViewer: 'ghost' });
    (usePeopleQuery as MockFn).mockReturnValue({ isPending: true, isSuccess: false, data: undefined });
    renderHeader();
    expect(useUIStore.getState().currentViewer).toBe('ghost');
  });
});
