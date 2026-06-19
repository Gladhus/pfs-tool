import { describe, it, expect } from 'vitest';
import { computeSeries } from '@/core/accounts/history';
import type { Account, Snapshot } from '@/types/sheets';

const mk = (id: string, person: string): Account => ({
  id,
  type: '', name_fr: id, name_en: id, category: 'investments',
  kind: 'asset',
  ownership: [{ person_id: person, share: 1 }],
  active: true,
  sort_order: 0,
  tags: [],
  annual_rate: 0,
});

const NO_FX = new Map<string, number>();

describe('computeSeries — viewer-aware leading trim', () => {
  const accounts = [mk('self-1', 'self'), mk('partner-1', 'partner')];
  const snapshots: Snapshot[] = [
    { date: '2020-01-01', account_id: 'partner-1', balance_raw: 5000 },
    { date: '2021-01-01', account_id: 'partner-1', balance_raw: 6000 },
    // self only joins on the third date
    { date: '2022-01-01', account_id: 'self-1', balance_raw: 1000 },
  ];
  const dates = ['2020-01-01', '2021-01-01', '2022-01-01'];

  it('drops leading dates that belong only to other people for a specific viewer', () => {
    const series = computeSeries(dates, accounts, snapshots, 'CAD', NO_FX, 'self');
    // Partner's 2020/2021 dates are trimmed; self's history starts in 2022.
    expect(series.dates).toEqual(['2022-01-01']);
    expect(series.investments).toEqual([1000]);
  });

  it('keeps every date for the household viewer', () => {
    const series = computeSeries(dates, accounts, snapshots, 'CAD', NO_FX, '__household__');
    expect(series.dates).toEqual(dates);
  });

  it('keeps all dates when the viewer holds a stake from the start', () => {
    const series = computeSeries(dates, accounts, snapshots, 'CAD', NO_FX, 'partner');
    expect(series.dates).toEqual(dates);
  });
});
