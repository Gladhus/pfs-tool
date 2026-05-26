// PFS Tool — runtime configuration.
// Edit this file once you've followed docs/SETUP.md.

window.PFS_CONFIG = {
  // Paste your Google OAuth 2.0 Client ID here (from Google Cloud Console).
  // See docs/SETUP.md.
  CLIENT_ID: "90763525172-0a05k5ejqn2rsgnt148g4evu25an4bb8.apps.googleusercontent.com",

  // Scopes the app requests. spreadsheets = read/write any sheet the user grants;
  // drive.file = create new sheets the app owns (much safer than full drive scope).
  SCOPES: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",

  // UI language: "fr" or "en". Account display labels respect this.
  LANGUAGE: "fr",

  // Currency code, display only.
  CURRENCY: "CAD",

  // Title of the spreadsheet the app creates on first run.
  SHEET_TITLE: "PFS Tool — Bilan financier"
};
