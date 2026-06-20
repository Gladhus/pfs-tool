import { describe, it, expect } from 'vitest';
import {
  parseOwnership, serializeOwnership, migrateLegacyOwnership, ownershipFromRow,
  shareFor, totalShare, viewerShare, ensurePrimaryPerson, ownershipLabel, auditOwnership,
  accountsVisibleToViewer, HOUSEHOLD_VIEWER,
} from '@/shared/utils/ownership';
import type { Account, OptionCompany, Person } from '@/types/sheets';

describe('parseOwnership', () => {
  it('parses a JSON string of entries', () => {
    expect(parseOwnership('[{"person_id":"self","share":0.5}]')).toEqual([{ person_id: 'self', share: 0.5 }]);
  });

  it('parses an already-parsed array', () => {
    expect(parseOwnership([{ person_id: 'self', share: 1 }])).toEqual([{ person_id: 'self', share: 1 }]);
  });

  it('drops entries with a missing person_id or non-finite share', () => {
    expect(parseOwnership([{ person_id: '', share: 1 }, { person_id: 'self', share: NaN }])).toEqual([]);
  });

  it('drops entries with a negative share', () => {
    expect(parseOwnership([{ person_id: 'self', share: -0.5 }, { person_id: 'partner', share: 0.5 }]))
      .toEqual([{ person_id: 'partner', share: 0.5 }]);
  });

  it('returns [] for empty, blank, or malformed input', () => {
    expect(parseOwnership('')).toEqual([]);
    expect(parseOwnership('   ')).toEqual([]);
    expect(parseOwnership('not json')).toEqual([]);
    expect(parseOwnership(undefined)).toEqual([]);
    expect(parseOwnership(null)).toEqual([]);
  });
});

describe('serializeOwnership', () => {
  it('round-trips through parseOwnership', () => {
    const entries = [{ person_id: 'self', share: 0.5 }, { person_id: 'partner', share: 0.5 }];
    expect(parseOwnership(serializeOwnership(entries))).toEqual(entries);
  });
});

describe('migrateLegacyOwnership', () => {
  it('"joint" owner splits self/partner by the legacy ownership_share', () => {
    expect(migrateLegacyOwnership('joint', 0.5)).toEqual([
      { person_id: 'self', share: 0.5 },
      { person_id: 'partner', share: 0.5 },
    ]);
    expect(migrateLegacyOwnership('joint', 0.3)).toEqual([
      { person_id: 'self', share: 0.3 },
      { person_id: 'partner', share: 0.7 },
    ]);
  });

  it('a non-joint owner gets 100% regardless of the legacy share value', () => {
    expect(migrateLegacyOwnership('self', 1)).toEqual([{ person_id: 'self', share: 1 }]);
    expect(migrateLegacyOwnership('partner', 0.25)).toEqual([{ person_id: 'partner', share: 1 }]);
  });

  it('clamps an out-of-range joint share into [0, 1]', () => {
    expect(migrateLegacyOwnership('joint', 5)).toEqual([
      { person_id: 'self', share: 1 },
      { person_id: 'partner', share: 0 },
    ]);
    expect(migrateLegacyOwnership('joint', -5)).toEqual([
      { person_id: 'self', share: 0 },
      { person_id: 'partner', share: 1 },
    ]);
  });

  it('defaults to a full self share when owner/share are missing', () => {
    expect(migrateLegacyOwnership(undefined, undefined)).toEqual([{ person_id: 'self', share: 1 }]);
  });
});

describe('ownershipFromRow', () => {
  it('prefers a populated `ownership` field over legacy owner/ownership_share', () => {
    const row = { ownership: '[{"person_id":"partner","share":1}]', owner: 'self', ownership_share: 1 };
    expect(ownershipFromRow(row)).toEqual([{ person_id: 'partner', share: 1 }]);
  });

  it('falls back to migrating legacy owner/ownership_share when `ownership` is empty', () => {
    const row = { ownership: '', owner: 'joint', ownership_share: 0.5 };
    expect(ownershipFromRow(row)).toEqual([
      { person_id: 'self', share: 0.5 },
      { person_id: 'partner', share: 0.5 },
    ]);
  });
});

