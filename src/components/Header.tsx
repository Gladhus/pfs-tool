import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthProvider';
import { useAuthStore, selectIsSignedIn } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import Logo from './Logo';

export default function Header() {
  const { t } = useTranslation();
  const { signIn, signOut, canSignIn } = useAuth();
  const isSignedIn = useAuthStore(selectIsSignedIn);
  const userEmail = useAuthStore((s) => s.userEmail);
  const sheetId = useAuthStore((s) => s.sheetId);
  const privateMode = useUIStore((s) => s.privateMode);
  const togglePrivateMode = useUIStore((s) => s.togglePrivateMode);

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-4 h-14 flex items-center gap-4">
      {/* Brand */}
      <div className="flex items-center gap-2.5 text-white shrink-0">
        <Logo size={18} />
        <span className="font-semibold text-sm tracking-tight">Net Worth Tracker</span>
      </div>

      <div className="flex-1" />

      {/* Right-side controls */}
      <div className="flex items-center gap-2">
        {isSignedIn && sheetId && (
          <a
            href={`https://docs.google.com/spreadsheets/d/${sheetId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            ↗ Sheet
          </a>
        )}

        {isSignedIn && (
          <button
            onClick={togglePrivateMode}
            title={privateMode ? t('private_mode_off') : t('private_mode')}
            className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            {privateMode ? '👁 ' + t('private_mode_off') : '🔒 ' + t('private_mode')}
          </button>
        )}

        {isSignedIn ? (
          <div className="flex items-center gap-2">
            {userEmail && (
              <span className="hidden md:inline text-xs text-slate-500">{userEmail}</span>
            )}
            <button
              onClick={signOut}
              className="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              {t('sign_out')}
            </button>
          </div>
        ) : (
          <button
            onClick={signIn}
            disabled={!canSignIn}
            className="text-xs px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
          >
            {t('sign_in')}
          </button>
        )}
      </div>
    </header>
  );
}
