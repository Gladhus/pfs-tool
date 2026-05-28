import { registerTranslations } from '../../core/i18n/index.js';

registerTranslations('en', {
  progression: 'Progression',
  show_net_worth: 'Net worth',
  show_investments: 'Investments',
  show_real_estate: 'Real Estate (net)',
  history: 'History',
  investments: 'Investments',
  real_estate_net: 'Real Estate (net)',
  debts: 'Debts',
  delta: 'Δ',
  history_summary: (n, from, to) => `${n} entries · ${from} → ${to}`,
  empty_history_title: 'No history yet',
  empty_history_body: 'Your snapshots will appear here once saved.',
  incomplete_data: 'Incomplete — some accounts use their last known value.',
  overview_option: 'Overview',
});
