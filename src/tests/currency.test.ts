import { describe, it, expect } from 'vitest';
import { signedMain } from '@/shared/utils/currency';
import { HOUSEHOLD_VIEWER } from '@/shared/utils/ownership';
import type { Account } from '@/types/sheets';

const mkAccount = (partial: Partial<Account> & { id: string; kind: 'asset' | 'debt' }): Account => ({
  type: '', name_fr: '', name_en: '', category: '',
  ownership: [{ person_id: 'self', share: 1 }], active: true, sort_order: 0, tags: [], annual_rate: 0,
  ...partial,
});

describe('signedMain — viewer argument', () => {
  const account = mkAccount({
    id: 'a1', kind: 'asset',
    ownership: [{ person_id: 'self', share: 0.7 }, { person_id: 'partner', share: 0.3 }],
  });

  it('defaults to the legacy self-only view', () => {
    expect(signedMain(account, 1000, 'CAD', null)).toBe(700);
  });

  it("scopes the value to the given person's share", () => {
    expect(signedMain(account, 1000, 'CAD', null, 'partner')).toBe(300);
  });

  it('returns 0 for a person with no ownership entry', () => {
    expect(signedMain(account, 1000, 'CAD', null, 'nobody')).toBe(0);
  });

  it('HOUSEHOLD_VIEWER combines every owner\'s share', () => {
    expect(signedMain(account, 1000, 'CAD', null, HOUSEHOLD_VIEWER)).toBe(1000);
  });

  it('debt accounts stay negative regardless of viewer', () => {
    const debt = mkAccount({
      id: 'd1', kind: 'debt',
      ownership: [{ person_id: 'self', share: 0.5 }, { person_id: 'partner', share: 0.5 }],
    });
    expect(signedMain(debt, 1000, 'CAD', null, 'self')).toBe(-500);
    expect(signedMain(debt, 1000, 'CAD', null, HOUSEHOLD_VIEWER)).toBe(-1000);
  });
});
