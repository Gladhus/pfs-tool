import { useTranslation } from 'react-i18next';
import { useUIStore, type TabName } from '@/stores/ui.store';

// Mobile-only fixed bottom tab bar (visible at ≤768px via CSS).
// Icons are text placeholders until issue #11 (Lucide React) is done.
const TABS: Array<{ id: TabName; labelKey: string; icon: string; extraClass?: string }> = [
  { id: 'overview', labelKey: 'tab_overview', icon: '◈' },
  { id: 'history',  labelKey: 'tab_history',  icon: '▤' },
  { id: 'detail',   labelKey: 'tab_detail',   icon: '≡' },
  { id: 'entry',    labelKey: 'tab_entry',    icon: '+', extraClass: 'bottom-tab-btn--entry' },
  { id: 'settings', labelKey: 'tab_settings', icon: '⚙' },
];

export default function BottomTabBar() {
  const { t } = useTranslation();
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  return (
    <nav id="bottom-tab-bar" aria-label="Mobile navigation">
      {TABS.map(({ id, labelKey, icon, extraClass }) => (
        <button
          key={id}
          className={[
            'bottom-tab-btn',
            extraClass,
            activeTab === id ? 'active' : '',
          ].filter(Boolean).join(' ')}
          onClick={() => setActiveTab(id)}
          aria-current={activeTab === id ? 'page' : undefined}
        >
          <span aria-hidden="true" style={{ fontSize: '1.1rem' }}>{icon}</span>
          <span>{t(labelKey)}</span>
        </button>
      ))}
    </nav>
  );
}
