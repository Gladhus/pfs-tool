/// <reference types="vite/client" />
// Minimal type declarations for Google APIs loaded via CDN scripts

declare global {

interface GapiClientSheets {
  spreadsheets: {
    get(params: { spreadsheetId: string; fields?: string }): Promise<{ result: unknown }>;
    create(params: { resource: unknown; fields?: string }): Promise<{ result: { spreadsheetId: string } }>;
    batchUpdate(params: { spreadsheetId: string; resource: unknown }): Promise<{ result: unknown }>;
    values: {
      get(params: {
        spreadsheetId: string;
        range: string;
        valueRenderOption?: string;
        dateTimeRenderOption?: string;
      }): Promise<{ result: { values?: unknown[][] } }>;
      update(params: {
        spreadsheetId: string;
        range: string;
        valueInputOption: string;
        resource: { values: unknown[][] };
      }): Promise<{ result: unknown }>;
      append(params: {
        spreadsheetId: string;
        range: string;
        valueInputOption: string;
        insertDataOption?: string;
        resource: { values: unknown[][] };
      }): Promise<{ result: unknown }>;
      clear(params: { spreadsheetId: string; range: string }): Promise<{ result: unknown }>;
      batchUpdate(params: {
        spreadsheetId: string;
        resource: {
          valueInputOption: string;
          data: Array<{ range: string; values: unknown[][] }>;
        };
      }): Promise<{ result: unknown }>;
    };
  };
}

interface GapiClientDrive {
  files: {
    list(params: {
      q?: string;
      fields?: string;
      orderBy?: string;
      pageSize?: number;
    }): Promise<{ result: { files?: Array<{ id: string; name: string; modifiedTime?: string }> } }>;
  };
}

interface GapiClient {
  init(config: { discoveryDocs: string[] }): Promise<void>;
  setToken(token: { access_token: string } | null): void;
  sheets: GapiClientSheets;
  drive: GapiClientDrive;
}

interface Gapi {
  load(lib: string, callback: () => void): void;
  client: GapiClient;
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: {
    access_token?: string;
    expires_in?: string | number;
    error?: string;
  }) => void;
  error_callback?: (error: unknown) => void;
}

interface TokenClient {
  requestAccessToken(opts: { prompt?: string; login_hint?: string }): void;
}

interface PFSConfig {
  CLIENT_ID: string;
  SCOPES: string;
  LANGUAGE: string;
  CURRENCY: string;
  SHEET_TITLE: string;
}

  interface Window {
    PFS_CONFIG: PFSConfig;
  }
  const gapi: Gapi;
  const google: {
    accounts: {
      oauth2: {
        initTokenClient(config: TokenClientConfig): TokenClient;
        revoke(token: string, callback: () => void): void;
      };
    };
  };
}

export {};
