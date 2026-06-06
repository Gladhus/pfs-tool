import { describe, it, expect } from 'vitest';
import { computeVestedShares, exercisableShares } from '@/utils/options';
import type { OptionGrant, OptionExercise } from '@/types/sheets';

const GRANT: OptionGrant = {
  id: 'g1',
  company_id: 'c1',
  label: 'Test Grant',
  grant_type: 'iso',
  grant_date: '2023-01-01',
  vesting_start: '2023-01-01',
  cliff_months: 12,
  vesting_months: 48,
  total_shares: 1000,
  vesting_interval: 'monthly',
  strike_price: 0,
  expiry_date: '2033-01-01',
};

describe('computeVestedShares', () => {
  it('returns 0 before cliff', () => {
    expect(computeVestedShares(GRANT, '2023-06-01')).toBe(0);
  });

  it('returns 0 at month 11 (one month before cliff)', () => {
    expect(computeVestedShares(GRANT, '2023-12-01')).toBe(0);
  });

  it('returns 250 at cliff boundary (month 12)', () => {
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
    expect(computeVestedShares(g, '2023-04-01')).toBe(62.5);
  });

  it('annual interval vests every 12 months', () => {
    const g = { ...GRANT, vesting_interval: 'annual', cliff_months: 0 };
    expect(computeVestedShares(g, '2024-01-01')).toBe(250);
  });

  it('vesting_months 0 returns 0', () => {
    expect(computeVestedShares({ ...GRANT, vesting_months: 0 }, '2025-01-01')).toBe(0);
  });

  it('total_shares 0 returns 0', () => {
    expect(computeVestedShares({ ...GRANT, total_shares: 0 }, '2025-01-01')).toBe(0);
  });

  it('null asOfDate returns 0', () => {
    expect(computeVestedShares(GRANT, null as unknown as string)).toBe(0);
  });
});

describe('exercisableShares', () => {
  const noExercises: OptionExercise[] = [];

  it('no exercises — equals vested', () => {
    expect(exercisableShares(GRANT, noExercises, '2024-01-01')).toBe(250);
  });

  it('partial exercise subtracts correctly', () => {
    const exercises: OptionExercise[] = [
      { id: 'e1', grant_id: 'g1', date: '2024-01-01', shares_exercised: 100, price_paid: 0 },
    ];
    expect(exercisableShares(GRANT, exercises, '2024-01-01')).toBe(150);
  });

  it('over-exercise clamps to 0', () => {
    const exercises: OptionExercise[] = [
      { id: 'e1', grant_id: 'g1', date: '2024-01-01', shares_exercised: 9999, price_paid: 0 },
    ];
    expect(exercisableShares(GRANT, exercises, '2024-01-01')).toBe(0);
  });
});
