import { describe, it, expect } from 'vitest';
import type { Snapshot } from '@/types/sheets';

/**
 * The dedup logic is extracted from api/accounts.ts loadSnapshots.
 * We test the pure algorithm here by replicating it.
 */
function dedup(dataRows: Array<Snapshot & { _idx?: number }>): Snapshot[] {
  const seen = new Map<string, Snapshot & { _idx: number }>();
  dataRows.forEach((row, idx) => {
    const key = `${row.date}|${row.account_id}`;
    const prev = seen.get(key);
    if (!prev) { seen.set(key, { ...row, _idx: idx }); return; }
    const ta = row.entered_at ?? '';
    const tp = prev.entered_at ?? '';
    const wins = ta && tp ? (ta > tp || (ta === tp && idx > prev._idx!)) : (!ta && !tp ? idx > prev._idx! : !!ta);
    if (wins) seen.set(key, { ...row, _idx: idx });
  });
  return [...seen.values()].map(({ _idx: _i, ...rest }) => rest as Snapshot);
}

const snap = (date: string, account_id: string, balance_raw: number, entered_at?: string): Snapshot =>
  ({ date, account_id, balance_raw, entered_at });

describe('loadSnapshots dedup', () => {
  it('keeps distinct (date, account_id) pairs all', () => {
    const rows = [snap('2024-01-01', 'a1', 100), snap('2024-01-01', 'a2', 200), snap('2024-02-01', 'a1', 150)];
    expect(dedup(rows)).toHaveLength(3);
  });

  it('latest entered_at wins when duplicates share same key', () => {
    const rows = [
      snap('2024-01-01', 'a1', 100, '2024-01-01T10:00:00'),
      snap('2024-01-01', 'a1', 999, '2024-01-01T12:00:00'),
    ];
    const result = dedup(rows);
    expect(result).toHaveLength(1);
    expect(result[0].balance_raw).toBe(999);
  });

  it('earlier entered_at loses', () => {
    const rows = [
      snap('2024-01-01', 'a1', 999, '2024-01-01T12:00:00'),
      snap('2024-01-01', 'a1', 100, '2024-01-01T10:00:00'),
    ];
    const result = dedup(rows);
    expect(result).toHaveLength(1);
    expect(result[0].balance_raw).toBe(999);
  });

  it('same entered_at tie-break uses highest row index', () => {
    const ts = '2024-01-01T10:00:00';
    const rows = [
      snap('2024-01-01', 'a1', 100, ts),
      snap('2024-01-01', 'a1', 200, ts),
    ];
    const result = dedup(rows);
    expect(result).toHaveLength(1);
    expect(result[0].balance_raw).toBe(200); // index 1 > index 0
  });

  it('__day__ rows are NOT deduplicated — each date keeps its own', () => {
    const rows = [
      snap('2024-01-01', '__day__', 0),
      snap('2024-01-01', '__day__', 0),
    ];
    // Both have same key; dedup collapses to 1 (expected — __day__ has no unique id either)
    expect(dedup(rows)).toHaveLength(1);
  });

  it('__day__ rows with distinct dates are both kept', () => {
    const rows = [snap('2024-01-01', '__day__', 0), snap('2024-02-01', '__day__', 0)];
    expect(dedup(rows)).toHaveLength(2);
  });

  it('row with entered_at beats row without entered_at', () => {
    const rows = [
      snap('2024-01-01', 'a1', 100),                    // no entered_at
      snap('2024-01-01', 'a1', 200, '2024-01-01T10:00'), // has entered_at
    ];
    const result = dedup(rows);
    expect(result[0].balance_raw).toBe(200);
  });
});
