import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { useAuthStore, selectIsSignedIn } from '@/stores/auth.store';
import { useDatasourceStore } from '@/stores/datasource.store';
import { useUIStore } from '@/stores/ui.store';
import { Icon } from '@/ui/Icon';
import { todayISO } from '@/utils/dates';
import NavTabs from './NavTabs';

const ICON_BTN = 'flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white/70 transition-colors hover:bg-white/15 hover:text-white';

export default function Header() {
  const { t } = useTranslation();
  const { signIn, canSignIn } = useAuth();
  const isSignedIn = useAuthStore(selectIsSignedIn);
  const hasDatasource = useDatasourceStore(s => s.datasource !== null);
  const privateMode = useUIStore((s) => s.privateMode);
  const togglePrivateMode = useUIStore((s) => s.togglePrivateMode);

  return (
    <header className="sticky top-0 z-40 bg-header border-b border-white/10 px-4 h-16 md:h-14 flex items-center gap-6">
      {/* Brand */}
      <div className="flex items-center gap-2.5 text-white shrink-0">
        <Icon name="logo" size={24} strokeWidth={2.5} className="text-[#72bf48]" />
        <span className="font-semibold text-sm tracking-tight">Net Worth Tracker</span>
      </div>

      {/* Inline nav tabs (desktop) */}
      {hasDatasource && (
        <div className="hidden md:flex h-full">
          <NavTabs />
        </div>
      )}

      <div className="flex-1" />

      {/* Right-side icon buttons */}
      <div className="flex items-center gap-2">
        {hasDatasource ? (
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
              className={({ isActive }) => `hidden md:flex ${ICON_BTN} ${isActive ? 'bg-white/20 text-white' : ''}`}
            >
              <Icon name="settings" size={19} strokeWidth={2.25} />
            </NavLink>
          </>
        ) : (
          <button
            onClick={signIn}
            disabled={!canSignIn}
            className="text-xs px-3 py-1.5 rounded bg-[#72bf48] hover:bg-[#64ac3e] disabled:opacity-50 disabled:cursor-not-allowed text-[#0c1e09] font-medium transition-colors"
          >
            {t('sign_in')}
          </button>
        )}
      </div>
    </header>
  );
}
