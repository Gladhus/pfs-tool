import { registerTranslations } from '../../core/i18n/index.js';

registerTranslations('fr', {
  empty_overview_title: 'Aucune donnée pour le moment',
  empty_overview_body: "Enregistrez votre premier bilan dans l'onglet Saisie pour voir vos statistiques apparaître ici.",
  empty_overview_cta: 'Aller à la saisie',
  data_as_of: (m) => `Données au ${m}`,
  overview_option: 'Aperçu',
  allocation_title: 'Répartition',
  series_net: 'Valeur nette',
  net_worth_chart: 'Valeur nette',
  tags_label: 'Étiquettes',
  view_by_category: 'Par catégorie',
  view_by_group: 'Par groupe',
  no_tags_title: 'Aucune étiquette pour le moment',
  no_tags_body: "Ouvrez un compte dans Paramètres et ajoutez des étiquettes (ex. « investissement », « location ») pour créer des regroupements transversaux.",
  no_groups_title: 'Aucun groupe',
  no_groups_body: "Créez des groupes dans Paramètres pour filtrer vos comptes par combinaison d'étiquettes.",
  manage_groups: 'Gérer les groupes',
});
