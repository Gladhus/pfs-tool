# PFS Tool — Personal Financial Statement

A small, portable web app for capturing a monthly snapshot of your net worth and watching it progress over time. Data lives in **your own Google Sheet**; the app is a static HTML/JS frontend that talks to Google Sheets via OAuth. Nothing is stored on any server you don't control.

> Status: **scaffold (v0.1)**. Sign-in works end to end; sheet read/write, entry form, and graphs land in subsequent iterations.

## Why a Google Sheet backend

- Zero install for end users.
- Works in any browser on any OS, including mobile.
- Data persists in the user's own Google Drive — they own it, can edit it in Sheets directly, and back it up automatically.
- Sharing with a spouse is just a normal Google Sheets share.

## Project layout

```
pfs-tool/
├── index.html                    # app shell
├── app.js                        # OAuth + (eventually) Sheets client
├── style.css                     # minimal styles
├── config.js                     # CLIENT_ID, language, currency (edit this)
├── seed/
│   └── default-accounts.json     # iteration-1 accounts mirroring your existing sheet
├── docs/
│   ├── SETUP.md                  # one-time Google Cloud OAuth setup
│   └── schema.md                 # Google Sheet tab/column structure
└── README.md                     # this file
```

## Running it locally

OAuth requires the app to be served over `http://localhost` (not `file://`), because Google rejects sign-in from `file://` origins.

```bash
cd pfs-tool
python3 -m http.server 8080
# then open http://localhost:8080 in your browser
```

> If you prefer Node: `npx http-server -p 8080`. Any static server works.

The port must match an authorized JavaScript origin you registered in the Google Cloud Console (see `docs/SETUP.md`). The default doc uses `8080`.

## First-run checklist

1. **Set up Google OAuth** — follow `docs/SETUP.md` (~5 min, free).
2. **Paste your Client ID** into `config.js` (`CLIENT_ID` field).
3. Start a local server (above).
4. Open `http://localhost:8080`.
5. Click "Sign in with Google" — you should see your email appear and a "Signed in" status.

If you see "Edit config.js and set CLIENT_ID", you skipped step 2.

## Roadmap

- [x] **v0.1** Project scaffold + working OAuth sign-in
- [ ] **v0.2** Bootstrap a managed sheet on first sign-in; seed accounts from `seed/default-accounts.json`
- [ ] **v0.3** New-snapshot entry form (one input per active account, pre-filled with last month's values, per-account comments)
- [ ] **v0.4** Snapshot view: per-category subtotals, net worth, month-over-month delta
- [ ] **v0.5** Net worth chart (Chart.js) with breakdown toggle
- [ ] **v0.6** CSV paste importer for historical data from your existing sheet
- [ ] **v0.7** Accounts management UI: add / edit / disable / reorder
- [ ] **v0.8** XLSX export mimicking the existing Historique layout
- [ ] **v1.0** GitHub Pages deploy + polish

## Data model

See `docs/schema.md`. TL;DR: three tabs (`accounts`, `snapshots`, `config`); snapshots are stored in long format (`month | account_id | balance | comment`) so renaming or disabling accounts never invalidates historical data.

## License

Personal project. No license attached yet.
