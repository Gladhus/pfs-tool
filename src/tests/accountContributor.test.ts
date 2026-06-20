import { describe, it, expect } from 'vitest';
import { makeAccountContributor } from '@/features/accounts/data/account.contributor';
import type { ValueContext } from '@/core/contributors/types';
import { computeDateStats, computeNetWorthFromSnapshots } from '@/utils/stats';
import { rateFor } from '@/utils/currency';
import { foldCategoryId } from '@/utils/colors';
import { HOUSEHOLD_VIEWER } from '@/utils/ownership';
import type { Contribution, Snapshot, Account } from '@/types/sheets';
import { ACCOUNTS, SNAPSHOTS, DATES_SORTED, FX_MAP, MAIN } from './fixtures/portfolio';

const ctx = (): ValueContext => ({
  viewer: 'self', // unused by the contributor (it emits all owners); scoping is downstream
  main: MAIN,
  fxRateFor: (d: string) => rateFor(FX_MAP, d),
});

const forViewer = (cs: Contribution[], viewer: string) =>
  cs.filter(c => viewer === HOUSEHOLD_VIEWER || c.ownerId === viewer);

const netOf = (cs: Contribution[], viewer: string) =>
  forViewer(cs, viewer).reduce((s, c) => s + c.amount, 0);

const foldedByCategory = (cs: Contribution[], viewer: string) => {
  const out: Record<string, number> = {};
  for (const c of forViewer(cs, viewer)) {
    const k = foldCategoryId(c.category);
    out[k] = (out[k] ?? 0) + c.amount;
  }
  return out;
};

describe('accountContributor.checkpointDates', () => {
  const c = makeAccountContributor(ACCOUNTS, SNAPSHOTS);

  it('returns the snapshot dates within the range, sorted and deduped', () => {
    expect(c.checkpointDates({ end: '2024-06-01' })).toEqual(DATES_SORTED);
    expect(c.checkpointDates({ start: '2022-06-01', end: '2024-06-01' }))
      .toEqual(['2023-05-10', '2024-06-01']);
  });

  it('ignores __day__ rows', () => {
    const snaps: Snapshot[] = [
      { date: '2024-01-01', account_id: '__day__', balance_raw: 0, comment: 'note' },
      { date: '2024-01-01', account_id: 'inv_self', balance_raw: 100 },
    ];
    expect(makeAccountContributor(ACCOUNTS, snaps).checkpointDates({ end: '2024-12-31' }))
      .toEqual(['2024-01-01']);
  });
});

describe('accountContributor.valuesOver — per-owner contributions', () => {
  const c = makeAccountContributor(ACCOUNTS, SNAPSHOTS);
  const axis = DATES_SORTED;
  const last = c.valuesOver(axis, ctx())[axis.length - 1];

  it('splits a joint account into one contribution per owner, summing to the whole', () => {
    const houseSelf = last.find(x => x.sourceId === 'house' && x.ownerId === 'self');
    const housePartner = last.find(x => x.sourceId === 'house' && x.ownerId === 'partner');
    expect(houseSelf?.amount).toBe(210000);     // 420000 × 0.5
    expect(housePartner?.amount).toBe(210000);
    expect((houseSelf!.amount) + (housePartner!.amount)).toBe(420000);
  });

  it('signs debt negative', () => {
    // Mortgage last value 290000 (carried from 2023), split 50/50 → -145000 each.
    const mortgageSelf = last.find(x => x.sourceId === 'mortgage' && x.ownerId === 'self');
    expect(mortgageSelf?.amount).toBe(-145000);
  });

  it('converts a foreign-currency account at the date\'s rate', () => {
    // cash_usd last value 1200 USD, carried from 2023; rate at 2024-06-01 = 1.40.
    const cash = last.find(x => x.sourceId === 'cash_usd');
    expect(cash?.amount).toBeCloseTo(1200 * 1.4, 6);
  });

  it('keeps raw category (real_estate_debt not folded on the contribution)', () => {
    expect(last.find(x => x.sourceId === 'mortgage')?.category).toBe('real_estate_debt');
  });

  it('carries balances forward into an axis that starts after the last entry', () => {
    // Axis skips 2021/2022; house (last entered 2022) must still be valued at 2023.
    const truncated = ['2023-05-10', '2024-06-01'];
    const first = makeAccountContributor(ACCOUNTS, SNAPSHOTS).valuesOver(truncated, ctx())[0];
    const houseSelf = first.find(x => x.sourceId === 'house' && x.ownerId === 'self');
    expect(houseSelf?.amount).toBe(200000); // 400000 carried × 0.5
  });
});

// The contract for the whole phase: account valuation must equal the legacy math.
describe('accountContributor — cross-check vs legacy aggregators', () => {
  const c = makeAccountContributor(ACCOUNTS, SNAPSHOTS);
  const series = c.valuesOver(DATES_SORTED, ctx());

  for (const viewer of ['self', 'partner', HOUSEHOLD_VIEWER]) {
    it(`net worth matches computeNetWorthFromSnapshots at every date (viewer=${viewer})`, () => {
      DATES_SORTED.forEach((date, i) => {
        const expected = computeNetWorthFromSnapshots(SNAPSHOTS, ACCOUNTS, date, MAIN, FX_MAP, viewer);
        expect(netOf(series[i], viewer)).toBeCloseTo(expected, 4);
      });
    });

    it(`folded category sums match computeDateStats at the latest date (viewer=${viewer})`, () => {
      const date = DATES_SORTED[DATES_SORTED.length - 1];
      // No equity here — accountContributor is the snapshot path only.
      const expected = computeDateStats(SNAPSHOTS, ACCOUNTS, date, MAIN, FX_MAP, undefined, date, viewer);
      const foldedExpected: Record<string, number> = {};
      for (const [k, v] of Object.entries(expected.byCategory)) {
        foldedExpected[foldCategoryId(k)] = (foldedExpected[foldCategoryId(k)] ?? 0) + v;
      }
      const got = foldedByCategory(series[DATES_SORTED.length - 1], viewer);
      // computeDateStats records zero-valued keys for accounts the viewer doesn't own;
      // the contributor omits zero-share owners. Compare over the union, missing = 0.
      const keys = new Set([...Object.keys(got), ...Object.keys(foldedExpected)]);
      for (const k of keys) expect(got[k] ?? 0).toBeCloseTo(foldedExpected[k] ?? 0, 4);
    });
  }
});

// Guards the contributor against the orphan-snapshot edge the legacy path also tolerates.
describe('accountContributor — unknown account snapshots are skipped', () => {
  it('ignores snapshots whose account is not in the accounts list', () => {
    const accounts: Account[] = [ACCOUNTS[0]];
    const snaps: Snapshot[] = [
      { date: '2024-01-01', account_id: ACCOUNTS[0].id, balance_raw: 100 },
      { date: '2024-01-01', account_id: 'ghost', balance_raw: 9999 },
    ];
    const out = makeAccountContributor(accounts, snaps).valuesOver(['2024-01-01'], ctx())[0];
    expect(out.every(c => c.sourceId === ACCOUNTS[0].id)).toBe(true);
  });
});
