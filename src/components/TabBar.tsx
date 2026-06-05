import { useTranslation } from 'react-i18next';
import { useUIStore, type TabName } from '@/stores/ui.store';

const TABS: Array<{ id: TabName; labelKey: string }> = [
  { id: 'overview',  labelKey: 'tab_overview' },
  { id: 'history',   labelKey: 'tab_history'  },
  { id: 'detail',    labelKey: 'tab_detail'   },
  { id: 'entry',     labelKey: 'tab_entry'    },
  { id: 'settings',  labelKey: 'tab_settings' },
];

export default function TabBar() {
  const { t } = useTranslation();
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  return (
    <nav className="bg-slate-900 border-b border-slate-800 flex overflow-x-auto" aria-label="Main navigation">
      {TABS.map(({ id, labelKey }) => (
        <button
          key={id}
          onClick={() => setActiveTab(id)}
          className={[
            'px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2',
            activeTab === id
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600',
          ].join(' ')}
          aria-current={activeTab === id ? 'page' : undefined}
        >
          {t(labelKey)}
        </button>
      ))}
    </nav>
  );
}
