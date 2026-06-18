import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToastStore } from '@/stores/toast.store';
import { usePeopleQuery } from '@/queries/sheetQueries';
import { useWritePeopleMutation } from '@/queries/sheetMutations';
import { Icon } from '@/ui/Icon';
import { Button } from '@/ui/Button';
import { Skeleton } from '@/ui/Skeleton';
import { PersonDialog } from '../components/PersonDialog';
import type { Person } from '@/types/sheets';

export function PeopleSection() {
  const { t } = useTranslation();
  const addToast = useToastStore(s => s.addToast);

  const peopleQ = usePeopleQuery();
  const writePeople = useWritePeopleMutation();
  const people = peopleQ.data ?? [];

  const [editId, setEditId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openNew = () => { setEditId(null); setDialogOpen(true); };
  const openEdit = (id: string) => { setEditId(id); setDialogOpen(true); };

  const editing = editId !== null ? people.find(p => p.id === editId) ?? null : null;
  const nextSortOrder = (Math.max(0, ...people.map(p => p.sort_order ?? 0)) || 0) + 10;

  const persist = (next: Person[], okMsg: string) => {
    writePeople.mutate(next, {
      onSuccess: () => { addToast(t(okMsg), 'ok'); setDialogOpen(false); },
      onError: () => addToast(t('person_save_failed'), 'error'),
    });
  };

  const onSave = (person: Person) => {
    const isNew = !people.some(p => p.id === person.id);
    const next = isNew ? [...people, person] : people.map(p => p.id === person.id ? person : p);
    persist(next, 'person_saved');
  };

  const onToggleActive = () => {
    if (!editing) return;
    const next = people.map(p => p.id === editing.id ? { ...p, active: !p.active } : p);
    persist(next, editing.active ? 'person_archived' : 'person_reactivated');
  };

  const sorted = [...people].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  if (peopleQ.isPending) {
    return <div className="space-y-2">{Array.from({ length: 2 }, (_, i) => <Skeleton key={i} variant="card" className="h-14" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted">{t('people_hint')}</p>
        <Button variant="primary" size="sm" onClick={openNew} className="shrink-0">
          <Icon name="plus" size={14} />
          {t('add_person')}
        </Button>
      </div>

      <div className="space-y-2">
        {sorted.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => openEdit(p.id)}
            className={`flex w-full items-center gap-3 rounded-lg bg-surface-1 p-3 text-left shadow-sm transition-colors hover:bg-surface-2 ${p.active ? '' : 'opacity-60'}`}
          >
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: p.color || 'var(--border)' }} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-fg">{p.name}</div>
              <div className="truncate text-xs text-muted">{p.email || t('person_no_email')}{!p.active ? ` · ${t('archived_label')}` : ''}</div>
            </div>
            <Icon name="chevronRight" size={16} className="text-muted" />
          </button>
        ))}
      </div>

      <PersonDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        person={editing}
        nextSortOrder={nextSortOrder}
        onSave={onSave}
        onToggleActive={onToggleActive}
      />
    </div>
  );
}
