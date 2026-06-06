import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { AuthProvider } from '@/auth/AuthProvider';

vi.mock('@/auth/bootstrap', () => ({
  bootstrapSheet: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/config', () => ({
  default: { CLIENT_ID: 'test-client-id', SCOPES: 'email' },
  hasValidClientId: () => true,
}));

import { bootstrapSheet } from '@/auth/bootstrap';

const mockInitTokenClient = vi.fn().mockReturnValue({ requestAccessToken: vi.fn() });

beforeEach(() => {
  vi.clearAllMocks();
  mockInitTokenClient.mockReturnValue({ requestAccessToken: vi.fn() });

  useAuthStore.setState({
    gapiReady: false, gisReady: false, accessToken: null, expiresAt: null,
    sheetId: null, userEmail: null, isBootstrapping: false,
    isDataLoaded: false, sessionRestoreAttempted: false, bootstrapError: null,
  });

  (globalThis as Record<string, unknown>).google = {
    accounts: { oauth2: { initTokenClient: mockInitTokenClient, revoke: vi.fn() } },
  };
  (globalThis as Record<string, unknown>).gapi = {
    load: vi.fn(),
    client: { init: vi.fn().mockResolvedValue(undefined), setToken: vi.fn() },
  };
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).google;
  delete (globalThis as Record<string, unknown>).gapi;
});

function Wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <StrictMode>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AuthProvider>{children}</AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>
  );
}

describe('AuthProvider', () => {
  it('calls initTokenClient exactly once even with StrictMode double-effect invocation', () => {
    render(null, { wrapper: Wrapper });
    // StrictMode double-invokes effects; the module-level _tokenClientInitialized guard
    // must prevent the second initTokenClient call
    expect(mockInitTokenClient).toHaveBeenCalledTimes(1);
  });

  it('retries bootstrapSheet on visibilitychange when bootstrapError is set and data not loaded', async () => {
    render(null, { wrapper: Wrapper });

    // Simulate a previous bootstrap failure with an active token
    act(() => {
      useAuthStore.setState({
        bootstrapError: 'some error',
        isDataLoaded: false,
        isBootstrapping: false,
        accessToken: 'tok-abc',
        expiresAt: Date.now() + 60 * 60 * 1000, // not near expiry so no token refresh
      });
    });

    await act(async () => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(bootstrapSheet).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().bootstrapError).toBeNull();
  });

  it('does NOT retry bootstrap when isBootstrapping is already true', async () => {
    render(null, { wrapper: Wrapper });

    act(() => {
      useAuthStore.setState({
        bootstrapError: 'error',
        isDataLoaded: false,
        isBootstrapping: true,
        accessToken: 'tok-abc',
        expiresAt: Date.now() + 60 * 60 * 1000,
      });
    });

    await act(async () => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(bootstrapSheet).not.toHaveBeenCalled();
  });
});
