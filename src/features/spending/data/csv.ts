import type { Person, SpendingCategory } from '@/types/sheets';
import { ownershipLabel } from '@/shared/utils/ownership';
import type { LedgerRow } from './spending.selectors';

/** Quote a CSV field when it contains a comma, quote, or newline (RFC 4180). */
function esc(v: string | number): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialize ledger rows to a CSV string (category names + owner labels resolved for humans). */
export function spendingsToCsv(
  rows: LedgerRow[],
  categories: SpendingCategory[],
  people: Person[],
  lang: string,
  householdLabel: string,
): string {
  const catName = (id: string) => {
    const c = categories.find(x => x.id === id);
    return c ? (lang === 'fr' ? c.name_fr : c.name_en) : id;
  };
  const header = ['date', 'amount', 'currency', 'category', 'owners', 'comment', 'recurring'];
  const lines = rows.map(r => [
    r.date,
    r.amount.toFixed(2),
    r.currency ?? '',
    catName(r.category_id),
    ownershipLabel(r.ownership, people, householdLabel),
    r.comment ?? '',
    r.recurring ? 'yes' : '',
  ].map(esc).join(','));
  return [header.join(','), ...lines].join('\n');
}

/** Trigger a client-side download of `content` as a file. */
export function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
