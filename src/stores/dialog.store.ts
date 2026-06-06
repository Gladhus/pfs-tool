import { create } from 'zustand';

export type ActiveDialog = 'account' | 'migrate' | 'group' | 'confirm' | null;

interface DialogState {
  activeDialog: ActiveDialog;
  onConfirm: (() => void) | null;
  openDialog: (d: ActiveDialog, onConfirm?: () => void) => void;
  closeDialog: () => void;
}

export const useDialogStore = create<DialogState>((set) => ({
  activeDialog: null,
  onConfirm: null,
  openDialog: (activeDialog, onConfirm = null) => set({ activeDialog, onConfirm }),
  closeDialog: () => set({ activeDialog: null, onConfirm: null }),
}));
