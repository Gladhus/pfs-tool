import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockState = {
  snapshots: [],
  accounts: [],
  optionCompanies: [],
  optionGrants: [],
  optionFmv: [],
  optionExercises: [],
};

vi.mock('../core/state.js', () => ({ state: mockState }));
vi.mock('./options.js', () => ({ computeTotalEquityValue: () => 0 }));

const { computeNetWorthFromSnapshots, buildBalanceSweep } = await import('../utils/stats.js');

beforeEach(() => {
  mockState.snapshots = [];
  mockState.accounts = [];
});

// --- computeNetWorthFromSnapshots ---

describe('computeNetWorthFromSnapshots — asset/debt sign handling', () => {
  it('sums pure assets positively', () => {
    mockState.accounts = [{ id: 'a1', kind: 'asset', ownership_share: 1 }];
    mockState.snapshots = [{ date: '2024-01-01', account_id: 'a1', balance_raw: 1000 }];
    expect(computeNetWorthFromSnapshots('2024-01-01')).toBe(1000);
  });

  it('subtracts debt accounts', () => {
    mockState.accounts = [{ id: 'd1', kind: 'debt', ownership_share: 1 }];
    mockState.snapshots = [{ date: '2024-01-01', account_id: 'd1', balance_raw: 500 }];
    expect(computeNetWorthFromSnapshots('2024-01-01')).toBe(-500);
  });

  it('nets asset and debt correctly', () => {
    mockState.accounts = [
      { id: 'a1', kind: 'asset', ownership_share: 1 },
      { id: 'd1', kind: 'debt',  ownership_share: 1 },
    ];
    mockState.snapshots = [
      { date: '2024-01-01', account_id: 'a1', balance_raw: 1000 },
      { date: '2024-01-01', account_id: 'd1', balance_raw: 500 },
    ];
    expect(computeNetWorthFromSnapshots('2024-01-01')).toBe(500);
  });

  it('scales by ownership_share', () => {
    mockState.accounts = [
      { id: 'a1', kind: 'asset', ownership_share: 0.5 },
      { id: 'd1', kind: 'debt',  ownership_share: 0.5 },
    ];
    mockState.snapshots = [
      { date: '2024-01-01', account_id: 'a1', balance_raw: 1000 },
      { date: '2024-01-01', account_id: 'd1', balance_raw: 400 },
    ];
    expect(computeNetWorthFromSnapshots('2024-01-01')).toBe(300);
  });

  it('skips snapshot whose account_id is not in accounts', () => {
    mockState.accounts = [{ id: 'a1', kind: 'asset', ownership_share: 1 }];
    mockState.snapshots = [
      { date: '2024-01-01', account_id: 'a1',      balance_raw: 1000 },
      { date: '2024-01-01', account_id: 'unknown', balance_raw: 9999 },
    ];
    expect(computeNetWorthFromSnapshots('2024-01-01')).toBe(1000);
  });

  it('ownership_share 0 falls back to 1 (the || 1 behaviour)', () => {
    mockState.accounts = [{ id: 'a1', kind: 'asset', ownership_share: 0 }];
    mockState.snapshots = [{ date: '2024-01-01', account_id: 'a1', balance_raw: 500 }];
    expect(computeNetWorthFromSnapshots('2024-01-01')).toBe(500);
  });
});

// --- buildBalanceSweep ---

describe('buildBalanceSweep — carry-forward logic', () => {
  it('returns empty array for empty dates', () => {
    mockState.snapshots = [{ date: '2024-01-01', account_id: 'a1', balance_raw: 100 }];
    expect(buildBalanceSweep([])).toEqual([]);
  });

  it('single date with a snapshot', () => {
    mockState.snapshots = [{ date: '2024-01-01', account_id: 'a1', balance_raw: 100 }];
    const result = buildBalanceSweep(['2024-01-01']);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ a1: 100 });
  });

  it('multiple dates each with a snapshot', () => {
    mockState.snapshots = [
      { date: '2024-01-01', account_id: 'a1', balance_raw: 100 },
      { date: '2024-02-01', account_id: 'a1', balance_raw: 200 },
    ];
    const result = buildBalanceSweep(['2024-01-01', '2024-02-01']);
    expect(result[0]).toEqual({ a1: 100 });
    expect(result[1]).toEqual({ a1: 200 });
  });

  it('date with no new snapshot carries prior balance forward', () => {
    mockState.snapshots = [{ date: '2024-01-01', account_id: 'a1', balance_raw: 100 }];
    const result = buildBalanceSweep(['2024-01-01', '2024-02-01']);
    expect(result[0]).toEqual({ a1: 100 });
    expect(result[1]).toEqual({ a1: 100 });
  });

  it('new account appearing on a later date', () => {
    mockState.snapshots = [
      { date: '2024-01-01', account_id: 'a1', balance_raw: 100 },
      { date: '2024-02-01', account_id: 'a2', balance_raw: 50 },
    ];
    const result = buildBalanceSweep(['2024-01-01', '2024-02-01']);
    expect(result[0]).toEqual({ a1: 100 });
    expect(result[1]).toEqual({ a1: 100, a2: 50 });
  });

  it('snapshots before dates[0] are pre-seeded', () => {
    mockState.snapshots = [
      { date: '2023-12-01', account_id: 'a1', balance_raw: 999 },
      { date: '2024-02-01', account_id: 'a1', balance_raw: 200 },
    ];
    const result = buildBalanceSweep(['2024-01-01', '2024-02-01']);
    expect(result[0]).toEqual({ a1: 999 });
    expect(result[1]).toEqual({ a1: 200 });
  });

  it('snapshots after the last date are excluded', () => {
    mockState.snapshots = [
      { date: '2024-01-01', account_id: 'a1', balance_raw: 100 },
      { date: '2024-12-01', account_id: 'a1', balance_raw: 9999 },
    ];
    const result = buildBalanceSweep(['2024-01-01']);
    expect(result[0]).toEqual({ a1: 100 });
  });

  it('exact date-boundary is included via <= comparator', () => {
    mockState.snapshots = [{ date: '2024-06-01', account_id: 'a1', balance_raw: 777 }];
    const result = buildBalanceSweep(['2024-06-01']);
    expect(result[0]).toEqual({ a1: 777 });
  });

  it('ignores __day__ rows', () => {
    mockState.snapshots = [
      { date: '2024-01-01', account_id: '__day__', balance_raw: 0, comment: 'note' },
      { date: '2024-01-01', account_id: 'a1',      balance_raw: 100 },
    ];
    const result = buildBalanceSweep(['2024-01-01']);
    expect(result[0]).toEqual({ a1: 100 });
    expect(result[0]['__day__']).toBeUndefined();
  });
});
