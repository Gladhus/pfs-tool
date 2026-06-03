// Overview-style stat card: head (icon or dot + label) + value + optional
// sparkline canvas + optional delta. Replaces the hand-rolled createElement
// sequences in features/overview for category, equity, and group cards.
//
// `head` is one of:
//   { iconKey: 'wallet', label: 'Cash' }   — category-style with icon glyph
//   { dot: '#06b6d4',    label: 'FIRE' }   — group-style with colour dot
//   { html: '<...>' }                      — escape hatch, fully custom
//
// Either `value` (number, will be passed through privMoney) or `valueText`
// (precomputed string, e.g. count + label) must be provided.

import { icon } from '../icons.js';
import { privMoney } from '../privacy.js';

export function statCard({
  className = 'ov-stat-card',
  head,
  value,
  valueText,
  valueNegative = false,
  spark = null,
  delta = null,
  groupColor = null,
} = {}) {
  const card = document.createElement('div');
  card.className = className;
  if (groupColor) card.style.setProperty('--group-color', groupColor);

  const headEl = document.createElement('div');
  headEl.className = 'ov-card-head';
  if (head?.html) {
    headEl.innerHTML = head.html;
  } else {
    if (head?.iconKey) {
      const w = document.createElement('span');
      w.className = 'cat-icon';
      w.innerHTML = icon(head.iconKey, { size: 14 });
      headEl.appendChild(w);
    } else if (head?.dot) {
      const dot = document.createElement('span');
      dot.className = 'group-stat-dot';
      if (head.dot !== true) dot.style.background = head.dot;
      headEl.appendChild(dot);
    }
    if (head?.label) {
      const lbl = document.createElement('div');
      lbl.className = 'ov-card-label';
      lbl.textContent = head.label;
      headEl.appendChild(lbl);
    }
  }
  card.appendChild(headEl);

  const valEl = document.createElement('div');
  valEl.className = 'ov-card-value' + (valueNegative ? ' negative' : '');
  valEl.textContent = valueText != null ? valueText : privMoney(value);
  card.appendChild(valEl);

  if (spark) card.appendChild(spark);
  if (delta) card.appendChild(delta);

  return card;
}
