import { describe, it, expect } from 'vitest';
import { resolveFilterSpec } from '@/core/filters';
import { HOUSEHOLD_VIEWER } from '@/utils/ownership';

const params = (q: string) => new URLSearchParams(q);

describe('resolveFilterSpec', () => {
  it('defaults period to "all" and account to "" when the URL is empty', () => {
    const spec = resolveFilterSpec(params(''), { viewer: 'self' });
    expect(spec).toEqual({
      viewer: 'self', period: 'all', view: 'category', accountId: '', includeInactive: false,
    });
  });

  it('honours an explicit defaultPeriod when the URL omits period', () => {
    expect(resolveFilterSpec(params(''), { viewer: 'self', defaultPeriod: '1y' }).period).toBe('1y');
  });

  it('reads period and account from the URL', () => {
    const spec = resolveFilterSpec(params('period=ytd&account=tfsa_1'), { viewer: 'self' });
    expect(spec.period).toBe('ytd');
    expect(spec.accountId).toBe('tfsa_1');
  });

  it('keeps the "person" view for the household viewer', () => {
    expect(resolveFilterSpec(params(''), { viewer: HOUSEHOLD_VIEWER, view: 'person' }).view).toBe('person');
  });

  it('falls back "person" → "category" for an individual viewer', () => {
    expect(resolveFilterSpec(params(''), { viewer: 'self', view: 'person' }).view).toBe('category');
  });

  it('passes category/group views through unchanged for any viewer', () => {
    expect(resolveFilterSpec(params(''), { viewer: 'self', view: 'group' }).view).toBe('group');
    expect(resolveFilterSpec(params(''), { viewer: HOUSEHOLD_VIEWER, view: 'category' }).view).toBe('category');
  });

  it('threads includeInactive through', () => {
    expect(resolveFilterSpec(params(''), { viewer: 'self', includeInactive: true }).includeInactive).toBe(true);
  });
});
