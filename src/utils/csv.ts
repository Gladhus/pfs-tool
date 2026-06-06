import type { Snapshot, Account } from '@/types/sheets';

const SNAPSHOT_HEADERS = ['date', 'account_id', 'balance_raw', 'comment', 'entered_at'];

function csvCell(value: unknown): string {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function snapshotsToCsv(snapshots: Snapshot[], _accounts: Account[]): string {
  const headers = SNAPSHOT_HEADERS;
  const rows = [
    headers,
    ...snapshots.map(s => [s.date, s.account_id, s.balance_raw, s.comment ?? '', s.entered_at ?? '']),
  ];
  return rows.map(r => r.map(csvCell).join(',')).join('\n');
}
