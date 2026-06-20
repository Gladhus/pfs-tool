import { describe, it, expect, vi } from 'vitest';
import { loadPeopleCatalog } from '@/shared/io/api/people';
import { DEFAULT_PEOPLE } from '@/constants';

function mockGapi({ getResult, getError }: { getResult?: unknown[][]; getError?: unknown }) {
  const get = vi.fn(() => getError ? Promise.reject(getError) : Promise.resolve({ result: { values: getResult } }));
  const update = vi.fn(() => Promise.resolve({}));
  const clear = vi.fn(() => Promise.resolve({}));
  const batchUpdate = vi.fn(() => Promise.resolve({}));
  (globalThis as unknown as { gapi: typeof gapi }).gapi = {
    client: {
      sheets: {
        spreadsheets: {
          values: { get, update, clear },
          batchUpdate,
        },
      },
    },
  } as unknown as typeof gapi;
  return { get, update, clear, batchUpdate };
}

describe('loadPeopleCatalog', () => {
  it('parses existing rows, including the primary column', async () => {
    mockGapi({
      getResult: [
        ['id', 'name', 'email', 'color', 'sort_order', 'active', 'primary'],
        ['self', 'Me', '', '', '10', 'TRUE', 'TRUE'],
        ['partner', 'Partner', '', '', '20', 'TRUE', 'FALSE'],
      ],
    });
    const people = await loadPeopleCatalog('sheet1');
    expect(people).toEqual([
      { id: 'self', name: 'Me', email: undefined, color: undefined, sort_order: 10, active: true, primary: true },
      { id: 'partner', name: 'Partner', email: undefined, color: undefined, sort_order: 20, active: true, primary: false },
    ]);
  });

  it('backfills `primary` on "self" for rows written before that column existed', async () => {
    mockGapi({
      getResult: [
        ['id', 'name', 'email', 'color', 'sort_order', 'active'],
        ['self', 'Me', '', '', '10', 'TRUE'],
        ['partner', 'Partner', '', '', '20', 'TRUE'],
      ],
    });
    const people = await loadPeopleCatalog('sheet1');
    expect(people.find(p => p.id === 'self')?.primary).toBe(true);
    expect(people.find(p => p.id === 'partner')?.primary).toBe(false);
  });

  it('seeds defaults when the people tab exists but has no data rows', async () => {
    const { update } = mockGapi({ getResult: [['id', 'name', 'email', 'color', 'sort_order', 'active', 'primary']] });
    const people = await loadPeopleCatalog('sheet1');
    expect(people).toEqual(DEFAULT_PEOPLE);
    expect(update).toHaveBeenCalled();
  });

  it('seeds defaults when the people tab is missing (400 "Unable to parse range")', async () => {
    const { batchUpdate, update } = mockGapi({ getError: { status: 400, message: 'Unable to parse range: people!A:Z' } });
    const people = await loadPeopleCatalog('sheet1');
    expect(people).toEqual(DEFAULT_PEOPLE);
    expect(batchUpdate).toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
  });

  it('also recognizes a 400 reported via result.error.code', async () => {
    const { update } = mockGapi({ getError: { result: { error: { code: 400 } } } });
    const people = await loadPeopleCatalog('sheet1');
    expect(people).toEqual(DEFAULT_PEOPLE);
    expect(update).toHaveBeenCalled();
  });

  it('rethrows a transient 5xx error instead of overwriting real data with defaults', async () => {
    const { update } = mockGapi({ getError: { status: 500, message: 'boom' } });
    await expect(loadPeopleCatalog('sheet1')).rejects.toMatchObject({ status: 500 });
    expect(update).not.toHaveBeenCalled();
  });

  it('rethrows a 429 rate-limit error instead of overwriting real data with defaults', async () => {
    const err = { result: { error: { code: 429 } } };
    const { update } = mockGapi({ getError: err });
    await expect(loadPeopleCatalog('sheet1')).rejects.toBe(err);
    expect(update).not.toHaveBeenCalled();
  });
});
