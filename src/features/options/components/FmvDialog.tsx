import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/shared/ui/Dialog';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Label } from '@/shared/ui/Label';
import { todayISO } from '@/shared/utils/dates';
import type { OptionFmv } from '@/types/sheets';

interface Props {
  open: boolean;
  onClose: () => void;
  companyId: string;
  entry: OptionFmv | null;
  onSave: (entry: OptionFmv) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label>{children}</div>;
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

  return (
    <Dialog open={open} onClose={onClose} title={t('opt_log_fmv')}>
      <div className="space-y-3">
        <Field label={t('opt_fmv_date_col')}>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </Field>
        <Field label={t('opt_fmv_value_col')}>
          <Input type="number" step="0.0001" value={fmv} onChange={e => setFmv(e.target.value)} placeholder={t('opt_fmv_placeholder')} autoFocus />
        </Field>
        <Field label={t('opt_fmv_note_col')}>
          <Input value={note} onChange={e => setNote(e.target.value)} placeholder={t('opt_note_placeholder')} />
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>{t('cancel')}</Button>
        <Button variant="primary" size="sm" onClick={handleSave}>{t('save_changes')}</Button>
      </div>
    </Dialog>
  );
}
