import type { Tag, Account } from '@/types/sheets';

export function allKnownTags(tagsCatalog: Tag[], accounts: Account[]): string[] {
  const set = new Set(tagsCatalog.map(t => t.name));
  for (const a of accounts) {
    if (Array.isArray(a.tags)) a.tags.forEach(tag => tag && set.add(tag));
  }
  return [...set].sort();
}

/** Merge a list of tag names into the catalog. Returns the merged catalog and whether it grew. */
export function mergeTagNames(catalog: Tag[], names: string[]): { merged: Tag[]; grew: boolean } {
  const set = new Set(catalog.map(t => t.name));
  const merged = [...catalog];
  let grew = false;
  for (const raw of names) {
    const name = raw.trim();
    if (name && !set.has(name)) { set.add(name); merged.push({ name }); grew = true; }
  }
  return { merged, grew };
}

/** Merge account tags into catalog; returns merged Tag[] (caller decides whether to write). */
export function mergeTags(tagsCatalog: Tag[], accounts: Account[]): { merged: Tag[]; grew: boolean } {
  const names = new Set(tagsCatalog.map(t => t.name));
  const merged = [...tagsCatalog];
  let grew = false;
  for (const a of accounts) {
    if (!Array.isArray(a.tags)) continue;
    for (const t of a.tags) {
      if (t && !names.has(t)) { names.add(t); merged.push({ name: t }); grew = true; }
    }
  }
  return { merged, grew };
}
