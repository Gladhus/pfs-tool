// PFS Tool — scaffold app.js
// Iteration 0: prove the OAuth flow works end-to-end. Sign in, get a token,
// load the Sheets API client, fetch the user's email. No sheet read/write yet.

(() => {
  const cfg = window.PFS_CONFIG || {};

  const els = {
    signinBtn:        document.getElementById("signin-btn"),
    signoutBtn:       document.getElementById("signout-btn"),
    userEmail:        document.getElementById("user-email"),
    signedOut:        document.getElementById("signed-out-state"),
    signedIn:         document.getElementById("signed-in-state"),
    sheetInfo:        document.getElementById("sheet-info"),
    sheetLink:        document.getElementById("sheet-link"),
    resetSheetBtn:    document.getElementById("reset-sheet-btn"),
    status:           document.getElementById("status"),
    entryForm:        document.getElementById("entry-form"),
    monthInput:       document.getElementById("month-input"),
    monthBadge:       document.getElementById("month-badge"),
    copyPrevBtn:      document.getElementById("copy-prev-btn"),
    categoriesEl:     document.getElementById("categories"),
    monthCommentEl:   document.getElementById("month-comment-input"),
    totalsGrid:       document.getElementById("totals-grid"),
    netWorthVal:      document.getElementById("net-worth-val"),
    netWorthDelta:    document.getElementById("net-worth-delta"),
    saveSnapshotBtn:  document.getElementById("save-snapshot-btn"),
    reloadBtn:        document.getElementById("reload-btn"),
    historySection:   document.getElementById("history-section"),
    historySummary:   document.getElementById("history-summary"),
    historyTableBody: document.querySelector("#history-table tbody"),
    chartSection:     document.getElementById("chart-section"),
    chartCanvas:      document.getElementById("net-worth-chart"),
    showNet:          document.getElementById("show-net"),
    showInvestments:  document.getElementById("show-investments"),
    showRealEstate:   document.getElementById("show-realestate"),
    tabBar:             document.getElementById("tab-bar"),
    accountsSection:    document.getElementById("accounts-section"),
    accountsTableBody:  document.querySelector("#accounts-table tbody"),
    addAccountBtn:      document.getElementById("add-account-btn"),
    saveAccountsBtn:    document.getElementById("save-accounts-btn"),
    reloadAccountsBtn:  document.getElementById("reload-accounts-btn"),
    accountsStatus:     document.getElementById("accounts-status"),
    newAccountType:     document.getElementById("new-account-type"),
    importSection:    document.getElementById("import-section"),
    importInput:      document.getElementById("import-input"),
    parseImportBtn:   document.getElementById("parse-import-btn"),
    clearImportBtn:   document.getElementById("clear-import-btn"),
    importPreview:    document.getElementById("import-preview"),
    importSummary:    document.getElementById("import-summary"),
    mappingTableBody: document.querySelector("#mapping-table tbody"),
    overwriteExisting:document.getElementById("overwrite-existing"),
    confirmImportBtn: document.getElementById("confirm-import-btn"),
    cancelImportBtn:  document.getElementById("cancel-import-btn"),
    ovNetWorth:       document.getElementById("ov-net-worth"),
    ovDeltaMom:       document.getElementById("ov-delta-mom"),
    ovDeltaYoy:       document.getElementById("ov-delta-yoy"),
    ovAsOf:           document.getElementById("ov-as-of"),
    ovCards:          document.getElementById("ov-cards"),
    ovFrom:           document.getElementById("ov-from"),
    ovTo:             document.getElementById("ov-to"),
    ovChartCanvas:    document.getElementById("overview-chart"),
    privateModeBtn:   document.getElementById("private-mode-btn"),
    histAccountSelect:document.getElementById("hist-account-select"),
    histChartToggles: document.getElementById("hist-chart-toggles"),
  };

  const LS_KEY_IMPORT_MAP = "pfs_import_mappings";
  const LS_KEY_ACTIVE_TAB = "pfs_active_tab";
  const LS_KEY_LANG       = "pfs_lang";
  const LS_KEY_PRIVATE    = "pfs_private";

  const state = {
    tokenClient: null,
    gapiReady:   false,
    gisReady:    false,
    accessToken: null,
    sheetId:     null,
    accounts:    [],   // [{id,name_fr,...}, ...] all accounts (active + inactive)
    categoryMeta:[],   // [{id,name_fr,name_en,sort_order}, ...]
    accountTypes:[],   // [{id_prefix,name_fr,name_en,category,kind,...}, ...]
    snapshots:  [],    // [{month,account_id,balance_raw,comment,entered_at}, ...]
    monthsSorted:[],   // sorted unique month strings
    currentMonth: null,
    importParsed: null, // last parsed import: {months, rows}
    chart: null,
    overviewChart: null,
    lang:         localStorage.getItem(LS_KEY_LANG) || cfg.LANGUAGE || "fr",
    privateMode:  localStorage.getItem(LS_KEY_PRIVATE) === "1",
  };

  const SHEET_TITLE = cfg.SHEET_TITLE || "PFS Tool — Bilan financier";
  const LS_KEY_SHEET_ID = "pfs_sheet_id";
  const LS_KEY_TOKEN    = "pfs_token";  // {access_token, expires_at}
  const TOKEN_SKEW_MS   = 60 * 1000;    // refresh 60s before actual expiry

  const HEADERS = {
    accounts:  ["id","type","name_fr","name_en","category","kind","owner","ownership_share","active","sort_order"],
    snapshots: ["month","account_id","balance_raw","comment","entered_at"],
    config:    ["key","value"],
  };

  function setStatus(msg, level = "") {
    els.status.textContent = msg;
    els.status.className = "status" + (level ? " " + level : "");
  }

  function configError() {
    if (!cfg.CLIENT_ID || cfg.CLIENT_ID === "YOUR_CLIENT_ID_HERE") {
      setStatus("Edit config.js and set CLIENT_ID. See docs/SETUP.md.", "warn");
      els.signinBtn.disabled = true;
      return true;
    }
    return false;
  }

  // --- Google API client (gapi) ---
  function onGapiLoad() {
    gapi.load("client", async () => {
      await gapi.client.init({
        discoveryDocs: [
          "https://sheets.googleapis.com/$discovery/rest?version=v4",
          "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
        ],
      });
      state.gapiReady = true;
      maybeEnableSignIn();
    });
  }

  // --- Google Identity Services (token client) ---
  function initTokenClient() {
    state.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: cfg.CLIENT_ID,
      scope: cfg.SCOPES,
      callback: (resp) => {
        if (resp.error) {
          // Silent refresh failures are expected if the user isn't signed in or
          // hasn't granted consent yet — just show the sign-in button.
          if (state.silentInFlight) {
            state.silentInFlight = false;
            setStatus("Ready. Click 'Sign in with Google' to continue.");
            return;
          }
          setStatus("Sign-in failed: " + resp.error, "warn");
          return;
        }
        state.silentInFlight = false;
        applyToken(resp.access_token, resp.expires_in);
        onSignedIn();
      },
    });
    state.gisReady = true;
    maybeEnableSignIn();
  }

  function applyToken(accessToken, expiresInSec) {
    state.accessToken = accessToken;
    gapi.client.setToken({ access_token: accessToken });
    const expiresAt = Date.now() + (Number(expiresInSec) || 3600) * 1000;
    try {
      localStorage.setItem(LS_KEY_TOKEN, JSON.stringify({
        access_token: accessToken,
        expires_at: expiresAt,
      }));
    } catch (_) { /* storage full / disabled — non-fatal */ }
  }

  function loadCachedToken() {
    try {
      const raw = localStorage.getItem(LS_KEY_TOKEN);
      if (!raw) return null;
      const t = JSON.parse(raw);
      if (!t.access_token || !t.expires_at) return null;
      if (t.expires_at - Date.now() < TOKEN_SKEW_MS) return null; // expired or about to
      return t;
    } catch (_) { return null; }
  }

  function clearCachedToken() {
    try { localStorage.removeItem(LS_KEY_TOKEN); } catch (_) { /* ignore */ }
  }

  async function tryRestoreSession() {
    // Path 1: valid cached token → reuse immediately.
    const cached = loadCachedToken();
    if (cached) {
      state.accessToken = cached.access_token;
      gapi.client.setToken({ access_token: cached.access_token });
      setStatus("Restoring session…");
      try {
        await onSignedIn();
        return true;
      } catch (err) {
        // Token may have been revoked server-side; fall through to silent refresh.
        console.warn("Cached token rejected:", err);
        clearCachedToken();
        gapi.client.setToken(null);
        state.accessToken = null;
      }
    }

    // Path 2: try silent refresh (no popup) — works if user is signed into Google
    // and has previously granted consent to this client.
    if (state.tokenClient) {
      state.silentInFlight = true;
      setStatus("Refreshing Google session…");
      state.tokenClient.requestAccessToken({ prompt: "" });
      return true; // callback will handle success/failure
    }
    return false;
  }

  function maybeEnableSignIn() {
    if (state.gapiReady && state.gisReady && !configError()) {
      els.signinBtn.disabled = false;
      setStatus("Ready. Click 'Sign in with Google' to continue.");
      // Best-effort: restore existing session without showing the popup.
      if (!state.sessionRestoreAttempted) {
        state.sessionRestoreAttempted = true;
        tryRestoreSession();
      }
    }
  }

  async function onSignedIn() {
    els.signinBtn.hidden = true;
    els.signoutBtn.hidden = false;
    els.signedOut.hidden = true;
    els.signedIn.hidden = false;

    const email = await fetchUserEmail();
    if (email) {
      els.userEmail.hidden = false;
      els.userEmail.textContent = email;
    }
    setStatus("Signed in. Locating your PFS sheet…");
    try {
      await bootstrapSheet();
    } catch (err) {
      console.error(err);
      setStatus("Bootstrap failed: " + (err.result?.error?.message || err.message || err), "warn");
    }
  }

  // --- Sheet bootstrap ---

  async function bootstrapSheet() {
    let sheetId = localStorage.getItem(LS_KEY_SHEET_ID);

    if (sheetId && !(await verifySheet(sheetId))) {
      sheetId = null;
      localStorage.removeItem(LS_KEY_SHEET_ID);
    }

    if (!sheetId) sheetId = await findSheetByName(SHEET_TITLE);

    let created = false;
    if (!sheetId) {
      setStatus("Creating your PFS sheet in Google Drive…");
      sheetId = await createSheet();
      created = true;
    }

    if (created) {
      setStatus("Seeding accounts and config…");
      await seedNewSheet(sheetId);
    }

    state.sheetId = sheetId;
    localStorage.setItem(LS_KEY_SHEET_ID, sheetId);
    showSheetLink(sheetId);
    setStatus(created ? "Sheet created and seeded." : "Sheet linked.", "ok");

    await loadAndRenderForm();
  }

  async function verifySheet(id) {
    try {
      await gapi.client.sheets.spreadsheets.get({
        spreadsheetId: id,
        fields: "spreadsheetId",
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  async function findSheetByName(name) {
    // With drive.file scope this only finds files this app has previously touched —
    // perfect for re-linking after localStorage is cleared.
    const escaped = name.replace(/'/g, "\\'");
    const resp = await gapi.client.drive.files.list({
      q: `name='${escaped}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
      fields: "files(id,name)",
      pageSize: 1,
    });
    return resp.result.files?.[0]?.id || null;
  }

  async function createSheet() {
    const resp = await gapi.client.sheets.spreadsheets.create({
      resource: {
        properties: { title: SHEET_TITLE, locale: "fr_CA" },
        sheets: [
          { properties: { title: "accounts" } },
          { properties: { title: "snapshots" } },
          { properties: { title: "config" } },
        ],
      },
      fields: "spreadsheetId",
    });
    return resp.result.spreadsheetId;
  }

  async function seedNewSheet(sheetId) {
    const seed = await fetch("seed/default-accounts.json?v=2").then(r => r.json());

    const accountRows = [
      HEADERS.accounts,
      ...seed.accounts.map(a => HEADERS.accounts.map(h => a[h] ?? "")),
    ];
    const snapshotRows = [HEADERS.snapshots];
    const configRows = [
      HEADERS.config,
      ["schema_version", String(seed.schema_version || 1)],
      ["language",       cfg.LANGUAGE || "fr"],
      ["currency",       cfg.CURRENCY || "CAD"],
      ["created_at",     new Date().toISOString()],
    ];

    await gapi.client.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      resource: {
        valueInputOption: "USER_ENTERED",
        data: [
          { range: "accounts!A1",  values: accountRows },
          { range: "snapshots!A1", values: snapshotRows },
          { range: "config!A1",    values: configRows },
        ],
      },
    });
  }

  function showSheetLink(id) {
    els.sheetInfo.hidden = false;
    els.sheetLink.href = `https://docs.google.com/spreadsheets/d/${id}/edit`;
  }

  // --- Data load ---

  async function loadAndRenderForm() {
    setStatus("Loading accounts and snapshots…");
    await Promise.all([loadAccounts(), loadSnapshots(), loadCategoryMeta()]);
    rebuildMonthsList();
    logCoverageDiagnostic();
    populateTypePicker(); // ensure dropdown is ready before the tab bar appears

    // Default month: current month
    const now = new Date();
    state.currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    els.monthInput.value = state.currentMonth;

    renderForm();
    els.entryForm.hidden = false;
    populateHistAccountSelect();
    renderHistoryTable();
    renderChart();
    renderOverview();
    showTabBar();
    applyI18n();
    setStatus("Loaded.", "ok");
  }

  function showTabBar() {
    els.tabBar.hidden = false;
    const saved = localStorage.getItem(LS_KEY_ACTIVE_TAB) || "overview";
    setActiveTab(saved);
  }

  function setActiveTab(name) {
    const tabs = ["overview", "history", "entry", "settings"];
    if (!tabs.includes(name)) name = "overview";
    for (const t of tabs) {
      const btn = els.tabBar.querySelector(`[data-tab="${t}"]`);
      const panel = document.getElementById(`tab-${t}`);
      btn.classList.toggle("active", t === name);
      panel.hidden = (t !== name);
    }
    localStorage.setItem(LS_KEY_ACTIVE_TAB, name);
    if (name === "overview")  renderOverview();
    if (name === "settings") renderAccountsTable();
  }

  async function loadAccounts() {
    // UNFORMATTED_VALUE: get raw cell values (numbers as numbers, not locale-
    // formatted strings). Without this, fr_CA formats 0.5 as "0,5" and
    // Number("0,5") returns NaN — silently reverting any share % change.
    const resp = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: state.sheetId,
      range: "accounts!A:Z",
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const rows = resp.result.values || [];
    if (rows.length < 2) { state.accounts = []; return; }
    const headers = rows[0];

    // Parse a numeric cell that may arrive as number, "0.5", or "0,5" (fr locale)
    const parseNum = (v, fallback) => {
      if (v === "" || v == null) return fallback;
      if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
      const n = Number(String(v).replace(",", "."));
      return Number.isFinite(n) ? n : fallback;
    };

    state.accounts = rows.slice(1).map(r => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = r[i] ?? ""; });
      obj.ownership_share = parseNum(obj.ownership_share, 1);
      obj.sort_order      = parseNum(obj.sort_order, 0);
      obj.active = obj.active === true || String(obj.active).toUpperCase() === "TRUE";
      return obj;
    }).filter(a => a.id);
  }

  // Active subset — used by the entry form and import dropdowns. Historical
  // computations (chart, history, totals for past months) read state.accounts
  // directly so inactive accounts still contribute to their historical periods.
  const activeAccounts = () => state.accounts.filter(a => a.active);

  async function loadSnapshots() {
    // UNFORMATTED_VALUE = return underlying cell value (numbers, booleans, raw
    // text) instead of the Sheets-display string. Crucial for date-formatted
    // cells, which otherwise come back as locale-specific text like "1/15/24".
    const resp = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: state.sheetId,
      range: "snapshots!A:Z",
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "SERIAL_NUMBER",
    });
    const rows = resp.result.values || [];
    if (rows.length < 2) { state.snapshots = []; return; }
    const headers = rows[0];

    const dataRows = rows.slice(1);
    const dropped = { noMonth: 0, noAccount: 0, badMonth: 0 };

    // Dedup by (month, account_id) — last entry wins (by entered_at timestamp,
    // fallback to row order). Handles legacy rows where the same logical month
    // was stored as both "2024-1" and "2024-01".
    const seen = new Map();
    dataRows.forEach((r, idx) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = r[i] ?? ""; });
      const monthRaw = obj.month;
      obj.month = normalizeMonth(obj.month);
      obj.balance_raw = Number(obj.balance_raw);
      if (!obj.month) { dropped.noMonth++; if (monthRaw) dropped.badMonth++; return; }
      if (!obj.account_id) { dropped.noAccount++; return; }
      if (!Number.isFinite(obj.balance_raw)) obj.balance_raw = 0;
      const key = `${obj.month}|${obj.account_id}`;
      const prev = seen.get(key);
      if (!prev) { seen.set(key, { ...obj, _idx: idx }); return; }
      const ta = obj.entered_at || "";
      const tp = prev.entered_at || "";
      const wins = ta && tp ? ta > tp : (!ta && !tp ? idx > prev._idx : !!ta);
      if (wins) seen.set(key, { ...obj, _idx: idx });
    });
    state.snapshots = [...seen.values()].map(({ _idx, ...rest }) => rest);

    const collapsed = dataRows.length - state.snapshots.length - dropped.noMonth - dropped.noAccount;
    console.log("[pfs] snapshots loaded:", {
      sheetRows: dataRows.length,
      kept: state.snapshots.length,
      droppedNoMonth: dropped.noMonth,
      droppedBadMonth: dropped.badMonth,
      droppedNoAccount: dropped.noAccount,
      collapsedDuplicates: Math.max(0, collapsed),
    });
  }

  function logCoverageDiagnostic() {
    const perAccount = {};
    let monthRows = 0;
    for (const s of state.snapshots) {
      if (s.account_id === "__month__") { monthRows++; continue; }
      perAccount[s.account_id] = perAccount[s.account_id] || { all: 0, zero: 0, nonzero: 0, first: null, last: null };
      perAccount[s.account_id].all++;
      if (s.balance_raw === 0) perAccount[s.account_id].zero++;
      else perAccount[s.account_id].nonzero++;
      if (!perAccount[s.account_id].first || s.month < perAccount[s.account_id].first) perAccount[s.account_id].first = s.month;
      if (!perAccount[s.account_id].last  || s.month > perAccount[s.account_id].last)  perAccount[s.account_id].last  = s.month;
    }
    const knownIds = new Set(state.accounts.map(a => a.id));
    const summary = [];
    for (const a of state.accounts) {
      const p = perAccount[a.id] || { all: 0, zero: 0, nonzero: 0, first: "", last: "" };
      summary.push({ account_id: a.id, name: a.name_fr || a.name_en, all: p.all, nonzero: p.nonzero, zero: p.zero, first: p.first, last: p.last });
    }
    for (const id of Object.keys(perAccount)) {
      if (!knownIds.has(id)) {
        const p = perAccount[id];
        summary.push({ account_id: id, name: "(no matching account in accounts tab)", all: p.all, nonzero: p.nonzero, zero: p.zero, first: p.first, last: p.last });
      }
    }
    console.log(`[pfs] snapshots per account (months row count: ${monthRows}):`);
    console.table(summary);

    // Expose for ad-hoc inspection in DevTools.
    window.__pfs = state;
    window.__pfsMonth = (m) => {
      const rows = state.snapshots.filter(s => s.month === m);
      const byAcct = Object.fromEntries(state.accounts.map(a => [a.id, a]));
      console.table(rows.map(r => ({
        month: r.month,
        account_id: r.account_id,
        name: byAcct[r.account_id]?.name_fr || "(unknown)",
        balance: r.balance_raw,
        kind: byAcct[r.account_id]?.kind || "",
        comment: r.comment,
      })));
      return rows;
    };
  }

  // Normalize a month cell into "YYYY-MM". Handles legacy "YYYY-M" (no
  // zero-pad) and Sheets-serial-date corruption (raw number representing
  // the day count from 1899-12-30).
  function normalizeMonth(raw) {
    if (raw == null) return "";
    const s = String(raw).trim();
    if (!s) return "";
    const m1 = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
    if (m1) return `${m1[1]}-${String(+m1[2]).padStart(2, "0")}`;
    const num = Number(s);
    if (Number.isFinite(num) && num > 25000 && num < 80000) {
      const d = new Date(Math.round((num - 25569) * 86400000));
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    }
    const parsed = parseMonthLabel(s);
    if (parsed) return parsed;
    return s;
  }

  // Categories: load names from seed/default-accounts.json (static asset bundled
  // with the app). The sheet only stores category IDs on each account; display
  // labels live here. This keeps the sheet clean and lets us change wording
  // without touching the user's data.
  async function loadCategoryMeta() {
    if (state.categoryMeta.length && state.accountTypes.length) return;
    const seed = await fetch("seed/default-accounts.json?v=2").then(r => r.json());
    state.categoryMeta  = seed.categories     || [];
    state.accountTypes  = seed.account_types  || [];
  }

  function rebuildMonthsList() {
    const set = new Set(state.snapshots.map(s => s.month));
    state.monthsSorted = [...set].sort();
  }

  // --- Form rendering ---

  const lang = () => state.lang || "fr";
  const tr = (obj) => obj[`name_${lang()}`] || obj.name_en || obj.name_fr || obj.id;
  const fmtMoney = (n) => new Intl.NumberFormat(lang() === "fr" ? "fr-CA" : "en-CA", {
    style: "currency", currency: cfg.CURRENCY || "CAD", maximumFractionDigits: 2,
  }).format(n || 0);
  const fmtDelta = (n) => (n >= 0 ? "+" : "") + fmtMoney(n);
  const fmtPct = (delta, ref) => {
    if (!ref) return "";
    const p = (delta / Math.abs(ref)) * 100;
    return (p >= 0 ? "+" : "") + p.toFixed(1) + "%";
  };

  const I18N = {
    fr: {
      sign_in: "Se connecter avec Google",
      sign_out: "Se déconnecter",
      signed_out_p1: "Connectez-vous avec votre compte Google pour lire et modifier votre bilan financier personnel.",
      signed_out_p2: "Vos données sont dans votre Google Drive — l'application n'y accède jamais depuis un serveur.",
      your_pfs_sheet: "Votre feuille PFS :",
      open_in_sheets: "Ouvrir dans Google Sheets",
      reset_link: "Réinitialiser",
      tab_overview: "Aperçu",
      tab_history: "Historique",
      tab_entry: "Saisie",
      tab_settings: "Paramètres",
      net_worth: "Valeur nette",
      from: "De",
      to: "à",
      period_all: "Tout",
      save_snapshot: "Enregistrer le bilan",
      reload_from_sheet: "Recharger",
      copy_prev_month: "Copier le mois préc.",
      month: "Mois",
      month_comment: "Commentaire du mois",
      progression: "Progression",
      show_net_worth: "Valeur nette",
      show_investments: "Investissements",
      show_real_estate: "Immobilier (net)",
      history: "Historique",
      investments: "Investissements",
      real_estate_net: "Immobilier (net)",
      debts: "Dettes",
      delta: "Δ",
      app_settings: "Préférences",
      language_label: "Langue",
      manage_accounts: "Gérer les comptes",
      manage_accounts_hint: "Modifiez les noms, la part de propriété, la catégorie ou décochez Actif pour archiver un compte sans perdre l'historique. Le champ id est immuable.",
      id_col: "ID",
      name_fr_col: "Nom (FR)",
      name_en_col: "Nom (EN)",
      category_col: "Catégorie",
      kind_col: "Type",
      owner_col: "Propriétaire",
      share_col: "Part %",
      active_col: "Actif",
      order_col: "Ordre",
      account_type_label: "Type de compte",
      add_account: "+ Ajouter un compte",
      save_changes: "Enregistrer",
      discard: "Annuler les modifications",
      import_historical: "Importer des données historiques",
      import_hint: "Collez votre feuille de suivi mensuelle (format large : comptes en colonne, mois en ligne). La copie depuis Google Sheets (TSV) fonctionne directement.",
      parse: "Analyser",
      clear: "Effacer",
      preview_label: "Aperçu",
      source_row: "Ligne source",
      sample_value: "Valeur exemple",
      map_to_account: "Associer au compte",
      overwrite_toggle: "Écraser les bilans existants pour les mois de ce collage (sinon, ignorer les mois déjà dans la feuille)",
      import_btn: "Importer",
      cancel: "Annuler",
      migrate_title: "Migrer l'ID du compte",
      current_id_label: "ID actuel",
      new_account_type_label: "Nouveau type de compte",
      new_id_label: "Nouvel ID",
      confirm_rename: "Confirmer",
      private_mode: "Privé",
      private_mode_off: "Afficher",
      overview_option: "Aperçu",
      comment_placeholder: "Commentaire (facultatif)",
      month_comment_placeholder: "Notes pour ce mois (facultatif)",
      import_placeholder: "Coller le CSV ou TSV ici…",
      history_summary: (n, from, to) => `${n} mois · ${from} → ${to}`,
      existing_month: "Mois existant (édition)",
      new_prefilled: (mo) => `Nouveau — pré-rempli de ${mo}`,
      new_month: "Nouveau mois",
      net_worth_chart: "Valeur nette",
      owner_self: "Vous",
      owner_partner: "Conjoint",
      owner_joint: "Joint",
    },
    en: {
      sign_in: "Sign in with Google",
      sign_out: "Sign out",
      signed_out_p1: "Sign in with your Google account to read and write your personal financial statement spreadsheet.",
      signed_out_p2: "Your data lives in your own Google Drive. This app never sees or stores it on any server.",
      your_pfs_sheet: "Your PFS sheet:",
      open_in_sheets: "Open in Google Sheets",
      reset_link: "Reset link",
      tab_overview: "Overview",
      tab_history: "History",
      tab_entry: "Entry",
      tab_settings: "Settings",
      net_worth: "Net worth",
      from: "From",
      to: "to",
      period_all: "All",
      save_snapshot: "Save snapshot",
      reload_from_sheet: "Reload from sheet",
      copy_prev_month: "Copy prev. month",
      month: "Month",
      month_comment: "Month comment",
      progression: "Progression",
      show_net_worth: "Net worth",
      show_investments: "Investments",
      show_real_estate: "Real Estate (net)",
      history: "History",
      investments: "Investments",
      real_estate_net: "Real Estate (net)",
      debts: "Debts",
      delta: "Δ",
      app_settings: "Preferences",
      language_label: "Language",
      manage_accounts: "Manage accounts",
      manage_accounts_hint: "Edit names, ownership %, category, kind, or uncheck Active to retire an account without losing its history. The id field is immutable.",
      id_col: "ID",
      name_fr_col: "Name (FR)",
      name_en_col: "Name (EN)",
      category_col: "Category",
      kind_col: "Kind",
      owner_col: "Owner",
      share_col: "Share %",
      active_col: "Active",
      order_col: "Order",
      account_type_label: "Account type",
      add_account: "+ Add account",
      save_changes: "Save changes",
      discard: "Discard",
      import_historical: "Import historical data",
      import_hint: "Paste your existing monthly tracking sheet (wide format: account names down the first column, months across the top). Copy/paste from Google Sheets works (tab-separated).",
      parse: "Parse",
      clear: "Clear",
      preview_label: "Preview",
      source_row: "Source row",
      sample_value: "Sample value",
      map_to_account: "Map to account",
      overwrite_toggle: "Overwrite existing snapshots for the months in this paste (otherwise skip months already in the sheet)",
      import_btn: "Import",
      cancel: "Cancel",
      migrate_title: "Migrate Account ID",
      current_id_label: "Current ID",
      new_account_type_label: "New account type",
      new_id_label: "New ID",
      confirm_rename: "Confirm rename",
      private_mode: "Private",
      private_mode_off: "Show",
      overview_option: "Overview",
      comment_placeholder: "Comment (optional)",
      month_comment_placeholder: "Notes for this month (optional)",
      import_placeholder: "Paste CSV or TSV here…",
      history_summary: (n, from, to) => `${n} months · ${from} → ${to}`,
      existing_month: "Existing month (editing)",
      new_prefilled: (mo) => `New — pre-filled from ${mo}`,
      new_month: "New month",
      net_worth_chart: "Net worth",
      owner_self: "You",
      owner_partner: "Partner",
      owner_joint: "Joint",
    },
  };

  const t = (key) => {
    const dict = I18N[lang()] || I18N.en;
    const v = dict[key];
    return typeof v === "string" ? v : ((I18N.en[key] && typeof I18N.en[key] === "string") ? I18N.en[key] : key);
  };

  const tFn = (key, ...args) => {
    const dict = I18N[lang()] || I18N.en;
    const fn = dict[key];
    return typeof fn === "function" ? fn(...args) : key;
  };

  function applyI18n() {
    document.documentElement.lang = lang();
    document.querySelectorAll("[data-i18n]").forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    // Update placeholders that are set inline
    const monthComment = document.getElementById("month-comment-input");
    if (monthComment) monthComment.placeholder = t("month_comment_placeholder");
    const importInput = document.getElementById("import-input");
    if (importInput) importInput.placeholder = t("import_placeholder");
    // Mark active lang button
    document.querySelectorAll(".lang-btn").forEach(b => b.classList.toggle("active", b.dataset.lang === lang()));
    // Update private mode button label
    if (els.privateModeBtn) {
      els.privateModeBtn.textContent = state.privateMode ? t("private_mode_off") : t("private_mode");
    }
  }

  function setLang(l) {
    state.lang = l;
    try { localStorage.setItem(LS_KEY_LANG, l); } catch(_) {}
    // Force type picker to rebuild with new language
    if (els.newAccountType) delete els.newAccountType.dataset.populated;
    applyI18n();
    if (!state.monthsSorted.length) return;
    populateHistAccountSelect();
    renderHistoryTable();
    renderChart();
    renderOverview();
    if (state.currentMonth) renderForm();
    renderAccountsTable();
  }

  function togglePrivateMode() {
    state.privateMode = !state.privateMode;
    try { localStorage.setItem(LS_KEY_PRIVATE, state.privateMode ? "1" : "0"); } catch(_) {}
    document.getElementById("tab-overview")?.classList.toggle("pfs-private", state.privateMode);
    if (els.privateModeBtn) els.privateModeBtn.textContent = state.privateMode ? t("private_mode_off") : t("private_mode");
  }

  // Parse a free-form money string ("$1,234.56", "1 234,56 $", "-500", "") into a number.
  // Returns null for empty/invalid. Handles both en-CA and fr-CA conventions.
  function parseMoney(str) {
    if (str == null) return null;
    let s = String(str).trim();
    if (s === "") return null;
    // Keep digits, minus, comma, period only.
    s = s.replace(/[^\d.,\-]/g, "");
    if (s === "" || s === "-") return null;
    const lastComma = s.lastIndexOf(",");
    const lastDot   = s.lastIndexOf(".");
    if (lastComma === -1 && lastDot === -1) {
      // pure integer
    } else {
      const decimalSep = lastComma > lastDot ? "," : ".";
      const thouSep    = decimalSep === "," ? "." : ",";
      s = s.split(thouSep).join("");
      if (decimalSep === ",") s = s.replace(",", ".");
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function categoriesInOrder() {
    const usedIds = new Set(activeAccounts().map(a => a.category));
    return state.categoryMeta
      .filter(c => usedIds.has(c.id))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  function accountsForCategory(catId) {
    return activeAccounts()
      .filter(a => a.category === catId)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  // Returns {balances: {accountId: number}, comments: {accountId: string}, monthComment: string}
  function snapshotForMonth(month) {
    const rows = state.snapshots.filter(s => s.month === month);
    const balances = {};
    const comments = {};
    let monthComment = "";
    for (const r of rows) {
      if (r.account_id === "__month__") {
        monthComment = r.comment || "";
      } else {
        balances[r.account_id] = r.balance_raw;
        if (r.comment) comments[r.account_id] = r.comment;
      }
    }
    return { balances, comments, monthComment };
  }

  function prevMonth(month) {
    const idx = state.monthsSorted.indexOf(month);
    if (idx > 0) return state.monthsSorted[idx - 1];
    // not in list yet: return latest month < this month
    const earlier = state.monthsSorted.filter(m => m < month);
    return earlier.length ? earlier[earlier.length - 1] : null;
  }

  function renderForm() {
    const month = els.monthInput.value || state.currentMonth;
    state.currentMonth = month;

    const existing = snapshotForMonth(month);
    const isEditing = state.monthsSorted.includes(month);
    const prevMo = prevMonth(month);
    const prevData = prevMo ? snapshotForMonth(prevMo) : null;

    // Month badge
    if (isEditing) {
      els.monthBadge.hidden = false;
      els.monthBadge.textContent = t("existing_month");
    } else if (prevMo) {
      els.monthBadge.hidden = false;
      els.monthBadge.textContent = tFn("new_prefilled", prevMo);
    } else {
      els.monthBadge.hidden = false;
      els.monthBadge.textContent = t("new_month");
    }

    // Month comment
    els.monthCommentEl.value = existing.monthComment || "";

    // Build category blocks
    els.categoriesEl.innerHTML = "";
    for (const cat of categoriesInOrder()) {
      const block = document.createElement("div");
      block.className = "category";
      block.dataset.categoryId = cat.id;

      const h = document.createElement("h3");
      const lbl = document.createElement("span");
      lbl.textContent = tr(cat);
      const sub = document.createElement("span");
      sub.className = "subtotal";
      h.appendChild(lbl);
      h.appendChild(sub);
      block.appendChild(h);

      for (const a of accountsForCategory(cat.id)) {
        const row = document.createElement("div");
        row.className = "account-row";
        row.dataset.accountId = a.id;

        const name = document.createElement("div");
        name.className = "name";
        const nameMain = document.createElement("span");
        nameMain.textContent = tr(a);
        name.appendChild(nameMain);
        const meta = document.createElement("span");
        meta.className = "meta";
        const ownerLbl = { self: t("owner_self"), partner: t("owner_partner"), joint: t("owner_joint") }[a.owner] || a.owner;
        const sharePct = Math.round((a.ownership_share || 1) * 100);
        meta.textContent = `${ownerLbl} · ${sharePct}%`;
        name.appendChild(meta);

        const bal = document.createElement("input");
        bal.type = "text";
        bal.inputMode = "decimal";
        bal.autocomplete = "off";
        bal.className = "balance";
        bal.placeholder = fmtMoney(0);

        const seedVal = existing.balances[a.id];
        const prevVal = prevData ? prevData.balances[a.id] : undefined;
        const initial = seedVal !== undefined ? seedVal
                       : prevVal !== undefined ? prevVal
                       : null;
        if (initial !== null) bal.value = fmtMoney(initial);

        // Focus: show raw number for easy editing. Blur: re-format as money.
        bal.addEventListener("focus", () => {
          const n = parseMoney(bal.value);
          bal.value = n === null ? "" : String(n);
          bal.select();
        });
        bal.addEventListener("blur", () => {
          const n = parseMoney(bal.value);
          bal.value = n === null ? "" : fmtMoney(n);
          recomputeTotals();
        });
        bal.addEventListener("input", recomputeTotals);

        const com = document.createElement("input");
        com.type = "text";
        com.className = "comment";
        com.placeholder = t("comment_placeholder");
        com.value = existing.comments[a.id] || "";
        com.tabIndex = -1; // skip in Tab order — click to focus

        row.appendChild(name);
        row.appendChild(bal);
        row.appendChild(com);
        block.appendChild(row);
      }
      els.categoriesEl.appendChild(block);
    }

    recomputeTotals();
  }

  function readFormValues() {
    const out = {}; // accountId -> {balance, comment}
    els.categoriesEl.querySelectorAll(".account-row").forEach(row => {
      const id = row.dataset.accountId;
      const balance = parseMoney(row.querySelector("input.balance").value);
      const comment = row.querySelector("input.comment").value.trim();
      out[id] = { balance, comment };
    });
    return out;
  }

  function recomputeTotals() {
    const values = readFormValues();
    const byCategory = {};
    let netWorth = 0;

    for (const a of activeAccounts()) {
      const v = values[a.id];
      if (!v || v.balance === null || Number.isNaN(v.balance)) continue;
      const signed = v.balance * (a.ownership_share || 1) * (a.kind === "debt" ? -1 : 1);
      byCategory[a.category] = (byCategory[a.category] || 0) + signed;
      netWorth += signed;
    }

    // Update per-category subtotal in headers
    els.categoriesEl.querySelectorAll(".category").forEach(block => {
      const catId = block.dataset.categoryId;
      block.querySelector(".subtotal").textContent = fmtMoney(byCategory[catId] || 0);
    });

    // Update totals grid
    els.totalsGrid.innerHTML = "";
    for (const cat of categoriesInOrder()) {
      const row = document.createElement("div");
      row.className = "row";
      const lbl = document.createElement("span"); lbl.className = "lbl"; lbl.textContent = tr(cat);
      const val = document.createElement("span"); val.className = "val"; val.textContent = fmtMoney(byCategory[cat.id] || 0);
      row.appendChild(lbl); row.appendChild(val);
      els.totalsGrid.appendChild(row);
    }

    els.netWorthVal.textContent = fmtMoney(netWorth);

    // Delta vs previous month
    const prevMo = prevMonth(state.currentMonth);
    if (prevMo) {
      const prevNet = computeNetWorthFromSnapshots(prevMo);
      const delta = netWorth - prevNet;
      const pct = fmtPct(delta, prevNet);
      els.netWorthDelta.textContent = `${fmtDelta(delta)}${pct ? ` (${pct})` : ""} vs ${prevMo}`;
      els.netWorthDelta.className = "delta " + (delta >= 0 ? "up" : "down");
    } else {
      els.netWorthDelta.textContent = "";
      els.netWorthDelta.className = "delta";
    }
  }

  function computeNetWorthFromSnapshots(month) {
    const rows = state.snapshots.filter(s => s.month === month && s.account_id !== "__month__");
    const acctById = Object.fromEntries(state.accounts.map(a => [a.id, a]));
    // Include inactive accounts too for historical totals
    let total = 0;
    for (const r of rows) {
      const a = acctById[r.account_id];
      if (!a) continue;
      total += r.balance_raw * (a.ownership_share || 1) * (a.kind === "debt" ? -1 : 1);
    }
    return total;
  }

  // --- History table ---

  function historyLabels() {
    return {
      month: t("month"),
      investments: t("investments"),
      realEstateNet: t("real_estate_net"),
      debts: t("debts"),
      netWorth: t("net_worth"),
      delta: t("delta"),
    };
  }

  function renderHistoryTable() {
    const labels = historyLabels();
    const acctById = Object.fromEntries(state.accounts.map(a => [a.id, a]));
    const byMonth = new Map();
    for (const s of state.snapshots) {
      if (s.account_id === "__month__") continue;
      const a = acctById[s.account_id];
      if (!a) continue;
      const signed = s.balance_raw * (a.ownership_share || 1) * (a.kind === "debt" ? -1 : 1);
      const m = byMonth.get(s.month) || { investments: 0, realEstate: 0, realEstateDebts: 0, debts: 0, net: 0 };
      m.net += signed;
      if (a.kind === "debt") m.debts += signed;
      if (a.category === "investments") m.investments += signed;
      else if (a.category === "real_estate") m.realEstate += signed;
      else if (a.category === "real_estate_debt") m.realEstateDebts += signed;
      byMonth.set(s.month, m);
    }
    for (const s of state.snapshots) {
      if (s.account_id === "__month__" && !byMonth.has(s.month)) {
        byMonth.set(s.month, { investments: 0, realEstate: 0, realEstateDebts: 0, debts: 0, net: 0 });
      }
    }

    const months = [...byMonth.keys()].sort().reverse(); // newest first
    if (!months.length) {
      els.historySection.hidden = true;
      return;
    }
    els.historySection.hidden = false;
    els.historySummary.textContent = tFn("history_summary", months.length, months[months.length - 1], months[0]);

    const tbody = els.historyTableBody;
    tbody.innerHTML = "";
    const sortedAsc = [...months].reverse();
    const prevByMonth = {};
    for (let i = 0; i < sortedAsc.length; i++) {
      prevByMonth[sortedAsc[i]] = i > 0 ? sortedAsc[i - 1] : null;
    }

    for (const month of months) {
      const m = byMonth.get(month);
      const reNet = m.realEstate + m.realEstateDebts;
      const prev = prevByMonth[month];
      const delta = prev ? m.net - byMonth.get(prev).net : null;

      const tr = document.createElement("tr");
      if (month === state.currentMonth) tr.classList.add("current");
      tr.dataset.month = month;

      const cMonth = document.createElement("td"); cMonth.textContent = month;
      const cInv   = document.createElement("td"); cInv.className = "num"; cInv.textContent = fmtMoney(m.investments);
      const cRE    = document.createElement("td"); cRE.className = "num"; cRE.textContent = fmtMoney(reNet);
      const cDebt  = document.createElement("td"); cDebt.className = "num"; cDebt.textContent = fmtMoney(m.debts);
      const cNet   = document.createElement("td"); cNet.className = "num"; cNet.textContent = fmtMoney(m.net);
      const cDelta = document.createElement("td"); cDelta.className = "num delta";
      cMonth.dataset.label = labels.month;
      cInv.dataset.label = labels.investments;
      cRE.dataset.label = labels.realEstateNet;
      cDebt.dataset.label = labels.debts;
      cNet.dataset.label = labels.netWorth;
      cDelta.dataset.label = labels.delta;
      if (delta !== null) {
        const pct = fmtPct(delta, byMonth.get(prev).net);
        cDelta.textContent = fmtDelta(delta) + (pct ? ` (${pct})` : "");
        cDelta.classList.add(delta >= 0 ? "up" : "down");
      } else {
        cDelta.textContent = "—";
      }

      tr.appendChild(cMonth);
      tr.appendChild(cInv);
      tr.appendChild(cRE);
      tr.appendChild(cDebt);
      tr.appendChild(cNet);
      tr.appendChild(cDelta);

      tr.addEventListener("click", () => {
        state.currentMonth = month;
        els.monthInput.value = month;
        renderForm();
        setActiveTab("entry");
      });

      tbody.appendChild(tr);
    }
  }

  // --- Chart ---

  function getHistFilteredMonths() {
    const btn = document.querySelector("#hist-period-pills .period-btn.active");
    return getMonthsForPeriod(btn?.dataset.period || "all");
  }

  // Computes overview totals per month. filteredMonths limits which months are included.
  function computeSeries(filteredMonths) {
    const months = filteredMonths || state.monthsSorted;
    const monthSet = new Set(months);
    const acctById = Object.fromEntries(state.accounts.map(a => [a.id, a]));
    const byMonth = new Map();
    for (const s of state.snapshots) {
      if (s.account_id === "__month__") continue;
      if (!monthSet.has(s.month)) continue;
      const a = acctById[s.account_id];
      if (!a) continue;
      const signed = s.balance_raw * (a.ownership_share || 1) * (a.kind === "debt" ? -1 : 1);
      const m = byMonth.get(s.month) || { net: 0, investments: 0, realEstateAssets: 0, realEstateDebts: 0 };
      m.net += signed;
      if (a.category === "investments") m.investments += signed;
      else if (a.category === "real_estate") m.realEstateAssets += signed;
      else if (a.category === "real_estate_debt") m.realEstateDebts += signed;
      byMonth.set(s.month, m);
    }
    // Ensure all requested months appear (with zeros if no snapshots)
    for (const mo of months) if (!byMonth.has(mo)) byMonth.set(mo, { net: 0, investments: 0, realEstateAssets: 0, realEstateDebts: 0 });
    const sorted = months.filter(m => byMonth.has(m)).sort();
    return {
      months: sorted,
      net:           sorted.map(m => byMonth.get(m).net),
      investments:   sorted.map(m => byMonth.get(m).investments),
      realEstateNet: sorted.map(m => byMonth.get(m).realEstateAssets + byMonth.get(m).realEstateDebts),
    };
  }

  function populateHistAccountSelect() {
    const sel = els.histAccountSelect;
    if (!sel || !state.accounts.length) return;
    const currentVal = sel.value;
    sel.innerHTML = "";
    const ovOpt = document.createElement("option");
    ovOpt.value = "";
    ovOpt.textContent = t("overview_option");
    sel.appendChild(ovOpt);
    const catOrder = Object.fromEntries(state.categoryMeta.map(c => [c.id, c.sort_order || 0]));
    const sorted = [...state.accounts].filter(a => a.active).sort((a, b) => {
      const co = (catOrder[a.category] || 99) - (catOrder[b.category] || 99);
      return co !== 0 ? co : (a.sort_order || 0) - (b.sort_order || 0);
    });
    const byCat = {};
    for (const a of sorted) (byCat[a.category] ||= []).push(a);
    for (const cat of state.categoryMeta.sort((a,b) => (a.sort_order||0)-(b.sort_order||0))) {
      const accts = byCat[cat.id];
      if (!accts?.length) continue;
      const og = document.createElement("optgroup");
      og.label = tr(cat);
      for (const a of accts) {
        const opt = document.createElement("option");
        opt.value = a.id;
        opt.textContent = tr(a);
        og.appendChild(opt);
      }
      sel.appendChild(og);
    }
    if (currentVal && [...sel.options].some(o => o.value === currentVal)) sel.value = currentVal;
  }

  function renderChart() {
    if (typeof Chart === "undefined") return;
    const filteredMonths = getHistFilteredMonths();
    const selectedAccount = els.histAccountSelect?.value || "";
    const isOverview = selectedAccount === "";

    // Show/hide series toggles based on mode
    if (els.histChartToggles) els.histChartToggles.hidden = !isOverview;

    const datasets = [];
    const chartCtx = els.chartCanvas.getContext("2d");
    const makeGradient = (r, g, b) => {
      const h = els.chartCanvas.offsetHeight || 300;
      const gr = chartCtx.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, `rgba(${r},${g},${b},0.18)`);
      gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
      return gr;
    };

    let chartMonths;
    if (isOverview) {
      const data = computeSeries(filteredMonths);
      if (!data.months.length) { els.chartSection.hidden = true; return; }
      chartMonths = data.months;
      if (els.showNet.checked) {
        datasets.push({ label: t("net_worth_chart"), data: data.net, borderColor: "#0f172a", backgroundColor: makeGradient(15,23,42), borderWidth: 2, fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: "#0f172a", pointHoverBorderColor: "#fff", pointHoverBorderWidth: 2 });
      }
      if (els.showInvestments.checked) {
        datasets.push({ label: t("investments"), data: data.investments, borderColor: "#059669", backgroundColor: makeGradient(5,150,105), borderWidth: 2, fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: "#059669", pointHoverBorderColor: "#fff", pointHoverBorderWidth: 2 });
      }
      if (els.showRealEstate.checked) {
        datasets.push({ label: t("real_estate_net"), data: data.realEstateNet, borderColor: "#0284c7", backgroundColor: makeGradient(2,132,199), borderWidth: 2, fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: "#0284c7", pointHoverBorderColor: "#fff", pointHoverBorderWidth: 2 });
      }
    } else {
      // Single account view
      const acct = state.accounts.find(a => a.id === selectedAccount);
      if (!acct) { els.chartSection.hidden = true; return; }
      const monthSet = new Set(filteredMonths);
      const snapByMonth = Object.fromEntries(
        state.snapshots.filter(s => s.account_id === selectedAccount && monthSet.has(s.month))
          .map(s => [s.month, s.balance_raw])
      );
      chartMonths = filteredMonths.filter(m => snapByMonth[m] !== undefined);
      if (!chartMonths.length) { els.chartSection.hidden = true; return; }
      const values = chartMonths.map(m => snapByMonth[m]);
      const color = acct.kind === "debt" ? "#e11d48" : "#059669";
      const [r,g,b] = acct.kind === "debt" ? [225,29,72] : [5,150,105];
      datasets.push({ label: tr(acct), data: values, borderColor: color, backgroundColor: makeGradient(r,g,b), borderWidth: 2, fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: color, pointHoverBorderColor: "#fff", pointHoverBorderWidth: 2 });
    }

    if (!datasets.length) { els.chartSection.hidden = true; return; }
    els.chartSection.hidden = false;

    const config = {
      type: "line",
      data: { labels: chartMonths, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "bottom", labels: { color: "#475569", font: { size: 12, family: "'Inter', sans-serif" }, padding: 24, usePointStyle: true, pointStyle: "circle", boxWidth: 8, boxHeight: 8 } },
          tooltip: {
            backgroundColor: "#0f172a", titleColor: "#94a3b8", bodyColor: "#f1f5f9",
            padding: 12, cornerRadius: 10, titleFont: { size: 11 },
            bodyFont: { size: 13, weight: "600" },
            callbacks: { label: (ctx) => `  ${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y)}` },
          },
        },
        scales: {
          y: {
            grid: { color: "rgba(15,23,42,.04)", drawTicks: false },
            border: { display: false },
            ticks: { color: "#94a3b8", font: { size: 11, family: "'Inter', sans-serif" }, padding: 10, maxTicksLimit: 6,
              callback: (v) => { const abs = Math.abs(v); if (abs >= 1000000) return (v/1000000).toFixed(1)+"M $"; if (abs >= 1000) return (v/1000).toFixed(0)+"k $"; return v+" $"; },
            },
          },
          x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 12, color: "#94a3b8", font: { size: 11, family: "'Inter', sans-serif" }, maxRotation: 0 } },
        },
      },
    };

    if (state.chart) {
      state.chart.data = config.data;
      state.chart.options = config.options;
      state.chart.update();
    } else {
      state.chart = new Chart(els.chartCanvas, config);
    }
  }

  // --- Save ---

  async function saveSnapshot() {
    if (!state.sheetId) return;
    const month = els.monthInput.value;
    if (!/^\d{4}-\d{2}$/.test(month)) {
      setStatus("Pick a valid month (YYYY-MM).", "warn");
      return;
    }

    const values = readFormValues();
    const enteredAt = new Date().toISOString();
    const newRows = [];

    for (const a of activeAccounts()) {
      const v = values[a.id];
      if (!v || v.balance === null || Number.isNaN(v.balance)) continue;
      newRows.push([month, a.id, v.balance, v.comment || "", enteredAt]);
    }
    const monthComment = els.monthCommentEl.value.trim();
    if (monthComment) {
      newRows.push([month, "__month__", 0, monthComment, enteredAt]);
    }

    if (!newRows.length) {
      setStatus("Nothing to save — all balances are empty.", "warn");
      return;
    }

    setStatus("Saving snapshot…");
    els.saveSnapshotBtn.disabled = true;
    try {
      // Strategy: read existing snapshots, drop rows for this month, write all back.
      // Simple, correct, idempotent. Slow only for very large datasets.
      const keep = state.snapshots.filter(s => s.month !== month);
      const allRows = [HEADERS.snapshots];
      for (const s of keep) {
        allRows.push([s.month, s.account_id, s.balance_raw, s.comment || "", s.entered_at || ""]);
      }
      for (const r of newRows) allRows.push(r);

      await gapi.client.sheets.spreadsheets.values.clear({
        spreadsheetId: state.sheetId,
        range: "snapshots!A:Z",
      });
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: state.sheetId,
        range: "snapshots!A1",
        valueInputOption: "RAW",
        resource: { values: allRows },
      });

      // Reload local state from the rows we just wrote
      state.snapshots = allRows.slice(1).map(r => ({
        month: normalizeMonth(r[0]), account_id: r[1], balance_raw: Number(r[2]) || 0,
        comment: r[3] || "", entered_at: r[4] || "",
      }));
      rebuildMonthsList();
      renderForm();
      renderHistoryTable();
      renderChart();
      renderOverview();
      setStatus(`Saved snapshot for ${month}.`, "ok");
    } catch (err) {
      console.error(err);
      setStatus("Save failed: " + (err.result?.error?.message || err.message || err), "warn");
    } finally {
      els.saveSnapshotBtn.disabled = false;
    }
  }

  // --- Form event handlers ---

  function onMonthChange() {
    state.currentMonth = els.monthInput.value;
    renderForm();
  }

  function onCopyPrev() {
    const prevMo = prevMonth(els.monthInput.value);
    if (!prevMo) {
      setStatus("No previous month to copy from.", "warn");
      return;
    }
    const prev = snapshotForMonth(prevMo);
    els.categoriesEl.querySelectorAll(".account-row").forEach(row => {
      const id = row.dataset.accountId;
      const v = prev.balances[id];
      if (v !== undefined) row.querySelector("input.balance").value = fmtMoney(v);
    });
    recomputeTotals();
    setStatus(`Pre-filled from ${prevMo}.`);
  }

  async function onReload() {
    await loadAndRenderForm();
  }

  // --- CSV import ---

  // Tiny CSV/TSV parser that handles quoted cells, double-quote escapes, and
  // both \r\n and \n line endings. Auto-detects tab vs comma separator.
  function parseDelimited(text) {
    const sep = text.includes("\t") ? "\t" : ",";
    const out = [];
    let row = [];
    let cur = "";
    let inQuotes = false;
    let i = 0;
    while (i < text.length) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"' && text[i + 1] === '"') { cur += '"'; i += 2; continue; }
        if (ch === '"') { inQuotes = false; i++; continue; }
        cur += ch; i++; continue;
      }
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === sep) { row.push(cur); cur = ""; i++; continue; }
      if (ch === "\r") { i++; continue; }
      if (ch === "\n") { row.push(cur); out.push(row); row = []; cur = ""; i++; continue; }
      cur += ch; i++;
    }
    if (cur.length || row.length) { row.push(cur); out.push(row); }
    return out.filter(r => r.some(c => c.trim() !== ""));
  }

  // Recognize month labels like "Sep 2020", "September 2020", "2020-09",
  // "sept. 2020", "9/2020", "9-2020".
  const MONTH_NAMES = {
    jan: 1, janv: 1, january: 1, janvier: 1,
    feb: 2, fév: 2, fevr: 2, fevrier: 2, février: 2, february: 2,
    mar: 3, mars: 3, march: 3,
    apr: 4, avr: 4, april: 4, avril: 4,
    may: 5, mai: 5,
    jun: 6, june: 6, juin: 6,
    jul: 7, july: 7, juil: 7, juillet: 7,
    aug: 8, août: 8, aout: 8, august: 8,
    sep: 9, sept: 9, september: 9, septembre: 9,
    oct: 10, october: 10, octobre: 10,
    nov: 11, november: 11, novembre: 11,
    dec: 12, déc: 12, december: 12, décembre: 12,
  };

  function parseMonthLabel(raw) {
    if (!raw) return null;
    let s = String(raw).trim().toLowerCase();
    s = s.replace(/[.,]/g, "").replace(/\s+/g, " ");
    // YYYY-MM or YYYY/MM
    let m = s.match(/^(\d{4})[\-\/](\d{1,2})$/);
    if (m) return `${m[1]}-${String(+m[2]).padStart(2, "0")}`;
    // MM-YYYY or MM/YYYY
    m = s.match(/^(\d{1,2})[\-\/](\d{4})$/);
    if (m) return `${m[2]}-${String(+m[1]).padStart(2, "0")}`;
    // "MMM YYYY", "Month YYYY"
    m = s.match(/^([a-zàâäéèêëîïôöùûüç]+)\s+(\d{4})$/);
    if (m) {
      const monIdx = MONTH_NAMES[m[1]];
      if (monIdx) return `${m[2]}-${String(monIdx).padStart(2, "0")}`;
    }
    return null;
  }

  // String similarity: normalized Jaccard on word tokens. Cheap and good enough.
  function normalizeName(s) {
    return String(s || "").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "") // strip accents
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ").trim();
  }
  function similarity(a, b) {
    a = new Set(normalizeName(a).split(" ").filter(Boolean));
    b = new Set(normalizeName(b).split(" ").filter(Boolean));
    if (!a.size && !b.size) return 0;
    let inter = 0;
    for (const t of a) if (b.has(t)) inter++;
    return inter / (a.size + b.size - inter);
  }

  function suggestAccount(sourceName) {
    const remembered = (() => {
      try { return JSON.parse(localStorage.getItem(LS_KEY_IMPORT_MAP) || "{}"); }
      catch (_) { return {}; }
    })();
    const key = normalizeName(sourceName);
    if (remembered[key]) return remembered[key];

    let best = null, bestScore = 0;
    for (const a of activeAccounts()) {
      const score = Math.max(similarity(sourceName, a.name_fr), similarity(sourceName, a.name_en));
      if (score > bestScore) { bestScore = score; best = a; }
    }
    return bestScore >= 0.5 ? best.id : null;
  }

  function rememberMapping(sourceName, accountId) {
    try {
      const m = JSON.parse(localStorage.getItem(LS_KEY_IMPORT_MAP) || "{}");
      m[normalizeName(sourceName)] = accountId;
      localStorage.setItem(LS_KEY_IMPORT_MAP, JSON.stringify(m));
    } catch (_) { /* ignore */ }
  }

  function onParseImport() {
    const raw = els.importInput.value;
    if (!raw.trim()) {
      setStatus("Paste data first.", "warn");
      return;
    }
    const grid = parseDelimited(raw);
    if (!grid.length) { setStatus("Could not parse the paste.", "warn"); return; }

    // Find the header row: the first row whose cells parse as months for ≥2 cells.
    let headerIdx = -1, monthCols = null;
    for (let i = 0; i < Math.min(grid.length, 10); i++) {
      const row = grid[i];
      const cols = row.map((c, idx) => ({ idx, month: parseMonthLabel(c) }))
                      .filter(x => x.month);
      if (cols.length >= 2) { headerIdx = i; monthCols = cols; break; }
    }
    if (headerIdx < 0) {
      setStatus("Couldn't find a row with month labels (e.g., 'Sep 2020').", "warn");
      return;
    }

    // Source rows = everything below header. The label is the first non-empty cell
    // that comes before the first month column.
    const firstMonthCol = monthCols[0].idx;
    const rows = [];
    for (let i = headerIdx + 1; i < grid.length; i++) {
      const r = grid[i];
      // Find the label (rightmost non-empty cell before the first month column)
      let label = "";
      for (let c = firstMonthCol - 1; c >= 0; c--) {
        if (r[c] && r[c].trim()) { label = r[c].trim(); break; }
      }
      if (!label) continue;
      const values = monthCols.map(mc => ({
        month: mc.month,
        raw: r[mc.idx] || "",
        num: parseMoney(r[mc.idx]),
      }));
      if (!values.some(v => v.num !== null)) continue; // empty row
      rows.push({ label, values, mapping: suggestAccount(label) || "__skip__" });
    }

    state.importParsed = { months: monthCols.map(m => m.month), rows };
    renderImportPreview();
  }

  function renderImportPreview() {
    if (!state.importParsed) { els.importPreview.hidden = true; return; }
    const { months, rows } = state.importParsed;

    els.importSummary.textContent =
      `${rows.length} source rows · ${months.length} months (${months[0]} → ${months[months.length - 1]})`;

    const tbody = els.mappingTableBody;
    tbody.innerHTML = "";
    for (const row of rows) {
      const tr = document.createElement("tr");
      if (row.mapping === "__skip__") tr.classList.add("skipped");

      const tdLabel = document.createElement("td");
      tdLabel.textContent = row.label;

      const tdSample = document.createElement("td");
      tdSample.className = "sample";
      const sample = row.values.find(v => v.num !== null);
      tdSample.textContent = sample ? `${sample.month}: ${sample.raw}` : "(empty)";

      const tdMap = document.createElement("td");
      const sel = document.createElement("select");
      sel.innerHTML = `
        <option value="__skip__">— Skip —</option>
        <option value="__month__">[Month-level comment]</option>
      `;
      // Group options by category
      const grouped = {};
      for (const a of activeAccounts()) (grouped[a.category] ||= []).push(a);
      for (const cat of categoriesInOrder()) {
        const og = document.createElement("optgroup");
        og.label = tr_(cat);
        for (const a of grouped[cat.id] || []) {
          const opt = document.createElement("option");
          opt.value = a.id;
          opt.textContent = tr_(a);
          og.appendChild(opt);
        }
        sel.appendChild(og);
      }
      sel.value = row.mapping;
      sel.addEventListener("change", () => {
        row.mapping = sel.value;
        tr.classList.toggle("skipped", row.mapping === "__skip__");
      });
      tdMap.appendChild(sel);

      tr.appendChild(tdLabel);
      tr.appendChild(tdSample);
      tr.appendChild(tdMap);
      tbody.appendChild(tr);
    }
    els.importPreview.hidden = false;
  }

  // alias to avoid shadow with `tr` element variable above
  const tr_ = tr;

  async function onConfirmImport() {
    if (!state.importParsed) return;
    const { rows } = state.importParsed;

    const mapped = rows.filter(r => r.mapping !== "__skip__");
    if (!mapped.length) { setStatus("Nothing to import — all rows are skipped.", "warn"); return; }

    // Remember user's mapping choices for next time
    for (const r of mapped) rememberMapping(r.label, r.mapping);

    // Build new snapshot rows
    const enteredAt = new Date().toISOString();
    const importedRows = []; // arrays [month, account_id, balance, comment, entered_at]
    const monthsTouched = new Set();
    for (const r of mapped) {
      for (const v of r.values) {
        if (v.num === null) continue;
        monthsTouched.add(v.month);
        // Stored balances are always non-negative — sign comes from account.kind.
        // Existing sheet has negative numbers on debt rows; flip them.
        const acct = r.mapping === "__month__" ? null : state.accounts.find(a => a.id === r.mapping);
        let balance = v.num;
        if (acct && acct.kind === "debt" && balance < 0) balance = -balance;

        if (r.mapping === "__month__") {
          if (v.raw && String(v.raw).trim()) {
            importedRows.push([v.month, "__month__", 0, String(v.raw).trim(), enteredAt]);
          }
        } else {
          importedRows.push([v.month, r.mapping, balance, "", enteredAt]);
        }
      }
    }

    if (!importedRows.length) { setStatus("No data to import.", "warn"); return; }

    // Merge with existing snapshots
    const overwrite = els.overwriteExisting.checked;
    const keep = state.snapshots.filter(s => {
      if (!monthsTouched.has(s.month)) return true;
      return !overwrite;
    });
    // If not overwriting, also skip imported rows whose (month, account_id) already exists
    const existingKeys = new Set(state.snapshots.map(s => `${s.month}|${s.account_id}`));
    const finalImported = overwrite
      ? importedRows
      : importedRows.filter(r => !existingKeys.has(`${r[0]}|${r[1]}`));

    const allRows = [HEADERS.snapshots, ...keep.map(s => [s.month, s.account_id, s.balance_raw, s.comment || "", s.entered_at || ""]), ...finalImported];

    setStatus(`Importing ${finalImported.length} rows…`);
    els.confirmImportBtn.disabled = true;
    try {
      await gapi.client.sheets.spreadsheets.values.clear({
        spreadsheetId: state.sheetId,
        range: "snapshots!A:Z",
      });
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: state.sheetId,
        range: "snapshots!A1",
        valueInputOption: "RAW",
        resource: { values: allRows },
      });

      // Refresh local state
      state.snapshots = allRows.slice(1).map(r => ({
        month: normalizeMonth(r[0]), account_id: r[1], balance_raw: Number(r[2]) || 0,
        comment: r[3] || "", entered_at: r[4] || "",
      }));
      rebuildMonthsList();
      renderForm();
      renderHistoryTable();
      renderChart();
      renderOverview();
      onCancelImport();
      setStatus(`Imported ${finalImported.length} rows across ${monthsTouched.size} months.`, "ok");
    } catch (err) {
      console.error(err);
      setStatus("Import failed: " + (err.result?.error?.message || err.message || err), "warn");
    } finally {
      els.confirmImportBtn.disabled = false;
    }
  }

  function onShowImport() {
    els.importSection.hidden = false;
    els.showImportBtn.hidden = true;
    els.importInput.focus();
  }

  function onHideImport() {
    els.importSection.hidden = true;
    els.showImportBtn.hidden = false;
  }

  function onClearImport() {
    els.importInput.value = "";
    onCancelImport();
  }

  function onCancelImport() {
    state.importParsed = null;
    els.importPreview.hidden = true;
    els.mappingTableBody.innerHTML = "";
  }

  // --- Accounts management ---

  const OWNERS  = ["self", "partner", "joint"];
  const KINDS   = ["asset", "debt"];

  function renderAccountsTable() {
    populateTypePicker();
    const tbody = els.accountsTableBody;
    tbody.innerHTML = "";
    const catOrder = Object.fromEntries(state.categoryMeta.map(c => [c.id, c.sort_order || 0]));
    const sorted = [...state.accounts].sort((a, b) => {
      const co = (catOrder[a.category] || 99) - (catOrder[b.category] || 99);
      if (co !== 0) return co;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
    for (const a of sorted) {
      tbody.appendChild(buildAccountRow(a, /*isNew=*/false));
    }
  }

  function populateTypePicker() {
    const sel = els.newAccountType;
    if (!state.accountTypes.length) return; // data not loaded yet — don't mark as populated
    if (sel.dataset.populated === "1") return;
    sel.innerHTML = "";
    // Group types by category
    const byCat = {};
    for (const t of state.accountTypes) (byCat[t.category] ||= []).push(t);
    for (const cat of state.categoryMeta) {
      const types = byCat[cat.id];
      if (!types || !types.length) continue;
      const og = document.createElement("optgroup");
      og.label = tr_(cat);
      for (const t of types) {
        const opt = document.createElement("option");
        opt.value = t.id_prefix;
        opt.textContent = `${t.name_fr} / ${t.name_en}`;
        og.appendChild(opt);
      }
      sel.appendChild(og);
    }
    sel.dataset.populated = "1";
  }

  function buildAccountRow(a, isNew) {
    const tr = document.createElement("tr");
    if (isNew) tr.classList.add("new-row");
    if (!a.active) tr.classList.add("inactive");
    tr.dataset.originalId = a.id;
    tr.dataset.isNew = isNew ? "1" : "0";
    tr.dataset.type = a.type || "";

    const td = (cls, label) => { const x = document.createElement("td"); if (cls) x.className = cls; if (label) x.dataset.label = label; tr.appendChild(x); return x; };
    const txt = (v, cls) => {
      const i = document.createElement("input"); i.type = "text"; i.value = v ?? ""; if (cls) i.className = cls;
      return i;
    };
    const num = (v, step = 1) => {
      const i = document.createElement("input"); i.type = "number"; i.value = v ?? 0; i.step = step;
      return i;
    };
    const sel = (v, options) => {
      const s = document.createElement("select");
      for (const o of options) {
        const opt = document.createElement("option"); opt.value = o.value; opt.textContent = o.label;
        if (o.value === v) opt.selected = true;
        s.appendChild(opt);
      }
      return s;
    };

    // id (read-only for existing; editable for new)
    const idInput = txt(a.id, "id");
    if (!isNew) idInput.readOnly = true;
    td(null, "ID").appendChild(idInput);

    td(null, "Name (FR)").appendChild(txt(a.name_fr));
    td(null, "Name (EN)").appendChild(txt(a.name_en));

    const catOpts = state.categoryMeta.map(c => ({ value: c.id, label: tr_(c) }));
    td(null, "Category").appendChild(sel(a.category, catOpts));

    td(null, "Kind").appendChild(sel(a.kind, KINDS.map(k => ({ value: k, label: k }))));
    td(null, "Owner").appendChild(sel(a.owner, OWNERS.map(o => ({ value: o, label: o }))));

    const share = num(Math.round((a.ownership_share || 0) * 100), 1);
    share.min = 0; share.max = 100; share.style.width = "4rem";
    td("num", "Share %").appendChild(share);

    const activeBox = document.createElement("input");
    activeBox.type = "checkbox"; activeBox.checked = !!a.active;
    activeBox.addEventListener("change", () => tr.classList.toggle("inactive", !activeBox.checked));
    td(null, "Active").appendChild(activeBox);

    const order = num(a.sort_order || 0);
    order.style.width = "4.5rem";
    td("num", "Order").appendChild(order);

    const actionsTd = td("actions-col");
    if (!isNew) {
      const renameBtn = document.createElement("button");
      renameBtn.type = "button";
      renameBtn.className = "rename-btn";
      renameBtn.textContent = "Rename ID";
      renameBtn.title = "Rename this account's ID — also updates every historical snapshot that references it";
      renameBtn.addEventListener("click", () => onRenameAccountId(a.id));
      actionsTd.appendChild(renameBtn);
    }

    return tr;
  }

  // Dialog elements (captured lazily to avoid null refs before HTML is added)
  const migrateDialog = () => document.getElementById("migrate-id-dialog");
  const migrateTypeSelect = () => document.getElementById("migrate-type-select");
  const migrateCurrentId = () => document.getElementById("migrate-current-id");
  const migrateNewId = () => document.getElementById("migrate-new-id");
  const migrateNote = () => document.getElementById("migrate-snapshots-note");

  let _migrateOldId = null;

  function openMigrateDialog(oldId) {
    _migrateOldId = oldId;
    const dialog = migrateDialog();
    const selEl = migrateTypeSelect();

    // Show current id
    migrateCurrentId().textContent = oldId;

    // Populate type picker if needed
    selEl.innerHTML = "";
    const byCat = {};
    for (const t of state.accountTypes) (byCat[t.category] ||= []).push(t);
    for (const cat of state.categoryMeta) {
      const types = byCat[cat.id];
      if (!types?.length) continue;
      const og = document.createElement("optgroup");
      og.label = tr_(cat);
      for (const t of types) {
        const opt = document.createElement("option");
        opt.value = t.id_prefix;
        opt.textContent = `${t.name_fr} / ${t.name_en}`;
        og.appendChild(opt);
      }
      selEl.appendChild(og);
    }

    // Pre-select the account's current type if known
    const acct = state.accounts.find(a => a.id === oldId);
    if (acct?.type) selEl.value = acct.type;

    updateMigratePreview();
    dialog.showModal();
  }

  function updateMigratePreview() {
    const prefix = migrateTypeSelect()?.value;
    if (!prefix) return;
    // Auto-number: next available prefix_N excluding the oldId itself
    const existingIds = new Set(state.accounts.map(a => a.id).filter(id => id !== _migrateOldId));
    let n = 1;
    while (existingIds.has(`${prefix}_${n}`)) n++;
    const newId = `${prefix}_${n}`;
    migrateNewId().textContent = newId;
    const affected = state.snapshots.filter(s => s.account_id === _migrateOldId).length;
    migrateNote().textContent = `${affected} historical snapshot row(s) will be updated.`;
  }

  async function executeMigrate() {
    const oldId = _migrateOldId;
    const newId = migrateNewId()?.textContent?.trim();
    if (!oldId || !newId || oldId === newId) { migrateDialog().close(); return; }
    if (state.accounts.some(a => a.id === newId)) {
      migrateNote().textContent = `ID "${newId}" already exists. Choose a different type.`;
      return;
    }
    const affected = state.snapshots.filter(s => s.account_id === oldId).length;

    migrateDialog().close();
    els.accountsStatus.style.color = "var(--muted)";
    els.accountsStatus.textContent = `Renaming ${oldId} → ${newId}…`;

    try {
      // Update in-memory
      const acct = state.accounts.find(a => a.id === oldId);
      if (acct) {
        acct.id = newId;
        acct.type = migrateTypeSelect()?.value || acct.type;
      }
      for (const s of state.snapshots) if (s.account_id === oldId) s.account_id = newId;

      // Write accounts tab
      const accountsRows = [
        HEADERS.accounts,
        ...state.accounts.map(a => HEADERS.accounts.map(h => a[h] ?? "")),
      ];
      await gapi.client.sheets.spreadsheets.values.clear({ spreadsheetId: state.sheetId, range: "accounts!A:Z" });
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: state.sheetId, range: "accounts!A1",
        valueInputOption: "RAW", resource: { values: accountsRows },
      });

      // Write snapshots tab if any rows were affected
      if (affected > 0) {
        const snapshotRows = [
          HEADERS.snapshots,
          ...state.snapshots.map(s => [s.month, s.account_id, s.balance_raw, s.comment || "", s.entered_at || ""]),
        ];
        await gapi.client.sheets.spreadsheets.values.clear({ spreadsheetId: state.sheetId, range: "snapshots!A:Z" });
        await gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: state.sheetId, range: "snapshots!A1",
          valueInputOption: "RAW", resource: { values: snapshotRows },
        });
      }

      renderAccountsTable();
      renderForm();
      renderHistoryTable();
      renderChart();
      renderOverview();
      els.accountsStatus.style.color = "var(--ok)";
      els.accountsStatus.textContent = `Renamed ${oldId} → ${newId}. ${affected} snapshot row(s) updated.`;
    } catch (err) {
      console.error(err);
      els.accountsStatus.style.color = "var(--warn)";
      els.accountsStatus.textContent = "Rename failed: " + (err.result?.error?.message || err.message || err);
    }
  }

  function onRenameAccountId(oldId) {
    openMigrateDialog(oldId);
  }

  function readAccountsTable() {
    const rows = [...els.accountsTableBody.querySelectorAll("tr")];
    const out = [];
    const seenIds = new Set();
    for (const tr of rows) {
      const inputs = tr.querySelectorAll("input, select");
      const [idEl, nameFr, nameEn, cat, kind, owner, share, active, order] = inputs;
      const id = (idEl.value || "").trim();
      if (!id) continue; // skip blank id rows
      if (seenIds.has(id)) throw new Error(`Duplicate account id: "${id}"`);
      seenIds.add(id);
      out.push({
        id,
        type: tr.dataset.type || "",
        name_fr: nameFr.value.trim(),
        name_en: nameEn.value.trim(),
        category: cat.value,
        kind: kind.value,
        owner: owner.value,
        ownership_share: Math.max(0, Math.min(100, Number(share.value) || 0)) / 100,
        active: active.checked,
        sort_order: Number(order.value) || 0,
      });
    }
    return out;
  }

  function slugify(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || `account_${Date.now()}`;
  }

  function onAddAccount() {
    const prefix = els.newAccountType.value;
    if (!prefix) { els.accountsStatus.textContent = "Pick an account type first."; els.accountsStatus.style.color = "var(--warn)"; return; }
    const type = state.accountTypes.find(t => t.id_prefix === prefix);
    if (!type) { els.accountsStatus.textContent = "Unknown account type."; els.accountsStatus.style.color = "var(--warn)"; return; }

    // Auto-number: find the next available `prefix_N`
    const existingIds = new Set(state.accounts.map(a => a.id));
    // Also include rows currently in the unsaved table (so adding two new in a row works)
    els.accountsTableBody.querySelectorAll("tr").forEach(tr => {
      const v = tr.querySelector("input.id")?.value;
      if (v) existingIds.add(v);
    });
    let n = 1;
    while (existingIds.has(`${prefix}_${n}`)) n++;
    const newId = `${prefix}_${n}`;

    const orderInCat = state.accounts.filter(a => a.category === type.category).map(a => a.sort_order || 0);
    const nextOrder = (orderInCat.length ? Math.max(...orderInCat) : 0) + 10;

    const blank = {
      id: newId,
      type: prefix,
      name_fr: `${type.name_fr} ${n}`,
      name_en: `${type.name_en} ${n}`,
      category: type.category,
      kind: type.kind,
      owner: type.default_owner || "self",
      ownership_share: type.default_ownership_share ?? 1,
      active: true,
      sort_order: nextOrder,
    };
    els.accountsTableBody.appendChild(buildAccountRow(blank, /*isNew=*/true));
    els.accountsStatus.style.color = "var(--muted)";
    els.accountsStatus.textContent = `Added ${newId} — remember to Save changes.`;
    // Focus the FR name so the user can rename if they want
    const newRow = els.accountsTableBody.lastElementChild;
    const inputs = newRow.querySelectorAll("input");
    inputs[1].focus();
    inputs[1].select();
    newRow.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function onSaveAccounts() {
    if (!state.sheetId) return;
    let next;
    try {
      next = readAccountsTable();
    } catch (err) {
      els.accountsStatus.textContent = err.message;
      els.accountsStatus.style.color = "var(--warn)";
      return;
    }
    if (!next.length) {
      els.accountsStatus.textContent = "Add at least one account.";
      els.accountsStatus.style.color = "var(--warn)";
      return;
    }
    // Validate: deleted (removed) accounts that have snapshots must stay
    const newIds = new Set(next.map(a => a.id));
    const removed = state.accounts.filter(a => !newIds.has(a.id));
    const usedRemoved = removed.filter(a => state.snapshots.some(s => s.account_id === a.id));
    if (usedRemoved.length) {
      const names = usedRemoved.map(a => a.id).join(", ");
      els.accountsStatus.textContent = `Cannot remove accounts with history: ${names}. Mark them inactive instead.`;
      els.accountsStatus.style.color = "var(--warn)";
      return;
    }

    els.accountsStatus.style.color = "var(--muted)";
    els.accountsStatus.textContent = "Saving…";
    els.saveAccountsBtn.disabled = true;
    try {
      const rows = [
        HEADERS.accounts,
        ...next.map(a => HEADERS.accounts.map(h => a[h] ?? "")),
      ];
      await gapi.client.sheets.spreadsheets.values.clear({
        spreadsheetId: state.sheetId,
        range: "accounts!A:Z",
      });
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: state.sheetId,
        range: "accounts!A1",
        valueInputOption: "RAW",
        resource: { values: rows },
      });
      state.accounts = next;
      renderAccountsTable();
      renderForm();
      renderHistoryTable();
      renderChart();
      renderOverview();
      els.accountsStatus.textContent = `Saved ${next.length} accounts.`;
      els.accountsStatus.style.color = "var(--ok)";
    } catch (err) {
      console.error(err);
      els.accountsStatus.textContent = "Save failed: " + (err.result?.error?.message || err.message || err);
      els.accountsStatus.style.color = "var(--warn)";
    } finally {
      els.saveAccountsBtn.disabled = false;
    }
  }

  async function onReloadAccounts() {
    els.accountsStatus.textContent = "Reloading from sheet…";
    await loadAccounts();
    renderAccountsTable();
    els.accountsStatus.textContent = "Reverted to last saved.";
    els.accountsStatus.style.color = "var(--muted)";
  }

  function onShowAccounts() {
    els.accountsSection.hidden = false;
    els.showAccountsBtn.hidden = true;
    renderAccountsTable();
  }
  function onHideAccounts() {
    els.accountsSection.hidden = true;
    els.showAccountsBtn.hidden = false;
    els.accountsStatus.textContent = "";
  }

  async function onResetSheetLink() {
    if (!confirm("Forget the linked sheet? A new one will be created on next sign-in if no matching sheet is found. The existing sheet in Drive is NOT deleted.")) return;
    localStorage.removeItem(LS_KEY_SHEET_ID);
    state.sheetId = null;
    els.sheetInfo.hidden = true;
    setStatus("Sheet link cleared. Sign out and sign back in to re-link or create a new one.");
  }

  async function fetchUserEmail() {
    try {
      const resp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: "Bearer " + state.accessToken },
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data.email || null;
    } catch (_) {
      return null;
    }
  }

  function onSignOut() {
    if (state.accessToken) {
      google.accounts.oauth2.revoke(state.accessToken, () => {});
    }
    state.accessToken = null;
    gapi.client.setToken(null);
    clearCachedToken();
    els.signinBtn.hidden = false;
    els.signoutBtn.hidden = true;
    els.userEmail.hidden = true;
    els.userEmail.textContent = "";
    els.signedOut.hidden = false;
    els.signedIn.hidden = true;
    els.sheetInfo.hidden = true;
    els.entryForm.hidden = true;
    setStatus("Signed out.");
  }

  // --- Overview ---

  function computeMonthStats(month) {
    const rows = state.snapshots.filter(s => s.month === month && s.account_id !== "__month__");
    const acctById = Object.fromEntries(state.accounts.map(a => [a.id, a]));
    let netWorth = 0;
    const byCategory = {};
    for (const r of rows) {
      const a = acctById[r.account_id];
      if (!a) continue;
      const signed = r.balance_raw * (a.ownership_share || 1) * (a.kind === "debt" ? -1 : 1);
      netWorth += signed;
      byCategory[a.category] = (byCategory[a.category] || 0) + signed;
    }
    return { netWorth, byCategory };
  }

  function getMonthsForPeriod(period) {
    const all = state.monthsSorted;
    if (!all.length || period === "all") return all;
    const latest = all[all.length - 1];
    const [yr, mo] = latest.split("-").map(Number);
    if (period === "YTD") {
      return all.filter(m => m >= `${yr}-01`);
    }
    const nMonths = { "3M": 3, "6M": 6, "1Y": 12, "5Y": 60 }[period];
    if (!nMonths) return all;
    const from = new Date(yr, mo - 1);
    from.setMonth(from.getMonth() - nMonths + 1);
    const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}`;
    return all.filter(m => m >= fromStr);
  }

  function getOvFilteredMonths() {
    const fromVal = els.ovFrom?.value;
    const toVal   = els.ovTo?.value;
    if (fromVal || toVal) {
      return state.monthsSorted.filter(m =>
        (!fromVal || m >= fromVal) && (!toVal || m <= toVal)
      );
    }
    const btn = document.querySelector("#ov-period-pills .period-btn.active");
    return getMonthsForPeriod(btn?.dataset.period || "all");
  }

  function renderOverview() {
    if (!els.ovNetWorth) return;

    // Apply private mode
    const ovTab = document.getElementById("tab-overview");
    ovTab?.classList.toggle("pfs-private", state.privateMode);
    if (els.privateModeBtn) els.privateModeBtn.textContent = state.privateMode ? t("private_mode_off") : t("private_mode");

    if (!state.monthsSorted.length) {
      els.ovNetWorth.textContent = "—";
      els.ovDeltaMom.textContent = "";
      els.ovDeltaYoy.textContent = "";
      els.ovAsOf.textContent = "";
      if (els.ovCards) els.ovCards.innerHTML = "";
      return;
    }

    const filteredMonths = getOvFilteredMonths();
    const periodBtn = document.querySelector("#ov-period-pills .period-btn.active");
    const activePeriod = periodBtn?.dataset.period || "all";

    const latestMonth = filteredMonths.length
      ? filteredMonths[filteredMonths.length - 1]
      : state.monthsSorted[state.monthsSorted.length - 1];

    // MoM: previous month in the full sorted list
    const latestIdx = state.monthsSorted.indexOf(latestMonth);
    const prevMoMonth = latestIdx > 0 ? state.monthsSorted[latestIdx - 1] : null;

    // Period reference: for "all" use YoY; otherwise use period start
    let periodRefMonth = null;
    if (activePeriod === "all" && !els.ovFrom?.value && !els.ovTo?.value) {
      const [yr, mo] = latestMonth.split("-").map(Number);
      const yoyTarget = `${yr - 1}-${String(mo).padStart(2, "0")}`;
      periodRefMonth = [...state.monthsSorted].reverse().find(m => m <= yoyTarget) || null;
    } else if (filteredMonths.length > 1) {
      periodRefMonth = filteredMonths[0];
    }

    const current = computeMonthStats(latestMonth);
    const prevMo  = prevMoMonth ? computeMonthStats(prevMoMonth) : null;
    const periodRef = periodRefMonth ? computeMonthStats(periodRefMonth) : null;

    // Hero
    els.ovNetWorth.textContent = fmtMoney(current.netWorth);
    els.ovAsOf.textContent = latestMonth;

    const applyDelta = (el, val, refVal, refLabel) => {
      if (!el || refVal == null) { if (el) el.textContent = ""; return; }
      const d = val - refVal;
      const pct = fmtPct(d, refVal);
      el.textContent = `${fmtDelta(d)}${pct ? ` (${pct})` : ""} vs ${refLabel}`;
      el.className = "delta " + (d >= 0 ? "up" : "down");
    };
    applyDelta(els.ovDeltaMom, current.netWorth, prevMo?.netWorth, prevMoMonth);
    applyDelta(els.ovDeltaYoy, current.netWorth, periodRef?.netWorth, periodRefMonth);

    // Stat cards — delta vs period reference (or MoM if no period ref)
    const cardRef = periodRef || prevMo;
    const cards = els.ovCards;
    cards.innerHTML = "";
    const sortedCats = [...state.categoryMeta].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    for (const cat of sortedCats) {
      const val = current.byCategory[cat.id];
      if (val == null) continue;
      const card = document.createElement("div");
      card.className = "ov-stat-card";

      const lbl = document.createElement("div");
      lbl.className = "ov-card-label";
      lbl.textContent = tr_(cat);

      const valEl = document.createElement("div");
      valEl.className = "ov-card-value" + (cat.kind === "debt" ? " negative" : "");
      valEl.textContent = fmtMoney(val);

      card.appendChild(lbl);
      card.appendChild(valEl);

      if (cardRef) {
        const prev = cardRef.byCategory[cat.id] || 0;
        const d = val - prev;
        if (d !== 0) {
          const deltaEl = document.createElement("div");
          deltaEl.className = "ov-card-delta " + (d >= 0 ? "up" : "down");
          const pct = fmtPct(d, prev);
          deltaEl.textContent = fmtDelta(d) + (pct ? ` (${pct})` : "");
          card.appendChild(deltaEl);
        }
      }
      cards.appendChild(card);
    }

    // Chart
    renderOverviewChart();
  }

  function renderOverviewChart() {
    if (typeof Chart === "undefined") return;
    const canvas = els.ovChartCanvas;
    if (!canvas) return;

    const months = getOvFilteredMonths();

    // Compute net worth per filtered month
    const acctById = Object.fromEntries(state.accounts.map(a => [a.id, a]));
    const byMonth = {};
    for (const s of state.snapshots) {
      if (s.account_id === "__month__") continue;
      if (!months.includes(s.month)) continue;
      const a = acctById[s.account_id];
      if (!a) continue;
      const signed = s.balance_raw * (a.ownership_share || 1) * (a.kind === "debt" ? -1 : 1);
      byMonth[s.month] = (byMonth[s.month] || 0) + signed;
    }
    const values = months.map(m => byMonth[m] ?? null);

    // Gradient fill
    const ctx = canvas.getContext("2d");
    const h = canvas.parentElement?.offsetHeight || 280;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(5,150,105,.22)");
    grad.addColorStop(1, "rgba(5,150,105,0)");

    const chartData = {
      labels: months,
      datasets: [{
        label: t("net_worth_chart"),
        data: values,
        borderColor: "#059669",
        backgroundColor: grad,
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: "#059669",
        pointHoverBorderColor: "#fff",
        pointHoverBorderWidth: 2,
        spanGaps: true,
      }],
    };

    const tickCallback = (v) => {
      const abs = Math.abs(v);
      if (abs >= 1000000) return (v / 1000000).toFixed(1) + "M";
      if (abs >= 1000) return (v / 1000).toFixed(0) + "k";
      return v;
    };

    if (state.overviewChart) {
      state.overviewChart.destroy();
      state.overviewChart = null;
    }
    state.overviewChart = new Chart(canvas, {
      type: "line",
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#0f172a",
            titleColor: "#94a3b8",
            bodyColor: "#f1f5f9",
            padding: 12,
            cornerRadius: 10,
            titleFont: { size: 11 },
            bodyFont: { size: 13, weight: "600", family: "'Inter', sans-serif" },
            callbacks: { label: (ctx) => `  ${fmtMoney(ctx.parsed.y)}` },
          },
        },
        scales: {
          y: {
            grid: { color: "rgba(15,23,42,.04)", drawTicks: false },
            border: { display: false },
            ticks: { color: "#94a3b8", font: { size: 11 }, padding: 10, maxTicksLimit: 5, callback: tickCallback },
          },
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: "#94a3b8", font: { size: 11 }, maxRotation: 0, maxTicksLimit: months.length <= 6 ? months.length : 12 },
          },
        },
      },
    });
  }

  // --- wire up ---
  els.signinBtn.disabled = true;
  els.signinBtn.addEventListener("click", () => {
    if (configError()) return;
    state.tokenClient.requestAccessToken({ prompt: "consent" });
  });
  els.signoutBtn.addEventListener("click", onSignOut);
  els.resetSheetBtn.addEventListener("click", onResetSheetLink);
  els.monthInput.addEventListener("change", onMonthChange);
  els.copyPrevBtn.addEventListener("click", onCopyPrev);
  els.reloadBtn.addEventListener("click", onReload);
  els.saveSnapshotBtn.addEventListener("click", saveSnapshot);
  els.parseImportBtn.addEventListener("click", onParseImport);
  els.clearImportBtn.addEventListener("click", onClearImport);
  els.confirmImportBtn.addEventListener("click", onConfirmImport);
  els.cancelImportBtn.addEventListener("click", onCancelImport);
  els.addAccountBtn.addEventListener("click", onAddAccount);
  els.tabBar.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });
  els.saveAccountsBtn.addEventListener("click", onSaveAccounts);
  els.reloadAccountsBtn.addEventListener("click", onReloadAccounts);
  els.showNet.addEventListener("change", renderChart);
  els.showInvestments.addEventListener("change", renderChart);
  els.showRealEstate.addEventListener("change", renderChart);

  // Migrate ID dialog
  document.getElementById("migrate-confirm-btn")?.addEventListener("click", executeMigrate);
  document.getElementById("migrate-cancel-btn")?.addEventListener("click", () => migrateDialog()?.close());
  document.getElementById("migrate-close-btn")?.addEventListener("click",  () => migrateDialog()?.close());
  document.getElementById("migrate-type-select")?.addEventListener("change", updateMigratePreview);
  migrateDialog()?.addEventListener("click", (e) => { if (e.target === migrateDialog()) migrateDialog().close(); });

  // Overview period pill buttons
  document.querySelectorAll("#ov-period-pills .period-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#ov-period-pills .period-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      if (els.ovFrom) els.ovFrom.value = "";
      if (els.ovTo)   els.ovTo.value   = "";
      renderOverview();
    });
  });

  // Overview custom range inputs
  if (els.ovFrom) {
    els.ovFrom.addEventListener("change", () => {
      document.querySelectorAll("#ov-period-pills .period-btn").forEach(b => b.classList.remove("active"));
      renderOverview();
    });
  }
  if (els.ovTo) {
    els.ovTo.addEventListener("change", () => {
      document.querySelectorAll("#ov-period-pills .period-btn").forEach(b => b.classList.remove("active"));
      renderOverview();
    });
  }

  // History chart period pill buttons
  document.querySelectorAll("#hist-period-pills .period-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#hist-period-pills .period-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderChart();
    });
  });

  // History chart account select
  if (els.histAccountSelect) {
    els.histAccountSelect.addEventListener("change", renderChart);
  }

  // Language toggle
  document.querySelectorAll(".lang-btn").forEach(btn => {
    btn.addEventListener("click", () => setLang(btn.dataset.lang));
  });

  // Private mode toggle
  els.privateModeBtn?.addEventListener("click", togglePrivateMode);

  // Both Google scripts load async. Poll until each is available, init once.
  let gapiStarted = false;
  let gisStarted = false;
  const poll = setInterval(() => {
    if (!gapiStarted && typeof gapi !== "undefined") {
      gapiStarted = true;
      onGapiLoad();
    }
    if (!gisStarted && typeof google !== "undefined" && google.accounts) {
      gisStarted = true;
      initTokenClient();
    }
    if (state.gapiReady && state.gisReady) clearInterval(poll);
  }, 50);

  configError();
  applyI18n();
})();
