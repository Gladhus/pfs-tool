import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockState = { tokenClient: null, sheetId: 'sheet-1' };
vi.mock('../core/state.js', () => ({ state: mockState }));

const state = mockState;
const { gapiCall } = await import('../api/sheets.js');

// A gapi.client request is a *thenable* — it implements `.then` but NOT `.catch`.
// This shim mimics that so we catch any regression where gapiCall assumes the
// result is a full Promise (the v1.9.1 bug that surfaced as "No internet
// connection." on every load).
function gapiThenable(resolveValue, rejectValue) {
  return {
    then(onFulfilled, onRejected) {
      return Promise.resolve().then(() => {
        if (rejectValue !== undefined) {
          if (onRejected) return onRejected(rejectValue);
          throw rejectValue;
        }
        return onFulfilled ? onFulfilled(resolveValue) : resolveValue;
      });
    },
    // deliberately NO `.catch` — matches the real gapi request object
  };
}

beforeEach(() => {
  state.tokenClient = null;
});

describe('gapiCall — thenable handling', () => {
  it('resolves a successful gapi thenable (no .catch on the request)', async () => {
    const resp = { result: { values: [['a']] } };
    const out = await gapiCall(() => gapiThenable(resp));
    expect(out).toBe(resp);
  });

  it('does not throw "catch is not a function" on the success path', async () => {
    // Regression guard: calling `.catch()` on the thenable would throw a
    // TypeError synchronously. Assert we get the value, not a TypeError.
    await expect(gapiCall(() => gapiThenable('ok'))).resolves.toBe('ok');
  });

  it('rethrows non-401 errors unchanged', async () => {
    const err = { status: 500, message: 'boom' };
    await expect(gapiCall(() => gapiThenable(undefined, err))).rejects.toBe(err);
  });

  it('rejects a 401 when there is no tokenClient to refresh with', async () => {
    const err = { status: 401 };
    await expect(gapiCall(() => gapiThenable(undefined, err))).rejects.toBe(err);
  });

  it('refreshes the token and retries once on 401', async () => {
    let calls = 0;
    state.tokenClient = {
      callback: null,
      requestAccessToken() {
        // simulate GIS invoking the callback with a fresh token
        this.callback({ access_token: 'new-token' });
      },
    };
    globalThis.gapi = { client: { setToken: vi.fn() } };

    const out = await gapiCall(() => {
      calls += 1;
      return calls === 1
        ? gapiThenable(undefined, { status: 401 })   // first call: 401
        : gapiThenable({ ok: true });                // retry: success
    });

    expect(calls).toBe(2);
    expect(out).toEqual({ ok: true });
    expect(globalThis.gapi.client.setToken).toHaveBeenCalledWith({ access_token: 'new-token' });
  });
});
