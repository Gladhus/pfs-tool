import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Icon } from '@/shared/ui/Icon';
import type { Person } from '@/types/sheets';
import { OwnerSplitField, type OwnerSplitValue } from '../OwnerSplitField';

interface Props {
  accounts: string[];               // bank accounts, unknowns first
  rememberedKeys: Set<string>;
  people: Person[];
  value: Record<string, OwnerSplitValue>;
  onChange: (account: string, v: OwnerSplitValue) => void;
  assignAllToMe: boolean;
  onToggleAssignAll: (v: boolean) => void;
  meName: string;
}

/** Wizard step: map each bank account to an owner / split — or skip and assign all to me. */
export function ImportAccountsStep({ accounts, rememberedKeys, people, value, onChange, assignAllToMe, onToggleAssignAll, meName }: Props) {
  const { t } = useTranslation();
  const activePeople = people.filter(p => p.active);

  return (
    <div className="space-y-3">
      {/* Shortcut: skip per-account mapping entirely. */}
      <div className="rounded-xl bg-surface-1 p-4 shadow-sm">
        <Checkbox
          checked={assignAllToMe}
          onCheckedChange={onToggleAssignAll}
          label={t('sp_imp_assign_all_me', { name: meName })}
        />
        {assignAllToMe && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
            <Icon name="user" size={12} />
            {t('sp_imp_assign_all_note', { count: accounts.length, name: meName })}
          </p>
        )}
      </div>

      {!assignAllToMe && (
        <>
          <p className="text-sm text-muted">{t('sp_imp_accounts_help')}</p>
          {accounts.map(acct => (
            <section key={acct} className="rounded-xl bg-surface-1 p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-medium text-fg">{acct}</span>
                {!rememberedKeys.has(acct) && (
                  <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] uppercase text-accent">{t('sp_imp_new')}</span>
                )}
              </div>
              {value[acct] && (
                <OwnerSplitField people={activePeople} value={value[acct]} onChange={v => onChange(acct, v)} />
              )}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
