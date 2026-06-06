import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/ui/Dialog';
import { Button } from '@/ui/Button';
import { TAG_PALETTE } from '@/utils/colors';
import { TagChipInput } from './TagChipInput';
import { ColorSwatchPicker } from './ColorSwatchPicker';
import type { Group } from '@/types/sheets';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Group being edited, or null when creating. */
  group: Group | null;
  availableTags: string[];
  hasExisting: boolean;
  onSave: (group: Group) => void;
  onDelete: () => void;
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

  const inputCls = 'h-8 w-full rounded border border-border bg-surface-1 px-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
  const labelCls = 'block text-xs font-medium text-fg-2 mb-1';

  return (
    <Dialog open={open} onClose={onClose} title={isNew ? t('add_group') : t('edit_group')} className="max-w-lg">
      <div className="space-y-3">
        <div>
          <label className={labelCls} htmlFor="group-name">{t('group_name_label')}</label>
          <input id="group-name" className={inputCls} value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className={labelCls}>{t('group_color_label')}</label>
          <ColorSwatchPicker value={color} onChange={setColor} />
        </div>
        <div>
          <label className={labelCls}>{t('group_all_label')}</label>
          <TagChipInput value={all} onChange={setAll} available={availableTags} placeholder={t('add_tag_placeholder')} />
        </div>
        <div>
          <label className={labelCls}>{t('group_any_label')}</label>
          <TagChipInput value={any} onChange={setAny} available={availableTags} placeholder={t('add_tag_placeholder')} />
        </div>
        <div>
          <label className={labelCls}>{t('group_exclude_label')}</label>
          <TagChipInput value={exclude} onChange={setExclude} available={availableTags} placeholder={t('add_tag_placeholder')} />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        {!isNew && hasExisting ? (
          <Button variant="danger" size="sm" onClick={onDelete}>{t('delete')}</Button>
        ) : <span />}
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" size="sm" onClick={handleSave}>{t('save_changes')}</Button>
        </div>
      </div>
    </Dialog>
  );
}
