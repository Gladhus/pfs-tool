import { registerTranslations } from '../../core/i18n/index.js';

registerTranslations('fr', {
  progression: 'Progression',
  show_net_worth: 'Valeur nette',
  show_investments: 'Investissements',
  show_real_estate: 'Immobilier (net)',
  history: 'Historique',
  investments: 'Investissements',
  real_estate_net: 'Immobilier (net)',
  debts: 'Dettes',
  delta: 'Δ',
  history_summary: (n, from, to) => `${n} entrée(s) · ${from} → ${to}`,
  empty_history_title: 'Aucun historique',
  empty_history_body: 'Vos bilans apparaîtront ici une fois enregistrés.',
  incomplete_data: 'Données incomplètes — certains comptes utilisent la dernière valeur connue.',
  overview_option: 'Aperçu',
});
