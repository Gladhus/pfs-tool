import { useTranslation } from 'react-i18next';
import { Dialog } from './Dialog';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="text-sm text-fg-2 mb-6">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          {cancelLabel ?? t('cancel')}
        </Button>
        <Button variant={variant} size="sm" onClick={() => { onConfirm(); onClose(); }}>
          {confirmLabel ?? t('delete')}
        </Button>
      </div>
    </Dialog>
  );
}
