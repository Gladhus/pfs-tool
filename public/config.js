// PFS Tool — runtime configuration.
// Edit this file once you've followed docs/SETUP.md.

window.PFS_CONFIG = {
  // Paste your Google OAuth 2.0 Client ID here (from Google Cloud Console).
  // See docs/SETUP.md.
  CLIENT_ID: "90763525172-0a05k5ejqn2rsgnt148g4evu25an4bb8.apps.googleusercontent.com",

  // drive.file: read/write only files this app created or that the user explicitly
  // opened via picker. Much safer than the broad `spreadsheets` scope which grants
  // access to every sheet in the account.
  SCOPES: "https://www.googleapis.com/auth/drive.file",

  // UI language: "fr" or "en". Account display labels respect this.
  LANGUAGE: "fr",

  // Currency code, display only.
  CURRENCY: "CAD",

  // Title of the spreadsheet the app creates on first run.
  SHEET_TITLE: "PFS Tool — Bilan financier"
};
