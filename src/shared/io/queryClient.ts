import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { classifyApiError } from '@/core/errors';
import { useStatusStore } from '@/shared/stores/status.store';

function handleError(err: unknown) {
  const key = classifyApiError(err);
  useStatusStore.getState().setStatus(`err_${key}`, 'warn');
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleError }),
  mutationCache: new MutationCache({ onError: handleError }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = (error as { status?: number })?.status;
        if (status === 403 || status === 404) return false;
        return failureCount < 3;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
    },
  },
});
