import * as Toast from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { useToastStore, type ToastVariant } from '@/shared/stores/toast.store';

const variantCls: Record<ToastVariant, string> = {
  default: 'bg-fg text-surface-1',
  ok:      'bg-ok-bg text-ok border border-ok/30',
  warn:    'bg-warn-bg text-warn border border-warn/30',
  error:   'bg-red-light text-red border border-red/30',
};

export function ToastHost() {
  const { toasts, removeToast } = useToastStore();

  return (
    <Toast.Provider>
      {toasts.map(t => (
        <Toast.Root
          key={t.id}
          open
          onOpenChange={open => { if (!open) removeToast(t.id); }}
          className={[
            'flex items-center gap-3 rounded-lg px-4 py-2.5 shadow-md text-sm',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-2',
            variantCls[t.variant],
          ].join(' ')}
        >
          <Toast.Description asChild>
            <span>{t.message}</span>
          </Toast.Description>
          <Toast.Action altText="Dismiss" asChild>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="ml-auto shrink-0 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current rounded"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </Toast.Action>
        </Toast.Root>
      ))}
      <Toast.Viewport
        className={[
          'fixed left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none',
          'bottom-4 md:bottom-4',
          'bottom-[calc(60px+0.55rem+env(safe-area-inset-bottom))]',
          '[&>li]:pointer-events-auto [&>li]:list-none',
        ].join(' ')}
      />
    </Toast.Provider>
  );
}
