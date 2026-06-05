import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthProvider';

export default function SignedOutScreen() {
  const { t } = useTranslation();
  const { signIn, canSignIn } = useAuth();

  return (
    <div id="signed-out-state">
      <p>Sign in to access your net worth data.</p>
      <br />
      <button onClick={signIn} disabled={!canSignIn} className="primary">
        {t('sign_in')}
      </button>
      {!canSignIn && (
        <p className="hint" style={{ marginTop: '0.75rem' }}>
          Connecting to Google…
        </p>
      )}
    </div>
  );
}