describe('shareFor / totalShare', () => {
  const ownership = [{ person_id: 'self', share: 0.5 }, { person_id: 'self', share: 0.25 }, { person_id: 'partner', share: 0.25 }];

  it('sums all entries for a given person', () => {
    expect(shareFor(ownership, 'self')).toBe(0.75);
    expect(shareFor(ownership, 'partner')).toBe(0.25);
  });

  it('returns 0 for a person with no entries', () => {
    expect(shareFor(ownership, 'nobody')).toBe(0);
  });

  it('sums every entry regardless of owner', () => {
    expect(totalShare(ownership)).toBe(1);
  });
});

describe('viewerShare', () => {
  const ownership = [{ person_id: 'self', share: 0.6 }, { person_id: 'partner', share: 0.4 }];

  it('returns a single person\'s share when the viewer is a person id', () => {
    expect(viewerShare(ownership, 'self')).toBe(0.6);
    expect(viewerShare(ownership, 'partner')).toBe(0.4);
  });

  it('returns 0 for a person with no ownership entry', () => {
    expect(viewerShare(ownership, 'nobody')).toBe(0);
  });

  it('returns the combined total for HOUSEHOLD_VIEWER', () => {
    expect(viewerShare(ownership, HOUSEHOLD_VIEWER)).toBe(1);
  });

  it('HOUSEHOLD_VIEWER reflects partial combined ownership', () => {
    expect(viewerShare([{ person_id: 'self', share: 0.5 }], HOUSEHOLD_VIEWER)).toBe(0.5);
  });
});

describe('accountsVisibleToViewer', () => {
  const mkAccount = (over: Partial<Account>): Account => ({
    id: 'a1', type: 'tfsa', name_fr: 'A', name_en: 'A', category: 'investments', kind: 'asset',
    ownership: [{ person_id: 'self', share: 1 }], active: true, sort_order: 0, tags: [], annual_rate: 0, ...over,
  });

  it('excludes accounts the viewer has 0% ownership of', () => {
    const accounts = [
      mkAccount({ id: 'mine', ownership: [{ person_id: 'self', share: 1 }] }),
      mkAccount({ id: 'theirs', ownership: [{ person_id: 'partner', share: 1 }] }),
    ];
    expect(accountsVisibleToViewer(accounts, 'self').map(a => a.id)).toEqual(['mine']);
  });

  it('includes accounts with a partial share', () => {
    const accounts = [mkAccount({ id: 'joint', ownership: [{ person_id: 'self', share: 0.5 }, { person_id: 'partner', share: 0.5 }] })];
    expect(accountsVisibleToViewer(accounts, 'self').map(a => a.id)).toEqual(['joint']);
  });

  it('includes every account with any owner for HOUSEHOLD_VIEWER', () => {
    const accounts = [
      mkAccount({ id: 'self-owned', ownership: [{ person_id: 'self', share: 1 }] }),
      mkAccount({ id: 'partner-owned', ownership: [{ person_id: 'partner', share: 1 }] }),
    ];
    expect(accountsVisibleToViewer(accounts, HOUSEHOLD_VIEWER).map(a => a.id)).toEqual(['self-owned', 'partner-owned']);
  });
});

