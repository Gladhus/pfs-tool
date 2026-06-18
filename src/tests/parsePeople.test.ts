import { describe, it, expect } from 'vitest';
import { parsePeopleRows, serializePeople, parseAccountRows, serializeAccounts } from '@/datasource/parse';
import type { Person, Account } from '@/types/sheets';

describe('parsePeopleRows / serializePeople', () => {
  const people: Person[] = [
    { id: 'self', name: 'Me', email: 'me@example.com', color: '#fff', sort_order: 10, active: true, primary: true },
    { id: 'partner', name: 'Partner', sort_order: 20, active: false, primary: false },
  ];

  it('round-trips a list of people through serialize → parse', () => {
    const rows = serializePeople(people);
    const parsed = parsePeopleRows(rows);
    expect(parsed).toEqual([
      { id: 'self', name: 'Me', email: 'me@example.com', color: '#fff', sort_order: 10, active: true, primary: true },
      { id: 'partner', name: 'Partner', email: undefined, color: undefined, sort_order: 20, active: false, primary: false },
    ]);
  });

  it('defaults `primary` to false for legacy rows missing that column', () => {
    const rows = [
      ['id', 'name', 'email', 'color', 'sort_order', 'active'],
      ['self', 'Me', '', '', '10', 'TRUE'],
    ];
    expect(parsePeopleRows(rows)).toEqual([
      { id: 'self', name: 'Me', email: undefined, color: undefined, sort_order: 10, active: true, primary: false },
    ]);
  });

  it('drops rows with no id and returns [] for headers-only input', () => {
    expect(parsePeopleRows([['id', 'name', 'email', 'color', 'sort_order', 'active', 'primary']])).toEqual([]);
    const rows = [
      ['id', 'name', 'email', 'color', 'sort_order', 'active', 'primary'],
      ['', 'Nobody', '', '', '0', 'TRUE', 'FALSE'],
    ];
    expect(parsePeopleRows(rows)).toEqual([]);
  });
});

describe('parseAccountRows ownership handling', () => {
  const mkRows = (extraHeaders: string[], extraRow: string[]) => [
    ['id', 'type', 'name_fr', 'name_en', 'category', 'kind', 'active', 'sort_order', 'tags', 'annual_rate', ...extraHeaders],
    ['a1', 'tfsa', 'CELI', 'TFSA', 'investments', 'asset', 'TRUE', '10', '', '0', ...extraRow],
  ];

  it('uses the `ownership` column when present', () => {
    const rows = mkRows(['ownership'], ['[{"person_id":"partner","share":1}]']);
    const [account] = parseAccountRows(rows);
    expect(account.ownership).toEqual([{ person_id: 'partner', share: 1 }]);
  });

  it('migrates legacy owner/ownership_share columns when `ownership` is absent', () => {
    const rows = mkRows(['owner', 'ownership_share'], ['joint', '0.5']);
    const [account] = parseAccountRows(rows);
    expect(account.ownership).toEqual([
      { person_id: 'self', share: 0.5 },
      { person_id: 'partner', share: 0.5 },
    ]);
  });

  it('round-trips ownership through serializeAccounts → parseAccountRows', () => {
    const account: Account = {
      id: 'a1', type: 'tfsa', name_fr: 'CELI', name_en: 'TFSA', category: 'investments', kind: 'asset',
      ownership: [{ person_id: 'self', share: 0.5 }, { person_id: 'partner', share: 0.5 }],
      active: true, sort_order: 10, tags: [], annual_rate: 0,
    };
    const rows = serializeAccounts([account]);
    const [parsed] = parseAccountRows(rows);
    expect(parsed.ownership).toEqual(account.ownership);
  });
});
