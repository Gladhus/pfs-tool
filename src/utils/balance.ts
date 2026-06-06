import type { Account, CategoryMeta, Snapshot } from '@/types/sheets';

export function activeAccounts(accounts: Account[]): Account[] {
  return accounts.filter(a => a.active);
}

export function categoriesInOrder(accounts: Account[], categoryMeta: CategoryMeta[]): CategoryMeta[] {
  const usedIds = new Set(activeAccounts(accounts).map(a => a.category));
  return categoryMeta
    .filter(c => usedIds.has(c.id))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

export function accountsForCategory(accounts: Account[], catId: string): Account[] {
  return activeAccounts(accounts)
    .filter(a => a.category === catId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

export function projectBalance(accounts: Account[], snapshots: Snapshot[], accountId: string, currentDate: string): number | null {
  const a = accounts.find(acc => acc.id === accountId);
  if (!a || !a.annual_rate) return null;
  const last = snapshots
    .filter(s => s.account_id === accountId && s.date < currentDate)
    .sort((x, y) => y.date.localeCompare(x.date))[0];
  if (!last) return null;
  const days = Math.round((new Date(currentDate).getTime() - new Date(last.date).getTime()) / 86400000);
  return last.balance_raw * Math.pow(1 + a.annual_rate / 12, days / (365 / 12));
}
