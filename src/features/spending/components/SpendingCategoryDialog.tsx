import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/shared/ui/Dialog';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Label } from '@/shared/ui/Label';
import { ColorSwatchPicker } from '@/features/settings/components/ColorSwatchPicker';
import { TAG_PALETTE } from '@/shared/utils/colors';
import type { SpendingCategory } from '@/types/sheets';

interface Props {
  open: boolean;
  onClose: () => void;
  category: SpendingCategory | null;
  categories: SpendingCategory[];
  onSave: (category: SpendingCategory) => void;
  onDelete: () => void;
  canDelete: boolean;
}

function slugId(name: string, taken: Set<string>): string {
  const base = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'category';
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}_${n++}`;
  return id;
}

export function SpendingCategoryDialog({ open, onClose, category, categories, onSave, onDelete, canDelete }: Props) {
  const { t } = useTranslation();
  const isNew = category === null;

  const build = () => ({
    name_fr: category?.name_fr ?? '',
    name_en: category?.name_en ?? '',
    color: category?.color || TAG_PALETTE[0],
    active: category?.active ?? true,
  });
  const [form, setForm] = useState(build);

  useEffect(() => {
    if (open) setForm(build());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category]);

  const set = <K extends keyof ReturnType<typeof build>>(k: K, v: ReturnType<typeof build>[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    const nameFr = form.name_fr.trim();
    const nameEn = form.name_en.trim();
    if (!nameFr && !nameEn) return;
    const id = isNew
      ? slugId(nameEn || nameFr, new Set(categories.map(c => c.id)))
      : category!.id;
    const sort_order = category?.sort_order ?? (Math.max(0, ...categories.map(c => c.sort_order ?? 0)) + 10);
    onSave({
      id,
      name_fr: nameFr || nameEn,
      name_en: nameEn || nameFr,
      color: form.color,
      icon: category?.icon ?? 'other',
      sort_order,
      active: form.active,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title={isNew ? t('sp_add_category') : t('sp_edit_category')}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t('name_fr_label')}</Label>
            <Input value={form.name_fr} onChange={e => set('name_fr', e.target.value)} />
          </div>
          <div>
            <Label>{t('name_en_label')}</Label>
            <Input value={form.name_en} onChange={e => set('name_en', e.target.value)} />
          </div>
        </div>

        <div>
          <Label>{t('color_label')}</Label>
          <ColorSwatchPicker value={form.color} onChange={c => set('color', c)} />
        </div>

        <Checkbox checked={form.active} onCheckedChange={v => set('active', v)} label={t('active_label')} />

        {!isNew && <p className="text-xs text-muted">ID: <code>{category!.id}</code></p>}
      </div>

      <div className="mt-5 flex items-center justify-between">
        {!isNew && canDelete
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
