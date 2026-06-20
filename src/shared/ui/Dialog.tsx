import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, children, className = '' }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className={[
            'fixed inset-0 z-50 bg-black/40',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          ].join(' ')}
        />
        <RadixDialog.Content
          className={[
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-[calc(100%-2rem)] max-w-md rounded-xl bg-surface-1 shadow-xl p-6',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            className,
          ].join(' ')}
        >
          {title && (
            <div className="flex items-center justify-between mb-4">
              <RadixDialog.Title className="text-base font-semibold text-fg">
                {title}
              </RadixDialog.Title>
              <RadixDialog.Close className="rounded p-1 text-muted hover:text-fg hover:bg-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <X size={16} />
              </RadixDialog.Close>
            </div>
          )}
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
