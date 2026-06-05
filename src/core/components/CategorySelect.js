import { tr } from '../i18n/index.js';

export function buildCategoryOptgroups(items, getCatId, getCatLabel, categories) {
  const byCat = {};
  for (const item of items) (byCat[getCatId(item)] ||= []).push(item);
  return categories.flatMap(cat => {
    const catItems = byCat[cat.id];
    if (!catItems?.length) return [];
    const og = document.createElement('optgroup');
    og.label = tr(cat);
    for (const item of catItems) {
      const opt = document.createElement('option');
      opt.value = item.id || item.id_prefix;
      opt.textContent = getCatLabel(item);
      og.appendChild(opt);
    }
    return [og];
  });
}
