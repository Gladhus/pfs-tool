import { Link, useRouteError, isRouteErrorResponse } from 'react-router-dom';

/**
 * Graceful catch-all for render/loader errors anywhere in the route tree. Wired as
 * the root route's `errorElement` so a thrown error shows this branded screen
 * instead of React Router's developer-facing default. Kept dependency-light (no
 * i18n / data hooks) so it still renders even when the failure is in a shared layer.
 */
export default function RouteError() {
  const error = useRouteError();
  // Surface the real error for developers without exposing the ugly default UI.
  console.error('Route error boundary caught:', error);

  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : null;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-bg px-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <p className="text-5xl font-bold text-fg-2">!</p>
        <h1 className="text-lg font-semibold text-fg">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted">
          The app hit an unexpected error. Reloading usually fixes it — your data is
          safe in your spreadsheet.
        </p>
      </div>

      {detail && (
        <details className="max-w-md text-left">
          <summary className="cursor-pointer text-xs text-muted hover:text-fg-2">
            Technical details
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-surface-2 p-3 text-xs text-fg-2 whitespace-pre-wrap break-words">
            {detail}
          </pre>
        </details>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => window.location.reload()}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
        >
          Reload
        </button>
        <Link
          to="/overview"
          className="rounded-md bg-surface-2 px-4 py-2 text-sm font-medium text-fg-2 transition-colors hover:bg-surface-3"
        >
          Go to Overview
        </Link>
      </div>
    </div>
  );
}
