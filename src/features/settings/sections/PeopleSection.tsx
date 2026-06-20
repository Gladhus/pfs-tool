import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToastStore } from '@/stores/toast.store';
import { usePeopleQuery, useAccountsQuery, useOptionCompaniesQuery } from '@/queries/sheetQueries';
import { useWritePeopleMutation } from '@/queries/sheetMutations';
import { personHasActiveClaims, auditOwnership, type OwnershipIssue } from '@/utils/ownership';
import { tr } from '@/i18n';
import { Icon } from '@/ui/Icon';
import { Button } from '@/ui/Button';
import { Skeleton } from '@/ui/Skeleton';
import { PersonDialog } from '../components/PersonDialog';
import type { Account, OptionCompany, Person } from '@/types/sheets';

function describeIssue(issue: OwnershipIssue, accounts: Account[], companies: OptionCompany[], people: Person[], t: (key: string, opts?: Record<string, unknown>) => string): string {
  const personName = (id: string) => people.find(p => p.id === id)?.name || id;
  switch (issue.kind) {
    case 'unbalanced_account': {
      const name = tr(accounts.find(a => a.id === issue.accountId) ?? { name_en: issue.accountId });
      return t('ownership_issue_unbalanced', { name, pct: issue.pct });
    }
    case 'unknown_account_owner': {
      const name = tr(accounts.find(a => a.id === issue.accountId) ?? { name_en: issue.accountId });
      return t('ownership_issue_unknown_owner', { name, person: personName(issue.personId) });
    }
    case 'unknown_company_owner': {
      const name = companies.find(c => c.id === issue.companyId)?.name ?? issue.companyId;
      return t('ownership_issue_unknown_company_owner', { name, person: personName(issue.personId) });
    }
  }
}

export function PeopleSection() {
  const { t } = useTranslation();
  const addToast = useToastStore(s => s.addToast);

  const peopleQ = usePeopleQuery();
  const accountsQ = useAccountsQuery();
  const companiesQ = useOptionCompaniesQuery();
  const writePeople = useWritePeopleMutation();
  const people = peopleQ.data ?? [];
  const accounts = accountsQ.data ?? [];
  const companies = companiesQ.data ?? [];

  const [editId, setEditId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openNew = () => { setEditId(null); setDialogOpen(true); };
  const openEdit = (id: string) => { setEditId(id); setDialogOpen(true); };

  const editing = editId !== null ? people.find(p => p.id === editId) ?? null : null;
  const archiveBlocked = editing ? personHasActiveClaims(editing.id, accounts, companies) : false;
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
    if (!editing || editing.primary) return;
    if (editing.active && personHasActiveClaims(editing.id, accounts, companies)) return;
    const next = people.map(p => p.id === editing.id ? { ...p, active: !p.active } : p);
    persist(next, editing.active ? 'person_archived' : 'person_reactivated');
  };

  const sorted = [...people].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const issues = auditOwnership(accounts, companies, people);

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
              <div className="truncate text-xs text-muted">{p.email || t('person_no_email')}{p.primary ? ` · ${t('primary_person_label')}` : ''}{!p.active ? ` · ${t('archived_label')}` : ''}</div>
            </div>
            <Icon name="chevronRight" size={16} className="text-muted" />
          </button>
        ))}
      </div>

      <div className="space-y-2 rounded-lg bg-surface-1 p-3 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-medium text-fg">
          <Icon name={issues.length > 0 ? 'alert' : 'check'} size={14} className={issues.length > 0 ? 'text-amber-500' : 'text-emerald-500'} />
          {t('ownership_audit_title')}
        </h3>
        {issues.length > 0 ? (
          <ul className="space-y-1.5">
            {issues.map((issue, i) => (
              <li key={i} className="text-xs text-muted">{describeIssue(issue, accounts, companies, people, t)}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">{t('ownership_audit_ok')}</p>
        )}
      </div>

      <PersonDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        person={editing}
        nextSortOrder={nextSortOrder}
        archiveBlocked={archiveBlocked}
        onSave={onSave}
        onToggleActive={onToggleActive}
      />
    </div>
  );
}
