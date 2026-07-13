import type { OwnershipEntry } from '@/types/sheets';

// Remembered import mappings, keyed by the importer id so different banks don't
// collide. Persisted in localStorage — they're device preferences, not sheet data.
const LS_CAT = 'pfs_spending_cat_map';
const LS_ACCT = 'pfs_spending_acct_map';

type Store<T> = Record<string, Record<string, T>>; // importerId → bankLabel → value

function read<T>(key: string): Store<T> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Store<T>) : {};
  } catch {
    return {};
  }
}

function write<T>(key: string, store: Store<T>): void {
  try { localStorage.setItem(key, JSON.stringify(store)); } catch { /* quota / private mode */ }
}

/** bankCategory → spending category id, for one importer. */
export function loadCategoryMap(importerId: string): Record<string, string> {
  return read<string>(LS_CAT)[importerId] ?? {};
}

export function saveCategoryMap(importerId: string, map: Record<string, string>): void {
  const store = read<string>(LS_CAT);
  store[importerId] = { ...(store[importerId] ?? {}), ...map };
  write(LS_CAT, store);
}

/** bankAccount → ownership split, for one importer. */
export function loadAccountMap(importerId: string): Record<string, OwnershipEntry[]> {
  return read<OwnershipEntry[]>(LS_ACCT)[importerId] ?? {};
}

export function saveAccountMap(importerId: string, map: Record<string, OwnershipEntry[]>): void {
  const store = read<OwnershipEntry[]>(LS_ACCT);
  store[importerId] = { ...(store[importerId] ?? {}), ...map };
  write(LS_ACCT, store);
}
