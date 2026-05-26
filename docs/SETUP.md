# Google Cloud OAuth Setup

The app needs a Google OAuth Client ID so it can ask users to sign in and access their own Google Sheets. This is a **one-time setup** by you (the project owner). Recipients you share the app with do NOT need to repeat it.

Total time: ~5 minutes. Free, no credit card required.

---

## 1. Create a Google Cloud project

1. Go to **https://console.cloud.google.com/**
2. Sign in with your Google account.
3. Top bar → project dropdown → **"New Project"**.
4. Name it `pfs-tool` (or whatever). Leave organization at "No organization". Click **Create**.
5. Wait ~10 seconds, then make sure the project dropdown now shows `pfs-tool`.

## 2. Enable the Google Sheets API

1. Left sidebar → **APIs & Services → Library** (or go to `https://console.cloud.google.com/apis/library`).
2. Search **"Google Sheets API"** → click it → **Enable**.
3. (Optional but recommended) Also enable **"Google Drive API"** — needed only if you want the app to create the spreadsheet for the user automatically. Skip if you'd rather create the sheet yourself and paste its ID into the app.

## 3. Configure the OAuth consent screen

This is what users see when they click "Sign in with Google".

1. Left sidebar → **APIs & Services → OAuth consent screen**.
2. User Type: **External** → Create.
3. Fill in:
   - **App name**: `PFS Tool` (or whatever you want shown to users)
   - **User support email**: your email
   - **Developer contact email**: your email
   - Leave logo, app domain, etc. empty for now.
4. Click **Save and Continue**.
5. **Scopes** screen → click **Add or Remove Scopes**.
   - Search and select:
     - `.../auth/spreadsheets` (Read/write your spreadsheets)
     - `.../auth/drive.file` (only if you want the app to create the sheet) — limits access to files the app creates, very safe scope.
   - Click **Update**, then **Save and Continue**.
6. **Test users** screen → Add yourself + anyone else who will use the app *before* you publish it. While the app is in "Testing" mode, only test users can sign in.
   - Click **+ Add Users**, paste their Gmail addresses, **Save and Continue**.
7. **Summary** → **Back to Dashboard**.

> While the app stays in "Testing" mode, test users see a small "Google hasn't verified this app" warning they click through (Advanced → Go to PFS Tool). To remove that warning entirely you'd submit the app for Google verification — optional, only needed for wide public release.

## 4. Create the OAuth Client ID

1. Left sidebar → **APIs & Services → Credentials**.
2. **+ Create Credentials → OAuth client ID**.
3. **Application type**: `Web application`.
4. **Name**: `PFS Tool Web Client`.
5. **Authorized JavaScript origins** — add **both**:
   - `http://localhost:8080` (local development — adjust port if you use a different one)
   - `https://YOUR-GITHUB-USERNAME.github.io` (for the future GitHub Pages deploy; you can add this later)
6. **Authorized redirect URIs** — leave empty. The app uses the GIS token client flow which doesn't need redirect URIs.
7. Click **Create**.
8. A dialog shows your **Client ID** — copy it. Looks like `123456789-abcdefg.apps.googleusercontent.com`.

## 5. Paste the Client ID into the app

1. Open `config.js` in this repo.
2. Replace `YOUR_CLIENT_ID_HERE` with the Client ID you just copied.
3. Save.

That's it. Run the app locally (see README.md) and you should be able to sign in.

---

## Adding more test users later

OAuth consent screen → Test users → + Add Users → paste Gmail → Save.

## When you're ready to share publicly

OAuth consent screen → **Publish App** → confirm.

If you stick to the `spreadsheets` and `drive.file` scopes, your app is considered "sensitive" but still works for any Google user — they'll just see the "unverified app" warning on first sign-in. To remove that warning permanently, click **Submit for Verification** and follow Google's process (involves a video demo, privacy policy URL, takes a few weeks). Not necessary for small/personal use.

## Troubleshooting

- **"Error 400: redirect_uri_mismatch"** → you probably added a redirect URI; you shouldn't have any. Remove all redirect URIs, save.
- **"Error 403: access_denied"** → your Google account isn't a test user. Add it under OAuth consent screen → Test users.
- **"This app isn't verified"** → expected for unpublished apps. Click **Advanced → Go to PFS Tool (unsafe)** to continue.
- **Sign-in popup blocked** → allow popups for `localhost` (or your hosted domain) in the browser.
