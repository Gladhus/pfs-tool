import { create } from 'zustand';

export type ToastVariant = 'default' | 'ok' | 'warn' | 'error';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, variant?: ToastVariant) => void;
  removeToast: (id: string) => void;
}

let _next = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, variant = 'default') => {
    const id = String(++_next);
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
