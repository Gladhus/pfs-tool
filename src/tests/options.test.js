import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockState = {
  optionExercises: [],
  optionGrants: [],
  optionFmv: [],
  optionCompanies: [],
};
vi.mock('../core/state.js', () => ({ state: mockState }));

const { computeVestedShares, exercisableShares } = await import('../utils/options.js');

beforeEach(() => { mockState.optionExercises = []; });

const GRANT = {
  id: 'g1',
  grant_date: '2023-01-01',
  vesting_start: '2023-01-01',
  cliff_months: 12,
  vesting_months: 48,
  total_shares: 1000,
  vesting_interval: 'monthly',
  strike_price: 0,
};

describe('computeVestedShares', () => {
  it('returns 0 before cliff', () => {
    expect(computeVestedShares(GRANT, '2023-06-01')).toBe(0);
  });

  it('returns 0 at month 11 (one month before cliff)', () => {
    expect(computeVestedShares(GRANT, '2023-12-01')).toBe(0);
  });

  it('returns > 0 at cliff boundary (month 12)', () => {
    expect(computeVestedShares(GRANT, '2024-01-01')).toBeGreaterThan(0);
    // 12 completed intervals × (1000 / 48) = 250
    expect(computeVestedShares(GRANT, '2024-01-01')).toBe(250);
  });

  it('partway vested at month 24 = 500', () => {
    expect(computeVestedShares(GRANT, '2025-01-01')).toBe(500);
  });

  it('fully vested after vesting_months = total_shares', () => {
    expect(computeVestedShares(GRANT, '2027-01-01')).toBe(1000);
  });

  it('over-vested is capped at total_shares', () => {
    expect(computeVestedShares(GRANT, '2030-01-01')).toBe(1000);
  });

  it('quarterly interval vests every 3 months', () => {
    const g = { ...GRANT, vesting_interval: 'quarterly', cliff_months: 0 };
    // month 3 → 1 completed quarterly interval → 1000/(48/3) = 62.5
    expect(computeVestedShares(g, '2023-04-01')).toBe(62.5);
  });

  it('annual interval vests every 12 months', () => {
    const g = { ...GRANT, vesting_interval: 'annual', cliff_months: 0 };
    // month 12 → 1 completed annual interval → 1000/(48/12) = 250
    expect(computeVestedShares(g, '2024-01-01')).toBe(250);
  });

  it('vesting_months 0 returns 0', () => {
    expect(computeVestedShares({ ...GRANT, vesting_months: 0 }, '2025-01-01')).toBe(0);
  });

  it('total_shares 0 returns 0', () => {
    expect(computeVestedShares({ ...GRANT, total_shares: 0 }, '2025-01-01')).toBe(0);
  });

  it('null asOfDate returns 0', () => {
    expect(computeVestedShares(GRANT, null)).toBe(0);
  });
});

describe('exercisableShares', () => {
  it('no exercises — equals vested', () => {
    mockState.optionExercises = [];
    expect(exercisableShares(GRANT, '2024-01-01')).toBe(250);
  });

  it('partial exercise subtracts correctly', () => {
    mockState.optionExercises = [{ grant_id: 'g1', date: '2024-01-01', shares_exercised: 100 }];
    expect(exercisableShares(GRANT, '2024-01-01')).toBe(150);
  });

  it('over-exercise clamps to 0', () => {
    mockState.optionExercises = [{ grant_id: 'g1', date: '2024-01-01', shares_exercised: 9999 }];
    expect(exercisableShares(GRANT, '2024-01-01')).toBe(0);
  });
});
