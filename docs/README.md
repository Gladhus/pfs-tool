# Documentation

| Doc | What it covers |
|-----|----------------|
| [HANDBOOK.md](HANDBOOK.md) | **Start here.** Super-detailed engineering handbook — every layer (navigation, storage, session, data, view), shared vs feature-specific code, and a step-by-step guide to adding a feature. Written for a junior engineer. |
| [SETUP.md](SETUP.md) | One-time Google Cloud OAuth setup for Sheets sign-in (~5 min). |
| [schema.md](schema.md) | The Google Sheet / XLSX tab schema and column meanings. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | The data-layer design rationale — why the funnel became a `core/` kernel + per-feature contributors (the "why" behind the handbook's data-layer chapter). |
| [SPENDING.md](SPENDING.md) | Design for the flag-gated **spending tracker** — a self-contained domain (tabs, selectors, pages) that tracks expenses with categories, owner splits, and recurring rules, separate from net worth. |

Project overview and quick start live in the [root README](../README.md);
release notes are in [CHANGELOG.md](../CHANGELOG.md).
</content>
