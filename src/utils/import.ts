import type { Account } from '@/types/sheets';

export function parseDelimited(text: string): string[][] {
  const sep = text.includes('\t') ? '\t' : ',';
  const out: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i += 2; continue; }
      if (ch === '"') { inQuotes = false; i++; continue; }
      cur += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === sep) { row.push(cur); cur = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { row.push(cur); out.push(row); row = []; cur = ''; i++; continue; }
    cur += ch; i++;
  }
  if (cur.length || row.length) { row.push(cur); out.push(row); }
  return out.filter(r => r.some(c => c.trim() !== ''));
}

export function normalizeName(s: string): string {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function similarity(a: string, b: string): number {
  const setA = new Set(normalizeName(a).split(' ').filter(Boolean));
  const setB = new Set(normalizeName(b).split(' ').filter(Boolean));
  if (!setA.size && !setB.size) return 0;
  let inter = 0;
  for (const tok of setA) if (setB.has(tok)) inter++;
  return inter / (setA.size + setB.size - inter);
}

/** mappings: caller reads from localStorage once and passes in. */
export function suggestAccount(
  sourceName: string,
  accounts: Account[],
  mappings: Record<string, string>,
): string | null {
  const key = normalizeName(sourceName);
  if (mappings[key]) return mappings[key];
  let best: Account | null = null;
  let bestScore = 0;
  for (const a of accounts.filter(acc => acc.active)) {
    const score = Math.max(similarity(sourceName, a.name_fr), similarity(sourceName, a.name_en));
    if (score > bestScore) { bestScore = score; best = a; }
  }
  return bestScore >= 0.5 && best ? best.id : null;
}

/** Returns updated mappings object; caller persists to localStorage. */
export function rememberMapping(
  sourceName: string,
  accountId: string,
  mappings: Record<string, string>,
): Record<string, string> {
  return { ...mappings, [normalizeName(sourceName)]: accountId };
}

export function slugify(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || `account_${Date.now()}`;
}
