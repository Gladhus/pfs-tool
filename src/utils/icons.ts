import type { IconName } from '@/ui/Icon';

export type { IconName };

const CATEGORY_ICON_MAP: Record<string, IconName> = {
  investments: 'investments', invest: 'investments',
  real_estate: 'realestate', realestate: 'realestate', property: 'realestate',
  cash: 'cash', bank: 'cash', checking: 'cash', savings: 'cash',
  debt: 'debts', debts: 'debts', loan: 'debts', loans: 'debts',
  credit: 'debts', mortgage: 'debts',
};

const CATEGORY_KEY_MAP: Record<string, string> = {
  investments: 'investments', invest: 'investments',
  real_estate: 'real-estate', realestate: 'real-estate', property: 'real-estate',
  cash: 'cash', bank: 'cash', checking: 'cash', savings: 'cash',
  debt: 'debts', debts: 'debts', loan: 'debts', loans: 'debts',
  credit: 'debts', mortgage: 'debts',
};

export function categoryIcon(categoryId: string | undefined): IconName {
  if (!categoryId) return 'other';
  const id = String(categoryId).toLowerCase().replace(/[\s-]/g, '_');
  return CATEGORY_ICON_MAP[id] ?? 'other';
}

export function categoryKey(categoryId: string | undefined): string {
  if (!categoryId) return 'other';
  const id = String(categoryId).toLowerCase().replace(/[\s-]/g, '_');
  return CATEGORY_KEY_MAP[id] ?? 'other';
}
