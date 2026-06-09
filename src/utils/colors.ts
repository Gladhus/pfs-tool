import type { Account, Group } from '@/types/sheets';

export const TAG_PALETTE = [
  '#4878b0', '#c47a24', '#4d8f2c', '#c23838', '#7b5aaa',
  '#2a8a7a', '#a5604a', '#8a7a2a', '#5a8a5a', '#5a6a8a',
];

function hashColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return TAG_PALETTE[Math.abs(h) % TAG_PALETTE.length];
}

export function tagColor(name: string): string {
  return hashColor(name);
}

export function groupColor(group: Pick<Group, 'color' | 'name'>): string {
  return group.color || hashColor(group.name);
}

const REAL_ESTATE_DEBT = 'real_estate_debt';
const REAL_ESTATE      = 'real_estate';

export function foldCategoryId(id: string): string {
  return id === REAL_ESTATE_DEBT ? REAL_ESTATE : id;
}

export function accountMatchesGroup(account: Pick<Account, 'tags'>, group: Group): boolean {
  if (!Array.isArray(account.tags)) return false;
  const tags = new Set(account.tags);
  if (group.all?.length && !group.all.every(t => tags.has(t))) return false;
  if (group.any?.length && !group.any.some(t => tags.has(t))) return false;
  if (group.exclude?.length && group.exclude.some(t => tags.has(t))) return false;
  return true;
}
