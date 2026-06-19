# Changelog

All notable changes to this project will be documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Versioning follows [Semantic Versioning](https://semver.org/).

---

## [2.2.4](https://github.com/Gladhus/pfs-tool/releases/tag/v2.2.4) — 2026-06-19

### Fixed
- **Detail page dropped line items for some viewers** — a category's per-account rows were only shown when more than one account in it was visible *to the current viewer*, so a category with mixed ownership (e.g. a 50/50 real estate account alongside a solely-owned one) would collapse to "total only" for whichever viewer saw fewer of its accounts, while another viewer of the same category still got line items. The decision is now based on the category's full account count, independent of viewer

## [2.2.3](https://github.com/Gladhus/pfs-tool/releases/tag/v2.2.3) — 2026-06-19

### Changed
- **Ownership-filtered account lists** — the Detail, History, and Entry pages now only show accounts the current "View as" viewer has a stake in: Detail hides year-over-year rows the viewer owns 0% of, the History account-filter dropdown drops them, and the Entry page lists only the viewer's accounts for balance entry (with the net-worth summary and progress counting just those). Switching the header viewer dropdown re-filters every page consistently
- **Shared `accountsVisibleToViewer` helper** — centralizes the "viewer owns > 0%" predicate in `utils/ownership.ts`, reused across the filtered pages

### Added
- **Entry-page empty state for filtered viewers** — when the selected viewer owns no accounts, the Entry page shows a clear prompt to change the "View as" selector instead of a blank form
- **Regression coverage** — new `DetailPage`/`EntryPage` test suites and `accountsVisibleToViewer` unit tests assert non-owned accounts are hidden (and shown again under "Household"); `e2e/viewer-select.spec.ts` now verifies the Entry page narrows its account rows when switching viewers

### Fixed
- **Detail page crash on empty state** — restored the missing `Button` import that broke the "Add accounts" action when no data was present

## [2.2.2](https://github.com/Gladhus/pfs-tool/releases/tag/v2.2.2) — 2026-06-19

### Changed
- **Settings "People" renamed to "Household"** — nav label and section hint text now refer to the household members feature consistently
- **Viewer dropdown label simplified** — the header "View as" Household option no longer has the redundant "(combined)" suffix

### Fixed
- **Header viewer dropdown unreachable on mobile** — the "View as" (Me/Partner/Household) selector was hidden below the `sm` breakpoint with no fallback; it's now always visible, just narrower on small screens
- **Ownership audit silently invisible** — the Settings → Household ownership audit section only rendered when issues existed, so it never appeared with clean data; it now always renders, showing a confirmation message when there are no issues

## [2.2.1](https://github.com/Gladhus/pfs-tool/releases/tag/v2.2.1) — 2026-06-19

### Added
- **Header viewer selector** — a "View as" dropdown in the header lets you switch the net worth and category figures across Overview, History, and Detail between each person and a combined "Household" total, using each account's ownership split; selection persists across reloads
- **Extensive viewer-selector e2e regression coverage** — `e2e/viewer-select.spec.ts` pins exact dollar amounts for Me, Partner, and Household across Overview and History, asserts Household always equals the sum of the two individual views, and edits an account live to an uneven 70/30 split to prove the math generalizes beyond a 50/50 ownership ratio

## [2.2.0](https://github.com/Gladhus/pfs-tool/releases/tag/v2.2.0) — 2026-06-18

### Added
- **Person model** — accounts and the sheet/XLSX schema now reference a `people` entity (`Person`), with a dedicated `people` tab/sheet and lazy migration seeding `self`/`partner` defaults on first load
- **Multi-owner ownership array** — `Account.ownership` is now `{ person_id, share }[]`, replacing the single `owner`/`ownership_share` fields and the `'joint'` sentinel; legacy sheets and XLSX files are migrated and written back automatically on load
- **Split ownership editor** — the account dialog keeps its single-owner picker by default, with a "split between multiple people" toggle that reveals a per-person share editor (validated to total 100%)
- **Primary owner flag** — `Person.primary` marks the sheet's primary owner (seeded on `self`); enforced in the People settings UI, which now also shows a "Primary owner" badge
- **Test backfill for the person/ownership feature** — 35 new unit tests across 3 new files: `ownership.test.ts` (`parseOwnership`, `migrateLegacyOwnership`, `ownershipFromRow`, `shareFor`/`totalShare`, `ensurePrimaryPerson`, `ownershipLabel`), `parsePeople.test.ts` (people/account row round-trips, legacy column fallback), and `loadPeopleCatalog.test.ts` (seeds defaults on a missing/empty people tab, but rethrows transient 5xx/429 errors instead of overwriting real data)
- **Playwright e2e coverage** — `e2e/people.spec.ts` covers the People settings UI (primary badge, archive guard, archive/reactivate, add person) via the offline XLSX flow; `e2e/migration.spec.ts` uploads an old-schema XLSX fixture (no `people` tab, legacy `owner`/`ownership_share` columns) and confirms it migrates to seeded defaults and per-person ownership labels, surviving a reload
- **PR CI workflow** — `.github/workflows/pr-checks.yml` now runs lint, `tsc --noEmit`, unit tests, and the Playwright suite on every pull request to `main`; previously only `deploy.yml` ran checks, and only on pushes to `main`/tags

### Changed
- **Net worth math now reads `ownership`** — `signedMain` computes each account's contribution using the new ownership array (still scoped to the `self` viewer until per-person viewing is built)

### Fixed
- **People-tab data loss on transient API errors** — `loadPeopleCatalog` only seeds `self`/`partner` defaults on a confirmed 400 ("tab missing") response; a 5xx or 429 error is now rethrown instead of silently overwriting real people data
- **Primary owner can't be archived** — archiving the primary person is blocked in the People settings dialog, with an explanatory message in place of the Archive button

## [2.1.0](https://github.com/Gladhus/pfs-tool/releases/tag/v2.1.0) — 2026-06-09

### Added
- **Dark forest header** — site header now uses the `forest-deep` token (`#182c12`) permanently; logo, nav tabs, and icon buttons are recoloured for the dark surface
- **Settings sidebar shortcuts** — "Manage accounts" and "Manage stock options" (when enabled) appear in the Settings sub-nav with an external-link indicator, navigating directly to the respective manage pages
- **Empty state actions** — History and Detail pages now show an "Add accounts" button when no data exists, matching the Overview empty state

### Changed
- **"Accounts" renamed to "Portfolio"** — nav tab, bottom bar, and all routes (`/accounts/*` → `/portfolio/*`); legacy redirects updated
- **NavTabs labels are i18n-translated** — "Overview", "Portfolio", and "Stock Options" now use the i18n system (French: "Aperçu", "Portefeuille", "Options sur actions")
- **Entry action buttons always labelled** — Copy, Reset, and Save buttons in the Entry sticky bar show their text at all screen widths; icon-only on mobile removed
- **Fallback balance warning always visible** — the estimated-balance indicator in the Entry sidebar is now an inline text row; no longer requires hover to read
- **History account filter labelled** — "Account" label added to the filter dropdown in the History chart header
- **Settings manage links moved to sidebar** — Manage accounts and Manage stock options links are now in the Settings sub-nav rather than inline rows in Preferences

### Fixed
- **Side-stripe border removed from StatCard** — `border-l-4` coloured accent strip removed; the dot colour indicator carries the category identity on its own
- **Uppercase eyebrow labels removed** — `text-xs uppercase tracking-wide` pattern removed from StatCard and HeroCard; plain sentence-case labels used instead
- **External nav links no longer show active state** — Settings sidebar links that navigate outside the section (`/portfolio/manage`, `/options/manage`) now use `Link` instead of `NavLink`, preventing false active highlighting
- **`--color-header` token applied** — dead CSS token is now used; DESIGN.md updated to reflect the dark header

### Removed
- **Detail page copy-to-clipboard button** — removed; the period picker is the only control above the table

---

## [2.0.1](https://github.com/Gladhus/pfs-tool/releases/tag/v2.0.1) — 2026-06-08

### Added
- **Close-file confirmation modal** — clicking "Close file" in the XLSX banner now opens a dialog with a warning and an inline "Download XLSX" button before clearing the file from memory
- **Empty state smart routing** — the overview empty state links to `/accounts/manage` when no accounts exist, and to `/entry` once accounts are set up

### Fixed
- **Default language** — new blank XLSX files now default to English instead of French
- **XLSX session persistence** — open file is restored from `sessionStorage` on page refresh
- **Mobile input zoom** — all inputs now use 16 px font on mobile to prevent iOS auto-zoom on focus
- **Modal edge clipping** — dialogs now have 1 rem horizontal margin on small screens so content is never flush with the viewport edge
- **Mobile bottom nav safe-area** — nav bar height now expands by `env(safe-area-inset-bottom)` so tab icons sit above the home indicator on notched iPhones
- **Mobile header height** — header is 64 px on mobile (up from 56 px) for a more comfortable tap target

---

## [2.0.0] — 2026-06-08

Complete rewrite of the application in **React 19 + TypeScript**. The data model, Google Sheet schema, and all end-user features are fully preserved — this is an engineering overhaul, not a product change.

### Added
- **XLSX datasource** — upload any `.xlsx` file exported from your Google Sheet and use the full app without signing in; all edits are kept in memory and the modified file can be downloaded at any time via the persistent banner
- **New XLSX file** — "New XLSX File" button on the sign-in screen creates a blank workbook with all tabs pre-structured; useful for starting fresh without a Google account
- **Datasource abstraction layer** — clean interface (`Datasource`) decouples all queries and mutations from the underlying storage; Google Sheets and XLSX are the first two implementations; a database backend can be added without touching the UI layer
- **Sticky entry bar** — totals bar in the Entry form sticks to the bottom of the viewport on scroll
- **Confirm guards** — unsaved changes in the Entry form prompt a confirmation before navigating away
- **Responsive layout** — bottom tab bar on mobile, inline header tabs on desktop; breakpoint-aware components throughout

### Changed
- **Framework**: vanilla JS → React 19 with concurrent features and the new JSX transform
- **Language**: plain JS → TypeScript with strict mode throughout
- **State management**: ad-hoc module state → TanStack Query v5 (server state) + Zustand (client/UI state)
- **Styling**: hand-rolled CSS → Tailwind CSS v4 (via Vite plugin); design system tokens for color, spacing, and radius
- **Routing**: hash-based tab switching → React Router v7 with proper URL structure
- **i18n**: manual translation registry → react-i18next with JSON catalogs
- **Build**: Vite config updated to TypeScript (`vite.config.ts`); path aliases via `@/`
- **Testing**: plain Jest → Vitest; all 181 tests ported and passing
- **Settings**: preferences, accounts, groups, and import reorganised into a multi-section settings area with sub-navigation
- **Sign-in screen**: Google sign-in alongside XLSX upload and new-file options

### Removed
- CSV export — superseded by XLSX download which preserves the full data model across all tabs

---

## [1.9.9](https://github.com/Gladhus/pfs-tool/releases/tag/v1.9.9) — 2026-06-05

### Fixed
- **#12 `parseMoney` accounting-format negatives**: `(1,234.56)`, `($6,500)` etc. now correctly parse as negative values. The sign is detected before stripping non-numeric characters, then applied to the result. Four new test cases added.

### Refactored
- **#37 Split `options/index.js`**: the 1220-line file is split into `charts.js`, `components/CompanyCard.js`, `ManagePanel.js`, `dialogs.js`; `index.js` reduced to ~90 lines. Circular dependency between dialogs and render functions resolved via `setRenderCallbacks` in `dialogs.js`.
- **#42 Deferred (won't fix)**: `onload=` attribute on `<script>` tags is blocked by the app's Content Security Policy; `setInterval` polling is intentionally retained.

---

## [1.9.8](https://github.com/Gladhus/pfs-tool/releases/tag/v1.9.8) — 2026-06-05

### Refactored
- **#36 Extract `core/router.js`**: tab routing moved out of `features/auth/index.js` into `src/core/router.js`; auth no longer imports any feature render functions.
- **#38 Extract CSV serializer + shortcut dispatcher**: snapshot-to-CSV logic moved to `src/utils/csv.js`; keyboard key→action mapping extracted to `src/core/shortcuts.js`.
- **#39 `setCurrentDate` setter**: added to `src/core/state.js`; replaces 4 duplicated `state.currentDate = …; datePicker.selectDate(…)` blocks.
- **#40 Remove `registerWriteConfig` indirection**: `i18n/index.js` now imports `writeConfig` directly from `api/config.js`.


## [1.9.9](https://github.com/Gladhus/pfs-tool/releases/tag/v1.9.9) — 2026-06-05

### Fixed
- **#12 `parseMoney` accounting-format negatives**: `(1,234.56)`, `($6,500)` etc. now correctly parse as negative values. The sign is detected before stripping non-numeric characters, then applied to the result. Four new test cases added.

### Refactored
- **#37 Split `options/index.js`**: the 1220-line file is split into `charts.js`, `components/CompanyCard.js`, `ManagePanel.js`, `dialogs.js`; `index.js` reduced to ~90 lines. Circular dependency between dialogs and render functions resolved via `setRenderCallbacks` in `dialogs.js`.
- **#42 Deferred (won't fix)**: `onload=` attribute on `<script>` tags is blocked by the app's Content Security Policy; `setInterval` polling is intentionally retained.

---

## [1.9.8](https://github.com/Gladhus/pfs-tool/releases/tag/v1.9.8) — 2026-06-05

### Refactored
- **#36 Extract `core/router.js`**: tab routing (`setActiveTab`, `setAccountsSubTab`, `refreshCurrentTab`, `showTabBar`) moved out of `features/auth/index.js` into `src/core/router.js`; auth no longer imports any feature render functions.
- **#37 Deferred** (options split — tracked separately).
- **#38 Extract CSV serializer + shortcut dispatcher**: snapshot-to-CSV logic moved to `src/utils/csv.js` (`snapshotsToCsv`); keyboard key→action mapping extracted to `src/core/shortcuts.js` (`dispatchShortcut`) — both are independently testable.
- **#39 `setCurrentDate` setter**: added to `src/core/state.js`; replaces 4 duplicated `state.currentDate = …; datePicker.selectDate(…)` blocks across `main.js` and `entry/index.js`.
- **#40 Remove `registerWriteConfig` indirection**: `i18n/index.js` now imports `writeConfig` directly from `api/config.js`; the registration callback and its call site in `main.js` are removed.
- **#41 `tokenRefreshMode` enum**: `REFRESH_MODE` constant added to `state.js`; `silentInFlight`/`proactiveRefreshInFlight` booleans replaced with a single `tokenRefreshMode` string — eliminates the stuck-flag ambiguity.
- **#42 Deferred**: the `onload=` attribute approach is blocked by the app's Content Security Policy (`script-src` disallows `unsafe-inline`); the `setInterval` polling loop is retained.

---

## [1.9.7](https://github.com/Gladhus/pfs-tool/releases/tag/v1.9.7) — 2026-06-05

### Changed
- **#31 Custom account-select ARIA + keyboard nav**: added `role="listbox"`, `role="option"`, `role="presentation"`, `aria-haspopup`, `aria-expanded`, and `aria-selected` to the History tab's custom select dropdown; focus moves to the selected item on open; ArrowDown/ArrowUp navigate between options, Esc closes and returns focus to the trigger; outside-click handler also resets `aria-expanded`.
- **#32 focus-visible styles**: added `:focus-visible` outlines to `.period-btn`, `.tab-btn::after`, and `.tab-icon-btn` so keyboard focus is clearly visible against dark backgrounds.
- **#33 Autocomplete ARIA roles**: `attachAutocomplete` now sets `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded` on the input, and `role="listbox"`, `aria-live="polite"` on the dropdown; each option gets `role="option"`, `aria-selected`, and a unique `id`; `aria-activedescendant` tracks the keyboard-focused option.
- **#34 Expand-button aria-expanded**: History "N earlier" button now carries `aria-expanded="false"` on creation and toggles it on each click; `aria-controls` points to the `olderList` element.
- **#35 Dialog focus management**: `#acct-name-fr` gains `autofocus` so `showModal()` focuses it natively — removed two `setTimeout` focus hacks; `openAccountDialog`/`openNewAccountDialog` capture `document.activeElement` before opening; `closeAccountDialog` restores focus to that element.

---

## [1.9.6](https://github.com/Gladhus/pfs-tool/releases/tag/v1.9.6) — 2026-06-05

### Refactored
- **#26 Extract `renderTagChips`**: tag-chip rendering was triplicated across accounts, groups, and options. Moved to `src/core/components/TagChips.js`; all three call sites now delegate to the shared helper.
- **#27 Extract `attachTagInput` + `allKnownTags`**: tag-input keyboard/autocomplete wiring (Enter/comma commit, Backspace pop, blur commit) was independently reimplemented in accounts, groups, and options. Extracted to `src/core/components/TagInput.js`; `allKnownTags()` moved to `src/utils/tags.js`. Removed exported `onAcctTagsKeydown`/`onAcctTagsBlur` from accounts — wiring now handled inside `attachTagInput`.
- **#28 Extract `attachPeriodPills` / `getActivePeriod`**: three structurally identical click-handler blocks in `main.js` replaced with `attachPeriodPills(id, fn)` calls from new `src/core/pills.js`; overview, detail, and history now use `getActivePeriod(id)` instead of raw `querySelector`.
- **#29 Extract `buildCategoryOptgroups`**: the same ~15-line category-grouped `<optgroup>` loop was built three times in `accounts/index.js`. Moved to `src/core/components/CategorySelect.js` and all three call sites replaced with a single function call.
- **#30 Extract `attachDialogHandler`**: six module-level `_xSaveHandler`/`_xDeleteHandler` variables and manual `removeEventListener`/`addEventListener` blocks in `options/index.js` replaced with `attachDialogHandler(btn, handler)` WeakMap helper added to `src/core/dom.js`.

---

## [1.9.5](https://github.com/Gladhus/pfs-tool/releases/tag/v1.9.5) — 2026-06-05

### Fixed
- **Sheet never loads — "No internet connection." on every load** (#29): the real root cause of the v1.9.1 regression. `gapiCall()` called `.catch()` directly on the gapi request object, but gapi requests are *thenables* that implement `.then` but **not** `.catch`. This threw `TypeError: ...catch is not a function` on the very first read (`loadAccounts`), which `classifyApiError` then misclassified as an offline/network error. `gapiCall` now uses `await` + `try/catch` (which only needs `.then`), so reads succeed and the 401-refresh-retry path still works. Added `gapiCall.test.js` with a thenable-without-`.catch` shim to lock this in.
- **Misleading offline classification**: `classifyApiError` no longer treats a bare `TypeError` as "offline" — gapi network errors reject with a result object, not a `TypeError`, so a `TypeError` signals a code bug. Offline is now detected solely via `navigator.onLine`, so real errors surface honestly instead of hiding behind "No internet connection."

---

## [1.9.4](https://github.com/Gladhus/pfs-tool/releases/tag/v1.9.4) — 2026-06-05

### Fixed
- **verifySheet wipes cached sheet ID on network error** (#28): `verifySheet` was catching all errors (including TypeErrors and network failures) and returning `false`, causing `bootstrapSheet` to clear the cached `pfs_sheet_id` from localStorage and call `findSheetByName` — which has no error handling and threw, producing "Failed to load sheet: No internet connection." on every subsequent load. `verifySheet` now only returns `false` for definitive 403/404 responses; network/unknown errors rethrow so `bootstrapSheet` keeps the cached ID and skips `findSheetByName`, attempting to load directly instead.

---

## [1.9.3](https://github.com/Gladhus/pfs-tool/releases/tag/v1.9.3) — 2026-06-05

### Fixed
- **Tags/groups loader cascade** (#27): `ensureTagsTab()` and `ensureGroupsTab()` inside the catch blocks of `loadTagsCatalog` / `loadGroupsCatalog` were also unguarded — the same `values.update` cascade bug as fixed in v1.9.2 for option loaders. A brief network error during `loadTagsCatalog` or `loadGroupsCatalog` now degrades to empty data instead of crashing `loadAll`.

---

## [1.9.2](https://github.com/Gladhus/pfs-tool/releases/tag/v1.9.2) — 2026-06-05

### Fixed
- **Option loader cascade** (#26): `ensureTab()` calls inside the catch blocks of all four option loaders (`loadOptionCompanies`, `loadOptionGrants`, `loadOptionFmv`, `loadOptionExercises`) were unguarded — a network failure during `values.update` escaped the catch block and crashed the entire `loadAll()`, showing "Failed to load sheet: No internet connection." on mobile even with a working connection. Each `ensureTab` call is now wrapped in its own try/catch and degrades to empty data instead of aborting the load.
- **Auto-retry on tab re-focus** (#26): when `bootstrapSheet` failed (e.g. brief LTE dropout), there was no recovery path without a full page reload. A `_bootstrapFailed` flag now triggers an automatic retry via the existing `visibilitychange` handler when the user returns to the tab and the token is still valid.

---

## [1.9.1](https://github.com/Gladhus/pfs-tool/releases/tag/v1.9.1) — 2026-06-04

### Fixed
- **gapiCall 401 retry** (#21): all Sheets/Drive API calls now auto-retry once after silently refreshing the token on HTTP 401, instead of surfacing an auth error to the user
- **Atomic sheet writes** (#22): replaced `clear → write` pattern with `write-first, trim-stale-tail` (`safeWriteTab`) in all save paths — the sheet is never left empty mid-write
- **Friendly error messages** (#23): `classifyApiError()` / `getUserMessage()` map raw API errors to translated user-readable strings (auth expired, offline, quota, server error, etc.) across all save/delete paths in EN and FR
- **Warn logging on load failures** (#24): silent catch blocks in `loadConfig` and the 4 options loaders now emit `console.warn` so failures are visible in devtools
- **Proactive token refresh on tab re-focus** (#25): `visibilitychange` listener refreshes the GIS token when switching back to the tab if expiry is within 5 minutes, preventing the next API call from hitting a 401

---

## [1.9.0](https://github.com/Gladhus/pfs-tool/releases/tag/v1.9.0) — 2026-06-04

### Added
- **Test backfill** (#15–#20): 69 new unit tests across 5 new test files — 128 tests total
  - `stats.test.js` — `computeNetWorthFromSnapshots` (asset/debt sign, ownership_share scaling, unknown account skip, `ownership_share=0` fallback) and `buildBalanceSweep` (LOCF carry-forward, pre-seeding from before first date, boundary inclusion, `__day__` row exclusion)
  - `getDatesForPeriod.test.js` — all/empty, YTD (keyed off data year not today's calendar year), 3M/6M/1Y/2Y/5Y windows, unknown period fallback, month-end overflow guard
  - `normalizeDate.test.js` — null/empty, YYYY-MM-DD passthrough, zero-padding, YYYY-MM→day-01, valid/boundary/out-of-range Sheets serials, leap-year serial (43890 → 2020-02-29)
  - `options.test.js` — `computeVestedShares` (cliff gating, cliff boundary, partial/full/over-vest cap, quarterly/annual intervals, degenerate inputs) and `exercisableShares` (no/partial/over exercise)
  - `parseDelimited.test.js` — comma/tab detection, quoted comma, escaped double-quote, CRLF endings, embedded newline in quoted field, blank-row filtering, no-trailing-newline, unclosed quote characterization

---

## [1.8.0](https://github.com/Gladhus/pfs-tool/releases/tag/v1.8.0) — 2026-06-04

### Fixed
- **setMonth overflow** (#13): `Date.setMonth()` overflows on end-of-month dates (e.g. Jan 31 + 1 month → Mar 3 instead of Feb 28); replaced all three raw `setMonth` call sites (`getDatesForPeriod`, `grantFullyVestedDate`, `grantFirstVestDate`) with a new `addMonths(date, n)` helper in `src/utils/dates.js` that clamps to the last day of the target month

### Removed
- **Dead `app.js`** (#14): deleted the 2460-line legacy single-file version from the repo root — it was never loaded by `index.html` or Vite; git history preserves it; removed the stale reference from `CLAUDE.md`

---

## [1.7.6](https://github.com/Gladhus/pfs-tool/releases/tag/v1.7.6) — 2026-06-04

### Fixed
- **CSP**: added `https://fonts.googleapis.com` to `style-src` and `https://fonts.gstatic.com` to `font-src` — gapi loads Google Fonts which were blocked, preventing the library from initialising

---

## [1.7.5](https://github.com/Gladhus/pfs-tool/releases/tag/v1.7.5) — 2026-06-04

### Fixed
- **CSP**: widened `script-src` to include `https://*.gstatic.com` (gapi dynamically loads modules from Google's CDN at gstatic.com); consolidated `connect-src` to `https://*.googleapis.com` wildcard; added `*.gstatic.com` to `img-src` and `style-src` for Google Fonts/icons loaded by gapi

---

## [1.7.4](https://github.com/Gladhus/pfs-tool/releases/tag/v1.7.4) — 2026-06-04

### Fixed
- **Sign-in regression**: CSP `connect-src` was missing `https://apis.google.com`, causing `gapi.load('client')` to fail silently — `gapiReady` was never set and the sign-in button stayed permanently disabled; added `apis.google.com` and `content.googleapis.com` to `connect-src`
- **Sheet discovery regression**: narrowing OAuth scope to `drive.file` only broke `findSheetByName()` and `onChooseSheet()` for existing users — `drive.files.list` under `drive.file` only returns files the app created in the current session, not pre-existing sheets; restored `spreadsheets` scope alongside `drive.file`

---

## [1.7.3](https://github.com/Gladhus/pfs-tool/releases/tag/v1.7.3) — 2026-06-04

### Security
- **OAuth token**: access token no longer persisted in `localStorage` — kept in memory only; silent GIS refresh handles session restore on reload; existing cached tokens are cleaned up on first load
- **CSP**: strict `Content-Security-Policy` meta tag added as the first element in `<head>`; covers all Google API endpoints; no `unsafe-inline` in `script-src`
- **XSS**: `escapeHtml()` now wraps both branches of the accounts-list group header `innerHTML` interpolation (`tr(cat)` and `a.category` fallback)
- **OAuth scope**: reduced from broad `spreadsheets` (all sheets in account) to `drive.file` (only files this app created or the user explicitly opened)
- **Dependencies**: removed `headroom-ai` (was never imported); pinned `chart.js` and `air-datepicker` to exact versions (dropped `^` ranges)

---

## [1.7.2](https://github.com/Gladhus/pfs-tool/releases/tag/v1.7.2) — 2026-06-04

### Fixed
- **Lint**: resolved all ESLint warnings across `src/` — removed unused imports (`HEADERS`, `state`, `fmtMoney`/`fmtMoneyShort`, `moneyTooltipLabel`, `computeCompanyEquityValue`/`UnvestedValue`, `addOptionFmvEntry`, `lang`, `iconEl`, `els`, `t`, `onSignedIn`, `applyToken`, `openGrantDialog`), dead local variables (`totalCols`, `dateIdx`, `_typesPopulated`, `cancelBtn` ×2, `ATTRS`), dead functions (`setView`, `onRenameAccountId`), unused catch bindings converted to bare `catch {}`, unused callback args renamed with `_` prefix
- **Icons**: restored `STROKE` constant usage in `icon()` after `ATTRS` removal to keep the constant meaningful

---

## [1.7.1] — 2026-06-04

### Fixed
- **i18n**: removed duplicate `net_worth` translation key in both `en.js` and `fr.js` (silent key collision — last definition was silently winning)
- **parseMoney**: removed useless escape character in regex character class (`\-` → `-`)
- **Overview category view**: fixed `ReferenceError: cs is not defined` crash when switching to category series-toggle view (`renderSeriesToggles` now calls `getComputedStyle` directly)

### Added
- **CI**: lint (`eslint src/`) and test (`vitest run`) steps now run before build — a failure in either blocks the deploy
- **ESLint 9**: flat config scoped to `src/` with browser globals and `allowEmptyCatch` for intentional catches; `npm run lint` script added
- **Test coverage**: `@vitest/coverage-v8` added; `npm run test:coverage` generates text + HTML reports for `src/utils/` and `src/core/`
- **`.editorconfig`**: codifies 2-space indent, LF line endings, UTF-8, and trailing-whitespace trimming

---

## [1.7.0](https://github.com/Gladhus/pfs-tool/releases/tag/v1.7.0) — 2026-06-03

### Added
- **Option exercise tracking**: each grant can now record one or more exercises (date, shares exercised, price paid — pre-filled with the grant's strike price — and an optional note). A collapsible **Exercises** block appears under each grant in both the main view and the manage tab, listing past exercises with edit/delete, plus an **Add exercise** action.
- Grant share counts now display as `vested (exercisable) / total shares vested`, where the parenthesized exercisable figure (vested minus already exercised) carries a tooltip. The exercisable count only appears once at least one exercise has been recorded.
- Exercisable shares drive intrinsic value everywhere it is calculated (per-grant, per-company, and overview net worth). Vested share totals and the vesting schedule chart are unaffected.
- Hard block prevents exercising more shares than are exercisable as of the exercise date (which also prevents exercises before the cliff, since vested = 0 then).
- New `option_exercises` sheet tab with columns `id, grant_id, date, shares_exercised, price_paid, note`.

---

## [1.6.0](https://github.com/Gladhus/pfs-tool/releases/tag/v1.6.0) — 2026-06-02

### Changed
- **Internal refactor — shared component library**: extracted privacy-aware formatters, reusable Delta and StatCard components, and a Chart.js options factory; deduplicated `hexToRgba`, `escapeHtml`, `slugify`, today/month helpers, year-tick computation, chart create/replace boilerplate, and CSS-variable palette extraction. No behaviour change — overview, history, detail, and stock-options tabs render identically. `state.privateMode` is now read in exactly one module (`core/privacy.js`) instead of being checked in 30+ inline ternaries across 7 feature files, so future tweaks to the mask glyph or delta rendering touch a single file.

---

## [1.5.1](https://github.com/Gladhus/pfs-tool/releases/tag/v1.5.1) — 2026-06-02

### Fixed
- **Mobile overview layout**: period pills now appear below the chart on mobile instead of top-right (which caused the chart to overflow the page width)
- **Mobile header**: private mode button is now visible in the header on mobile; previously it was hidden along with the rest of the auth area

---

## [1.5.0](https://github.com/Gladhus/pfs-tool/releases/tag/v1.5.0) — 2026-06-02

### Added
- **History pagination**: history cards now paginate at 12 months per page with Newer/Older navigation
- **Private mode in header**: private mode button moved to the main header (right of the gear icon) using an eye/eye-off icon; toggle now re-renders the currently active tab instead of always refreshing overview

### Changed
- **Tab bar**: replaced segmented pill navigation with GitHub-style underline tabs
- **Overview hero card**: period pills repositioned to the top-right corner of the hero card on all screen sizes
- **Sidebar — Manage sub-items**: Accounts, Groups, and Import are now nested sub-points under the Manage sidebar item (visible only when Manage is active); sidebar is sticky on desktop
- **Header cleanup**: removed "Open in Google Sheets", "Sign out", and user email from the header permanently — these live in Settings only; suppressed ok-level status messages (e.g. "Loaded.")

### Fixed
- **Private mode coverage**: $ amounts and share counts are now redacted across all sections — History cards (values + deltas), Stock Options (card totals, per-grant values, share counts, chart tooltips, y-axis ticks), and Settings/Accounts balance display; percentages and FMV always remain visible
- **Private mode toggle**: toggling private mode outside the overview tab now re-renders the active tab correctly
- **Detail table horizontal scroll**: fixed section layout so the detail table scrolls independently on mobile

---

## [1.4.3](https://github.com/Gladhus/pfs-tool/releases/tag/v1.4.3) — 2026-05-29

### Changed
- **Equity tags input**: replaced plain comma-separated text field with tag chips + autocomplete — same pattern as the account editor; suggestions come from the existing tags catalog, chips show with × remove buttons, Enter/comma adds a new tag, changes auto-save to the sheet

---

## [1.4.2](https://github.com/Gladhus/pfs-tool/releases/tag/v1.4.2) — 2026-05-29

### Fixed
- **Bootstrap crash**: equity bucket pushed into the `buckets[]` array without a `.match` method caused `a[Dt].match is not a function` during overview chart rendering whenever Stock Options was enabled (root cause: category-view equity bucket lacked the `match: () => false` sentinel that all other buckets carry)

---

## [1.4.1](https://github.com/Gladhus/pfs-tool/releases/tag/v1.4.1) — 2026-05-29

### Fixed
- **Equity tags section**: "Tags" label renamed to "Equity tags" for clarity; section now uses a proper `<h2>` header matching the Accounts manage panel style
- **Equity tags rendering**: tags section was silently wiped when no companies existed (root cause: `list.innerHTML = '...'` overwrote the already-appended tags row when the companies array was empty; fixed with `appendChild`)

---

## [1.4.0](https://github.com/Gladhus/pfs-tool/releases/tag/v1.4.0) — 2026-05-28

### Added
- **Equity in overview chart**: vested stock options value now appears as its own colored stacked area in the Overview chart (category view), with a series toggle chip alongside the other categories
- **Equity in group totals**: groups now include equity when its configured tags match the group's tag criteria — set tags in the Stock Options manage panel (⚙ → Tags field)
- **Equity tags**: new "Tags" field at the top of the Stock Options manage panel; comma-separated tags (e.g. `tech, investments`) control which overview groups equity is counted in; persisted to the sheet config as `equity_tags`
- **Equity sparkline**: the equity stat card now draws its historical sparkline (was created but never rendered)

### Fixed
- **Vesting chart tooltip**: hover values were showing the cumulative stacked total instead of each grant's individual vested share count
- **Mobile accounts sidebar**: sticky horizontal nav bar now stays pinned at the top of the viewport when scrolling on mobile (previously used `position: static`)

---

## [1.3.1](https://github.com/Gladhus/pfs-tool/releases/tag/v1.3.1) — 2026-05-28

### Fixed
- **Options value chart**: chart now starts from the first date where real FMV data exists; mid-month FMV entries no longer produce a false zero on the month-01 tick that precedes them (root cause: `generateMonthlyDates` used the raw FMV date as the range start, generating a month-01 tick before any FMV existed, which `getEffectiveFmv` correctly returned null for — now returns `null` instead of 0 for no-data dates, leading null ticks are trimmed, and `spanGaps: false` prevents Chart.js from interpolating through any remaining gaps)

---

## [1.3.0](https://github.com/Gladhus/pfs-tool/releases/tag/v1.3.0) — 2026-05-28

### Added
- **Options manage panel**: gear icon on the Stock Options tab now opens a full management sub-panel (same pattern as Accounts tab) — contains CRUD for companies, grants, and FMV history
- **FMV history editor**: per-company table of all historical FMV entries with inline edit and delete; add new entries without leaving the manage panel
- **Settings jump links**: Settings → Preferences now has a "Manage" section with direct navigation buttons to the Accounts manage panel and the Stock Options manage panel
- **Accounts manage sidebar**: sticky sidebar navigation inside the Accounts manage panel for quick-scrolling to Accounts, Groups, and Import sections; collapses to a horizontal row on mobile

### Changed
- **Stock Options gear**: previously opened a small dropdown; now swaps the full tab to a manage sub-panel; main view is now a read-only overview (hero values + charts + vesting progress)
- **Stock options toggle persistence**: enabling/disabling the Stock Options tab now writes `stock_options_enabled` to the Google Sheet config tab in addition to localStorage; the setting is restored across devices on sign-in

---

## [1.2.0](https://github.com/Gladhus/pfs-tool/releases/tag/v1.2.0) — 2026-05-28

### Added
- **Stock Options tab**: new dedicated tab for tracking equity compensation — supports multiple companies, multiple grants per company (ISO, NSO, RSU, SAR), full vesting calendar (cliff + monthly/quarterly/annual intervals), and FMV history with LOCF semantics
- **Vesting charts**: per-company stacked line chart showing cumulative vested value over time; solid lines for past vesting, dashed for future; extends to last fully-vested date; vertical "today" marker
- **Options value chart**: top-level summary chart showing actual historical intrinsic value over time, stacked by company (driven by FMV history)
- **Equity in net worth**: vested stock option value is included in the net worth hero, Overview donut chart, and entry form totals
- **Stock Options toggle**: enable/disable the Stock Options tab from Settings → Preferences; hidden by default

### Changed
- **Navigation restructure**: main tab bar simplified to Overview · Accounts · Stock Options (if enabled) — Detail and History moved inside the Accounts tab as sub-panels accessible via a pill sub-nav
- **Accounts gear**: ⚙ button on the Accounts sub-nav reveals an account management panel (accounts list, groups editor, and import tool) — previously spread across the Settings tab
- **Stock Options gear**: ⚙ button on the Stock Options tab reveals the Add Company panel
- **Settings tab**: stripped down to Preferences and Data (sheet link, CSV export) — account/group management and CSV import moved to the Accounts gear panel
- **Import historical data**: moved from Settings → Data to the Accounts gear panel, alongside account and group management

---

## [1.1.4](https://github.com/Gladhus/pfs-tool/releases/tag/v1.1.4) — 2026-05-28

### Fixed
- **CSV import**: `parseMoney` now correctly treats `$6,500`-style values as 6500 — a comma followed by exactly 3 digits is a thousands separator, not a decimal. Mixed formats like `$1,234.56` also parse correctly.

### Added
- **Tests**: Vitest test suite with 59 unit tests covering `parseMoney` (null/empty, plain integers, currency symbols, thousands separators, decimal separators, negatives, real spreadsheet values) and `parseMonthLabel` (all supported date formats).

---

## [1.1.3](https://github.com/Gladhus/pfs-tool/releases/tag/v1.1.3) — 2026-05-28

### Fixed
- **CSV import**: date column headers are now parsed universally — supports `DD/MM/YYYY`, `DD-MMM-YY` (e.g. `1-Dec-15`), `DD-MMM-YYYY`, `MMM-DD-YY(YY)`, `YYYY-MMM-DD`, `MMM YYYY`, and all prior formats. Two-digit years are treated as 2000s.

---

## [1.1.2](https://github.com/Gladhus/pfs-tool/releases/tag/v1.1.2) — 2026-05-28

### Fixed
- **Deploy workflow**: README version badge was not being updated on release — `sed` command was planned but never added to the workflow

---

## [1.1.1](https://github.com/Gladhus/pfs-tool/releases/tag/v1.1.1) — 2026-05-28

### Fixed
- **i18n**: all translation files now self-register on import via `registerTranslations()` — previously the registry was always empty and every label fell back to its key
- **Language persistence**: changing language now writes to the sheet's `config` tab; `setLang()` was saving to `localStorage` only

---

## [1.1.0](https://github.com/Gladhus/pfs-tool/releases/tag/v1.1.0) — 2026-05-28

### Added
- **Choose sheet**: replaced the static "Reset link" with a "Choose sheet" button that opens a Drive file picker — lists all PFS spreadsheets created by the app, lets the user switch without re-authenticating
- **Account growth rate**: new optional field in the account editor (`%/yr`); when set, the entry form shows a **Calculate** button next to that account's balance input, pre-filling it with the projected balance (compound monthly) from the last recorded snapshot, with the rate and days-elapsed shown in a tooltip
- **Config persistence**: language and theme preferences are now written back to the sheet's `config` tab on change, and restored automatically on next sign-in

### Changed
- **Project structure**: full professional restructure into feature-based folders — `src/core/` (state, dom, format, toast, icons, autocomplete, i18n), `src/api/` (one module per data domain), `src/utils/` (dates, stats, balance, import helpers), `src/features/` (one folder per tab/feature); each feature carries its own `en.js`/`fr.js` translations; i18n uses a `registerTranslations()` registry pattern
- **Deploy workflow**: release job now also updates the version badge in README.md and includes it in the release commit

---

## [1.0.0](https://github.com/Gladhus/pfs-tool/releases/tag/v1.0.0) — 2026-05-27

### Added
- **Air Datepicker**: replaced the native `<input type="date">` with a fully custom-styled date picker — month and year panel views with no native selects, themed to match the app's design system, FR/EN locale support
- **Entry form — Reset button**: clears all entered values with a confirmation modal; does not write to the sheet
- **Entry form — previous value hints**: direction arrow (▲ / ▼ / =) shown next to each account's previous value hint, updated live as you type
- **Entry tab — open today**: clicking the `+` tab button pre-fills the date input with today's date

### Changed
- **Tab order**: Overview → Detail → History
- **Detail tab**: sticky first column (category and account names stay visible when scrolling right); category header rows show background only, no borders; YoY Δ column inline per year; sticky column header on vertical scroll
- **History tab**: account selector replaced with a custom styled dropdown (no native `<select>`)
- **Overview cards**: max 4 per row; cards expand to fill available width
- **Period pills**: reordered to 3M → 6M → YTD → 1Y → 2Y → 5Y → All; inactive pills use a dimmer text color
- **Card deltas**: two-line layout — amount + % on the first line (green/red), period label on the second line (muted); applied consistently across category cards, group cards, and the net worth hero
- **Net worth hero delta**: removed the oval pill; now uses the same two-line delta style as the other cards
- **Entry form buttons**: Reset and Copy prev. entry are proper bordered buttons; badge moved to the right side of the header
- **Entry form totals**: category summary rows stack label above value, preventing negative signs from wrapping at narrow widths
- **Mobile tabs**: all tabs fit the screen without horizontal scrolling — tabs share available width equally

---

## [0.9.7](https://github.com/Gladhus/pfs-tool/releases/tag/v0.9.7) — 2026-05-27

### Added
- **Detail tab**: new year-over-year table showing every account's balance at Jan 1 of each year, grouped by category with subtotals, a net worth total row, and a Δ column (latest vs prior year); period pills (3Y / 5Y / All)
- **Tab bar redesign**: Overview / History / Detail as the main text tabs; Entry (`+`) and Settings (⚙) moved to icon buttons at the far right

## [0.9.6](https://github.com/Gladhus/pfs-tool/releases/tag/v0.9.6) — 2026-05-27

### Added
- **2Y period button** added to both Overview and History period pill bars

### Changed
- **Chart x-axis labels**: smarter tick selection — year-only labels for ranges ≥2 years, "Mon YYYY" for shorter ranges; tick count scales to canvas width (3 on mobile, up to 7 on desktop); replaces the previous fixed `maxTicksLimit` approach
- **Chart series start from first data point**: series lines (by category/group in Overview; investments and real estate in History) now begin at their first actual entry rather than showing $0 from the start of time
- **Overview chart x-axis range**: when toggling to a series that starts later (e.g. a group added in 2025), the x-axis now trims to that series' first data point rather than showing blank space back to 2020
- **History month-card delta**: now shows the latest net worth for the current month vs the latest net worth for the prior month (month-over-month), rather than day-over-day delta

## [0.9.5](https://github.com/Gladhus/pfs-tool/releases/tag/v0.9.5) — 2026-05-27

### Fixed
- Overview "By group" mode caused the page to be narrower than the viewport on Safari (mobile and desktop) — `position: absolute` checkboxes inside series chip toggles were escaping their containing block and inflating the document width; fixed by adding `position: relative` to chips and zeroing the hidden input size

### Changed
- Deploy workflow: removed `check-version` hard gate; `release` job now skips gracefully when version tag already exists — CSS/doc-only pushes no longer require a version bump; check-version now gates only when UX files changed; enforces CHANGELOG entry for new versions
- Removed pre-commit hook and `npm prepare` hook wiring

## [0.9.4] — 2026-05-27

### Fixed
- Pre-commit hook now runs `git fetch --tags` before checking, catching tags created by CI on the remote

## [0.9.3] — 2026-05-27

### Changed
- README rewritten as a product overview — removed setup/deployment sections, focused on features and data model
- Backfilled changelog entries for 0.9.1 and 0.9.2

## [0.9.2] — 2026-05-27

### Added
- MIT license
- README fully rewritten with version/deploy badges, features list, architecture overview, and data model table

## [0.9.1] — 2026-05-27

### Added
- Pre-commit hook in `.githooks/pre-commit` blocks commits to `main` if version tag already exists
- `npm prepare` script wires up `.githooks/` automatically on `npm install`
- `check-version` CI job fails fast if version tag already exists, before build/deploy runs

## [0.9.0] — 2026-05-27

### Added
- **Carry-forward (LOCF)**: charts, overview, history, and entry net worth now use each account's last known value when no entry exists for a given date — no more drops in graphs from missing data
- **Sparse entry**: leaving an account blank in the entry form skips it (no data point created); explicit `0` still records as a real entry
- **Incomplete day warning**: yellow ⚠ icon on history entries where some accounts rely on carry-forward values, with a tooltip explaining why
- **Entry net worth fallback**: net worth shown at the bottom of the entry form uses carry-forward for unfilled accounts, with a ⚠ icon indicating this
- **Dim empty rows**: account rows with no value entered are dimmed (45% opacity), brightening on hover or focus
- **Custom confirm modal**: replacing native `window.confirm()` with a styled in-app dialog (used when saving would delete previously recorded entries)
- **Custom tooltip system**: JS-based fixed-position tooltips that escape `overflow: hidden` containers; styled with off-white background, medium weight, border, and shadow
- **Semantic versioning + git tags**: `package.json` is now the version source of truth; version shown in footer; deploy workflow triggers on `v*` tag pushes
- **Groups system**: tag-based account groups with CNF filter logic (all/any/exclude); groups catalog stored in `groups` sheet tab; group editor in Settings
- **Tag autocomplete**: dropdown autocomplete on tag inputs in the account editor
- **Overview: By Group view**: group cards replace raw tag view; "By Group" is now the default; donut hidden in group mode

### Fixed
- Clearing a pre-filled balance and saving now correctly removes that entry from the sheet (previously the old row was preserved)
- Overview, history, and sparkline charts no longer show artificial drops when accounts have sparse entries

### Changed
- Entry form balance placeholder changed from `$0.00` to `—` to make it clear blank = no entry
- Deploy workflow now triggers on both `main` branch pushes and `v*` tag pushes

---

## [0.7.0] — 2026-05-22

### Added
- Daily snapshot model (YYYY-MM-DD) replacing monthly (YYYY-MM)
- History tab: day entries grouped under collapsible month cards
- Entry form: date picker, day comment, copy-previous-day button
- Previous entry value shown as muted hint below each balance input with direction arrow
- Progress strip showing filled / total account count on entry form
- Sheet link moved into header; status messages auto-dismiss
- Migration tool in Settings to convert old YYYY-MM rows to YYYY-MM-01
