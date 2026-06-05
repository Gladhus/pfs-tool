import { state } from '../core/state.js';

export function allKnownTags() {
  const set = new Set((state.tagsCatalog || []).map(t => t.name));
  for (const a of state.accounts) {
    if (Array.isArray(a.tags)) a.tags.forEach(tag => tag && set.add(tag));
  }
  return [...set].sort();
}
