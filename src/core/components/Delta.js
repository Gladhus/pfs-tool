// Render a privacy-aware delta element: "+$1,200 (+3.4%) this month".
// Two layouts:
//   inline  — text on the outer element, dir class on the outer element.
//             Used in card-style deltas where the whole thing is one line.
//   stacked — outer is plain (no dir), inner span has the num + dir class,
//             optional period chip below. Used in the overview hero and
//             group cards where the number and period stack visually.

import { privDelta, privPct } from '../privacy.js';

export function deltaEl({
  value,
  ref = null,
  periodLabel = '',
  layout = 'inline',
  baseClass = 'delta',
  tag = 'div',
}) {
  const el = document.createElement(tag);
  const dir = value >= 0 ? 'up' : 'down';
  const pct = privPct(value, ref);
  const numText = privDelta(value) + (pct ? ` (${pct})` : '');

  if (layout === 'stacked') {
    el.className = baseClass;
    const num = document.createElement('span');
    num.className = `${baseClass}-num ${dir}`;
    num.textContent = numText;
    el.appendChild(num);
    if (periodLabel) {
      const per = document.createElement('span');
      per.className = `${baseClass}-period`;
      per.textContent = periodLabel;
      el.appendChild(per);
    }
  } else {
    el.className = `${baseClass} ${dir}`;
    el.textContent = numText + (periodLabel ? ` ${periodLabel}` : '');
  }
  return el;
}
