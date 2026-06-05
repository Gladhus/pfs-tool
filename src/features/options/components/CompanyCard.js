import { state } from '../../../core/state.js';
import { t } from '../../../core/i18n/index.js';
import { fmtMoney } from '../../../core/format.js';
import { privMoney, privShares } from '../../../core/privacy.js';
import { escapeHtml } from '../../../core/dom.js';
import {
  computeVestedShares, computeUnvestedShares,
  computeIntrinsicValue, computeUnvestedValue,
  getEffectiveFmv,
  grantFirstVestDate,
  exercisableShares, exercisedSharesForGrant,
} from '../../../utils/options.js';
import { fmtMonth } from '../../../utils/dates.js';
import { GRANT_COLORS, COMPANY_COLORS, renderCompanyVestingChart, renderCompanyValueChart } from '../charts.js';
import { openExerciseDialog } from '../dialogs.js';

// --- Per-company card ---

export function buildCompanyCard(company, ci, now) {
  const grants         = state.optionGrants.filter(g => g.company_id === company.id);
  const fmvEntry       = getEffectiveFmv(company.id, now);
  const fmv            = fmvEntry?.fmv ?? null;
  const vestedVal      = fmv !== null ? grants.reduce((s,g) => s + computeIntrinsicValue(g, fmv, now), 0) : null;
  const unvestedVal    = fmv !== null ? grants.reduce((s,g) => s + computeUnvestedValue(g, fmv, now), 0) : null;
  const vestedShares   = grants.reduce((s,g) => s + computeVestedShares(g, now), 0);
  const unvestedShares = grants.reduce((s,g) => s + computeUnvestedShares(g, now), 0);
  const color          = COMPANY_COLORS[ci % COMPANY_COLORS.length];

  const card = document.createElement('div');
  card.className = 'opt-company-card';
  card.style.setProperty('--opt-color', color);

  // --- Header ---
  const header = document.createElement('div');
  header.className = 'opt-card-header';

  // Title row: company name left, pill right
  const titleRow = document.createElement('div');
  titleRow.className = 'opt-card-title-row';

  const titleEl = document.createElement('div');
  titleEl.className = 'opt-card-title';
  titleEl.innerHTML = `
    <span class="opt-company-dot"></span>
    <strong>${escapeHtml(company.name)}</strong>
    ${company.ticker ? `<span class="opt-ticker">${escapeHtml(company.ticker)}</span>` : ''}
  `;

  const pillEl = document.createElement('div');
  pillEl.className = 'opt-chart-pill';
  pillEl.innerHTML = `
    <button class="opt-pill-btn active" data-view="vesting">${t('opt_pill_vesting')}</button>
    <button class="opt-pill-btn" data-view="value">${t('opt_pill_value')}</button>
  `;

  titleRow.appendChild(titleEl);
  titleRow.appendChild(pillEl);

  const metaEl = document.createElement('div');
  metaEl.className = 'opt-card-meta';
  metaEl.innerHTML = fmv !== null
    ? `<span class="opt-fmv-display">${t('opt_last_fmv')} ${fmtMoney(fmv)}</span><span class="opt-fmv-date">${fmtMonth(fmvEntry.date, { style: 'short' })}</span>`
    : `<span class="opt-no-fmv hint">${t('opt_no_fmv')}</span>`;

  const valuesEl = document.createElement('div');
  valuesEl.className = 'opt-card-values';

  function renderCardValues(view) {
    if (view === 'vesting') {
      valuesEl.innerHTML = `
        <span class="opt-vested-val">${privShares(vestedShares)} <span class="opt-val-label">${t('opt_shares_vested')}</span></span>
        <span class="opt-unvested-val">${privShares(unvestedShares)} <span class="opt-val-label">${t('opt_shares_unvested')}</span></span>
      `;
    } else {
      valuesEl.innerHTML = `
        ${vestedVal !== null ? `<span class="opt-vested-val">${privMoney(vestedVal)} <span class="opt-val-label">${t('opt_vested_label')}</span></span>` : ''}
        ${unvestedVal !== null ? `<span class="opt-unvested-val">${privMoney(unvestedVal)} <span class="opt-val-label">${t('opt_unvested_label')}</span></span>` : ''}
      `;
    }
  }
  renderCardValues('vesting');

  header.appendChild(titleRow);
  header.appendChild(metaEl);
  header.appendChild(valuesEl);
  card.appendChild(header);

  // --- Charts (two canvases, toggled by pill) ---
  let vestingWrap = null, valueWrap = null;
  if (grants.length) {
    vestingWrap = document.createElement('div');
    vestingWrap.className = 'opt-chart-wrap';
    const vestingCanvas = document.createElement('canvas');
    vestingCanvas.className = 'opt-company-canvas';
    vestingWrap.appendChild(vestingCanvas);
    card.appendChild(vestingWrap);

    valueWrap = document.createElement('div');
    valueWrap.className = 'opt-chart-wrap';
    valueWrap.hidden = true;
    const valueCanvas = document.createElement('canvas');
    valueCanvas.className = 'opt-company-canvas';
    valueWrap.appendChild(valueCanvas);
    card.appendChild(valueWrap);

    requestAnimationFrame(() => {
      renderCompanyVestingChart(vestingCanvas, company, grants, fmv, now);
      const rendered = renderCompanyValueChart(valueCanvas, company, grants, color, now);
      if (!rendered) {
        valueCanvas.remove();
        const hint = document.createElement('p');
        hint.className = 'hint';
        hint.style.cssText = 'padding: 2rem 1.25rem; text-align: center; margin: 0;';
        hint.textContent = t('opt_no_fmv_history');
        valueWrap.appendChild(hint);
      }
    });
  }

  // --- Grants list ---
  const grantsList = document.createElement('div');
  grantsList.className = 'opt-grants-list';
  if (grants.length) {
    grants.forEach((grant, gi) => {
      const gColor          = GRANT_COLORS[gi % GRANT_COLORS.length];
      const vested          = computeVestedShares(grant, now);
      const exercised       = exercisedSharesForGrant(grant.id, now);
      const exercisable     = exercisableShares(grant, now);
      const total           = Number(grant.total_shares) || 0;
      const pct             = total ? Math.min(100, (vested / total) * 100) : 0;
      const vestVal         = fmv !== null ? computeIntrinsicValue(grant, fmv, now) : null;
      const unvestedGrantVal = fmv !== null ? computeUnvestedValue(grant, fmv, now) : null;
      const totalGrantVal   = vestVal !== null && unvestedGrantVal !== null ? vestVal + unvestedGrantVal : null;
      const fullyVested     = vested >= total;
      const firstVest       = grantFirstVestDate(grant);
      const cliffPending    = !fullyVested && firstVest && firstVest > now;
      const cliffMonths     = cliffPending ? Math.ceil(
        (new Date(firstVest+'T12:00:00') - new Date(now+'T12:00:00')) / (1000*60*60*24*30.44)
      ) : 0;

      const valueHtml = vestVal !== null
        ? `<span class="opt-grant-value">${privMoney(vestVal)}${totalGrantVal !== null ? `<span class="opt-grant-unvested-val"> / ${privMoney(totalGrantVal)}</span>` : ''}</span>`
        : '';

      // Vested count, with an exercisable count in parentheses when some
      // shares have been exercised: "11,250 (10,000) / 12,000 shares vested".
      const exercisablePart = exercised > 0
        ? ` (<span class="opt-exercisable" data-tooltip="${escapeHtml(t('opt_exercisable_tip'))}">${privShares(exercisable)}</span>)`
        : '';
      const sharesText = `${privShares(vested)}${exercisablePart} / ${privShares(total)} ${t('opt_shares_vested')}`;
      const metaLeft = cliffPending
        ? t('opt_cliff_pending').replace('{months}', cliffMonths)
        : (fullyVested && exercised === 0)
          ? t('opt_fully_vested')
          : sharesText;

      const row = document.createElement('div');
      row.className = 'opt-grant-row';
      row.innerHTML = `
        <div class="opt-grant-header">
          <span class="opt-grant-dot" style="background:${gColor}"></span>
          <span class="opt-grant-name">${escapeHtml(grant.label || grant.grant_type || 'Grant')}</span>
          <span class="opt-grant-type-badge">${escapeHtml(grant.grant_type || '')}</span>
        </div>
        <div class="opt-grant-progress-wrap">
          <div class="opt-grant-progress-bar">
            <div class="opt-grant-progress-fill" style="width:${pct.toFixed(1)}%;background:${gColor}"></div>
          </div>
          <span class="opt-grant-pct">${Math.round(pct)}%</span>
        </div>
        <div class="opt-grant-meta">
          <span>${metaLeft}</span>
          ${valueHtml}
        </div>`;
      row.appendChild(buildGrantExercisesBlock(grant));
      grantsList.appendChild(row);
    });
  } else {
    grantsList.innerHTML = `<p class="hint" style="margin:.5rem 0">${t('opt_no_grants')}</p>`;
  }
  card.appendChild(grantsList);

  // --- Pill toggle wiring ---
  pillEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.opt-pill-btn');
    if (!btn || btn.classList.contains('active')) return;
    const view = btn.dataset.view;
    pillEl.querySelectorAll('.opt-pill-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderCardValues(view);
    if (vestingWrap) vestingWrap.hidden = (view !== 'vesting');
    if (valueWrap)   valueWrap.hidden   = (view !== 'value');
  });

  return card;
}

