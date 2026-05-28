import { state } from '../core/state.js';

export function projectBalance(accountId, currentDate) {
  const a = state.accounts.find(acc => acc.id === accountId);
  if (!a || !a.annual_rate) return null;
  const last = state.snapshots
    .filter(s => s.account_id === accountId && s.date < currentDate)
    .sort((x, y) => y.date.localeCompare(x.date))[0];
  if (!last) return null;
  const days = Math.round((new Date(currentDate) - new Date(last.date)) / 86400000);
  return last.balance_raw * Math.pow(1 + a.annual_rate / 12, days / (365 / 12));
}

export const activeAccounts = () => state.accounts.filter(a => a.active);

export function categoriesInOrder() {
  const usedIds = new Set(activeAccounts().map(a => a.category));
  return state.categoryMeta
    .filter(c => usedIds.has(c.id))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

export function accountsForCategory(catId) {
  return activeAccounts()
    .filter(a => a.category === catId)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}
