import type { Currency } from '@/types/sheets';

/** A text token with its horizontal position and width on the page. */
export interface PositionedToken { x: number; w: number; str: string }

/** One physical text line reconstructed from a PDF page (tokens left-to-right). */
export interface PositionedLine {
  page: number;
  y: number;
  tokens: PositionedToken[];
  text: string;
}

/** What an importer receives: full text (for detection) + positioned lines (for table parsing). */
export interface ImportSource {
  filename: string;
  text: string;
  lines: PositionedLine[];
}

/** How a raw transaction should be treated. The importer classifies it; the
    generic pipeline only imports `expense` rows. */
export type TxnKind = 'expense' | 'income' | 'transfer';

/** A transaction parsed from the source, in the bank's native labels (pre-mapping). */
export interface RawTxn {
  date: string;          // YYYY-MM-DD; '' when pending/unknown
  pending: boolean;
  description: string;
  account: string;       // bank account label (e.g. "Compte Conjoint")
  category: string;      // bank category label (e.g. "Épicerie")
  amount: number;        // positive magnitude
  currency: Currency;    // parsed from the amount suffix ($ → CAD, USD → USD)
  kind: TxnKind;
}

/** A format plugin. Register new banks/exports by adding one of these. */
export interface SpendingImporter {
  id: string;
  /** Human label shown once detected (e.g. "Banque Nationale"). */
  label: string;
  /** Cheap content sniff — does this importer recognize the source? */
  detect(src: ImportSource): boolean;
  /** Parse the source into raw transactions. */
  parse(src: ImportSource): RawTxn[];
}
