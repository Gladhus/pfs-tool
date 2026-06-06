import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/ui/Dialog';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Label } from '@/ui/Label';
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label>{children}</div>;
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

  return (
    <Dialog open={open} onClose={onClose} title={isNew ? t('opt_new_exercise') : t('opt_edit_exercise')}>
      <div className="space-y-3">
        <Field label={t('opt_exercise_date')}>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </Field>
        <Field label={t('opt_exercise_shares')}>
          <Input type="number" value={shares} onChange={e => setShares(e.target.value)} autoFocus />
        </Field>
        <Field label={t('opt_exercise_price')}>
          <Input type="number" step="0.0001" value={price} onChange={e => setPrice(e.target.value)} />
        </Field>
        <Field label={t('opt_exercise_note')}>
          <Input value={note} onChange={e => setNote(e.target.value)} />
        </Field>
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
