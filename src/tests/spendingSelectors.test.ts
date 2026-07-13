import { describe, it, expect } from 'vitest';
import {
  expandRecurrence, recurringOccurrences, ledgerFor, sliceLedger,
  viewerAmount, spendingSummary, monthWindow, shiftMonthKey, monthKeyOf,
  periodWindow, categoryPeriodTable,
  type SpendingCtx,
} from '@/features/spending/data/spending.selectors';
import { HOUSEHOLD_VIEWER } from '@/shared/utils/ownership';
import type { Spending, SpendingRecurrence } from '@/types/sheets';

const CTX: SpendingCtx = { main: 'CAD', fxRateFor: () => 1.35 };

function rule(over: Partial<SpendingRecurrence> = {}): SpendingRecurrence {
  return {
    id: 'r1', label: 'Rent', amount: 1500, category_id: 'housing',
    ownership: [{ person_id: 'self', share: 1 }],
    frequency: 'monthly', interval: 1, start_date: '2026-01-15', active: true,
    ...over,
  };
}

function spend(over: Partial<Spending> = {}): Spending {
  return {
    id: 's1', date: '2026-03-10', amount: 100, category_id: 'groceries',
    ownership: [{ person_id: 'self', share: 1 }],
    ...over,
  };
}

describe('monthWindow / month keys', () => {
  it('covers a full month inclusively', () => {
    expect(monthWindow('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthWindow('2024-02').end).toBe('2024-02-29'); // leap year
  });
  it('shiftMonthKey wraps years', () => {
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12');
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01');
  });
  it('monthKeyOf slices the date', () => {
    expect(monthKeyOf('2026-03-10')).toBe('2026-03');
  });
});

describe('expandRecurrence', () => {
  it('produces one monthly occurrence inside the window', () => {
    expect(expandRecurrence(rule(), monthWindow('2026-03'))).toEqual(['2026-03-15']);
  });
  it('clamps the day at short months', () => {
    // Start on the 31st; February should land on the 28th (2026 is not a leap year).
    const dates = expandRecurrence(rule({ start_date: '2026-01-31' }), monthWindow('2026-02'));
    expect(dates).toEqual(['2026-02-28']);
  });
  it('respects the start date (no occurrence before it)', () => {
    // Starts Jan 15: absent from December, present from January on.
    expect(expandRecurrence(rule(), monthWindow('2025-12'))).toEqual([]);
    expect(expandRecurrence(rule(), monthWindow('2026-01'))).toEqual(['2026-01-15']);
  });
  it('respects the end date', () => {
    const dates = expandRecurrence(rule({ end_date: '2026-02-28' }), monthWindow('2026-03'));
    expect(dates).toEqual([]);
  });
  it('skips inactive rules', () => {
    expect(expandRecurrence(rule({ active: false }), monthWindow('2026-03'))).toEqual([]);
  });
  it('weekly with interval steps correctly', () => {
    const dates = expandRecurrence(
      rule({ frequency: 'weekly', interval: 2, start_date: '2026-03-02' }),
      monthWindow('2026-03'),
    );
    expect(dates).toEqual(['2026-03-02', '2026-03-16', '2026-03-30']);
  });
});

describe('ledgerFor', () => {
  it('unions one-off spendings with expanded recurrences, newest first', () => {
    const rows = ledgerFor([spend({ date: '2026-03-10' })], [rule()], monthWindow('2026-03'));
    expect(rows.map(r => r.date)).toEqual(['2026-03-15', '2026-03-10']);
    expect(rows.find(r => r.date === '2026-03-15')!.recurring).toBe(true);
    expect(rows.find(r => r.date === '2026-03-10')!.recurring).toBe(false);
  });
  it('a stored override replaces the generated occurrence', () => {
    const override = spend({ id: 'recur:r1:2026-03-15', date: '2026-03-15', amount: 1600 });
    const rows = ledgerFor([override], [rule()], monthWindow('2026-03'));
    const march15 = rows.filter(r => r.date === '2026-03-15');
    expect(march15).toHaveLength(1);
    expect(march15[0].amount).toBe(1600);
    expect(march15[0].recurring).toBe(false);
  });
  it('excludes one-offs outside the window', () => {
    const rows = ledgerFor([spend({ date: '2026-02-10' })], [], monthWindow('2026-03'));
    expect(rows).toHaveLength(0);
  });
});

describe('recurringOccurrences', () => {
  it('tags each occurrence with a stable recur:* id', () => {
    const occ = recurringOccurrences([rule()], monthWindow('2026-03'));
    expect(occ[0].id).toBe('recur:r1:2026-03-15');
  });
});

describe('sliceLedger + viewerAmount', () => {
  it('splits a joint spending per owner and converts currency', () => {
    const joint = spend({ amount: 100, currency: 'USD', ownership: [{ person_id: 'self', share: 0.6 }, { person_id: 'partner', share: 0.4 }] });
    const slices = sliceLedger([joint], CTX);
    expect(slices).toHaveLength(2);
    // 100 USD × 1.35 = 135 CAD, split 60/40.
    expect(slices.find(s => s.ownerId === 'self')!.amount).toBeCloseTo(81, 5);
    expect(slices.find(s => s.ownerId === 'partner')!.amount).toBeCloseTo(54, 5);
  });
  it('viewerAmount returns the household gross and the per-person slice', () => {
    const joint = spend({ amount: 100, ownership: [{ person_id: 'self', share: 0.6 }, { person_id: 'partner', share: 0.4 }] });
    expect(viewerAmount(joint, CTX, HOUSEHOLD_VIEWER)).toBeCloseTo(100, 5);
    expect(viewerAmount(joint, CTX, 'self')).toBeCloseTo(60, 5);
  });
});

describe('spendingSummary', () => {
  const spendings: Spending[] = [
    spend({ id: 'a', date: '2026-03-01', amount: 200, category_id: 'groceries', ownership: [{ person_id: 'self', share: 0.5 }, { person_id: 'partner', share: 0.5 }] }),
    spend({ id: 'b', date: '2026-03-05', amount: 60, category_id: 'dining', ownership: [{ person_id: 'self', share: 1 }] }),
  ];
  const rules = [rule({ amount: 1500, category_id: 'housing' })]; // one occurrence 2026-03-15, owner self

  it('totals the household window across one-offs and recurrences', () => {
    const s = spendingSummary(spendings, rules, monthWindow('2026-03'), CTX, HOUSEHOLD_VIEWER);
    expect(s.total).toBeCloseTo(200 + 60 + 1500, 5);
    expect(s.count).toBe(3);
  });

  it('scopes to a single viewer by owner share', () => {
    const s = spendingSummary(spendings, rules, monthWindow('2026-03'), CTX, 'partner');
    // partner: 100 (half of groceries) only.
    expect(s.total).toBeCloseTo(100, 5);
    expect(s.count).toBe(1);
    expect(s.byCategory).toEqual([{ categoryId: 'groceries', amount: 100, pct: 100 }]);
  });

  it('breaks down by category, sorted desc', () => {
    const s = spendingSummary(spendings, rules, monthWindow('2026-03'), CTX, HOUSEHOLD_VIEWER);
    expect(s.byCategory.map(b => b.categoryId)).toEqual(['housing', 'groceries', 'dining']);
    expect(s.byCategory[0].amount).toBeCloseTo(1500, 5);
  });

  it('breaks down by person', () => {
    const s = spendingSummary(spendings, rules, monthWindow('2026-03'), CTX, HOUSEHOLD_VIEWER);
    const self = s.byPerson.find(p => p.ownerId === 'self')!;
    const partner = s.byPerson.find(p => p.ownerId === 'partner')!;
    expect(self.amount).toBeCloseTo(100 + 60 + 1500, 5); // half groceries + dining + rent
    expect(partner.amount).toBeCloseTo(100, 5);
  });

  it('is empty for a window with no data', () => {
    // Before the rule's start date and before any one-off.
    const s = spendingSummary(spendings, rules, monthWindow('2025-01'), CTX, HOUSEHOLD_VIEWER);
    expect(s.total).toBe(0);
    expect(s.count).toBe(0);
    expect(s.byCategory).toEqual([]);
  });
});

describe('periodWindow', () => {
  const today = '2026-07-13';
  it('month → the current calendar month', () => {
    expect(periodWindow('month', today)).toEqual({ start: '2026-07-01', end: '2026-07-31' });
  });
  it('ytd → Jan 1 to today', () => {
    expect(periodWindow('ytd', today)).toEqual({ start: '2026-01-01', end: today });
  });
  it('rolling 3m/1y end at today', () => {
    expect(periodWindow('3m', today)).toEqual({ start: '2026-04-13', end: today });
    expect(periodWindow('1y', today)).toEqual({ start: '2025-07-13', end: today });
  });
  it('all starts at the epoch floor', () => {
    expect(periodWindow('all', today)).toEqual({ start: '0000-01-01', end: today });
  });
});

describe('categoryPeriodTable', () => {
  const spendings: Spending[] = [
    spend({ id: 'a', date: '2026-05-10', amount: 100, category_id: 'groceries' }),
    spend({ id: 'b', date: '2026-06-10', amount: 50, category_id: 'groceries' }),
    spend({ id: 'c', date: '2026-06-12', amount: 30, category_id: 'dining' }),
    spend({ id: 'd', date: '2026-07-05', amount: 20, category_id: 'groceries' }),
  ];

  it('builds a MoM table over only the months with data, sorted by total', () => {
    const tbl = categoryPeriodTable(spendings, [], CTX, HOUSEHOLD_VIEWER, 'month', '2026-07-13', 6);
    expect(tbl.periods).toEqual(['2026-05', '2026-06', '2026-07']); // April etc. skipped (no data)
    expect(tbl.rows[0]).toEqual({ categoryId: 'groceries', cells: [100, 50, 20], total: 170 });
    expect(tbl.rows[1]).toEqual({ categoryId: 'dining', cells: [0, 30, 0], total: 30 });
    expect(tbl.columnTotals).toEqual([100, 80, 20]);
    expect(tbl.grandTotal).toBe(200);
  });

  it('caps at the most recent maxPeriods columns', () => {
    // Eight consecutive months of data → only the latest six columns.
    const many: Spending[] = ['01', '02', '03', '04', '05', '06', '07', '08'].map(mm =>
      spend({ id: `m${mm}`, date: `2026-${mm}-05`, amount: 10, category_id: 'groceries' }));
    const tbl = categoryPeriodTable(many, [], CTX, HOUSEHOLD_VIEWER, 'month', '2026-08-31', 6);
    expect(tbl.periods).toEqual(['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']);
  });

  it('YoY shows only years with data (no empty leading years)', () => {
    const yearly: Spending[] = [
      spend({ id: 'y1', date: '2024-03-01', amount: 100, category_id: 'groceries' }),
      spend({ id: 'y2', date: '2026-03-01', amount: 200, category_id: 'groceries' }),
    ];
    const tbl = categoryPeriodTable(yearly, [], CTX, HOUSEHOLD_VIEWER, 'year', '2026-07-13', 6);
    expect(tbl.periods).toEqual(['2024', '2026']); // 2025 skipped, no phantom years
    expect(tbl.rows[0].cells).toEqual([100, 200]);
  });

  it('is empty with no data', () => {
    expect(categoryPeriodTable([], [], CTX, HOUSEHOLD_VIEWER, 'month', '2026-07-13').periods).toEqual([]);
  });
});
