import { describe, it, expect } from 'vitest';
import { snapshotsToCsv } from '@/utils/csv';
import type { Snapshot, Account } from '@/types/sheets';

const mkSnap = (date: string, account_id: string, balance_raw: number, comment = '', entered_at = ''): Snapshot =>
  ({ date, account_id, balance_raw, comment: comment || undefined, entered_at: entered_at || undefined });

const noAccounts: Account[] = [];

describe('snapshotsToCsv', () => {
  it('includes a header row', () => {
    const csv = snapshotsToCsv([mkSnap('2024-01-01', 'a1', 1000)], noAccounts);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('date');
    expect(lines[0]).toContain('account_id');
    expect(lines[0]).toContain('balance_raw');
  });

  it('one row per snapshot after the header', () => {
    const snapshots = [
      mkSnap('2024-01-01', 'a1', 1000),
      mkSnap('2024-01-01', 'a2', 2000),
      mkSnap('2024-02-01', 'a1', 1100),
    ];
    const lines = snapshotsToCsv(snapshots, noAccounts).split('\n');
    expect(lines).toHaveLength(4); // 1 header + 3 data
  });

  it('values are formatted correctly', () => {
    const csv = snapshotsToCsv([mkSnap('2024-01-01', 'a1', 1234.56)], noAccounts);
    expect(csv).toContain('2024-01-01');
    expect(csv).toContain('a1');
    expect(csv).toContain('1234.56');
  });

  it('wraps fields containing commas in double-quotes', () => {
    const csv = snapshotsToCsv([mkSnap('2024-01-01', 'a1', 0, 'note, with comma')], noAccounts);
    expect(csv).toContain('"note, with comma"');
  });

  it('escapes double-quotes inside quoted fields', () => {
    const csv = snapshotsToCsv([mkSnap('2024-01-01', 'a1', 0, 'say "hello"')], noAccounts);
    expect(csv).toContain('"say ""hello"""');
  });

  it('empty snapshots returns just the header', () => {
    const csv = snapshotsToCsv([], noAccounts);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1);
  });
});
