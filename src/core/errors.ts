// Maps Google API errors to user-facing i18n keys
export type ApiErrorKey =
  | 'authExpired'
  | 'permissionDenied'
  | 'notFound'
  | 'quotaExceeded'
  | 'serverError'
  | 'offline'
  | 'unknown';

export function classifyApiError(err: unknown): ApiErrorKey {
  const status =
    (err as { status?: number })?.status ??
    (err as { result?: { error?: { code?: number } } })?.result?.error?.code;

  if (status === 401) return 'authExpired';
  if (status === 403) return 'permissionDenied';
  if (status === 404) return 'notFound';
  if (status === 429) return 'quotaExceeded';
  if (typeof status === 'number' && status >= 500) return 'serverError';
  if (!navigator.onLine) return 'offline';
  return 'unknown';
}
