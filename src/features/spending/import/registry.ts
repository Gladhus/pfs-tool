import type { ImportSource, SpendingImporter } from './types';
import { bncImporter } from './bnc.importer';

/**
 * Registered format plugins. To support a new bank/export, implement a
 * `SpendingImporter` and add it here — detection is automatic (first match wins).
 */
export const IMPORTERS: SpendingImporter[] = [
  bncImporter,
];

/** Pick the first importer that recognizes the source, or null if unknown. */
export function detectImporter(src: ImportSource): SpendingImporter | null {
  return IMPORTERS.find(imp => imp.detect(src)) ?? null;
}
