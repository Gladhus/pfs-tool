import type { Currency } from '@/types/sheets';
import { MONTH_NAMES } from '@/shared/utils/dates';
import type { ImportSource, PositionedLine, RawTxn, SpendingImporter, TxnKind } from './types';

// The Banque Nationale "Bilan → Historique de mes transactions" export is a
// five-column table: Date | Description | Compte | Catégorie | Montant. We parse
// it by column geometry (token x-positions) rather than line order, so it's
// robust to how any given PDF text extractor breaks lines and to descriptions
// that wrap onto a second physical line.

const HEADER_COLS = ['Date', 'Description', 'Compte', 'Catégorie', 'Montant'];
const HEADER_WORDS = new Set(['Bilan', 'Historique de mes transactions', ...HEADER_COLS]);

// BNC categories that are unambiguously internal movements, never spending —
// notably "Paiement carte de crédit" (paying the card off would double-count the
// individual card purchases we already import). Always excluded.
const TRANSFER_CATEGORIES = new Set(['Transfert', 'Paiement carte de crédit']);

// Debit categories that aren't clearly personal spending — the user decides
// (per category, remembered) whether to include or skip these.
const UNCERTAIN_CATEGORIES = new Set(['Frais', 'Frais bancaires', 'Non catégorisé', 'Argent comptant', 'Remboursement']);

const DATE_FR = /^\d{1,2}\s+[a-zàâäéèêëîïôöùûüç]+\.?\s+\d{4}$/i;

function isFooter(text: string): boolean {
  return /Banque Nationale\s*\|\s*Services bancaires/i.test(text)
    || /app\.bnc\.ca/i.test(text)
    || /^\d+\s*\/\s*\d+$/.test(text)              // "3/40" page number
    || /^\d{1,2}\/\d{1,2}\/\d{2,4},/.test(text);  // "7/13/26, 8:32 AM" timestamp
}

