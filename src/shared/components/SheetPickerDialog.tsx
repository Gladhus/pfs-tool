import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listSheets } from '@/shared/io/api/drive';
import { useAuthStore } from '@/shared/stores/auth.store';
import { setStatus } from '@/shared/stores/status.store';
import { bootstrapSheet } from '@/app/auth/bootstrap';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface SheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
}

export default function SheetPickerDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [sheets, setSheets] = useState<SheetFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open) {
      dlg.showModal();
      setLoading(true);
      setError(null);
      setSheets([]);
      listSheets()
        .then(setSheets)
        .catch((err: unknown) => setError((err as { message?: string })?.message ?? String(err)))
        .finally(() => setLoading(false));
    } else {
      dlg.close();
    }
  }, [open]);

  const handlePick = async (file: SheetFile) => {
    if (useAuthStore.getState().isBootstrapping) return;
    onClose();
    useAuthStore.getState().setSheetId(file.id);
    setStatus(t('sheet_linked'), 'ok');
    await bootstrapSheet();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="bg-surface-1 text-fg rounded-xl shadow-lg border border-border p-0 max-w-sm w-full backdrop:bg-black/60"
    >
      <div className="p-5 border-b border-border">
        <h2 className="font-semibold">{t('choose_sheet')}</h2>
        <p className="text-sm text-muted mt-1">{t('choose_sheet_hint')}</p>
      </div>

      <div className="p-3 max-h-72 overflow-y-auto">
        {loading && (
          <p className="text-sm text-muted text-center py-4">{t('loading')}</p>
        )}
        {error && (
          <p className="text-sm text-red text-center py-4">{error}</p>
        )}
        {!loading && !error && sheets.length === 0 && (
          <p className="text-sm text-muted text-center py-4">{t('no_sheets_found')}</p>
        )}
        {sheets.map((f) => (
          <button
            key={f.id}
            onClick={() => void handlePick(f)}
            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-surface-2 text-sm transition-colors"
          >
            {f.name}
          </button>
        ))}
      </div>

      <div className="p-3 border-t border-border flex justify-end">
        <button
          onClick={onClose}
          className="text-sm px-3 py-1.5 rounded bg-surface-2 hover:bg-surface-3 text-fg-2 transition-colors"
        >
          {t('cancel')}
        </button>
      </div>
    </dialog>
  );
}
