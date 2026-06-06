import { useToastStore, type ToastVariant } from '@/stores/toast.store';

const variantClass: Record<ToastVariant, string> = {
  default: 'bg-fg text-surface-1',
  ok:      'bg-ok-bg text-ok border border-ok/30',
  warn:    'bg-warn-bg text-warn border border-warn/30',
  error:   'bg-red-light text-red border border-red/30',
};

export function ToastHost() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none
                 bottom-4 md:bottom-4
                 bottom-[calc(60px+0.55rem+env(safe-area-inset-bottom))]"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 rounded-lg px-4 py-2.5 shadow-md text-sm pointer-events-auto ${variantClass[t.variant]}`}
        >
          <span>{t.message}</span>
          <button
            type="button"
            onClick={() => removeToast(t.id)}
            className="ml-auto shrink-0 opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
