# Changelog

All notable changes to this project will be documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Versioning follows [Semantic Versioning](https://semver.org/).

---

## [1.7.3] — 2026-06-04

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
