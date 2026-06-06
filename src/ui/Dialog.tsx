import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, children, className = '' }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const focusable = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const panel = panelRef.current;
    if (!panel) return;

    const first = panel.querySelectorAll<HTMLElement>(focusable)[0];
    first?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;

      const els = Array.from(panel.querySelectorAll<HTMLElement>(focusable)).filter(
        (el) => !el.hasAttribute('disabled'),
      );
      if (els.length === 0) return;
      const last = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === els[0]) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); els[0].focus(); }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'dialog-title' : undefined}
        className={`relative z-10 w-full max-w-md rounded-lg bg-surface-1 shadow-md p-6 ${className}`}
      >
        {title && (
          <h2 id="dialog-title" className="text-base font-semibold text-fg mb-4">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
