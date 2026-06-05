import './en.js';
import './fr.js';
import { state } from '../../core/state.js';
import { t } from '../../core/i18n/index.js';
import { privMoney } from '../../core/privacy.js';
import { escapeHtml } from '../../core/dom.js';
import { computeTotalEquityValue, computeTotalUnvestedValue } from '../../utils/options.js';
import { todayISO } from '../../utils/dates.js';
import { renderSummaryChart } from './charts.js';
import { buildCompanyCard } from './components/CompanyCard.js';
import { renderOptionsManage } from './ManagePanel.js';
import {
  setRenderCallbacks,
  openCompanyDialog,
  openGrantDialog,
  openExerciseDialog,
  closeCompanyDialog,
  closeGrantDialog,
  closeExerciseDialog,
} from './dialogs.js';

// Re-export dialog openers consumed by src/main.js
export {
  openCompanyDialog,
  openGrantDialog,
  openExerciseDialog,
  closeCompanyDialog,
  closeGrantDialog,
  closeExerciseDialog,
};

// --- Sub-tab state ---
let _optSubTab = 'main';

export function setOptionsSubTab(panel) {
  _optSubTab = panel;
  for (const p of ['main', 'manage']) {
    const el = document.getElementById(`opt-sub-${p}`);
    if (el) el.hidden = (p !== panel);
  }
  document.querySelectorAll('#options-sidebar .section-sidebar-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.panel === panel);
  });
  if (panel === 'main')   _renderOptionsMain();
  if (panel === 'manage') renderOptionsManage();
}

export function renderOptions() {
  setOptionsSubTab(_optSubTab);
}

// --- Main sub-panel ---

function _renderOptionsMain() {
  const now = todayISO();
  const companies = state.optionCompanies.filter(c => c.active !== false);
  const totalVested   = computeTotalEquityValue(now);
  const totalUnvested = computeTotalUnvestedValue(now);

  const vestedEl   = document.getElementById('opt-vested-value');
  const unvestedEl = document.getElementById('opt-unvested-value');
  if (vestedEl)   vestedEl.textContent   = privMoney(totalVested);
  if (unvestedEl) unvestedEl.textContent = privMoney(totalUnvested);

  renderSummaryChart(now);

  const list = document.getElementById('opt-companies-list');
  if (!list) return;
  list.innerHTML = '';

  if (!companies.length) {
    list.innerHTML = `
      <div class="opt-empty-state">
        <p class="opt-empty-title">${escapeHtml(t('opt_no_companies'))}</p>
        <p class="hint">${escapeHtml(t('opt_no_companies_hint'))}</p>
      </div>`;
    return;
  }

  companies.forEach((company, ci) => {
    const card = buildCompanyCard(company, ci, now);
    list.appendChild(card);
  });
}

// Wire render callbacks so dialogs.js can trigger re-renders without
// importing from index.js or ManagePanel.js (avoids circular imports).
setRenderCallbacks(renderOptions, renderOptionsManage);
