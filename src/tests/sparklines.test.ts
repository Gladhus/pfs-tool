import { describe, it, expect } from 'vitest';
import { categorySparkline, groupSparkline, personSparkline, equitySparkline } from '@/features/networth/sparklines';
import { buildBalanceSweep } from '@/shared/utils/stats';
import { HOUSEHOLD_VIEWER } from '@/shared/utils/ownership';
import { ACCOUNTS, SNAPSHOTS, DATES_SORTED, FX_MAP, MAIN, GROUPS, OPTION_DATA } from './fixtures/portfolio';

const sweep = buildBalanceSweep(SNAPSHOTS, DATES_SORTED);

describe('categorySparkline', () => {
  it('starts where the category has data and tracks the viewer total', () => {
    const self = categorySparkline('investments', ACCOUNTS, sweep, DATES_SORTED, MAIN, FX_MAP, 'self');
    // Trim is on category presence (viewer-independent, matching the chart): partner_inv
    // makes investments present in 2021, so the series keeps all four points — but self
    // owns none then, so the 2021 value is 0.
    expect(self.length).toBe(4);
    expect(self[0]).toBe(0);
    expect(self[1]).toBe(24000); // inv_self 20000 + half of inv_joint 8000
  });
});

describe('groupSparkline', () => {
  it('rolls option equity into a matching group', () => {
    const withEquity = groupSparkline(GROUPS[0], ACCOUNTS, sweep, DATES_SORTED, MAIN, FX_MAP, OPTION_DATA, HOUSEHOLD_VIEWER);
    const withoutEquity = groupSparkline(GROUPS[0], ACCOUNTS, sweep, DATES_SORTED, MAIN, FX_MAP, undefined, HOUSEHOLD_VIEWER);
    // The Tech group matches inv_self (tag) and optco (tag) → equity lifts the last point.
    expect(withEquity[withEquity.length - 1]).toBeGreaterThan(withoutEquity[withoutEquity.length - 1]);
  });
});

describe('personSparkline', () => {
  it('scopes to a single owner', () => {
    const partner = personSparkline('partner', ACCOUNTS, sweep, DATES_SORTED, MAIN, FX_MAP, OPTION_DATA);
    expect(partner.length).toBeGreaterThan(0);
    expect(partner.every(v => typeof v === 'number')).toBe(true);
  });
});

describe('equitySparkline', () => {
  it('is empty without option data and non-empty (owner-visible) with it', () => {
    expect(equitySparkline(undefined, DATES_SORTED, MAIN, FX_MAP, 'self')).toEqual([]);
    const self = equitySparkline(OPTION_DATA, DATES_SORTED, MAIN, FX_MAP, 'self');
    expect(self.length).toBeGreaterThan(0);
    // optco's owner is self → partner sees no equity.
    expect(equitySparkline(OPTION_DATA, DATES_SORTED, MAIN, FX_MAP, 'partner')).toEqual([]);
  });
});
