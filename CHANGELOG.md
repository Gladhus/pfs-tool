# Changelog

All notable changes to this project will be documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Versioning follows [Semantic Versioning](https://semver.org/).

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
