import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { dispatchShortcut } from '@/utils/shortcuts';
import { useUIStore } from '@/stores/ui.store';
import { useConfigQuery } from '@/queries/sheetQueries';

const ACTION_ROUTES: Partial<Record<string, string>> = {
  'tab:overview': '/overview',
  'tab:accounts/detail': '/detail',
  'tab:accounts/history': '/history',
  'tab:accounts/manage': '/detail',
  'tab:options': '/options',
  'tab:entry': '/entry',
  'tab:settings': '/settings',
};

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const togglePrivateMode = useUIStore((s) => s.togglePrivateMode);
  const configQuery = useConfigQuery();
  const stockOptEnabled = configQuery.data?.stock_options_enabled === true;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const onEntryTab = location.pathname.startsWith('/entry');
      const action = dispatchShortcut(e.key, {
        stockOptEnabled,
        saveEnabled: false,
        onEntryTab,
      });

      if (!action) return;
      e.preventDefault();

      if (action === 'private') {
        togglePrivateMode();
        return;
      }
      const route = ACTION_ROUTES[action];
      if (route) navigate(route);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, location.pathname, togglePrivateMode, stockOptEnabled]);
}
