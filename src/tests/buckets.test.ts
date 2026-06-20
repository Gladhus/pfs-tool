import { describe, it, expect } from 'vitest';
import { categoryStrategy, groupStrategy, personStrategy, bucketStrategy } from '@/core/buckets';
import type { BucketModels } from '@/core/buckets';
import type { Contribution, Group } from '@/types/sheets';
import { CATEGORY_META, GROUPS, PEOPLE } from './fixtures/portfolio';

const models = (over: Partial<BucketModels> = {}): BucketModels => ({
  categoryMeta: CATEGORY_META,
  groups: GROUPS,
  people: PEOPLE.filter(p => p.active),
  hasEquity: true,
  tr: (e) => e.name_en ?? e.name_fr ?? '',
  ...over,
});

const c = (over: Partial<Contribution>): Contribution => ({
  amount: 100, category: 'investments', ownerId: 'self', sourceId: 'x', ...over,
});

describe('categoryStrategy', () => {
  it('builds folded category buckets, with equity appended last when present', () => {
    expect(categoryStrategy(models()).buckets.map(b => b.key))
      .toEqual(['investments', 'cash', 'real_estate', 'equity']); // real_estate_debt folded out
  });

  it('omits the equity bucket when there is no equity', () => {
    expect(categoryStrategy(models({ hasEquity: false })).buckets.map(b => b.key))
      .toEqual(['investments', 'cash', 'real_estate']);
  });

  it('assigns by folded category (real_estate_debt → real_estate)', () => {
    const s = categoryStrategy(models());
    expect(s.assign(c({ category: 'investments' }))).toEqual([{ bucketKey: 'investments', amount: 100 }]);
    expect(s.assign(c({ category: 'real_estate_debt', amount: -40 })))
      .toEqual([{ bucketKey: 'real_estate', amount: -40 }]);
  });

  it('routes equity contributions to the equity bucket — or drops them when absent', () => {
    expect(categoryStrategy(models()).assign(c({ category: 'equity', amount: 50 })))
      .toEqual([{ bucketKey: 'equity', amount: 50 }]);
    expect(categoryStrategy(models({ hasEquity: false })).assign(c({ category: 'equity', amount: 50 })))
      .toEqual([]);
  });
});

describe('groupStrategy', () => {
  it('builds a bucket per group', () => {
    expect(groupStrategy(models()).buckets.map(b => b.key)).toEqual(['group:Tech']);
  });

  it('assigns by tag match and drops non-matching contributions', () => {
    const s = groupStrategy(models());
    expect(s.assign(c({ tags: ['tech'] }))).toEqual([{ bucketKey: 'group:Tech', amount: 100 }]);
    expect(s.assign(c({ tags: ['other'] }))).toEqual([]);
    expect(s.assign(c({ tags: undefined }))).toEqual([]);
  });

  it('assigns one contribution to every matching group', () => {
    const groups: Group[] = [
      { name: 'Tech', color: '', all: [], any: ['tech'], exclude: [] },
      { name: 'Taxable', color: '', all: [], any: ['tech'], exclude: [] },
    ];
    expect(groupStrategy(models({ groups })).assign(c({ tags: ['tech'], amount: 7 })))
      .toEqual([{ bucketKey: 'group:Tech', amount: 7 }, { bucketKey: 'group:Taxable', amount: 7 }]);
  });
});

describe('personStrategy', () => {
  it('builds a bucket per active person', () => {
    expect(personStrategy(models()).buckets.map(b => b.key)).toEqual(['person:self', 'person:partner']);
  });

  it('assigns by ownerId and drops contributions owned by no listed person', () => {
    const s = personStrategy(models());
    expect(s.assign(c({ ownerId: 'partner', amount: 25 }))).toEqual([{ bucketKey: 'person:partner', amount: 25 }]);
    expect(s.assign(c({ ownerId: 'ghost' }))).toEqual([]);
  });
});

describe('bucketStrategy selector', () => {
  it('dispatches to the right strategy by view', () => {
    expect(bucketStrategy('category', models()).buckets.some(b => b.catId)).toBe(true);
    expect(bucketStrategy('group', models()).buckets[0].key).toBe('group:Tech');
    expect(bucketStrategy('person', models()).buckets[0].personId).toBe('self');
  });
});
