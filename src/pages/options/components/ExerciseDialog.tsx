import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/ui/Dialog';
import { Button } from '@/ui/Button';
import { todayISO } from '@/utils/dates';
import type { OptionExercise } from '@/types/sheets';

interface Props {
  open: boolean;
  onClose: () => void;
  grantId: string;
  exercise: OptionExercise | null;
  onSave: (exercise: OptionExercise) => void;
  onDelete: () => void;
}

export function ExerciseDialog({ open, onClose, grantId, exercise, onSave, onDelete }: Props) {
  const { t } = useTranslation();
  const isNew = exercise === null;
  const [date, setDate] = useState(todayISO());
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    setDate(exercise?.date ?? todayISO());
    setShares(exercise ? String(exercise.shares_exercised) : '');
    setPrice(exercise ? String(exercise.price_paid) : '');
    setNote(exercise?.note ?? '');
  }, [open, exercise]);

  const handleSave = () => {
    const sh = Number(shares);
    if (!date || !(sh > 0)) return;
    onSave({
      id: exercise?.id ?? `ex_${Date.now()}`,
      grant_id: grantId,
      date,
      shares_exercised: sh,
      price_paid: Number(price) || 0,
      note: note.trim(),
    });
  };

  const inputCls = 'h-8 w-full rounded border border-border bg-surface-1 px-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
  const labelCls = 'block text-xs font-medium text-fg-2 mb-1';

  return (
    <Dialog open={open} onClose={onClose} title={isNew ? t('opt_new_exercise') : t('opt_edit_exercise')}>
      <div className="space-y-3">
        <div>
          <label className={labelCls} htmlFor="ex-date">{t('opt_exercise_date')}</label>
          <input id="ex-date" type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="ex-shares">{t('opt_exercise_shares')}</label>
          <input id="ex-shares" type="number" className={inputCls} value={shares} onChange={e => setShares(e.target.value)} autoFocus />
        </div>
        <div>
          <label className={labelCls} htmlFor="ex-price">{t('opt_exercise_price')}</label>
          <input id="ex-price" type="number" step="0.0001" className={inputCls} value={price} onChange={e => setPrice(e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="ex-note">{t('opt_exercise_note')}</label>
          <input id="ex-note" className={inputCls} value={note} onChange={e => setNote(e.target.value)} />
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between">
        {!isNew ? <Button variant="danger" size="sm" onClick={onDelete}>{t('opt_delete_exercise')}</Button> : <span />}
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" size="sm" onClick={handleSave}>{t('save_changes')}</Button>
        </div>
      </div>
    </Dialog>
  );
}
