import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useUIStore } from '@/shared/stores/ui.store';

// Return the key, appending interpolated values so the resolved {{name}} is assertable
// (the mock has no real "Viewing as {{name}}" template to substitute into).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => (
    opts && typeof opts === 'object' ? `${k}:${Object.values(opts).join(',')}` : k
  ), i18n: { language: 'en' } }),
}));

vi.mock('@/shared/io/queries/sheetQueries', () => ({
  usePeopleQuery: vi.fn(),
}));

import { usePeopleQuery } from '@/shared/io/queries/sheetQueries';
import { ViewingAsBadge } from '@/shared/components/ViewingAsBadge';

type MockFn = ReturnType<typeof vi.fn>;

const TWO_PEOPLE = [
  { id: 'self', name: 'Me', sort_order: 1, active: true, primary: true },
  { id: 'partner', name: 'Partner', sort_order: 2, active: true, primary: false },
];

function people(data: unknown) {
  return { isPending: false, isSuccess: true, data };
}

beforeEach(() => {
  vi.clearAllMocks();
  useUIStore.setState({ currentViewer: 'self' });
  (usePeopleQuery as MockFn).mockReturnValue(people(TWO_PEOPLE));
});

describe('ViewingAsBadge', () => {
  it('names the current person viewer', () => {
    useUIStore.setState({ currentViewer: 'partner' });
    render(<ViewingAsBadge />);
    expect(screen.getByText('viewing_as:Partner')).toBeTruthy();
  });

  it('uses the household label for the household viewer', () => {
    useUIStore.setState({ currentViewer: '__household__' });
    render(<ViewingAsBadge />);
    expect(screen.getByText('viewing_as:viewer_household')).toBeTruthy();
  });

  it('renders nothing when there is only one active person (no filtering possible)', () => {
    (usePeopleQuery as MockFn).mockReturnValue(people([TWO_PEOPLE[0]]));
    const { container } = render(<ViewingAsBadge />);
    expect(container.firstChild).toBeNull();
  });
});
