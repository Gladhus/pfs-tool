// Privacy-aware formatters. All call sites that used to write
// `state.privateMode ? '••••••' : fmtMoney(v)` should go through these.

import { state, LS_KEY_PRIVATE } from './state.js';
import { fmtMoney, fmtDelta, fmtPct, fmtMoneyShort } from './format.js';

export const MASK = {
  full:  '••••••',
  med:   '••••',
  short: '••',
};

export const privMoney  = (n)                 => state.privateMode ? MASK.full  : fmtMoney(n);
export const privDelta  = (n)                 => state.privateMode ? MASK.short : fmtDelta(n);
// Percentages are proportional, not absolute — safe to show in private mode.
// Kept as a wrapper so call sites have one consistent priv* import surface.
export const privPct    = (delta, ref)        => fmtPct(delta, ref);
export const privShares = (n)                 => state.privateMode ? MASK.short : Math.round(n).toLocaleString();

// Compact axis formatter — used by Chart.js y-axis tick callbacks.
// `mask` controls what shows when private; `prefix`/`suffix` wrap the formatted value.
export function privShort(n, { mask = MASK.med, prefix = '', suffix = '' } = {}) {
  if (state.privateMode) return mask;
  return fmtMoneyShort(n, { prefix, suffix });
}

const EYE_OPEN = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF  = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

// Sync the private-mode toggle button to reflect current state.
// Called from applyI18n (locale switch) and from togglePrivate (click).
export function updatePrivateButton(btn = null) {
  const el = btn || document.getElementById('private-mode-btn');
  if (!el) return;
  el.classList.toggle('is-private', state.privateMode);
  el.innerHTML = state.privateMode ? EYE_OFF : EYE_OPEN;
}

// Flip private mode, persist, refresh the button. Caller is responsible for
// triggering a tab re-render (we don't import feature modules here).
export function togglePrivate() {
  state.privateMode = !state.privateMode;
  try { localStorage.setItem(LS_KEY_PRIVATE, state.privateMode ? '1' : '0'); } catch (_) {}
  updatePrivateButton();
}
