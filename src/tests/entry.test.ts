import { describe, it, expect } from 'vitest';
import { computeEntryTotals, buildEntryRows } from '@/core/accounts/entry';
import { LEGACY_SELF_ID } from '@/utils/ownership';
import type { Account, Snapshot } from '@/types/sheets';

const mkAccount = (id: string, category: string, kind: Account['kind'] = 'asset'): Account => ({
  id,
  type: '', name_fr: id, name_en: id, category,
  kind,
  ownership: [{ person_id: 'self', share: 1 }],
  active: true,
  sort_order: 0,
  tags: [],
  annual_rate: 0,
});

const NO_FX = new Map<string, number>();

describe('computeEntryTotals', () => {
  it('sums filled balances and carries forward blanks', () => {
    const visible = [mkAccount('a1', 'cash'), mkAccount('a2', 'cash')];
    const totals = computeEntryTotals({
      visible,
      form: { a1: { balance: '100', comment: '' }, a2: { balance: '', comment: '' } },
      prevBalances: { a2: 50 },
      date: '2024-01-01',
      mainCurrency: 'CAD',
      fxRateMap: NO_FX,
      viewer: LEGACY_SELF_ID,
    });
    expect(totals.netWorth).toBe(150);
    expect(totals.byCategory.cash).toBe(150);
    expect(totals.filled).toBe(1);
    expect(totals.total).toBe(2);
    expect(totals.usingFallback).toBe(true);
  });

  it('skips accounts with neither a balance nor a previous value', () => {
    const visible = [mkAccount('a1', 'cash')];
    const totals = computeEntryTotals({
      visible,
      form: { a1: { balance: '', comment: '' } },
      prevBalances: {},
      date: '2024-01-01',
      mainCurrency: 'CAD',
      fxRateMap: NO_FX,
      viewer: LEGACY_SELF_ID,
    });
    expect(totals.netWorth).toBe(0);
    expect(totals.filled).toBe(0);
    expect(totals.usingFallback).toBe(false);
  });

  it('subtracts debt accounts from net worth', () => {
    const visible = [mkAccount('a1', 'cash'), mkAccount('d1', 'debts', 'debt')];
    const totals = computeEntryTotals({
      visible,
      form: { a1: { balance: '100', comment: '' }, d1: { balance: '30', comment: '' } },
      prevBalances: {},
      date: '2024-01-01',
      mainCurrency: 'CAD',
      fxRateMap: NO_FX,
      viewer: LEGACY_SELF_ID,
    });
    expect(totals.netWorth).toBe(70);
  });
});

describe('buildEntryRows', () => {
  const ENTERED = '2024-06-01T00:00:00.000Z';

  it('writes filled balances, the day comment, and preserves inactive rows', () => {
    const active = [mkAccount('a1', 'cash'), mkAccount('a2', 'cash')];
    const snapshots: Snapshot[] = [
      { date: '2024-01-01', account_id: 'x_inactive', balance_raw: 999 },
    ];
    const { rows, deleted } = buildEntryRows({
      active,
      form: { a1: { balance: '100', comment: 'hi' }, a2: { balance: '', comment: '' } },
      dayComment: 'note',
      snapshots,
      date: '2024-01-01',
      existingBalances: { a2: 50 },
      enteredAt: ENTERED,
    });

    expect(rows).toContainEqual({ date: '2024-01-01', account_id: 'a1', balance_raw: 100, comment: 'hi', entered_at: ENTERED });
    expect(rows).toContainEqual({ date: '2024-01-01', account_id: '__day__', balance_raw: 0, comment: 'note', entered_at: ENTERED });
    // inactive account's row is preserved verbatim
    expect(rows).toContainEqual({ date: '2024-01-01', account_id: 'x_inactive', balance_raw: 999 });
    // a2 was filled before but is now blank → flagged for deletion
    expect(deleted.map(a => a.id)).toEqual(['a2']);
  });

  it('reports nothing to write when the form is empty', () => {
    const { rows, deleted } = buildEntryRows({
      active: [mkAccount('a1', 'cash')],
      form: { a1: { balance: '', comment: '' } },
      dayComment: '',
      snapshots: [],
      date: '2024-01-01',
      existingBalances: {},
      enteredAt: ENTERED,
    });
    expect(rows).toEqual([]);
    expect(deleted).toEqual([]);
  });
});
