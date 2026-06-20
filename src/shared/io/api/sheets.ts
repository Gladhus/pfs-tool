// gapi thenables have .then but NOT .catch — always use `await`, never .catch().

let _tokenClient: { requestAccessToken(opts: { prompt: string }): void; callback: unknown } | null = null;

/** Called by AuthProvider once GIS is initialized. */
export function setGapiTokenClient(tc: typeof _tokenClient): void {
  _tokenClient = tc;
}

/** Extracts the HTTP status code from a thrown gapi error, if any. */
export function gapiErrorStatus(err: unknown): number | undefined {
  return (err as { status?: number })?.status ??
    (err as { result?: { error?: { code?: number } } })?.result?.error?.code;
}

/** Wraps a gapi request: on 401 silently refreshes the token once and retries. */
export async function gapiCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const status = gapiErrorStatus(err);
    if (status !== 401) throw err;
    return await new Promise<T>((resolve, reject) => {
      if (!_tokenClient) { reject(err); return; }
      const prev = (_tokenClient as { callback: unknown }).callback;
      (_tokenClient as { callback: unknown }).callback = (resp: { access_token?: string; error?: string }) => {
        (_tokenClient as { callback: unknown }).callback = prev;
        if (resp.error) { reject(new Error('Token refresh failed: ' + resp.error)); return; }
        gapi.client.setToken({ access_token: resp.access_token! });
        Promise.resolve(fn()).then(resolve, reject);
      };
      _tokenClient.requestAccessToken({ prompt: '' });
    });
  }
}

/**
 * Atomically replace a tab's data without a clear-then-write window.
 * previousRowCount: data rows EXCLUDING header (pass queryClient cache length).
 */
export async function safeWriteTab(
  sheetId: string,
  tabName: string,
  allRows: unknown[][],
  previousRowCount: number,
): Promise<void> {
  await gapiCall(() => gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${tabName}!A1`,
    valueInputOption: 'RAW',
    resource: { values: allRows as string[][] },
  }));
  const newRowCount = allRows.length;
  const oldTotalRows = previousRowCount + 1;
  if (oldTotalRows > newRowCount) {
    await gapiCall(() => gapi.client.sheets.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range: `${tabName}!A${newRowCount + 1}:Z${oldTotalRows}`,
    }));
  }
}