describe('ensurePrimaryPerson', () => {
  const mkPerson = (over: Partial<Person>): Person =>
    ({ id: 'x', name: 'X', sort_order: 0, active: true, primary: false, ...over });

  it('leaves the list unchanged when someone is already primary', () => {
    const people = [mkPerson({ id: 'self', primary: true }), mkPerson({ id: 'partner' })];
    expect(ensurePrimaryPerson(people)).toBe(people);
  });

  it('returns [] unchanged for an empty list', () => {
    expect(ensurePrimaryPerson([])).toEqual([]);
  });

  it('flags "self" as primary when no one is flagged and self is present', () => {
    const people = [mkPerson({ id: 'partner' }), mkPerson({ id: 'self' })];
    const result = ensurePrimaryPerson(people);
    expect(result.find(p => p.id === 'self')?.primary).toBe(true);
    expect(result.find(p => p.id === 'partner')?.primary).toBe(false);
  });

  it('falls back to the first person when "self" is not present', () => {
    const people = [mkPerson({ id: 'alice' }), mkPerson({ id: 'bob' })];
    const result = ensurePrimaryPerson(people);
    expect(result.find(p => p.id === 'alice')?.primary).toBe(true);
    expect(result.find(p => p.id === 'bob')?.primary).toBe(false);
  });
});

describe('ownershipLabel', () => {
  const people: Person[] = [
    { id: 'self', name: 'Me', sort_order: 10, active: true, primary: true },
    { id: 'partner', name: 'Partner', sort_order: 20, active: true, primary: false },
  ];

  it('returns the jointFallback for an empty ownership array', () => {
    expect(ownershipLabel([], people, 'Joint')).toBe('Joint');
  });

  it('returns just the name for a single full owner', () => {
    expect(ownershipLabel([{ person_id: 'self', share: 1 }], people, 'Joint')).toBe('Me');
  });

  it('returns "Name pct% · Name pct%" for a split ownership', () => {
    expect(ownershipLabel([{ person_id: 'self', share: 0.5 }, { person_id: 'partner', share: 0.5 }], people, 'Joint'))
      .toBe('Me 50% · Partner 50%');
  });

  it('falls back to the raw person_id when the person is unknown', () => {
    expect(ownershipLabel([{ person_id: 'ghost', share: 1 }], people, 'Joint')).toBe('ghost');
  });
});

describe('auditOwnership', () => {
  const people: Person[] = [
    { id: 'self', name: 'Me', sort_order: 10, active: true, primary: true },
    { id: 'partner', name: 'Partner', sort_order: 20, active: true, primary: false },
  ];

  const mkAccount = (over: Partial<Account>): Account => ({
    id: 'a1', type: 'tfsa', name_fr: 'A', name_en: 'A', category: 'investments', kind: 'asset',
    ownership: [{ person_id: 'self', share: 1 }], active: true, sort_order: 0, tags: [], annual_rate: 0, ...over,
  });

  const mkCompany = (over: Partial<OptionCompany>): OptionCompany => ({
    id: 'c1', name: 'ACME', ticker: '', active: true, tags: [], owner: 'self', ...over,
  });

  it('returns no issues for fully balanced, known ownership', () => {
    expect(auditOwnership([mkAccount({})], [mkCompany({})], people)).toEqual([]);
  });

  it('flags an active account whose shares don\'t sum to 100%', () => {
    const account = mkAccount({ ownership: [{ person_id: 'self', share: 0.6 }] });
    expect(auditOwnership([account], [], people)).toEqual([
      { kind: 'unbalanced_account', accountId: 'a1', pct: 60 },
    ]);
  });

  it('ignores archived accounts entirely', () => {
    const account = mkAccount({ active: false, ownership: [{ person_id: 'self', share: 0.5 }] });
    expect(auditOwnership([account], [], people)).toEqual([]);
  });

  it('flags an active account referencing an unknown or archived person', () => {
    const account = mkAccount({ ownership: [{ person_id: 'ghost', share: 1 }] });
    expect(auditOwnership([account], [], people)).toEqual([
      { kind: 'unknown_account_owner', accountId: 'a1', personId: 'ghost' },
    ]);
  });

  it('flags an active option company owned by an unknown or archived person', () => {
    const company = mkCompany({ owner: 'ghost' });
    expect(auditOwnership([], [company], people)).toEqual([
      { kind: 'unknown_company_owner', companyId: 'c1', personId: 'ghost' },
    ]);
  });

  it('ignores archived option companies', () => {
    const company = mkCompany({ active: false, owner: 'ghost' });
    expect(auditOwnership([], [company], people)).toEqual([]);
  });
});
