import { state, LS_KEY_IMPORT_MAP } from '../core/state.js';
import { activeAccounts } from './balance.js';

export function parseDelimited(text) {
  const sep = text.includes('\t') ? '\t' : ',';
  const out = [];
  let row = [];
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

export function normalizeName(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function similarity(a, b) {
  const setA = new Set(normalizeName(a).split(' ').filter(Boolean));
  const setB = new Set(normalizeName(b).split(' ').filter(Boolean));
  if (!setA.size && !setB.size) return 0;
  let inter = 0;
  for (const tok of setA) if (setB.has(tok)) inter++;
  return inter / (setA.size + setB.size - inter);
}

export function suggestAccount(sourceName) {
  const remembered = (() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY_IMPORT_MAP) || '{}'); }
    catch (_) { return {}; }
  })();
  const key = normalizeName(sourceName);
  if (remembered[key]) return remembered[key];
  let best = null, bestScore = 0;
  for (const a of activeAccounts()) {
    const score = Math.max(similarity(sourceName, a.name_fr), similarity(sourceName, a.name_en));
    if (score > bestScore) { bestScore = score; best = a; }
  }
  return bestScore >= 0.5 ? best.id : null;
}

export function rememberMapping(sourceName, accountId) {
  try {
    const m = JSON.parse(localStorage.getItem(LS_KEY_IMPORT_MAP) || '{}');
    m[normalizeName(sourceName)] = accountId;
    localStorage.setItem(LS_KEY_IMPORT_MAP, JSON.stringify(m));
  } catch (_) { /* ignore */ }
}

export function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || `account_${Date.now()}`;
}
