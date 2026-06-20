import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToastStore } from '@/shared/stores/toast.store';
import {
  useOptionCompaniesQuery, useOptionGrantsQuery,
  useOptionFmvQuery, useOptionExercisesQuery,
  useAccountsQuery, useTagsQuery, useConfigQuery, usePeopleQuery,
} from '@/shared/io/queries/sheetQueries';
import { allKnownTags, mergeTagNames } from '@/shared/utils/tags';
import { LEGACY_SELF_ID } from '@/shared/utils/ownership';
import type { Currency } from '@/types/sheets';
import {
  useWriteOptionCompaniesMutation, useWriteOptionGrantsMutation,
  useWriteOptionFmvMutation, useWriteOptionExercisesMutation,
  useWriteTagsMutation,
} from '@/shared/io/queries/sheetMutations';
import { Amount } from '@/shared/ui/Amount';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Skeleton } from '@/shared/ui/Skeleton';
import { CompanyDialog } from './components/CompanyDialog';
import { GrantDialog } from './components/GrantDialog';
import { FmvDialog } from './components/FmvDialog';
import { ExerciseDialog } from './components/ExerciseDialog';
import type { OptionCompany, OptionGrant, OptionFmv, OptionExercise } from '@/types/sheets';

export default function OptionsManagePage() {
  const { t } = useTranslation();
  const addToast = useToastStore(s => s.addToast);

  const companiesQ = useOptionCompaniesQuery();
  const grantsQ = useOptionGrantsQuery();
  const fmvQ = useOptionFmvQuery();
  const exercisesQ = useOptionExercisesQuery();

  const companies = companiesQ.data ?? [];
  const grants = grantsQ.data ?? [];
  const fmv = fmvQ.data ?? [];
  const exercises = exercisesQ.data ?? [];

  const accountsQ = useAccountsQuery();
  const tagsQ = useTagsQuery();
  const configQ = useConfigQuery();
  const peopleQ = usePeopleQuery();
  const availableTags = allKnownTags(tagsQ.data ?? [], accountsQ.data ?? []);
  const mainCurrency: Currency = configQ.data?.currency === 'USD' ? 'USD' : 'CAD';
  const people = peopleQ.data ?? [];

  const writeCompanies = useWriteOptionCompaniesMutation();
  const writeTags = useWriteTagsMutation();
  const writeGrants = useWriteOptionGrantsMutation();
  const writeFmv = useWriteOptionFmvMutation();
  const writeExercises = useWriteOptionExercisesMutation();

  const fail = () => addToast(t('opt_save_failed'), 'error');

  // ── Dialog state ────────────────────────────────────────────────────
  const [companyDlg, setCompanyDlg] = useState<{ company: OptionCompany | null } | null>(null);
  const [grantDlg, setGrantDlg] = useState<{ grant: OptionGrant | null; companyId: string } | null>(null);
  const [fmvDlg, setFmvDlg] = useState<{ companyId: string } | null>(null);
  const [exerciseDlg, setExerciseDlg] = useState<{ exercise: OptionExercise | null; grantId: string } | null>(null);

  // ── Company CRUD ────────────────────────────────────────────────────
  // Persist the "assume main currency" default for any company still missing one.
  const defaultOwnerId = people.find(p => p.primary)?.id ?? LEGACY_SELF_ID;
  const normCompanies = (list: OptionCompany[]) => list.map(c => ({ ...c, currency: c.currency ?? mainCurrency, owner: c.owner || defaultOwnerId }));

  const saveCompany = (c: OptionCompany) => {
    const { merged, grew } = mergeTagNames(tagsQ.data ?? [], c.tags);
    if (grew) writeTags.mutate(merged);
    const exists = companies.some(x => x.id === c.id);
    const next = exists ? companies.map(x => x.id === c.id ? c : x) : [...companies, c];
    writeCompanies.mutate(normCompanies(next), { onSuccess: () => setCompanyDlg(null), onError: fail });
  };
  const deleteCompany = (id: string) => {
    const grantIds = new Set(grants.filter(g => g.company_id === id).map(g => g.id));
    writeCompanies.mutate(normCompanies(companies.filter(c => c.id !== id)), { onError: fail });
    writeGrants.mutate(grants.filter(g => g.company_id !== id), { onError: fail });
    writeFmv.mutate(fmv.filter(f => f.company_id !== id), { onError: fail });
    writeExercises.mutate(exercises.filter(e => !grantIds.has(e.grant_id)), {
      onSuccess: () => setCompanyDlg(null), onError: fail,
    });
  };

  // ── Grant CRUD ──────────────────────────────────────────────────────
  const saveGrant = (g: OptionGrant) => {
    const exists = grants.some(x => x.id === g.id);
    const next = exists ? grants.map(x => x.id === g.id ? g : x) : [...grants, g];
    writeGrants.mutate(next, { onSuccess: () => setGrantDlg(null), onError: fail });
  };
  const deleteGrant = (id: string) => {
    writeGrants.mutate(grants.filter(g => g.id !== id), { onError: fail });
    writeExercises.mutate(exercises.filter(e => e.grant_id !== id), {
      onSuccess: () => setGrantDlg(null), onError: fail,
    });
  };

  // ── FMV CRUD ────────────────────────────────────────────────────────
  const saveFmv = (entry: OptionFmv) => {
    const exists = fmv.some(f => f.company_id === entry.company_id && f.date === entry.date);
    const next = exists
      ? fmv.map(f => (f.company_id === entry.company_id && f.date === entry.date ? entry : f))
      : [...fmv, entry];
    writeFmv.mutate(next, { onSuccess: () => setFmvDlg(null), onError: fail });
  };

  // ── Exercise CRUD ───────────────────────────────────────────────────
  const saveExercise = (ex: OptionExercise) => {
    const exists = exercises.some(x => x.id === ex.id);
    const next = exists ? exercises.map(x => x.id === ex.id ? ex : x) : [...exercises, ex];
    writeExercises.mutate(next, { onSuccess: () => setExerciseDlg(null), onError: fail });
  };
  const deleteExercise = (id: string) => {
    writeExercises.mutate(exercises.filter(e => e.id !== id), { onSuccess: () => setExerciseDlg(null), onError: fail });
  };

  if (companiesQ.isPending) {
    return <div className="space-y-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} variant="card" className="h-32" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button variant="primary" size="sm" onClick={() => setCompanyDlg({ company: null })}>
          <Icon name="plus" size={14} /> {t('opt_add_company')}
        </Button>
      </div>

      {companies.length === 0 && <p className="py-8 text-center text-sm text-muted">{t('opt_no_companies')}</p>}

      {companies.map(company => {
        const cGrants = grants.filter(g => g.company_id === company.id);
        const cFmv = fmv.filter(f => f.company_id === company.id).sort((a, b) => b.date.localeCompare(a.date));
        return (
          <section key={company.id} className="rounded-xl bg-surface-1 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <strong className="text-fg">{company.name}</strong>
                {company.ticker && <span className="text-xs text-muted">{company.ticker}</span>}
                <span className="text-xs text-muted">{people.find(p => p.id === company.owner)?.name || company.owner}</span>
                {company.active === false && <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] uppercase text-muted">{t('opt_inactive')}</span>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setCompanyDlg({ company })}>
                <Icon name="edit" size={14} />
              </Button>
            </div>

            {/* FMV history */}
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('opt_fmv_history')}</h4>
                <Button variant="link" size="sm" onClick={() => setFmvDlg({ companyId: company.id })}>{t('opt_fmv_add')}</Button>
              </div>
              {cFmv.length === 0 ? (
                <p className="text-xs text-muted">{t('opt_no_fmv_history')}</p>
              ) : (
                <div className="space-y-1">
                  {cFmv.map(f => (
                    <div key={f.date} className="flex items-center gap-3 text-xs text-fg-2">
                      <span className="tabular-nums">{f.date}</span>
                      <span className="tabular-nums text-fg"><Amount value={f.fmv} currency={company.currency ?? mainCurrency} sensitive={false} /></span>
                      {f.note && <span className="truncate text-muted">{f.note}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Grants */}
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('opt_grants_label')}</h4>
                <Button variant="link" size="sm" onClick={() => setGrantDlg({ grant: null, companyId: company.id })}>{t('opt_add_grant')}</Button>
              </div>
              {cGrants.length === 0 ? (
                <p className="text-xs text-muted">{t('opt_no_grants')}</p>
              ) : (
                <div className="space-y-2">
                  {cGrants.map(grant => {
                    const gEx = exercises.filter(e => e.grant_id === grant.id).sort((a, b) => a.date.localeCompare(b.date));
                    return (
                      <div key={grant.id} className="rounded-lg bg-surface-2 p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-fg">{grant.label || grant.grant_type || 'Grant'}</span>
                          <div className="flex items-center gap-1">
                            <Button variant="link" size="sm" onClick={() => setExerciseDlg({ exercise: null, grantId: grant.id })}>{t('opt_add_exercise')}</Button>
                            <Button variant="ghost" size="sm" onClick={() => setGrantDlg({ grant, companyId: company.id })}>
                              <Icon name="edit" size={13} />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-0.5 text-xs text-muted">
                          {Number(grant.total_shares).toLocaleString()} · {grant.grant_type} · <Amount value={Number(grant.strike_price) || 0} currency={company.currency ?? mainCurrency} sensitive={false} />
                        </div>
                        {gEx.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {gEx.map(ex => (
                              <button
                                key={ex.id}
                                type="button"
                                onClick={() => setExerciseDlg({ exercise: ex, grantId: grant.id })}
                                className="flex w-full items-center gap-2 text-left text-xs text-muted hover:text-fg"
                              >
                                <span>{ex.date}</span>
                                <span className="tabular-nums">{Number(ex.shares_exercised).toLocaleString()} {t('opt_shares_exercised_suffix')}</span>
                                <span className="tabular-nums">@ <Amount value={Number(ex.price_paid) || 0} currency={company.currency ?? mainCurrency} sensitive={false} /></span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        );
      })}

      {/* Dialogs */}
      {companyDlg && (
        <CompanyDialog
          open
          onClose={() => setCompanyDlg(null)}
          company={companyDlg.company}
          people={people}
          availableTags={availableTags}
          mainCurrency={mainCurrency}
          onSave={saveCompany}
          onDelete={() => companyDlg.company && deleteCompany(companyDlg.company.id)}
        />
      )}
      {grantDlg && (
        <GrantDialog
          open
          onClose={() => setGrantDlg(null)}
          grant={grantDlg.grant}
          companyId={grantDlg.companyId}
          onSave={saveGrant}
          onDelete={() => grantDlg.grant && deleteGrant(grantDlg.grant.id)}
        />
      )}
      {fmvDlg && (
        <FmvDialog
          open
          onClose={() => setFmvDlg(null)}
          companyId={fmvDlg.companyId}
          entry={null}
          onSave={saveFmv}
        />
      )}
      {exerciseDlg && (
        <ExerciseDialog
          open
          onClose={() => setExerciseDlg(null)}
          grantId={exerciseDlg.grantId}
          exercise={exerciseDlg.exercise}
          onSave={saveExercise}
          onDelete={() => exerciseDlg.exercise && deleteExercise(exerciseDlg.exercise.id)}
        />
      )}
    </div>
  );
}
