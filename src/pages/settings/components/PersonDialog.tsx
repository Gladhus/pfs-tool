import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/ui/Dialog';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Label } from '@/ui/Label';
import { TAG_PALETTE } from '@/utils/colors';
import { ColorSwatchPicker } from './ColorSwatchPicker';
import type { Person } from '@/types/sheets';

interface Props {
  open: boolean;
  onClose: () => void;
  person: Person | null;
  nextSortOrder: number;
  onSave: (person: Person) => void;
  onToggleActive: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label>{children}</div>;
}

export function PersonDialog({ open, onClose, person, nextSortOrder, onSave, onToggleActive }: Props) {
  const { t } = useTranslation();
  const isNew = person === null;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [color, setColor] = useState(TAG_PALETTE[0]);

  useEffect(() => {
    if (!open) return;
    setName(person?.name ?? '');
    setEmail(person?.email ?? '');
    setColor(person?.color || TAG_PALETTE[0]);
  }, [open, person]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({
      id: person?.id ?? (trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `person_${nextSortOrder}`),
      name: trimmed,
      email: email.trim() || undefined,
      color,
      sort_order: person?.sort_order ?? nextSortOrder,
      active: person?.active ?? true,
      primary: person?.primary ?? false,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title={isNew ? t('add_person') : t('edit_person')} className="max-w-lg">
      <div className="space-y-3">
        <Field label={t('person_name_label')}>
          <Input value={name} onChange={e => setName(e.target.value)} autoFocus />
        </Field>
        <Field label={t('person_email_label')}>
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder={t('person_email_placeholder')} />
        </Field>
        <Field label={t('person_color_label')}>
          <ColorSwatchPicker value={color} onChange={setColor} />
        </Field>
        {!isNew && <p className="text-xs text-muted">ID: <code>{person!.id}</code></p>}
        {!isNew && person!.primary && <p className="text-xs text-muted">{t('primary_person_label')}</p>}
      </div>

      <div className="mt-5 flex items-center justify-between">
        {!isNew && !person!.primary
          ? (
            <Button variant="danger" size="sm" onClick={onToggleActive}>
              {person!.active ? t('archive_person') : t('reactivate_person')}
            </Button>
          )
          : !isNew && person!.primary
            ? <p className="text-xs text-muted">{t('cannot_archive_primary')}</p>
            : <span />}
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" size="sm" onClick={handleSave}>{t('save_changes')}</Button>
        </div>
      </div>
    </Dialog>
  );
}
