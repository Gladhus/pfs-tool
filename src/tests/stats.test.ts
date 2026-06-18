import { describe, it, expect } from 'vitest';
import { computeNetWorthFromSnapshots, buildBalanceSweep } from '@/utils/stats';
import { HOUSEHOLD_VIEWER } from '@/utils/ownership';
import type { Account, Snapshot } from '@/types/sheets';

const mkAccount = (partial: Partial<Account> & { id: string; kind: 'asset' | 'debt' }): Account => ({
  type: '', name_fr: '', name_en: '', category: '',
  ownership: [{ person_id: 'self', share: 1 }], active: true, sort_order: 0, tags: [], annual_rate: 0,
  ...partial,
});

const mkSnap = (date: string, account_id: string, balance_raw: number): Snapshot => ({
  date, account_id, balance_raw,
});

describe('computeNetWorthFromSnapshots — asset/debt sign handling', () => {
  it('sums pure assets positively', () => {
    const accounts = [mkAccount({ id: 'a1', kind: 'asset', ownership: [{ person_id: 'self', share: 1 }] })];
    const snapshots = [mkSnap('2024-01-01', 'a1', 1000)];
    expect(computeNetWorthFromSnapshots(snapshots, accounts, '2024-01-01')).toBe(1000);
  });

  it('subtracts debt accounts', () => {
    const accounts = [mkAccount({ id: 'd1', kind: 'debt', ownership: [{ person_id: 'self', share: 1 }] })];
    const snapshots = [mkSnap('2024-01-01', 'd1', 500)];
    expect(computeNetWorthFromSnapshots(snapshots, accounts, '2024-01-01')).toBe(-500);
  });

  it('nets asset and debt correctly', () => {
    const accounts = [
      mkAccount({ id: 'a1', kind: 'asset', ownership: [{ person_id: 'self', share: 1 }] }),
      mkAccount({ id: 'd1', kind: 'debt',  ownership: [{ person_id: 'self', share: 1 }] }),
    ];
    const snapshots = [mkSnap('2024-01-01', 'a1', 1000), mkSnap('2024-01-01', 'd1', 500)];
    expect(computeNetWorthFromSnapshots(snapshots, accounts, '2024-01-01')).toBe(500);
  });

  it('scales by ownership_share', () => {
    const accounts = [
      mkAccount({ id: 'a1', kind: 'asset', ownership: [{ person_id: 'self', share: 0.5 }] }),
      mkAccount({ id: 'd1', kind: 'debt',  ownership: [{ person_id: 'self', share: 0.5 }] }),
    ];
    const snapshots = [mkSnap('2024-01-01', 'a1', 1000), mkSnap('2024-01-01', 'd1', 400)];
    expect(computeNetWorthFromSnapshots(snapshots, accounts, '2024-01-01')).toBe(300);
  });

  it('skips snapshot whose account_id is not in accounts', () => {
    const accounts = [mkAccount({ id: 'a1', kind: 'asset', ownership: [{ person_id: 'self', share: 1 }] })];
    const snapshots = [mkSnap('2024-01-01', 'a1', 1000), mkSnap('2024-01-01', 'unknown', 9999)];
    expect(computeNetWorthFromSnapshots(snapshots, accounts, '2024-01-01')).toBe(1000);
  });
});

describe('computeNetWorthFromSnapshots — viewer argument', () => {
  const accounts = [
    mkAccount({ id: 'a1', kind: 'asset', ownership: [{ person_id: 'self', share: 0.6 }, { person_id: 'partner', share: 0.4 }] }),
  ];
  const snapshots = [mkSnap('2024-01-01', 'a1', 1000)];

  it('defaults to the legacy self-only view when no viewer is passed', () => {
    expect(computeNetWorthFromSnapshots(snapshots, accounts, '2024-01-01')).toBe(600);
  });

  it("scopes the total to the given person's share", () => {
    expect(computeNetWorthFromSnapshots(snapshots, accounts, '2024-01-01', 'CAD', undefined, 'partner')).toBe(400);
  });

  it('HOUSEHOLD_VIEWER combines every owner\'s share', () => {
    expect(computeNetWorthFromSnapshots(snapshots, accounts, '2024-01-01', 'CAD', undefined, HOUSEHOLD_VIEWER)).toBe(1000);
  });
});

describe('buildBalanceSweep — carry-forward logic', () => {
  it('returns empty array for empty dates', () => {
    const snapshots = [mkSnap('2024-01-01', 'a1', 100)];
    expect(buildBalanceSweep(snapshots, [])).toEqual([]);
  });

  it('single date with a snapshot', () => {
    const snapshots = [mkSnap('2024-01-01', 'a1', 100)];
    const result = buildBalanceSweep(snapshots, ['2024-01-01']);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ a1: 100 });
  });

  it('date with no new snapshot carries prior balance forward', () => {
    const snapshots = [mkSnap('2024-01-01', 'a1', 100)];
    const result = buildBalanceSweep(snapshots, ['2024-01-01', '2024-02-01']);
    expect(result[0]).toEqual({ a1: 100 });
    expect(result[1]).toEqual({ a1: 100 });
  });

  it('new account appearing on a later date', () => {
    const snapshots = [mkSnap('2024-01-01', 'a1', 100), mkSnap('2024-02-01', 'a2', 50)];
    const result = buildBalanceSweep(snapshots, ['2024-01-01', '2024-02-01']);
    expect(result[0]).toEqual({ a1: 100 });
    expect(result[1]).toEqual({ a1: 100, a2: 50 });
  });

  it('snapshots before dates[0] are pre-seeded', () => {
    const snapshots = [mkSnap('2023-12-01', 'a1', 999), mkSnap('2024-02-01', 'a1', 200)];
    const result = buildBalanceSweep(snapshots, ['2024-01-01', '2024-02-01']);
    expect(result[0]).toEqual({ a1: 999 });
    expect(result[1]).toEqual({ a1: 200 });
  });

  it('ignores __day__ rows', () => {
    const snapshots = [
      { date: '2024-01-01', account_id: '__day__', balance_raw: 0, comment: 'note' },
      mkSnap('2024-01-01', 'a1', 100),
    ];
    const result = buildBalanceSweep(snapshots, ['2024-01-01']);
    expect(result[0]).toEqual({ a1: 100 });
    expect(result[0]['__day__']).toBeUndefined();
  });
});
