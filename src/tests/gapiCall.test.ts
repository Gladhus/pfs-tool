import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gapiCall, setGapiTokenClient } from '@/api/sheets';

function gapiThenable<T>(resolveValue?: T, rejectValue?: unknown) {
  return {
    then(onFulfilled?: (v: T) => unknown, onRejected?: (e: unknown) => unknown) {
      return Promise.resolve().then(() => {
        if (rejectValue !== undefined) {
          if (onRejected) return onRejected(rejectValue);
          throw rejectValue;
        }
        return onFulfilled ? onFulfilled(resolveValue as T) : resolveValue;
      });
    },
    // deliberately NO .catch — matches real gapi request object
  };
}

beforeEach(() => {
  setGapiTokenClient(null);
});

describe('gapiCall — thenable handling', () => {
  it('resolves a successful gapi thenable (no .catch on the request)', async () => {
    const resp = { result: { values: [['a']] } };
    const out = await gapiCall(() => gapiThenable(resp) as Promise<typeof resp>);
    expect(out).toBe(resp);
  });

  it('does not throw "catch is not a function" on the success path', async () => {
    await expect(gapiCall(() => gapiThenable('ok') as Promise<string>)).resolves.toBe('ok');
  });

  it('rethrows non-401 errors unchanged', async () => {
    const err = { status: 500, message: 'boom' };
    await expect(gapiCall(() => gapiThenable(undefined, err) as Promise<never>)).rejects.toBe(err);
  });

  it('rejects a 401 when there is no tokenClient to refresh with', async () => {
    const err = { status: 401 };
    await expect(gapiCall(() => gapiThenable(undefined, err) as Promise<never>)).rejects.toBe(err);
  });

  it('refreshes the token and retries once on 401', async () => {
    let calls = 0;
    const fakeClient = {
      callback: null as unknown,
      requestAccessToken() {
        (this.callback as (r: { access_token: string }) => void)({ access_token: 'new-token' });
      },
    };
    setGapiTokenClient(fakeClient as Parameters<typeof setGapiTokenClient>[0]);
    globalThis.gapi = { client: { setToken: vi.fn() } } as unknown as typeof gapi;

    const out = await gapiCall(() => {
      calls += 1;
      return (calls === 1
        ? gapiThenable(undefined, { status: 401 })
        : gapiThenable({ ok: true })) as Promise<{ ok: boolean }>;
    });

    expect(calls).toBe(2);
    expect(out).toEqual({ ok: true });
    expect((globalThis.gapi.client as unknown as { setToken: ReturnType<typeof vi.fn> }).setToken)
      .toHaveBeenCalledWith({ access_token: 'new-token' });
  });
});