/** French "13 juillet 2026" → "2026-07-13". */
export function parseFrDate(raw: string): string {
  const m = raw.trim().toLowerCase().match(/^(\d{1,2})\s+([a-zàâäéèêëîïôöùûüç]+)\.?\s+(\d{4})$/i);
  if (!m) return '';
  const month = MONTH_NAMES[m[2]];
  if (!month) return '';
  return `${m[3]}-${String(month).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
}

/** "2 277,08 $" / "+135,00 $" / "6 342,68 USD" → magnitude, sign, currency. */
export function parseAmount(raw: string): { value: number; credit: boolean; currency: Currency } | null {
  const s = raw.replace(/ /g, ' ').trim();
  const m = s.match(/^([+-])?\s*([\d\s.,]+?)\s*(\$|USD|CAD)$/i);
  if (!m) return null;
  const num = m[2].replace(/\s/g, '').replace(',', '.');
  const value = Number(num);
  if (!Number.isFinite(value)) return null;
  const currency: Currency = /usd/i.test(m[3]) ? 'USD' : 'CAD';
  return { value: Math.abs(value), credit: m[1] === '+', currency };
}

// pdf.js emits per-fragment tokens; columns are separated by wide space tokens
// (width far larger than an intra-word space), so we segment a line into cells at
// those wide spaces and assign each cell to a column by its left x.
const WIDE_SPACE = 20;

interface Cell { x: number; text: string }

/** Break one physical line into its cells at wide-space separators. */
function splitCells(line: PositionedLine): Cell[] {
  const cells: Cell[] = [];
  let cur: { x: number; text: string } | null = null;
  for (const tk of line.tokens) {
    if (tk.str.trim() === '' && tk.w > WIDE_SPACE) {
      if (cur) { cells.push(cur); cur = null; }
      continue;
    }
    if (!cur) cur = { x: tk.x, text: '' };
    cur.text += tk.str;
  }
  if (cur) cells.push(cur);
  return cells
    .map(c => ({ x: c.x, text: c.text.replace(/\s+/g, ' ').trim() }))
    .filter(c => c.text !== '');
}

/** Column anchor x-positions from the header row (its five cells). */
function findAnchors(lines: PositionedLine[]): number[] | null {
  for (const ln of lines) {
    const cells = splitCells(ln);
    if (cells.length >= HEADER_COLS.length && HEADER_COLS.every((h, i) => cells[i]?.text === h)) {
      return cells.slice(0, HEADER_COLS.length).map(c => c.x);
    }
  }
  return null;
}

/** Assign a line's cells to the five columns by nearest anchor (empty where absent). */
function rowCells(line: PositionedLine, anchors: number[]): string[] {
  const out = ['', '', '', '', ''];
  for (const cell of splitCells(line)) {
    let best = 0, bestDist = Infinity;
    anchors.forEach((a, i) => { const d = Math.abs(a - cell.x); if (d < bestDist) { bestDist = d; best = i; } });
    out[best] = out[best] ? `${out[best]} ${cell.text}` : cell.text;
  }
  return out;
}

/** A very long merchant name can swallow the account (no wide space before it).
    Learn the account vocabulary from clean rows, then strip a trailing known
    account off any description that absorbed one. */
function recoverAccounts(txns: RawTxn[]): void {
  const vocab = [...new Set(txns.map(t => t.account).filter(Boolean))].sort((a, b) => b.length - a.length);
  for (const t of txns) {
    if (t.account) continue;
    for (const acc of vocab) {
      if (t.description === acc) { t.description = ''; t.account = acc; break; }
      if (t.description.endsWith(` ${acc}`)) {
        t.description = t.description.slice(0, -(acc.length + 1)).trim();
        t.account = acc;
        break;
      }
    }
  }
}

interface Draft {
  date: string; pending: boolean;
  desc: string; account: string; category: string; amountCell: string;
}

function classify(category: string, credit: boolean): TxnKind {
  if (credit) return 'income';
  if (TRANSFER_CATEGORIES.has(category)) return 'transfer';
  if (UNCERTAIN_CATEGORIES.has(category)) return 'uncertain';
  return 'expense';
}

function finalize(d: Draft): RawTxn | null {
  const amt = parseAmount(d.amountCell);
  if (!amt) return null;
  const date = d.pending ? '' : parseFrDate(d.date);
  if (!d.pending && !date) return null;
  return {
    date,
    pending: d.pending,
    description: d.desc.trim(),
    account: d.account.trim(),
    category: d.category.trim(),
    amount: amt.value,
    currency: amt.currency,
    kind: classify(d.category.trim(), amt.credit),
  };
}

function parseBnc(lines: PositionedLine[]): RawTxn[] {
  const anchors = findAnchors(lines);
  if (!anchors) return [];

  const out: RawTxn[] = [];
  let cur: Draft | null = null;
  const flush = () => {
    if (cur && cur.amountCell) {
      const txn = finalize(cur);
      if (txn) out.push(txn);
    }
    cur = null;
  };

  for (const line of lines) {
    if (!line.text || isFooter(line.text)) continue;
    const [dCell, descCell, acctCell, catCell, amtCell] = rowCells(line, anchors);

    // Skip header/title rows (also guards against a header repeated mid-table).
    if (HEADER_WORDS.has(dCell)) continue;

    const isStart = DATE_FR.test(dCell) || dCell === 'En attente';
    if (isStart) {
      flush();
      cur = { date: dCell, pending: dCell === 'En attente', desc: descCell, account: acctCell, category: catCell, amountCell: amtCell };
    } else if (cur) {
      // Continuation line (wrapped description): append the Description cell,
      // and backfill any field the first line didn't carry.
      if (descCell) cur.desc = `${cur.desc} ${descCell}`.trim();
      if (!cur.account && acctCell) cur.account = acctCell;
      if (!cur.category && catCell) cur.category = catCell;
      if (!cur.amountCell && amtCell) cur.amountCell = amtCell;
    }
  }
  flush();
  recoverAccounts(out);
  return out;
}

export const bncImporter: SpendingImporter = {
  id: 'bnc',
  label: 'Banque Nationale',
  detect(src: ImportSource): boolean {
    return /Banque Nationale/i.test(src.text)
      || (/Historique de mes transactions/i.test(src.text) && /Catégorie/i.test(src.text) && /Montant/i.test(src.text));
  },
  parse(src: ImportSource): RawTxn[] {
    return parseBnc(src.lines);
  },
};
