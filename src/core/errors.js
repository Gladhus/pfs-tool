import { t } from './i18n/index.js';

export function classifyApiError(err) {
  const status = err?.status ?? err?.result?.error?.code;
  if (status === 401) return 'authExpired';
  if (status === 403) return 'permissionDenied';
  if (status === 404) return 'notFound';
  if (status === 429) return 'quotaExceeded';
  if (status >= 500)  return 'serverError';
  // Only trust the browser's own offline signal. A bare TypeError from a gapi
  // call almost always means a code bug, not a dropped connection — classifying
  // it as "offline" hides real errors behind a misleading message.
  if (!navigator.onLine) return 'offline';
  return 'unknown';
}

export function getUserMessage(err) {
  return t('err_' + classifyApiError(err));
}
