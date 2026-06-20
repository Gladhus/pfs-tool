import { describe, it, expect } from 'vitest';
import { activeVisibleAccounts, isViewerLockedOut } from '@/core/scope';
import { HOUSEHOLD_VIEWER } from '@/shared/utils/ownership';
import type { Account } from '@/types/sheets';

const mk = (id: string, owners: Array<[string, number]>, active = true): Account => ({
  id, type: '', name_fr: id, name_en: id, category: 'investments', kind: 'asset',
  ownership: owners.map(([person_id, share]) => ({ person_id, share })),
  active, sort_order: 0, tags: [], annual_rate: 0,
});

const ACCOUNTS = [
  mk('self_only', [['self', 1]]),
  mk('joint', [['self', 0.5], ['partner', 0.5]]),
  mk('partner_only', [['partner', 1]]),
  mk('archived_self', [['self', 1]], false),
];

describe('activeVisibleAccounts', () => {
  it('returns active accounts the viewer holds a stake in', () => {
    expect(activeVisibleAccounts(ACCOUNTS, 'self').map(a => a.id)).toEqual(['self_only', 'joint']);
  });

  it('excludes inactive accounts even when the viewer owns them', () => {
    expect(activeVisibleAccounts(ACCOUNTS, 'self').map(a => a.id)).not.toContain('archived_self');
  });

  it('scopes to a single person', () => {
    expect(activeVisibleAccounts(ACCOUNTS, 'partner').map(a => a.id)).toEqual(['joint', 'partner_only']);
  });

  it('household sees every active account', () => {
    expect(activeVisibleAccounts(ACCOUNTS, HOUSEHOLD_VIEWER).map(a => a.id))
      .toEqual(['self_only', 'joint', 'partner_only']);
  });
});

describe('isViewerLockedOut', () => {
  it('is false when the viewer owns some active account', () => {
    expect(isViewerLockedOut(ACCOUNTS, 'self')).toBe(false);
  });

  it('is true when there is active data but none of it is the viewer\'s', () => {
    const onlyPartner = [mk('partner_only', [['partner', 1]])];
    expect(isViewerLockedOut(onlyPartner, 'self')).toBe(true);
  });

  it('is false when there are no active accounts at all (genuinely empty, not locked out)', () => {
    expect(isViewerLockedOut([mk('archived', [['self', 1]], false)], 'self')).toBe(false);
  });
});
