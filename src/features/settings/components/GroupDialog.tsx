import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/shared/ui/Dialog';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Label } from '@/shared/ui/Label';
import { TAG_PALETTE } from '@/shared/utils/colors';
import { TagChipInput } from './TagChipInput';
import { ColorSwatchPicker } from './ColorSwatchPicker';
import type { Group } from '@/types/sheets';

interface Props {
  open: boolean;
  onClose: () => void;
  group: Group | null;
  availableTags: string[];
  hasExisting: boolean;
  onSave: (group: Group) => void;
  onDelete: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label>{children}</div>;
}

export function GroupDialog({ open, onClose, group, availableTags, hasExisting, onSave, onDelete }: Props) {
  const { t } = useTranslation();
  const isNew = group === null;

  const [name, setName] = useState('');
  const [color, setColor] = useState(TAG_PALETTE[0]);
  const [all, setAll] = useState<string[]>([]);
  const [any, setAny] = useState<string[]>([]);
  const [exclude, setExclude] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(group?.name ?? '');
    setColor(group?.color || TAG_PALETTE[0]);
    setAll(group?.all ? [...group.all] : []);
    setAny(group?.any ? [...group.any] : []);
    setExclude(group?.exclude ? [...group.exclude] : []);
  }, [open, group]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({ name: trimmed, color, all, any, exclude });
  };

  return (
    <Dialog open={open} onClose={onClose} title={isNew ? t('add_group') : t('edit_group')} className="max-w-lg">
      <div className="space-y-3">
        <Field label={t('group_name_label')}>
          <Input value={name} onChange={e => setName(e.target.value)} autoFocus />
        </Field>
        <Field label={t('group_color_label')}>
          <ColorSwatchPicker value={color} onChange={setColor} />
        </Field>
        <Field label={t('group_all_label')}>
          <TagChipInput value={all} onChange={setAll} available={availableTags} placeholder={t('add_tag_placeholder')} />
        </Field>
        <Field label={t('group_any_label')}>
          <TagChipInput value={any} onChange={setAny} available={availableTags} placeholder={t('add_tag_placeholder')} />
        </Field>
        <Field label={t('group_exclude_label')}>
          <TagChipInput value={exclude} onChange={setExclude} available={availableTags} placeholder={t('add_tag_placeholder')} />
        </Field>
      </div>

      <div className="mt-5 flex items-center justify-between">
        {!isNew && hasExisting
          ? <Button variant="danger" size="sm" onClick={onDelete}>{t('delete')}</Button>
          : <span />}
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" size="sm" onClick={handleSave}>{t('save_changes')}</Button>
        </div>
      </div>
    </Dialog>
  );
}
