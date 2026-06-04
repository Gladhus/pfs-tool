import { state, LS_KEY_LANG } from '../state.js';
import { updatePrivateButton } from '../privacy.js';

const _registry = { fr: {}, en: {} };
let _writeConfigFn = null;

export function registerTranslations(locale, strings) {
  Object.assign(_registry[locale], strings);
}
export function registerWriteConfig(fn) { _writeConfigFn = fn; }

export const lang = () => state.lang || 'fr';
export const tr = (obj) => obj[`name_${lang()}`] || obj.name_en || obj.name_fr || obj.id;

export const t = (key) => {
  const dict = _registry[lang()] || _registry.en;
  const v = dict[key];
  return typeof v === 'string' ? v : (typeof _registry.en[key] === 'string' ? _registry.en[key] : key);
};

export const tFn = (key, ...args) => {
  const dict = _registry[lang()] || _registry.en;
  const fn = dict[key] || _registry.en[key];
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
  updatePrivateButton();
}

export function setLang(l, { persist = true } = {}) {
  state.lang = l;
  if (persist) {
    try { localStorage.setItem(LS_KEY_LANG, l); } catch {}
    _writeConfigFn?.('language', l);
  }
  applyI18n();
}
