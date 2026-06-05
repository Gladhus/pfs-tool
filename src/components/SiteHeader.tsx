import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthProvider';
import { useAuthStore, selectIsSignedIn } from '@/stores/auth.store';
import { useUIStore, type TabName } from '@/stores/ui.store';
import { useStatusStore } from '@/stores/status.store';
import Logo from './Logo';

const TABS: Array<{ id: TabName; labelKey: string }> = [
  { id: 'overview', labelKey: 'tab_overview' },
  { id: 'history',  labelKey: 'tab_history'  },
  { id: 'detail',   labelKey: 'tab_detail'   },
  { id: 'entry',    labelKey: 'tab_entry'    },
  { id: 'settings', labelKey: 'tab_settings' },
];

export default function SiteHeader() {
  const { t } = useTranslation();
  const { signIn, signOut, canSignIn } = useAuth();
  const isSignedIn  = useAuthStore(selectIsSignedIn);
  const userEmail   = useAuthStore((s) => s.userEmail);
  const sheetId     = useAuthStore((s) => s.sheetId);
  const activeTab   = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const privateMode = useUIStore((s) => s.privateMode);
  const togglePrivateMode = useUIStore((s) => s.togglePrivateMode);
  const { message, level } = useStatusStore();

  return (
    <header className="site-header">
      {/* Brand */}
      <h1 className="site-logo">
        <span className="logo-mark">
          <Logo size={16} />
        </span>
        <span className="logo-name">Net Worth Tracker</span>
      </h1>

      {/* Tab bar — shown when signed in, hidden on mobile (bottom tab bar takes over) */}
      {isSignedIn && (
        <nav id="tab-bar" aria-label="Main navigation">
          {TABS.map(({ id, labelKey }) => (
            <button
              key={id}
              className={`tab-btn${activeTab === id ? ' active' : ''}`}
              onClick={() => setActiveTab(id)}
              aria-current={activeTab === id ? 'page' : undefined}
            >
              {t(labelKey)}
            </button>
          ))}
        </nav>
      )}

      {/* Status message — flex: 1, centred between tab bar and auth area */}
      <span
        role="status"
        aria-live="polite"
        className={`status${level ? ' ' + level : ''}`}
      >
        {message}
      </span>

      {/* Auth area */}
      <div id="auth-area">
        {isSignedIn && userEmail && (
          <span id="user-email">{userEmail}</span>
        )}
        {isSignedIn && sheetId && (
          <a
            className="header-sheet-link"
            href={`https://docs.google.com/spreadsheets/d/${sheetId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('data_sheet')}
          </a>
        )}
        {isSignedIn && (
          <button
            id="private-mode-btn"
            className={`private-mode-btn${privateMode ? ' is-private' : ''}`}
            onClick={togglePrivateMode}
            title={privateMode ? t('private_mode_off') : t('private_mode')}
          >
            {privateMode ? t('private_mode_off') : t('private_mode')}
          </button>
        )}
        {isSignedIn ? (
          <button onClick={signOut}>{t('sign_out')}</button>
        ) : (
          <button onClick={signIn} disabled={!canSignIn} className="primary">
            {t('sign_in')}
          </button>
        )}
      </div>
    </header>
  );
}
