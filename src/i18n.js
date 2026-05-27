import { state, LS_KEY_LANG } from './state.js';

export const lang = () => state.lang || 'fr';

// Translate an object with name_fr / name_en fields to the current language.
export const tr = (obj) => obj[`name_${lang()}`] || obj.name_en || obj.name_fr || obj.id;

export const I18N = {
  fr: {
    sign_in: 'Se connecter avec Google',
    sign_out: 'Se déconnecter',
    signed_out_p1: 'Connectez-vous avec votre compte Google pour lire et modifier votre bilan financier personnel.',
    signed_out_p2: "Vos données sont dans votre Google Drive — l'application n'y accède jamais depuis un serveur.",
    your_pfs_sheet: 'Votre feuille PFS :',
    open_in_sheets: 'Ouvrir dans Google Sheets',
    reset_link: 'Réinitialiser',
    tab_overview: 'Aperçu',
    tab_history: 'Historique',
    tab_entry: 'Saisie',
    tab_settings: 'Paramètres',
    net_worth: 'Valeur nette',
    from: 'De',
    to: 'à',
    period_all: 'Tout',
    save_snapshot: 'Enregistrer le bilan',
    reload_from_sheet: 'Recharger',
    copy_prev_month: 'Copier le mois préc.',
    month: 'Mois',
    month_comment: 'Commentaire du mois',
    progression: 'Progression',
    show_net_worth: 'Valeur nette',
    show_investments: 'Investissements',
    show_real_estate: 'Immobilier (net)',
    history: 'Historique',
    investments: 'Investissements',
    real_estate_net: 'Immobilier (net)',
    debts: 'Dettes',
    delta: 'Δ',
    app_settings: 'Préférences',
    language_label: 'Langue',
    manage_accounts: 'Gérer les comptes',
    manage_accounts_hint: "Modifiez les noms, la part de propriété, la catégorie ou décochez Actif pour archiver un compte sans perdre l'historique. Le champ id est immuable.",
    id_col: 'ID',
    name_fr_col: 'Nom (FR)',
    name_en_col: 'Nom (EN)',
    category_col: 'Catégorie',
    kind_col: 'Type',
    owner_col: 'Propriétaire',
    share_col: 'Part %',
    active_col: 'Actif',
    order_col: 'Ordre',
    account_type_label: 'Type de compte',
    add_account: '+ Ajouter un compte',
    save_changes: 'Enregistrer',
    discard: 'Annuler les modifications',
    import_historical: 'Importer des données historiques',
    import_hint: 'Collez votre feuille de suivi mensuelle (format large : comptes en colonne, mois en ligne). La copie depuis Google Sheets (TSV) fonctionne directement.',
    parse: 'Analyser',
    clear: 'Effacer',
    preview_label: 'Aperçu',
    source_row: 'Ligne source',
    sample_value: 'Valeur exemple',
    map_to_account: 'Associer au compte',
    overwrite_toggle: 'Écraser les bilans existants pour les mois de ce collage (sinon, ignorer les mois déjà dans la feuille)',
    import_btn: 'Importer',
    cancel: 'Annuler',
    migrate_title: "Migrer l'ID du compte",
    current_id_label: 'ID actuel',
    new_account_type_label: 'Nouveau type de compte',
    new_id_label: 'Nouvel ID',
    confirm_rename: 'Confirmer',
    private_mode: 'Privé',
    private_mode_off: 'Afficher',
    data_as_of: (m) => `Données au ${m}`,
    overview_option: 'Aperçu',
    comment_placeholder: 'Commentaire (facultatif)',
    month_comment_placeholder: 'Notes pour ce mois (facultatif)',
    import_placeholder: 'Coller le CSV ou TSV ici…',
    history_summary: (n, from, to) => `${n} mois · ${from} → ${to}`,
    existing_month: 'Mois existant (édition)',
    new_prefilled: (mo) => `Nouveau — pré-rempli de ${mo}`,
    new_month: 'Nouveau mois',
    net_worth_chart: 'Valeur nette',
    owner_self: 'Vous',
    owner_partner: 'Conjoint',
    owner_joint: 'Joint',
  },
  en: {
    sign_in: 'Sign in with Google',
    sign_out: 'Sign out',
    signed_out_p1: 'Sign in with your Google account to read and write your personal financial statement spreadsheet.',
    signed_out_p2: 'Your data lives in your own Google Drive. This app never sees or stores it on any server.',
    your_pfs_sheet: 'Your PFS sheet:',
    open_in_sheets: 'Open in Google Sheets',
    reset_link: 'Reset link',
    tab_overview: 'Overview',
    tab_history: 'History',
    tab_entry: 'Entry',
    tab_settings: 'Settings',
    net_worth: 'Net worth',
    from: 'From',
    to: 'to',
    period_all: 'All',
    save_snapshot: 'Save snapshot',
    reload_from_sheet: 'Reload from sheet',
    copy_prev_month: 'Copy prev. month',
    month: 'Month',
    month_comment: 'Month comment',
    progression: 'Progression',
    show_net_worth: 'Net worth',
    show_investments: 'Investments',
    show_real_estate: 'Real Estate (net)',
    history: 'History',
    investments: 'Investments',
    real_estate_net: 'Real Estate (net)',
    debts: 'Debts',
    delta: 'Δ',
    app_settings: 'Preferences',
    language_label: 'Language',
    manage_accounts: 'Manage accounts',
    manage_accounts_hint: "Edit names, ownership %, category, kind, or uncheck Active to retire an account without losing its history. The id field is immutable.",
    id_col: 'ID',
    name_fr_col: 'Name (FR)',
    name_en_col: 'Name (EN)',
    category_col: 'Category',
    kind_col: 'Kind',
    owner_col: 'Owner',
    share_col: 'Share %',
    active_col: 'Active',
    order_col: 'Order',
    account_type_label: 'Account type',
    add_account: '+ Add account',
    save_changes: 'Save changes',
    discard: 'Discard',
    import_historical: 'Import historical data',
    import_hint: 'Paste your existing monthly tracking sheet (wide format: account names down the first column, months across the top). Copy/paste from Google Sheets works (tab-separated).',
    parse: 'Parse',
    clear: 'Clear',
    preview_label: 'Preview',
    source_row: 'Source row',
    sample_value: 'Sample value',
    map_to_account: 'Map to account',
    overwrite_toggle: 'Overwrite existing snapshots for the months in this paste (otherwise skip months already in the sheet)',
    import_btn: 'Import',
    cancel: 'Cancel',
    migrate_title: 'Migrate Account ID',
    current_id_label: 'Current ID',
    new_account_type_label: 'New account type',
    new_id_label: 'New ID',
    confirm_rename: 'Confirm rename',
    private_mode: 'Private',
    private_mode_off: 'Show',
    data_as_of: (m) => `Data as of ${m}`,
    overview_option: 'Overview',
    comment_placeholder: 'Comment (optional)',
    month_comment_placeholder: 'Notes for this month (optional)',
    import_placeholder: 'Paste CSV or TSV here…',
    history_summary: (n, from, to) => `${n} months · ${from} → ${to}`,
    existing_month: 'Existing month (editing)',
    new_prefilled: (mo) => `New — pre-filled from ${mo}`,
    new_month: 'New month',
    net_worth_chart: 'Net worth',
    owner_self: 'You',
    owner_partner: 'Partner',
    owner_joint: 'Joint',
  },
};

export const t = (key) => {
  const dict = I18N[lang()] || I18N.en;
  const v = dict[key];
  return typeof v === 'string' ? v : ((I18N.en[key] && typeof I18N.en[key] === 'string') ? I18N.en[key] : key);
};

export const tFn = (key, ...args) => {
  const dict = I18N[lang()] || I18N.en;
  const fn = dict[key];
  return typeof fn === 'function' ? fn(...args) : key;
};

export function applyI18n() {
  document.documentElement.lang = lang();
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  const monthComment = document.getElementById('month-comment-input');
  if (monthComment) monthComment.placeholder = t('month_comment_placeholder');
  const importInput = document.getElementById('import-input');
  if (importInput) importInput.placeholder = t('import_placeholder');
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang()));
  const privateModeBtn = document.getElementById('private-mode-btn');
  if (privateModeBtn) {
    privateModeBtn.textContent = state.privateMode ? t('private_mode_off') : t('private_mode');
  }
}

export function setLang(l) {
  state.lang = l;
  try { localStorage.setItem(LS_KEY_LANG, l); } catch (_) {}
  applyI18n();
}
