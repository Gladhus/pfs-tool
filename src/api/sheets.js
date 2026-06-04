import { state } from '../core/state.js';

// Wraps a gapi call: on HTTP 401, silently refreshes the token once and retries.
// Usage: await gapiCall(() => gapi.client.sheets.spreadsheets.values.get(...))
export function gapiCall(fn) {
  return fn().catch(err => {
    if ((err?.status ?? err?.result?.error?.code) !== 401) throw err;
    return new Promise((resolve, reject) => {
      if (!state.tokenClient) { reject(err); return; }
      const prev = state.tokenClient.callback;
      state.tokenClient.callback = (resp) => {
        state.tokenClient.callback = prev;
        if (resp.error) { reject(new Error('Token refresh failed: ' + resp.error)); return; }
        gapi.client.setToken({ access_token: resp.access_token });
        fn().then(resolve, reject);
      };
      state.tokenClient.requestAccessToken({ prompt: '' });
    });
  });
}

// Atomically replace a sheet tab's data without a clear-then-write window.
// Writes the new rows first (sheet is never empty), then clears only the
// trailing rows that remain from the previous, potentially larger dataset.
//
// previousRowCount: the number of data rows (excluding header) before this
// write — callers pass state.xxx.length so we know how many rows existed.
export async function safeWriteTab(tabName, allRows, previousRowCount) {
  await gapiCall(() => gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: state.sheetId,
    range: `${tabName}!A1`,
    valueInputOption: 'RAW',
    resource: { values: allRows },
  }));

  // Clear trailing stale rows left over from a previously larger dataset.
  const newRowCount = allRows.length; // includes header
  const oldTotalRows = previousRowCount + 1; // +1 for header
  if (oldTotalRows > newRowCount) {
    const firstStaleRow = newRowCount + 1;
    const lastStaleRow  = oldTotalRows;
    await gapiCall(() => gapi.client.sheets.spreadsheets.values.clear({
      spreadsheetId: state.sheetId,
      range: `${tabName}!A${firstStaleRow}:Z${lastStaleRow}`,
    }));
  }
}
