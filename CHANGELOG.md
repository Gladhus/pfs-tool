# Changelog

All notable changes to this project will be documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Versioning follows [Semantic Versioning](https://semver.org/).

---

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
