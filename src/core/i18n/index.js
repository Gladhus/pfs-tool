import { state, LS_KEY_LANG } from '../state.js';

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
  const privateModeBtn = document.getElementById('private-mode-btn');
  if (privateModeBtn) {
    privateModeBtn.classList.toggle('is-private', state.privateMode);
    privateModeBtn.innerHTML = state.privateMode
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  }
}

export function setLang(l, { persist = true } = {}) {
  state.lang = l;
  if (persist) {
    try { localStorage.setItem(LS_KEY_LANG, l); } catch (_) {}
    _writeConfigFn?.('language', l);
  }
  applyI18n();
}
