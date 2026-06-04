import { t } from './i18n/index.js';

export function classifyApiError(err) {
  const status = err?.status ?? err?.result?.error?.code;
  if (status === 401) return 'authExpired';
  if (status === 403) return 'permissionDenied';
  if (status === 404) return 'notFound';
  if (status === 429) return 'quotaExceeded';
  if (status >= 500)  return 'serverError';
  if (!navigator.onLine || err instanceof TypeError) return 'offline';
  return 'unknown';
}

export function getUserMessage(err) {
  return t('err_' + classifyApiError(err));
}