// --- Per-grant exercises (collapsible log + add/edit) ---

export function buildGrantExercisesBlock(grant) {
  const exercises = (state.optionExercises || [])
    .filter(e => e.grant_id === grant.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  const count = exercises.length;

  const wrap = document.createElement('div');
  wrap.className = 'opt-exercises-block';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'opt-exercises-toggle';

  const body = document.createElement('div');
  body.className = 'opt-exercises-body';
  body.hidden = true;

  const labelFor = (open) =>
    `${open ? '▾' : '▸'} ${t('opt_exercises_label')}` +
    (count ? ` · ${t('opt_exercises_count').replace('{count}', count)}` : '');
  toggle.textContent = labelFor(false);

  if (count) {
    exercises.forEach(ex => {
      const exRow = document.createElement('div');
      exRow.className = 'opt-exercise-row';
      exRow.innerHTML = `
        <span class="opt-exercise-date">${escapeHtml(ex.date)}</span>
        <span class="opt-exercise-shares">${privShares(Number(ex.shares_exercised) || 0)} ${escapeHtml(t('opt_shares_exercised_suffix'))}</span>
        <span class="opt-exercise-price">@ ${fmtMoney(Number(ex.price_paid) || 0)}</span>
        <span class="opt-exercise-note">${escapeHtml(ex.note || '')}</span>
        <button type="button" class="link-btn opt-exercise-edit-btn">${t('edit_label')}</button>`;
      exRow.querySelector('.opt-exercise-edit-btn')
        .addEventListener('click', () => openExerciseDialog(ex.id, grant.id));
      body.appendChild(exRow);
    });
  } else {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.style.margin = '.25rem 0 .5rem';
    hint.textContent = t('opt_no_exercises');
    body.appendChild(hint);
  }

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'link-btn opt-add-exercise-btn';
  addBtn.textContent = t('opt_add_exercise');
  addBtn.addEventListener('click', () => openExerciseDialog(null, grant.id));
  body.appendChild(addBtn);

  toggle.addEventListener('click', () => {
    body.hidden = !body.hidden;
    toggle.textContent = labelFor(!body.hidden);
  });

  wrap.appendChild(toggle);
  wrap.appendChild(body);
  return wrap;
}
