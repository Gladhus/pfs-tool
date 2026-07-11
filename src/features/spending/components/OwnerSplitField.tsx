import { useTranslation } from 'react-i18next';
import { Input } from '@/shared/ui/Input';
import { Select, SelectItem } from '@/shared/ui/Select';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Label } from '@/shared/ui/Label';
import { shareFor } from '@/shared/utils/ownership';
import type { OwnershipEntry, Person } from '@/types/sheets';

/** The owner-split editor's working shape (percentages, 0–100). */
export interface OwnerSplitValue {
  split: boolean;
  owner: string;
  shares: Record<string, number>;
}

/** Seed the editor from a stored ownership array. */
export function ownershipToSplit(ownership: OwnershipEntry[], people: Person[]): OwnerSplitValue {
  const isSingle = ownership.length === 1 && Math.round(ownership[0].share * 100) === 100;
  const shares: Record<string, number> = {};
  for (const p of people) shares[p.id] = Math.round(shareFor(ownership, p.id) * 100);
  return {
    owner: isSingle ? ownership[0].person_id : (people[0]?.id ?? ''),
    split: !isSingle,
    shares,
  };
}

/** Convert the editor's working shape back into a normalized ownership array. */
export function splitToOwnership(value: OwnerSplitValue, people: Person[]): OwnershipEntry[] {
  if (value.split) {
    return people
      .filter(p => (value.shares[p.id] ?? 0) > 0)
      .map(p => ({ person_id: p.id, share: (value.shares[p.id] ?? 0) / 100 }));
  }
  return value.owner ? [{ person_id: value.owner, share: 1 }] : [];
}

export function sharesTotal(value: OwnerSplitValue, people: Person[]): number {
  return people.reduce((sum, p) => sum + (value.shares[p.id] ?? 0), 0);
}

export function splitInvalid(value: OwnerSplitValue, people: Person[]): boolean {
  return value.split && sharesTotal(value, people) !== 100;
}

interface Props {
  people: Person[];
  value: OwnerSplitValue;
  onChange: (v: OwnerSplitValue) => void;
}

export function OwnerSplitField({ people, value, onChange }: Props) {
  const { t } = useTranslation();
  const setShare = (id: string, pct: number) =>
    onChange({ ...value, shares: { ...value.shares, [id]: Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0)) } });
  const invalid = splitInvalid(value, people);

  return (
    <div className="space-y-2">
      <Checkbox
        checked={value.split}
        onCheckedChange={v => onChange({ ...value, split: v })}
        label={t('split_ownership_label')}
      />

      {!value.split ? (
        <div>
          <Label>{t('owner_label_field')}</Label>
          <Select value={value.owner} onValueChange={v => onChange({ ...value, owner: v })} aria-label={t('owner_label_field')}>
            {people.map(p => <SelectItem key={p.id} value={p.id}>{p.name || p.id}</SelectItem>)}
          </Select>
        </div>
      ) : (
        <div className="space-y-2 rounded-lg bg-surface-2 p-3">
          {people.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-3">
              <Label className="mb-0">{p.name || p.id}</Label>
              <Input
                type="number" min={0} max={100} className="w-20"
                value={value.shares[p.id] ?? 0}
                onChange={e => setShare(p.id, Number(e.target.value))}
              />
            </div>
          ))}
          <p className={`text-xs ${invalid ? 'text-red' : 'text-muted'}`}>
            {t('share_total_label', { pct: sharesTotal(value, people) })}
          </p>
        </div>
      )}
    </div>
  );
}
