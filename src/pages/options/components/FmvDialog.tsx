import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/ui/Dialog';
import { Button } from '@/ui/Button';
import { todayISO } from '@/utils/dates';
import type { OptionFmv } from '@/types/sheets';

interface Props {
  open: boolean;
  onClose: () => void;
  companyId: string;
  entry: OptionFmv | null;
  onSave: (entry: OptionFmv) => void;
}

export function FmvDialog({ open, onClose, companyId, entry, onSave }: Props) {
  const { t } = useTranslation();
  const [date, setDate] = useState(todayISO());
  const [fmv, setFmv] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    setDate(entry?.date ?? todayISO());
    setFmv(entry ? String(entry.fmv) : '');
    setNote(entry?.note ?? '');
  }, [open, entry]);

  const handleSave = () => {
    const val = Number(fmv);
    if (!date || !Number.isFinite(val)) return;
    onSave({ date, company_id: companyId, fmv: val, note: note.trim() });
  };

  const inputCls = 'h-8 w-full rounded border border-border bg-surface-1 px-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
  const labelCls = 'block text-xs font-medium text-fg-2 mb-1';

  return (
    <Dialog open={open} onClose={onClose} title={t('opt_log_fmv')}>
      <div className="space-y-3">
        <div>
          <label className={labelCls} htmlFor="fmv-date">{t('opt_fmv_date_col')}</label>
          <input id="fmv-date" type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="fmv-val">{t('opt_fmv_value_col')}</label>
          <input id="fmv-val" type="number" step="0.0001" className={inputCls} value={fmv} onChange={e => setFmv(e.target.value)} placeholder={t('opt_fmv_placeholder')} autoFocus />
        </div>
        <div>
          <label className={labelCls} htmlFor="fmv-note">{t('opt_fmv_note_col')}</label>
          <input id="fmv-note" className={inputCls} value={note} onChange={e => setNote(e.target.value)} placeholder={t('opt_note_placeholder')} />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>{t('cancel')}</Button>
        <Button variant="primary" size="sm" onClick={handleSave}>{t('save_changes')}</Button>
      </div>
    </Dialog>
  );
}
