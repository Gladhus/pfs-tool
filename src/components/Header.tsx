import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { useAuthStore, selectIsSignedIn } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { Icon } from '@/ui/Icon';
import { todayISO } from '@/utils/dates';
import NavTabs from './NavTabs';

const ICON_BTN = 'flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-fg-2 transition-colors hover:bg-surface-3 hover:text-fg';

export default function Header() {
  const { t } = useTranslation();
  const { signIn, canSignIn } = useAuth();
  const isSignedIn = useAuthStore(selectIsSignedIn);
  const privateMode = useUIStore((s) => s.privateMode);
  const togglePrivateMode = useUIStore((s) => s.togglePrivateMode);

  return (
    <header className="sticky top-0 z-40 bg-surface-1 border-b border-border px-4 h-14 flex items-center gap-6">
      {/* Brand */}
      <div className="flex items-center gap-2.5 text-fg shrink-0">
        <Icon name="logo" size={24} strokeWidth={2.5} className="text-accent" />
        <span className="font-semibold text-sm tracking-tight">Net Worth Tracker</span>
      </div>

      {/* Inline nav tabs (desktop) */}
      {isSignedIn && (
        <div className="hidden md:flex h-full">
          <NavTabs />
        </div>
      )}

      <div className="flex-1" />

      {/* Right-side icon buttons */}
      <div className="flex items-center gap-2">
        {isSignedIn ? (
          <>
            <Link
              to={`/entry/${todayISO()}`}
              aria-label="New entry"
              title="New entry"
              className={`hidden md:flex ${ICON_BTN}`}
            >
              <Icon name="plus" size={22} strokeWidth={2.5} />
            </Link>
            <button
              type="button"
              onClick={togglePrivateMode}
              aria-label={privateMode ? t('private_mode_off') : t('private_mode')}
              title={privateMode ? t('private_mode_off') : t('private_mode')}
              className={ICON_BTN}
            >
              <Icon name={privateMode ? 'eyeOff' : 'eye'} size={19} strokeWidth={2.25} />
            </button>
            <NavLink
              to="/settings"
              aria-label={t('tab_settings')}
              title={t('tab_settings')}
              className={({ isActive }) => `hidden md:flex ${ICON_BTN} ${isActive ? 'bg-surface-3 text-fg' : ''}`}
            >
              <Icon name="settings" size={19} strokeWidth={2.25} />
            </NavLink>
          </>
        ) : (
          <button
            onClick={signIn}
            disabled={!canSignIn}
            className="text-xs px-3 py-1.5 rounded bg-accent hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed text-accent-fg transition-colors"
          >
            {t('sign_in')}
          </button>
        )}
      </div>
    </header>
  );
}
