import { describe, it, expect } from 'vitest';
import {
  expandRecurrence, recurringOccurrences, ledgerFor, sliceLedger,
  viewerAmount, spendingSummary, monthWindow, shiftMonthKey, monthKeyOf,
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
