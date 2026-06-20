import type { Account } from '@/types/sheets';
import { activeAccounts } from '@/shared/utils/balance';
import { accountsVisibleToViewer } from '@/shared/utils/ownership';

/**
 * Active accounts the viewer holds any stake in — the display/visibility set used
 * by the Detail table and the viewer empty-state checks. (The aggregation paths
 * scope per-owner inside the contributors instead.)
 */
export function activeVisibleAccounts(accounts: Account[], viewer: string): Account[] {
  return accountsVisibleToViewer(activeAccounts(accounts), viewer);
}

/**
 * True when there is active account data but none of it belongs to the viewer — the
 * page is blank because of the "View as" lens, not because there's no data. Drives
 * the viewer-specific empty state on History and Detail.
 */
export function isViewerLockedOut(accounts: Account[], viewer: string): boolean {
  return activeAccounts(accounts).length > 0 && activeVisibleAccounts(accounts, viewer).length === 0;
}
