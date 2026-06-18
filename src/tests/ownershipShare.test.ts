import { describe, it, expect } from 'vitest';
import { computeNetWorthFromSnapshots } from '@/utils/stats';
import type { Account, Snapshot } from '@/types/sheets';

const mkAccount = (id: string, selfShare: number | null | undefined): Account => ({
  id,
  type: '', name_fr: '', name_en: '', category: '',
  kind: 'asset',
  ownership: selfShare == null ? [] : [{ person_id: 'self', share: selfShare }],
  active: true,
  sort_order: 0,
  tags: [],
  annual_rate: 0,
});

const mkSnap = (account_id: string, balance_raw: number): Snapshot => ({
  date: '2024-01-01',
  account_id,
  balance_raw,
});

describe('ownership array drives the self share of net worth', () => {
  it("self's share: 0 → account contributes 0 to net worth", () => {
    const accounts = [mkAccount('a1', 0)];
    const snapshots = [mkSnap('a1', 10_000)];
    expect(computeNetWorthFromSnapshots(snapshots, accounts, '2024-01-01')).toBe(0);
  });

  it("self's share: 0.5 → balance scaled by 0.5", () => {
    const accounts = [mkAccount('a1', 0.5)];
    const snapshots = [mkSnap('a1', 10_000)];
    expect(computeNetWorthFromSnapshots(snapshots, accounts, '2024-01-01')).toBe(5_000);
  });

  it('no ownership entry for self → contributes 0', () => {
    const accounts = [mkAccount('a1', null)];
    const snapshots = [mkSnap('a1', 10_000)];
    expect(computeNetWorthFromSnapshots(snapshots, accounts, '2024-01-01')).toBe(0);
  });

  it("self's share: 1 → full value", () => {
    const accounts = [mkAccount('a1', 1)];
    const snapshots = [mkSnap('a1', 10_000)];
    expect(computeNetWorthFromSnapshots(snapshots, accounts, '2024-01-01')).toBe(10_000);
  });
});
