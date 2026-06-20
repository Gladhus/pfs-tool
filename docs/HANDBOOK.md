# PFS Tool — Engineering Handbook

> **Who this is for.** A junior engineer who has never seen this codebase and
> needs to understand *how the whole thing works* — not just one file — and then
> add a feature without breaking anything. It is deliberately long and
> deliberately repetitive: every concept is explained in plain language first,
> then shown in real code with a `file:line` citation you can click.
>
> **How to read it.** Skim §1–§3 for the mental model, then read the layer you're
> about to touch. When you're ready to build, jump straight to **§14 — How to add
> a feature**, which links back to the relevant deep-dive sections.
>
> **Companion docs.** [ARCHITECTURE.md](ARCHITECTURE.md) is the *design rationale*
> for the data layer (why it looks the way it does). This handbook is the
> *operating manual* for the entire app. [schema.md](schema.md) documents the
> spreadsheet columns; [SETUP.md](SETUP.md) covers Google OAuth setup.

---

## Table of contents

1. [What the app is, in one breath](#1-what-the-app-is-in-one-breath)
2. [The tech stack and why each piece is here](#2-the-tech-stack-and-why-each-piece-is-here)
3. [The 10,000-foot view: one request, end to end](#3-the-10000-foot-view-one-request-end-to-end)
4. [The directory map: where everything lives](#4-the-directory-map-where-everything-lives)
5. [Layer 0 — Storage: the datasource abstraction](#5-layer-0--storage-the-datasource-abstraction)
6. [Layer 1 — Fetch & cache: React Query](#6-layer-1--fetch--cache-react-query)
7. [Session & authentication: Google OAuth](#7-session--authentication-google-oauth)
8. [State management: the three kinds of state](#8-state-management-the-three-kinds-of-state)
9. [Navigation & routing](#9-navigation--routing)
10. [Layer 2/3 — The data layer (the engine)](#10-layer-23--the-data-layer-the-engine)
11. [Domain data: features and their selectors](#11-domain-data-features-and-their-selectors)
12. [Layer 4 — The view layer](#12-layer-4--the-view-layer)
13. [Shared cross-cutting concerns](#13-shared-cross-cutting-concerns)
14. [How to add a feature (the guide)](#14-how-to-add-a-feature-the-guide)
15. [Conventions, rules & cheat sheet](#15-conventions-rules--cheat-sheet)
16. [Testing](#16-testing)
17. [Glossary](#17-glossary)

---

## 1. What the app is, in one breath

PFS Tool is a **privacy-first personal net-worth tracker** that runs entirely in
your browser. There is **no backend server**. Every number you see — net worth,
allocation by category, history over time, stock-option equity — is computed
**in the browser** from a handful of raw tables that live in either:

- a **Google Sheet** in *your* Google Drive (the signed-in mode), or
- an **in-memory XLSX workbook** you uploaded (the no-sign-in mode).

That single fact drives the whole architecture. Because there is no server to do
math for us, the browser must do all of it: load raw rows → turn them into typed
models → scope them to the current viewer → filter by time period → aggregate
into the numbers on screen → format. The bulk of this handbook is about *how that
pipeline is organized so it stays maintainable.*

> **Key mental model:** the app is a **funnel**.
> `load → scope to viewer → filter by period → aggregate → format`.
> Memorize that sentence. Every page is a different mouth on the same funnel.

---

## 2. The tech stack and why each piece is here

| Tool | Version | What it does here | Why |
|------|---------|-------------------|-----|
| **React 19** | `^19.2` | UI rendering | Component model; we use function components + hooks only. |
| **TypeScript 6** | `^6.0` | Types everywhere | The data layer is pure functions over typed models — types are the contract. |
| **Vite 8** | `^8.0` | Dev server + build | Fast HMR; `@` alias → `src/`. |
| **React Router 7** | `^7.17` | Client-side routing | Nested layouts + guards (see §9). |
| **TanStack React Query 5** | `^5.101` | Server-state cache | Loads/caches the spreadsheet tables, keyed by datasource (see §6). |
| **Zustand 5** | `^5.0` | Client-state store | Tiny global state for auth, UI prefs, datasource (see §8). |
| **Radix UI** | various | Headless accessible primitives | Dialog, Select, Tooltip, Toast, etc., wrapped in `shared/ui`. |
| **Recharts 3** | `^3.8` | Charts | All the line/area charts. |
| **i18next + react-i18next** | `^26` / `^17` | Translation | English + French (see §13). |
| **SheetJS (`xlsx`)** | 0.20.3 | XLSX read/write | Parses uploaded workbooks and exports downloads. |
| **Tailwind CSS 4** | `^4.3` | Styling | Utility classes; theme via CSS variables. |
| **Vitest + Testing Library** | `^4.1` | Unit/component tests | Pure functions + rendered components. |
| **Playwright** | `^1.60` | E2E tests | Full browser flows. |

The full dependency list is in [`package.json`](../package.json). The scripts you
will actually run:

```bash
npm run dev          # Vite dev server
npm run typecheck    # tsc --noEmit (no emit, just type-check)
npm run build        # typecheck + vite build
npm test             # vitest run (unit + component)
npm run test:e2e     # playwright
npm run lint         # eslint, zero-warnings policy
```

---

## 3. The 10,000-foot view: one request, end to end

Here is the complete life of the **Overview page** from cold load to pixels. Every
arrow is a layer this handbook covers. Don't worry about the details yet — this is
the skeleton you'll hang everything else on.

```
┌── BROWSER LOADS index.html ──────────────────────────────────────────────┐
│  index.html boots src/app/main.tsx                                        │
│    main.tsx wires the global providers:                                   │
│      QueryClientProvider  (React Query cache)                             │
│      TooltipProvider      (Radix)                                         │
│      RouterProvider       (the route tree)                               │
└───────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌── ROUTING (src/app/router.tsx) ───────────────────────────────────────────┐
│  RootLayout  → AuthProvider mounts, theme + lang applied                  │
│    ProtectedLayout → "are we signed in OR in xlsx mode?" gate            │
│      AppShell → header, status bar, bottom tabs, <Outlet/>               │
│        OverviewPage  (the matched route element)                         │
└───────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌── AUTH / SESSION (src/app/auth/*) ────────────────────────────────────────┐
│  AuthProvider asks Google for a token, finds/creates your Sheet,          │
│  builds a SheetsDatasource and stores it in the datasource store.         │
└───────────────────────────────────────────────────────────────────────────┘
                                   │  datasource exists
                                   ▼
┌── FETCH/CACHE (src/shared/io/queries/*) ──────────────────────────────────┐
│  OverviewPage calls useAccountsQuery(), useSnapshotsQuery(), …            │
│  each → useDatasourceQuery → React Query → datasource.loadX()             │
│  cached, keyed by ['sheet', sheetId, 'accounts'] etc.                     │
└───────────────────────────────────────────────────────────────────────────┘
                                   │  Account[] Snapshot[] FxRate[] …
                                   ▼
┌── STORAGE (src/shared/io/datasource/*, io/api/*) ─────────────────────────┐
│  SheetsDatasource.loadAccounts() → api/accounts.ts → gapi Sheets API      │
│  → parseAccountRows() turns rows-of-arrays into typed Account[]           │
└───────────────────────────────────────────────────────────────────────────┘
                                   │  typed models
                                   ▼
┌── DATA LAYER / ENGINE (src/core/*) ───────────────────────────────────────┐
│  useOverviewStats() (a thin adapter) builds:                              │
│    • a FilterSpec  ("what am I looking at": viewer, period, view)        │
│    • the contributors  [accounts, equity]                                │
│  then calls buildDataset(...) which:                                      │
│    scope → axis → value contributors → bucketize → trim                   │
│  → returns a Dataset (series + scalars), all viewer-scoped & time-aligned │
└───────────────────────────────────────────────────────────────────────────┘
                                   │  Dataset
                                   ▼
┌── VIEW (src/features/networth/*) ─────────────────────────────────────────┐
│  OverviewPage reads the Dataset slices and renders HeroCard,              │
│  OverviewChart, StatCardGrid — formatting numbers at the very edge        │
│  with fmt*/priv* helpers. No math in components.                          │
└───────────────────────────────────────────────────────────────────────────┘
```

Everything below is just zooming into one of these boxes.

---

## 4. The directory map: where everything lives

The project is organized **feature-first**: a *domain* (a kind of financial thing
the app tracks) is **one folder** that holds both its **data** and its **views**.
There are exactly five top-level buckets under `src/`:

```
src/
├── app/         ← the application SHELL: boot, routing, layouts, auth, guards
│   ├── main.tsx            entry point (providers + router)
│   ├── router.tsx          the entire route tree
│   ├── RootLayout.tsx      outermost layout: AuthProvider, theme, lang
│   ├── ProtectedLayout.tsx "are you allowed in?" gate
│   ├── AppShell.tsx        header + status bar + tabs + <Outlet/>
│   ├── OptionsGuard.tsx    feature-flag gate for the options section
│   ├── NotFound.tsx        404
│   └── auth/
│       ├── AuthProvider.tsx  all Google OAuth side-effects
│       └── bootstrap.ts      find/create the Google Sheet
│
├── shared/      ← everything used by MORE THAN ONE feature
│   ├── ui/          design-system primitives (Button, Dialog, StatCard…)
│   ├── components/  shared composite UI (Header, BottomTabBar, ChartTooltip…)
│   ├── utils/       pure helpers (currency, dates, ownership, stats, format…)
│   ├── stores/      Zustand global state (auth, ui, datasource, status, toast)
│   ├── hooks/       shared React hooks (useSheetData, useBreakpoint…)
│   ├── i18n/        translation setup + en.json / fr.json
│   └── io/          ALL input/output (the persistence + fetch layers)
│       ├── api/         per-tab Google Sheets read/write functions
│       ├── datasource/  the Datasource interface + sheets/xlsx impls + parse
│       ├── queries/     React Query hooks (queries, mutations, keys)
│       └── queryClient.ts
│
├── core/        ← the shared DATA KERNEL (imports NO feature)
│   ├── contract.contributor.ts  the ValuedContributor contract (the seam)
│   ├── filters.ts               FilterSpec + resolveFilterSpec
│   ├── scope.ts                 viewer ∩ active visibility helpers
│   ├── axis.ts                  period→date-range + merge dates into one axis
│   ├── dataset.ts               buildDataset() — the cross-domain composer
│   ├── errors.ts                API error classification
│   └── buckets/                 BucketStrategy (category|group|person)
│
├── features/    ← one folder per DOMAIN (data + views together)
│   ├── networth/   the cross-domain Overview roll-up
│   ├── accounts/   data/ + history/ + detail/ + entry/
│   ├── options/    data/ + OptionsPage + OptionsManagePage + components/
│   └── settings/   preferences, accounts, groups, people, import sections
│
└── types/       ← shared TypeScript types (sheets.ts: the raw models)
```

### The one rule that keeps this clean: **dependency direction**

Imports flow **one way only**:

```
features/  →  core/  →  shared/utils  →  types/
   │                         ▲
   └────────→ shared/* ──────┘
```

- **`core/` may import `shared/utils` and `types`, but NEVER a feature.** It is the
  kernel; it must not know that "accounts" or "options" exist. (The contributors
  *implement* `core`'s contract and live in features — `core` only knows the
  interface.)
- **A feature may import `core`, `shared`, and `types`.**
- **A feature should not import another feature** (the one sanctioned exception is
  `networth`, the cross-domain roll-up, which imports the accounts and options
  *contributors* because combining domains is literally its job — see §11).

If you ever feel tempted to `import` a feature from `core/`, stop: that means the
logic belongs in the feature, or the abstraction belongs in `core`'s contract.

---

## 5. Layer 0 — Storage: the datasource abstraction

**Job:** turn the outside world (a Google Sheet or an uploaded XLSX) into typed
TypeScript models, and write them back. Nothing above this layer knows or cares
which storage is behind it.

### 5.1 The `Datasource` interface — the contract

Everything starts at one interface. It is a list of `loadX()` / `writeX()` methods,
one pair per spreadsheet tab.

```ts
// src/shared/io/datasource/types.ts
export interface Datasource {
  readonly id: string;     // identity used as the React Query cache key
  readonly kind: string;   // 'sheets' | 'xlsx'

  loadAccounts(): Promise<Account[]>;
  loadSnapshots(): Promise<Snapshot[]>;
  loadConfig(): Promise<Partial<AppConfig>>;
  // …tags, groups, people, fx, option_companies, option_grants, option_fmv, option_exercises

  writeAccounts(accounts: Account[]): Promise<void>;
  writeSnapshots(snapshots: Snapshot[]): Promise<void>;
  // …matching writers
}
```

Two classes implement it:

| Class | File | Backed by |
|-------|------|-----------|
| `SheetsDatasource` | `src/shared/io/datasource/sheets.ts` | Google Sheets API (via `gapi`) |
| `XlsxDatasource` | `src/shared/io/datasource/xlsx.ts` | An in-memory SheetJS workbook |

Because both satisfy the same interface, **every layer above this point is
storage-agnostic.** Switching from Sheets to XLSX changes one object; nothing else.

### 5.2 The raw models (the "typed" in "typed models")

The shapes everything else speaks in live in [`src/types/sheets.ts`](../src/types/sheets.ts).
The important ones:

```ts
// src/types/sheets.ts
export interface Account {
  id: string;
  category: string;            // 'investments' | 'real_estate' | 'real_estate_debt' | …
  kind: 'asset' | 'debt';      // debt counts negative toward net worth
  ownership: OwnershipEntry[]; // [{ person_id, share }] — shares sum to 1
  active: boolean;
  tags: string[];              // for group matching
  currency?: Currency;         // 'CAD' | 'USD'; absent → main currency
  // …name_fr, name_en, sort_order, annual_rate, type
}

export interface Snapshot {     // one account's balance on one date
  date: string;                 // 'YYYY-MM-DD'
  account_id: string;           // or the special '__day__' for a day-level comment
  balance_raw: number;          // in the account's native currency, unsigned
  comment?: string;
  entered_at?: string;          // tiebreaker for duplicate (date, account) rows
}
```

> **Two quirks to memorize, because they show up everywhere:**
> 1. **Ownership is an array.** A joint account owned 50/50 is
>    `[{person_id:'self', share:0.5}, {person_id:'partner', share:0.5}]`. This is
>    why the data layer emits *one contribution per owner* (see §10).
> 2. **`account_id === '__day__'`** is a sentinel row that carries a *day comment*,
>    not a balance. Aggregation code skips it everywhere
>    (e.g. `account.contributor.ts:24`).

### 5.3 Parsing & serializing: rows ↔ models

Spreadsheets give you an **array of arrays** ("AOA"): row 0 is headers, the rest
are values. `src/shared/io/datasource/parse.ts` is the *only* place that converts
between AOA and typed models. It is shared by both datasources.

```ts
// src/shared/io/datasource/parse.ts:38 — AOA → typed Account[]
export function parseAccountRows(rows: unknown[][]): Account[] {
  if (rows.length < 2) return [];
  const headers = rows[0] as string[];
  return (rows.slice(1) as unknown[][]).map(r => {
    const obj = toObj(headers, r);          // header[i] → row[i], by name
    obj.ownership = ownershipFromRow(obj);  // parse the ownership column
    obj.active = obj.active === true || String(obj.active).toUpperCase() === 'TRUE';
    obj.tags = parseTagString(obj.tags);
    // …coerce numbers, validate currency
    return obj as unknown as Account;
  }).filter(a => a.id);                      // drop blank rows
}
```

**Security note you must not remove:** user-supplied spreadsheets could contain a
column literally named `__proto__`, `constructor`, or `prototype`. Assigning those
keys would pollute `Object.prototype` (prototype-pollution attack). `toObj` drops
them — see `parse.ts:25` (`UNSAFE_KEYS`). There's a regression test:
`src/tests/parseProtoPollution.test.ts`.

Serializers do the reverse (`serializeAccounts`, `serializeSnapshots`, …) and are
used by the writers.

### 5.4 `SheetsDatasource` — Google Sheets

A thin object that delegates reads to per-tab functions in `src/shared/io/api/*`
and writes through `safeWriteTab`:

```ts
// src/shared/io/datasource/sheets.ts:16
export class SheetsDatasource implements Datasource {
  readonly kind = 'sheets';
  constructor(readonly id: string, private readonly qc: QueryClient) {}

  loadAccounts()  { return loadAccounts(this.id); }   // → api/accounts.ts → gapi
  async writeAccounts(accounts: Account[]) {
    const rows = serializeAccounts(accounts);
    await safeWriteTab(this.id, 'accounts', rows, this.prev(qk.accounts(this.id)));
  }
  // …one pair per tab
}
```

`this.id` is the **Google Sheet's file ID** — which doubles as the cache key (§6).
The `api/*` files (`accounts.ts`, `config.ts`, `fx.ts`, `options.ts`, …) are the
only code that calls `gapi.client.sheets.*` directly.

### 5.5 `XlsxDatasource` — the no-backend mode

Wraps a SheetJS `WorkBook`. Three things make it special:

1. **Its `id` is the constant `'__xlsx__'`** (`xlsx.ts:29`) — there's only ever one
   uploaded file, so the cache key is fixed.
2. **It persists to `sessionStorage`** so a page refresh doesn't lose your upload.
   `saveToSession()` base64-encodes the whole workbook; `restoreSession()` reads it
   back on store creation (`xlsx.ts:36`, and `datasource.store.ts:11`).
3. **Writes mutate the in-memory workbook and re-save the session** (`xlsx.ts:90`).
   `downloadXlsx()` lets the user export the file.

That session-restore is wired at store-construction time:

```ts
// src/shared/stores/datasource.store.ts:10
export const useDatasourceStore = create<DatasourceState>((set) => ({
  datasource: XlsxDatasource.restoreSession(),   // ← survives refresh in xlsx mode
  setDatasource: (datasource) => {
    if (datasource instanceof XlsxDatasource) datasource.saveToSession();
    else if (datasource === null) XlsxDatasource.clearSession();
    set({ datasource });
  },
}));
```

---

## 6. Layer 1 — Fetch & cache: React Query

**Job:** call the datasource's `loadX()` methods, cache the results, and re-fetch
when needed — without each page worrying about loading states, retries, or
staleness.

### 6.1 The shared query wrapper

Every read goes through one helper that does three things: key the cache by the
active datasource's id, only run once a datasource exists, and forward the loader.

```ts
// src/shared/io/queries/sheetQueries.ts:18
function useDatasourceQuery<T>(
  keyFor: (id: string) => readonly unknown[],
  load: (ds: Datasource) => Promise<T>,
  opts: { staleTime?: number; extraEnabled?: boolean } = {},
) {
  const ds = useDatasource();                 // the Zustand datasource store
  return useQuery({
    queryKey: keyFor(ds?.id ?? ''),           // ['sheet', <id>, 'accounts']
    queryFn: () => load(ds!),
    enabled: !!ds && (opts.extraEnabled ?? true),
    staleTime: opts.staleTime,
  });
}

export function useAccountsQuery() {
  return useDatasourceQuery(qk.accounts, ds => ds.loadAccounts(), { staleTime: STALE_5M });
}
```

### 6.2 Cache keys — `qk`

All keys are minted from one factory so they never drift:

```ts
// src/shared/io/queries/keys.ts
export const qk = {
  accounts:  (s: string) => ['sheet', s, 'accounts'] as const,
  snapshots: (s: string) => ['sheet', s, 'snapshots'] as const,
  // …config, tags, groups, people, fx_rates, option_*
};
```

Because the key includes the datasource id, **switching datasource automatically
invalidates everything** — a brand-new sheet id means brand-new keys, so React
Query refetches. `categoryMeta` and `accountTypes` are seeded from a static JSON
file, not the sheet, so they key on a constant and use `staleTime: Infinity`.

### 6.3 The convenience aggregator

Most pages want the "common five" tables. `useSheetData()` bundles them:

```ts
// src/shared/hooks/useSheetData.ts:10
export function useSheetData() {
  const accounts  = useAccountsQuery();
  const snapshots = useSnapshotsQuery();
  // …categoryMeta, config, tags, groups
  return {
    accounts: accounts.data ?? [],
    snapshots: snapshots.data ?? [],
    // …
    isLoading: accounts.isLoading || snapshots.isLoading || config.isLoading,
    isError:   accounts.isError   || snapshots.isError   || config.isError,
  };
}
```

### 6.4 Writes — mutations with optimistic updates

Writes live in `src/shared/io/queries/sheetMutations.ts`. The interesting one is
the snapshot save: it updates the cache **optimistically** (instantly, before the
network), then rolls back on error.

```ts
// src/shared/io/queries/sheetMutations.ts:11 (abridged)
export function useSaveSnapshotMutation() {
  return useMutation({
    mutationFn: async (snapshot) => { /* write merged rows to datasource */ },
    onMutate: async (snapshot) => {              // optimistic: patch cache now
      await qc.cancelQueries({ queryKey: qk.snapshots(ds.id) });
      const prev = qc.getQueryData(qk.snapshots(ds.id));
      qc.setQueryData(qk.snapshots(ds.id), old => /* upsert snapshot */);
      return { prev };                           // remember for rollback
    },
    onError: (_e, _s, ctx) => qc.setQueryData(qk.snapshots(ds.id), ctx.prev), // rollback
    onSuccess: (rows) => qc.setQueryData(qk.snapshots(ds.id), rows),
  });
}
```

The simpler mutations (accounts, tags, groups, people, config, options) just write
then `invalidateQueries` so the next read refetches.

---

## 7. Session & authentication: Google OAuth

**Job:** get a Google access token, locate (or create) the user's Sheet, and turn
that into a live `SheetsDatasource`. All of this is isolated in
`src/app/auth/`. This is the single most side-effect-heavy part of the app, so it
is quarantined here and exposed to the rest of the app as just three things:
`signIn()`, `signOut()`, `canSignIn`.

### 7.1 The two Google libraries

Google's auth is split across two scripts loaded in `index.html`:

- **GAPI** (`gapi.client`) — makes the actual Sheets/Drive REST calls.
- **GIS** (`google.accounts.oauth2`) — does the OAuth token dance.

`AuthProvider` waits for both to load, then initializes them
(`initGapi`/`initGis`, `AuthProvider.tsx:150` & `:164`). Readiness is tracked in
the auth store:

```ts
// src/shared/stores/auth.store.ts:56
export const selectApisReady = (s) => s.gapiReady && s.gisReady;
```

### 7.2 The sign-in flow, step by step

1. **User clicks "Sign in with Google"** → `signIn()` calls
   `tokenClient.requestAccessToken()` (`AuthProvider.tsx:285`).
2. **Google returns a token** → `handleTokenResponse` stores it, schedules a
   refresh, and (on a real sign-in, not a background refresh) calls `onSignedIn`
   (`AuthProvider.tsx:119`).
3. **`onSignedIn`** fetches the user's email (for the next login hint) and calls
   **`bootstrapSheet()`** (`AuthProvider.tsx:100`).
4. **`bootstrapSheet`** (`src/app/auth/bootstrap.ts:11`):
   - reuse the cached sheet id if it still verifies, else
   - find a sheet named "Net Worth Tracker", else
   - **create** one and **seed** it with default tabs/data;
   - then **construct the `SheetsDatasource`** and put it in the datasource store:
     ```ts
     // bootstrap.ts:47
     useDatasourceStore.getState().setDatasource(new SheetsDatasource(sheetId, queryClient));
     queryClient.invalidateQueries({ queryKey: ['sheet', sheetId] });
     setIsDataLoaded(true);
     ```

The instant the datasource lands in the store, every `useDatasourceQuery` becomes
`enabled` and the page's data loads. That's the seam between "session" and "fetch."

### 7.3 Token lifetime & resilience

The provider is careful about a few real-world problems:

- **Silent restore on load:** once APIs are ready, it tries `requestAccessToken({prompt:''})`
  with a stored `login_hint` so returning users don't see a popup
  (`AuthProvider.tsx:219`).
- **Proactive refresh:** a timer fires 5 minutes before expiry to refresh the token
  (`scheduleRefresh`, `:61`), and the `visibilitychange` handler refreshes when you
  re-focus a tab near expiry (`:238`).
- **Bootstrap retry:** if bootstrap failed while the tab was hidden, refocusing
  retries it (`:257`).
- **StrictMode double-mount guard:** a module-level `_tokenClientInitialized` flag
  prevents double-initializing the token client (`:13`).

### 7.4 What the rest of the app sees

Components never touch any of this. They read derived booleans from the store:

```ts
selectIsSignedIn  = (s) => s.accessToken !== null   // auth.store.ts:55
isBootstrapping, isDataLoaded                        // gates "Setting up…" UI
```

`signOut()` revokes the token, clears the datasource, and resets state
(`AuthProvider.tsx:294`).

---

## 8. State management: the three kinds of state

This is the question that trips up newcomers: *"where do I put this piece of
state?"* There are exactly three homes, each with a clear job.

| Kind | Lives in | Examples | Persisted? |
|------|----------|----------|------------|
| **Server state** (data we loaded) | **React Query** | accounts, snapshots, config, fx rates, options | cached in memory, refetched |
| **Client state** (app-wide UI) | **Zustand stores** | current viewer, view toggle, theme, language, private mode, auth tokens, datasource | some persisted to `localStorage` |
| **Navigational state** (what's in the URL) | **URL search params** | `?period=1y`, `?account=acc_123` | it's the URL, shareable/bookmarkable |

> **The decision rule:**
> - Did it come from the spreadsheet? → **React Query** (never copy it into Zustand).
> - Is it a global preference or session fact? → **Zustand**.
> - Should it survive a refresh *and* be in a shareable link? → **URL param**.

### 8.1 The Zustand stores

Each store is a small `create()` in `src/shared/stores/`:

| Store | Holds | Persisted to |
|-------|-------|--------------|
| `auth.store.ts` | tokens, sheet id, readiness, bootstrap status | sheet id → `localStorage` |
| `datasource.store.ts` | the active `Datasource` object | xlsx → `sessionStorage` |
| `ui.store.ts` | `currentViewer`, `ovView`, theme, lang, privateMode, series visibility | `localStorage` (`pfs_ui`) |
| `status.store.ts` | the status-bar message | no |
| `toast.store.ts` | transient toasts | no |
| `dialog.store.ts` | shared dialog open-state | no |

`ui.store` shows the persistence pattern (Zustand `persist` middleware +
`partialize` to choose what's saved):

```ts
// src/shared/stores/ui.store.ts:24
export const useUIStore = create<UIState>()(
  persist((set) => ({
    currentViewer: LEGACY_SELF_ID,   // who we're "viewing as"
    ovView: 'category',              // category | group | person toggle
    // …theme, lang, privateMode, ovSeriesVisible
  }), {
    name: 'pfs_ui',
    storage: createJSONStorage(() => localStorage),
    partialize: (s) => ({ /* only these keys are saved */ }),
  }),
);
```

> **`currentViewer`** is the single most important UI value to understand. It is
> either a person id (e.g. `'self'`) or the sentinel `HOUSEHOLD_VIEWER`
> (`'__household__'`). It answers *"whose money am I looking at?"* and is fed into
> every `FilterSpec`. "Viewing as Partner" simply sets this to `'partner'`.

### 8.2 Why we never copy server state into Zustand

If you stuffed `accounts` into a Zustand store, you'd have two sources of truth and
a stale-cache bug waiting to happen. React Query already *is* your accounts cache.
Read it with `useAccountsQuery()` wherever you need it; it's deduped and shared.

---

## 9. Navigation & routing

**Job:** map URLs to pages, wrapped in the right layers of "are you allowed here?"
The entire route tree lives in **one file**: `src/app/router.tsx`. Read it
top-to-bottom and you know every screen in the app.

### 9.1 The nesting (layouts as Russian dolls)

```
RootLayout                         ← AuthProvider, theme, lang, toast host
└── ProtectedLayout                ← "signed in OR xlsx mode?" gate
    └── AppShell                   ← header + status bar + bottom tabs + <Outlet/>
        ├── /overview              → OverviewPage              (networth feature)
        ├── /portfolio  (SectionLayout, sub-nav: History/Detail/Manage)
        │   ├── /portfolio/history → HistoryPage               (accounts feature)
        │   ├── /portfolio/detail  → DetailPage                (accounts feature)
        │   └── /portfolio/manage  → AccountsSection           (settings feature)
        ├── /entry, /entry/:date   → EntryPage                 (accounts feature)
        ├── /settings   (SettingsSectionLayout)
        │   ├── (index)            → PreferencesSection
        │   ├── /settings/groups   → GroupsSection
        │   ├── /settings/people   → PeopleSection
        │   └── /settings/import   → ImportSection
        └── /options    (OptionsGuard → SectionLayout)
            ├── (index)            → OptionsPage               (options feature)
            └── /options/manage    → OptionsManagePage         (options feature)
```

Each nesting level is a React Router *layout route* — it renders some chrome plus
an `<Outlet/>` where the child renders. `AppShell.tsx:98` is the canonical example:
header, the XLSX banner, status bar, an `<Outlet/>` for the page, and a bottom tab
bar on mobile.

### 9.2 The two gates (guards)

**`ProtectedLayout`** — the "are you allowed in at all?" gate:

```ts
// src/app/ProtectedLayout.tsx:11
if (datasource?.kind === 'xlsx') return <Outlet />;      // xlsx mode: always allowed
if (!isSignedIn) return <Navigate to="/" replace />;      // not signed in → home
if (isBootstrapping || !isDataLoaded) return <SettingUp/>;// loading → spinner
return <Outlet />;                                         // good → render the page
```

**`OptionsGuard`** — the **feature-flag** gate. The Stock Options section only
exists if the user enabled it in config:

```ts
// src/app/OptionsGuard.tsx:5
const configQuery = useConfigQuery();
if (configQuery.isPending) return <Skeleton/>;
if (!configQuery.data?.stock_options_enabled) return <Navigate to="/overview" replace />;
return <Outlet />;
```

This is the pattern to copy if you add a flag-gated feature (see §14.4).

### 9.3 Sub-navigation & redirects

`SectionLayout` renders a sub-nav from a `links` array passed in router.tsx
(`ACCOUNTS_LINKS`, `OPTIONS_LINKS` at `router.tsx:25`). Old pre-restructure URLs
are preserved with `<Navigate>` redirects (`router.tsx:103`) so bookmarks survive.

The router is created with `basename: '/pfs-tool/'` (`router.tsx:114`) because the
app is hosted under a sub-path.

---

## 10. Layer 2/3 — The data layer (the engine)

This is the heart of the app and the part most worth understanding deeply. **Job:**
take raw models + a description of "what am I looking at" and produce a normalized,
viewer-scoped, time-aligned `Dataset` that any page can render without doing math.

Everything here is in `src/core/` and is **pure** (no React, no I/O, no clock
reads) — which is why it's exhaustively unit-tested.

> Read [ARCHITECTURE.md §3](ARCHITECTURE.md) for *why* it's shaped this way (the
> "before" was the same funnel copy-pasted into five pages). This section is *how*
> it works mechanically.

### 10.1 `FilterSpec` — "what am I looking at"

One object describes the entire query. It's resolved **once** from the URL + UI
store, so the "is this in the URL or in Zustand?" question stops leaking into pages.

```ts
// src/core/filters.ts:14
export interface FilterSpec {
  viewer: string;        // person id, or HOUSEHOLD_VIEWER for everyone
  period: Period;        // '3m'|'6m'|'1y'|'2y'|'3y'|'5y'|'ytd'|'all'
  view: OverviewView;    // 'category' | 'group' | 'person'
  accountId: string;     // single-account drill-down; '' = none
  includeInactive: boolean;
}

export function resolveFilterSpec(params: URLSearchParams, inputs: FilterInputs): FilterSpec {
  const period = (params.get('period') as Period) ?? inputs.defaultPeriod ?? 'all';
  const accountId = params.get('account') ?? '';
  // "By person" only makes sense for the whole household → fall back to category
  const view = inputs.view === 'person' && inputs.viewer !== HOUSEHOLD_VIEWER
    ? 'category' : (inputs.view ?? 'category');
  return { viewer: inputs.viewer, period, view, accountId, includeInactive: inputs.includeInactive ?? false };
}
```

### 10.2 The `ValuedContributor` contract — the extension seam

This is **the** interface to understand. Anything that contributes value to net
worth — accounts today, stock options today, *crypto/pensions/whatever tomorrow* —
implements it. The engine asks each contributor **two questions** and never learns
which kind it is.

```ts
// src/core/contract.contributor.ts:54
export interface ValuedContributor {
  readonly id: string;
  isEnabled(spec: FilterSpec): boolean;                 // cheap gate (disabled feature = free)
  checkpointDates(range: DateRange): string[];          // Q1: which dates do you change on?
  valuesOver(axis: string[], ctx: ValueContext): Contribution[][]; // Q2: what are you worth on each axis date?
}
```

A **`Contribution`** is the unit of output. Crucially, **it carries no date** — it
is a *sample* ("what are you worth as of the date the engine asked about"), not an
*event*. And it is **per-owner**:

```ts
// src/core/contract.contributor.ts:11
export interface Contribution {
  amount: number;    // THIS owner's slice, in main currency, signed (debt < 0)
  category: string;  // 'investments' | 'equity' | … (raw, not folded)
  ownerId: string;   // the single owner this slice belongs to
  sourceId: string;  // account/company id (drill-down + memo keys)
  tags?: string[];   // for group matching
}
```

> **Why two questions instead of "give me everything"?** Net worth on day *D* is the
> sum of *every* contributor valued on *D*, so all series must share one x-axis. But
> account-entry days and stock-vesting days don't line up. So it's two passes:
> first collect everyone's dates and **merge** them into one axis (Q1); then value
> everyone on that merged axis (Q2), each contributor **carrying its last value
> forward** onto dates it has no native point for. See the worked example in
> [ARCHITECTURE.md](ARCHITECTURE.md) ("Merged axis").

> **Why per-owner?** A joint 50/50 account emits **two** contributions (self-half,
> partner-half). Then *every* downstream concern collapses to "group by `ownerId`":
> household total = sum all; viewing as one person = keep `ownerId === viewer`;
> person view = bucket by `ownerId`. This single idea dissolves the old `share`
> multiplier and the old "leading empty dates" bug.

### 10.3 The two real contributors

**Accounts** (`src/features/accounts/data/account.contributor.ts`). Snapshot/LOCF
("last observation carried forward"). Note the per-owner loop:

```ts
// account.contributor.ts:33 (abridged)
valuesOver(axis, ctx) {
  const sweep = buildBalanceSweep(snapshots, axis);   // balance per account per axis date
  return axis.map((date, i) => {
    const usdCad = ctx.fxRateFor(date);
    const out = [];
    for (const [accountId, balanceRaw] of Object.entries(sweep[i])) {
      const a = acctById.get(accountId);
      const signed = toMain(balanceRaw, a.currency ?? ctx.main, ctx.main, usdCad) * (a.kind === 'debt' ? -1 : 1);
      for (const o of a.ownership) {                   // ← one Contribution per owner
        if (!(o.share > 0)) continue;
        out.push({ amount: signed * o.share, category: a.category, ownerId: o.person_id, sourceId: a.id, tags: a.tags });
      }
    }
    return out;
  });
}
```

**Stock options** (`src/features/options/data/equity.contributor.ts`). There are no
stored snapshots — value is *computed* from the vesting schedule, FMV history, and
exercises. Each company has a *single* owner, so it emits one contribution per
company. Its `checkpointDates` derives **exact vesting days** from the schedule
(`vestingCheckpoints`, `equity.contributor.ts:19`) — deliberately not the
month-snapping `generateMonthlyDates`, which would drop equity to month precision.

It also reads `ctx.equityDate` (the "value time-vesting assets at ~today for the
current scalar" hook) so the contributor never reads the wall clock — the as-of
date is always injected by the engine.

### 10.4 `BucketStrategy` — the grouping seam

The category/group/person toggle is real polymorphism, not an `if`. Each grouping
is a self-contained strategy in `src/core/buckets/`:

```ts
// src/core/buckets/types.ts:36
export interface BucketStrategy {
  buckets: BucketDef[];                          // the series/legend entries (stable order)
  assign(c: Contribution): BucketAssignment[];   // which bucket(s) a contribution lands in
}
```

| Strategy | File | `assign` logic |
|----------|------|----------------|
| category | `category.strategy.ts` | fold category id; equity is its own bucket |
| group | `group.strategy.ts` | match the contribution's tags against group rules → **may return several** |
| person | `person.strategy.ts` | `'person:' + ownerId` → exactly one |

The person strategy is almost trivial *because* contributions are already
per-owner:

```ts
// src/core/buckets/person.strategy.ts:25
assign(c) {
  const key = 'person:' + c.ownerId;
  return keys.has(key) ? [{ bucketKey: key, amount: c.amount }] : [];
}
```

`bucketStrategy(view, models)` (`buckets/index.ts:19`) picks the right one from a
lookup table — so adding a fourth grouping is "write a file, add one entry."

### 10.5 The axis: from period to a shared timeline

```ts
// src/core/axis.ts
periodRange(period, datesSorted) → { start?, end }    // the date window for a period
buildAxis(contributors, spec, range)                  // each contributor's checkpointDates → merged, sorted, deduped
```

`buildAxis` is Q1 in action: collect every enabled contributor's checkpoint dates
and `mergeAxis` them into one sorted, day-level timeline.

### 10.6 `buildDataset` — the composer (where it all comes together)

`src/core/dataset.ts` is the one place the funnel actually runs. Its output:

```ts
// src/core/dataset.ts:21
export interface Dataset {
  chartDates: string[];                    // trimmed x-axis
  netData: (number | null)[];              // net worth series
  buckets: DatasetBucketSeries[];          // one series per bucket (category|group|person)
  netWorth: number;  byCategory: Record<string, number>;          // "current" scalars
  prevNetWorth: number | null; prevByCategory: Record<string, number> | null;  // period-start scalars
  groupValues: Map<string, number>;  personValues: Map<string, number>;  // + their prev*
  latestDate: string | null; periodRefDate: string | null;
}
```

The algorithm, in order (`dataset.ts:81`):

1. **Filter to enabled contributors**, and define a `scope` function: household →
   keep all; a single viewer → keep `ownerId === viewer` (`dataset.ts:84`).
2. **Scalars first.** Value everyone at the latest date (equity at ~`today`) and at
   the period-reference date, scope, then sum/bucket into `netWorth`, `byCategory`,
   group/person values, and their `prev*` counterparts (`dataset.ts:92–120`).
3. **Series.** For each axis date: value every contributor, scope, add into `net[i]`
   and each bucket's series; track `firstSeen` per bucket for leading-null behavior
   and `hasAny[i]` for "did this date count for the viewer" (`dataset.ts:135–160`).
4. **Trim** leading dates that are null across every *visible* series — **once**, in
   one place (`dataset.ts:166–175`). This is the bug-prone step that used to be
   copy-pasted into five files.

> **Two intentional "legacy quirks" are reproduced here** so output is byte-identical
> to the old per-page code (and frozen by golden-master tests):
> - `foldByCategory` zero-seeds account categories even when the viewer owns none,
>   so category cards still render (`dataset.ts:60`).
> - `firstSeen` is computed from "presence": account presence is viewer-independent,
>   but equity only counts once visible to the viewer (`dataset.ts:152`).
> If you change these, the golden tests will (correctly) scream.

### 10.7 Putting the engine together (the call site)

A page never calls all of this by hand. `useOverviewStats` is the thin adapter that
wires it up — this is the template you'll imitate:

```ts
// src/features/networth/useOverviewStats.ts:92 (abridged)
const contributors = [makeAccountContributor(accounts, snapshots)];
if (optionData?.companies.length) contributors.push(makeEquityContributor(/* … */));

const bucketModels = { categoryMeta, groups, people: activePeople, hasEquity, tr };
const spec = { viewer, period: 'all', view, accountId: '', includeInactive: false };

const ds = buildDataset({
  contributors, axis: filteredDates, datesSorted, spec, bucketModels,
  main, fxRateFor, today: todayISO(), seriesVisible,
});
// then reshape ds.* into the OverviewStats the page renders
```

---

## 11. Domain data: features and their selectors

`core/` handles **cross-domain net worth**. But each domain also has views that
need shapes the net-worth `Dataset` can't express — and that logic lives in the
domain's own `data/` folder as **selectors** (pure functions; the suffix
`.selectors.ts` means "data shaping for views").

A **domain** is a kind of financial thing the app tracks. Today there are two:

| Domain | Contributor (→ net worth) | Selectors (domain-only views) |
|--------|---------------------------|-------------------------------|
| **accounts** | `data/account.contributor.ts` | `data/history.selectors.ts`, `data/detail.selectors.ts`, `data/entry.selectors.ts` |
| **options** | `data/equity.contributor.ts` | `data/equity.selectors.ts` |

Examples of "shapes the net-worth Dataset can't express":

- **History** needs *cards per month* with incomplete-data flags
  (`buildHistoryCards`, `history.selectors.ts:113`).
- **Detail** needs a *year-over-year table* with category headers and per-account
  rows (`buildDetailModel`, `detail.selectors.ts:67`).
- **Entry** needs *running totals as you type* (`computeEntryTotals`,
  `entry.selectors.ts:27`).
- **Options** needs *"504 vested / 396 unvested shares"* and vesting schedules
  (`companyEquitySummary`, `equity.selectors.ts:26`) — pure equity detail, not a
  net-worth slice.

Notice the accounts selectors **reuse the same contributor** the engine uses
(`history.selectors.ts:45` calls `makeAccountContributor(...).valuesOver(...)`), so
History's series and Overview's net agree by construction.

> **`networth` is not a domain — it's the cross-domain roll-up.** It's the *only*
> place the two domains meet: `useOverviewStats` imports both contributors and
> hands them to `buildDataset`. History/Detail use accounts only; the Options page
> uses equity only; Overview uses both. That's the sanctioned cross-feature import
> from §4.

---

## 12. Layer 4 — The view layer

**Job:** render a selector's / dataset's output. **The invariant: no data logic in
a component.** No aggregation, no scoping, no valuation, no FX math in a `.tsx`
file. Components receive numbers and arrays and turn them into pixels, formatting
at the very last moment.

### 12.1 The anatomy of a page

`OverviewPage.tsx` is the model page. It does exactly four things:

```ts
// src/features/networth/OverviewPage.tsx (structure)
// 1. READ STATE: UI store (viewer/view/private) + URL params (period)
const spec = resolveFilterSpec(searchParams, { viewer, view: ovView, defaultPeriod: 'all' });

// 2. FETCH: React Query hooks for every table it needs
const accountsQ = useAccountsQuery(); /* …snapshots, groups, config, options, fx, people */

// 3. COMPUTE: hand everything to the data-layer adapter
const stats = useOverviewStats({ snapshots, accounts, …, viewer });

// 4. RENDER: pass slices to dumb components; format at the edge
return <HeroCard netWorth={stats.netWorth} … /> /* OverviewChart, StatCardGrid */;
```

It reads state, fetches, computes via the data layer, and renders. **It never
sums, scopes, or converts a currency itself.** When you build a page, this is the
shape.

### 12.2 The three tiers of UI components

| Tier | Folder | Knows about the domain? | Examples |
|------|--------|------------------------|----------|
| **Design-system primitives** | `shared/ui/` | No — generic | `Button`, `Dialog`, `Select`, `StatCard`, `Amount`, `Delta`, `Skeleton` |
| **Shared composites** | `shared/components/` | App-aware, feature-agnostic | `Header`, `BottomTabBar`, `ChartTooltip`, `SectionLayout`, `ViewingAsBadge` |
| **Feature components** | `features/<x>/components/` | Yes — that feature | `HeroCard`, `OverviewChart`, `HistoryCard`, `CompanyVestingChart` |

`shared/ui/index.ts` re-exports the primitives so you can
`import { Button, Dialog } from '@/shared/ui'`. A new generic widget goes in
`shared/ui`; a widget only the options pages use goes in `features/options/components`.

### 12.3 Formatting & privacy — the "edge"

Numbers become strings only at render time, via `shared/utils/format.ts`
(`fmtMoney`, `fmtCur`, `fmtDelta`) and `shared/utils/privacy.ts` (the `priv*`
helpers that mask amounts when **private mode** is on). The shared chart tooltip
(`shared/components/ChartTooltip.tsx`) is the single tooltip renderer for all
charts. If you find yourself writing `.toLocaleString()` in a component, reach for
these instead.

---

## 13. Shared cross-cutting concerns

These are the utilities every feature leans on. Know they exist so you don't
reinvent them. All live under `src/shared/utils/` unless noted.

### 13.1 Money: `currency.ts`

The money primitives. The historically-central one is `signedMain`, which folds
**three** funnel stages into one number:

```ts
// src/shared/utils/currency.ts:41
signedMain(account, balanceRaw, main, usdCad, viewer)
  = toMain(balanceRaw, account.currency, main, usdCad)   // 1. FX conversion
  × viewerShare(account.ownership, viewer)                // 2. scope to viewer
  × (account.kind === 'debt' ? -1 : 1);                   // 3. debt sign
```

> Note: the *new* contributor path (§10.3) deliberately **does not** use
> `signedMain` for the viewer-share step — it emits per-owner contributions and
> lets the engine scope. `signedMain` is still used by the older domain selectors
> (Detail, Entry, History cards). Both produce identical numbers; the cross-check
> tests prove it. Use `toMain` + per-owner emission in new contributors;
> `signedMain` is fine in a single-shot selector.

Also here: `fxMap(rates)` builds a date→rate map, and `rateFor(map, date)` returns
the nearest-prior rate for a date (`currency.ts:6` & `:13`).

### 13.2 Ownership & scoping: `ownership.ts`

- `HOUSEHOLD_VIEWER = '__household__'` — the "everyone" sentinel (`ownership.ts:9`).
- `viewerShare(ownership, viewer)` — a person's fractional share of an account.
- `accountsVisibleToViewer(accounts, viewer)` — filter to accounts the viewer holds
  a stake in. Used by `core/scope.ts` for empty-state checks.

### 13.3 Dates: `dates.ts`

- `todayISO()` — current date as `YYYY-MM-DD` (injected into the engine, never read
  inside it).
- `deriveDatesSorted(snapshots)` — all distinct snapshot dates, sorted.
- `getDatesForPeriod(datesSorted, period)` — slice to a period window. (`core/axis.ts`
  mirrors these windows so the contributor axis matches the legacy date list.)

### 13.4 Aggregation helpers: `stats.ts`

- `buildBalanceSweep(snapshots, dates)` — for each date, the carried-forward balance
  of every account (LOCF). The workhorse the accounts contributor sits on.
- `buildEffectiveBalances(snapshots, asOfDate)` — balances as of a single date (used
  by the Detail year-over-year table).

### 13.5 Categories & groups: `colors.ts`

- `foldCategoryId(id)` — folds `real_estate_debt` into `real_estate` for display.
- `accountMatchesGroup({tags}, group)` — the tag-rule matcher the group strategy uses.

### 13.6 i18n: `shared/i18n/`

Two JSON catalogs (`en.json`, `fr.json`) + an i18next init. The helper `tr(entity)`
resolves a bilingual `{name_en, name_fr}` to the active language
(`i18n/index.ts:21`). **`core/` is intentionally i18n-free** — label resolution is
*injected* into it via `BucketModels.tr` so the kernel stays pure.

### 13.7 Theme, language, breakpoints (hooks)

`shared/hooks/` holds the app-wide effects: `useTheme` (applies light/dark),
`useAppLang` (syncs i18n to the store), `useBreakpoint('md')` (responsive),
`useKeyboardShortcuts`, `useFxAutoFill` (backfills missing FX rates), and
`useSyncPreferencesFromConfig`. These are mounted high up (RootLayout / AppShell)
so the whole tree gets them.

---

## 14. How to add a feature (the guide)

This is the payoff section. There are **four common kinds of change**, ordered from
most-additive (touch nothing else) to most-involved. Pick the one that matches your
goal and follow the recipe. Each recipe lists exactly what you write and what you
must **not** touch.

> **The golden rule of extension:** the two seams (`ValuedContributor` and
> `BucketStrategy`) mean the most common changes are *new files that implement an
> interface*, with **zero edits** to the engine (`scope`, `axis`, `dataset`, `trim`,
> `format`) or to existing pages.

### 14.1 Recipe A — Add a new asset type (a new domain) → write a `ValuedContributor`

**Goal:** make a new kind of asset (say, **crypto**) count toward net worth and
appear on Overview/History automatically.

**You write:**

1. **Raw types** in `src/types/sheets.ts` (e.g. `CryptoHolding`, `PricePoint`), and
   a tab schema if it's persisted.
2. **Storage:** add `loadCrypto()/writeCrypto()` to the `Datasource` interface
   (`datasource/types.ts`), implement in both `sheets.ts` and `xlsx.ts`, add the
   parse/serialize pair in `parse.ts`, and a cache key in `keys.ts` +
   query hook in `sheetQueries.ts`. (Mirror how `options` is wired.)
3. **The contributor** — the heart of it — at
   `src/features/crypto/data/crypto.contributor.ts`:

   ```ts
   import type { ValuedContributor, ValueContext, Contribution, DateRange } from '@/core/contract.contributor';

   export function makeCryptoContributor(holdings: CryptoHolding[], prices: PricePoint[]): ValuedContributor {
     return {
       id: 'crypto',
       isEnabled: () => holdings.length > 0,

       // Q1: which dates do I change on? (price points, buys/sells)
       checkpointDates({ start, end }: DateRange) {
         const out = new Set<string>();
         for (const p of prices) if ((!start || p.date >= start) && p.date <= end) out.add(p.date);
         return [...out].sort();
       },

       // Q2: what am I worth on each axis date? One Contribution per owner.
       valuesOver(axis, ctx: ValueContext) {
         return axis.map(date => {
           const usdCad = ctx.fxRateFor(date);
           return holdings.map(h => ({
             amount: toMain(unitsHeldAt(h, date) * priceAt(prices, h, date), h.currency ?? ctx.main, ctx.main, usdCad),
             category: 'crypto',
             ownerId: h.owner,
             sourceId: h.id,
             tags: h.tags,
           }));
         });
       },
     };
   }
   ```

4. **Register it** by pushing it into the contributors array in
   `useOverviewStats.ts` (one line, next to `makeEquityContributor`).
5. If you want a **crypto card on Overview**, add a `'crypto'` category bucket the
   same way equity is handled in `category.strategy.ts`.

**You do NOT touch:** `scope`, `axis`, `dataset`, the trim logic, the group/person
strategies, or any page's render code. FX, debt sign, viewer scoping, axis-merge,
carry-forward, and trim are inherited for free.

**Tests to add:** a `crypto.contributor.test.ts` (checkpointDates + valuesOver
against a tiny fixture), and — if it touches Overview output — confirm the
golden-master snapshots update intentionally.

### 14.2 Recipe B — Add a new way to group → write a `BucketStrategy`

**Goal:** a new Overview grouping, e.g. "by institution."

**You write:**

1. `src/core/buckets/institution.strategy.ts` implementing `BucketStrategy`
   (`buckets()` to define the legend entries, `assign()` to map a contribution to
   bucket(s)). Copy `person.strategy.ts` as the simplest template.
2. Add `'institution'` to the `OverviewView` union (`core/filters.ts:6`) and to the
   `STRATEGIES` lookup in `buckets/index.ts:12`.
3. Add the toggle option in the `ViewToggle` component.

**You do NOT touch:** contributors, valuation, trim, or formatting.

### 14.3 Recipe C — Add a new filter → extend `FilterSpec`

**Goal:** a new way to narrow the data, e.g. "only show CAD accounts."

**You write:**

1. A field on `FilterSpec` (`core/filters.ts:14`), e.g. `currency?: Currency`.
2. Read it in `resolveFilterSpec` (from a URL param or the UI store).
3. Apply it in the one stage that should honor it — typically the `scope` function
   in `dataset.ts:84`, or a contributor's `valuesOver`.

**You do NOT touch:** strategies, pages other than the toggle that sets the param.

### 14.4 Recipe D — Add a whole new screen/section (with optional feature flag)

**Goal:** a new top-level section like "Goals," possibly behind a config flag.

**You write:**

1. **The page(s)** under `src/features/goals/` (and any `data/*.selectors.ts` for
   its math — keep logic out of the `.tsx`).
2. **Routes** in `src/app/router.tsx`: add a `SectionLayout` with a `*_LINKS` array
   for sub-nav, and child routes. Copy the `/options` block.
3. **A guard** if it's flag-gated: copy `OptionsGuard.tsx`, point it at your config
   flag, and wrap the routes (`router.tsx:88`). Add the flag to `AppConfig`
   (`types/sheets.ts:85`), `parseConfigRows`/`serializeConfig` (`parse.ts:83`/`:244`),
   and a settings toggle.
4. **Navigation entry** in the tab bar / nav components if it's a primary section.
5. **i18n keys** in `en.json` + `fr.json` for every label.

**You do NOT touch:** the data engine, unless the screen introduces a new asset
type (then it's Recipe A first).

### 14.5 The checklist for *any* change

- [ ] Did I put computation in a `.ts` selector/contributor, not a `.tsx`?
- [ ] Did `core/` stay free of any `@/features` import?
- [ ] Did I add both `en.json` and `fr.json` keys?
- [ ] Did I add a unit test for new pure logic?
- [ ] If I touched Overview/History/Detail output, did the golden snapshots change
      *intentionally* (and do I understand why)?
- [ ] `npm run typecheck && npm test && npm run lint` all green?
- [ ] If it's user-facing, did I bump the version + CHANGELOG?

---

## 15. Conventions, rules & cheat sheet

### 15.1 File naming

Files say **what they are** via a dot-suffix, matching the existing `*.store.ts`
convention:

| Suffix | Meaning | Example |
|--------|---------|---------|
| `*.store.ts` | Zustand store | `ui.store.ts` |
| `*.contributor.ts` | a `ValuedContributor` | `account.contributor.ts` |
| `*.selectors.ts` | pure view-data shaping for a domain | `history.selectors.ts` |
| `*.strategy.ts` | a `BucketStrategy` | `category.strategy.ts` |
| `contract.contributor.ts` | the contract the contributors implement | (one file) |
| `*.test.ts(x)` | tests | `dataset.test.ts` |
| `PascalCase.tsx` | a React component/page | `OverviewPage.tsx` |

### 15.2 The hard rules (don't break these)

1. **No data logic in components.** Math lives in `core/` or a `*.selectors.ts`.
2. **`core/` imports no feature.** It only knows interfaces.
3. **Server state stays in React Query**; never mirror it into Zustand.
4. **The engine never reads the clock.** Pass `today`/`equityDate` in.
5. **Format only at the edge** (`fmt*`/`priv*`), never mid-pipeline.
6. **Both languages, always.** Every user string has `en` + `fr` keys.
7. **Keep the golden masters honest.** If Overview/History/Detail numbers change,
   it must be on purpose.

### 15.3 The "where does it go?" cheat sheet

| I'm adding… | It goes in… |
|-------------|-------------|
| A pure helper used by 2+ features | `src/shared/utils/` |
| A generic button/input/dialog | `src/shared/ui/` |
| A new spreadsheet tab | `Datasource` iface + both impls + `parse.ts` + `keys.ts` + `sheetQueries.ts` |
| Net-worth math for a new asset | a `*.contributor.ts` in `features/<domain>/data/` |
| A new Overview grouping | a `*.strategy.ts` in `core/buckets/` |
| Math for one domain's own page | a `*.selectors.ts` in that feature's `data/` |
| A new global preference | `ui.store.ts` (+ `partialize`) |
| Something that belongs in the URL | a search param + `resolveFilterSpec` |
| A new page | `features/<domain>/` + a route in `router.tsx` |

---

## 16. Testing

The test suite is the safety net that lets you refactor fearlessly. Layers:

- **Unit tests (Vitest)** — pure functions: contributors, strategies, `buildDataset`,
  selectors, utils. Tiny fixtures, fast. See `src/tests/*.test.ts`.
- **Component tests (Testing Library)** — rendered pages/components:
  `OverviewPage.test.tsx`, `HistoryPage.test.tsx`, `DetailPage.test.tsx`, etc.
- **Golden-master tests** — `src/tests/golden/` freezes Overview/History/Detail
  output against a rich fixture (`src/tests/fixtures/portfolio.ts`). Their job is to
  scream if a refactor changes a number. When you *intend* to change output, update
  the snapshot and explain why in your commit.
- **Cross-check tests** — prove the new contributor path equals the legacy
  `computeDateStats` math (`accountContributor.test.ts`, `equityContributor.test.ts`).
- **E2E (Playwright)** — full flows: `npm run test:e2e`.

Run everything before pushing:

```bash
npm run typecheck && npm test && npm run lint && npm run build
```

---

## 17. Glossary

| Term | Meaning |
|------|---------|
| **Datasource** | The storage abstraction (`SheetsDatasource` or `XlsxDatasource`) every layer loads/writes through. |
| **Model** | A typed object parsed from spreadsheet rows (`Account`, `Snapshot`, …) — see `types/sheets.ts`. |
| **Contributor** | A `ValuedContributor`: a source of net-worth value (accounts, equity, …) that answers "which dates?" and "what are you worth?" |
| **Contribution** | One owner's signed, main-currency value as a *sample* on an axis date. Carries no date. |
| **Axis** | The merged, sorted, day-level timeline shared by every contributor's series. |
| **LOCF** | "Last Observation Carried Forward" — a balance holds until the next snapshot. |
| **BucketStrategy** | The polymorphic grouping (category \| group \| person) applied to contributions. |
| **FilterSpec** | The one object describing "what am I looking at": viewer, period, view, accountId, includeInactive. |
| **Dataset** | The normalized, viewer-scoped, time-aligned result of `buildDataset` that pages render. |
| **Viewer** | The person we're "viewing as" — a person id, or `HOUSEHOLD_VIEWER` for everyone. |
| **Selector** | A pure function (`*.selectors.ts`) that shapes a domain's data for its own views. |
| **Domain** | A kind of financial thing the app tracks (accounts, options). One `features/<x>/` folder. |
| **Seam** | An interface designed for extension (`ValuedContributor`, `BucketStrategy`) — where new features plug in without editing the engine. |
| **`__day__`** | Sentinel `account_id` for a day-level comment row (carries no balance). |
| **Private mode** | A UI toggle that masks all amounts (`priv*` helpers). |
| **Golden master** | A frozen snapshot of page output that fails the build if numbers drift unexpectedly. |

---

*This handbook describes the codebase as of the feature-first data-layer
architecture (v2.3.0). When you change how a layer works, update the matching
section here — a wrong map is worse than no map.*
</content>
</invoke>
