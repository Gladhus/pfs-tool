import { describe, it, expect } from 'vitest';
import { parseAccountRows, parseSnapshotRows } from '@/shared/io/datasource/parse';

// A malicious XLSX/Sheet can name a column `__proto__` (or constructor/prototype).
// Parsing it must never mutate Object.prototype.
describe('parse — prototype pollution guard', () => {
  it('ignores a __proto__ header without polluting Object.prototype', () => {
    parseAccountRows([
      ['id', 'name_en', '__proto__'],
      ['a1', 'Checking', '{"polluted":true}'],
    ]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('ignores constructor/prototype headers in snapshots', () => {
    const before = Object.prototype.toString;
    parseSnapshotRows([
      ['date', 'account_id', 'balance_raw', 'constructor', 'prototype'],
      ['2024-01-01', 'a1', '100', 'x', 'y'],
    ]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.prototype.toString).toBe(before);
  });

  it('still parses legitimate columns normally', () => {
    const [acct] = parseAccountRows([
      ['id', 'name_en', 'active'],
      ['a1', 'Checking', 'TRUE'],
    ]);
    expect(acct.id).toBe('a1');
    expect(acct.active).toBe(true);
  });
});
