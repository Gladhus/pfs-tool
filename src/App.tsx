import { useEffect } from 'react';
import { AuthProvider } from './auth/AuthProvider';
import { useAuthStore, selectIsSignedIn } from './stores/auth.store';
import SiteHeader from './components/SiteHeader';
import BottomTabBar from './components/BottomTabBar';
import SignedOutScreen from './components/SignedOutScreen';
import SignedInShell from './components/SignedInShell';

function AppShell() {
  const isSignedIn    = useAuthStore(selectIsSignedIn);
  const isDataLoaded  = useAuthStore((s) => s.isDataLoaded);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);

  // Mirror signed-in state to body for CSS selectors (.is-signed-in #tab-bar etc.)
  useEffect(() => {
    document.body.classList.toggle('is-signed-in', isSignedIn);
  }, [isSignedIn]);

  return (
    <>
      <SiteHeader />

      {isSignedIn ? (
        isBootstrapping ? (
          <main>
            <p className="hint" style={{ textAlign: 'center', paddingTop: '2rem' }}>
              Setting up your sheet…
            </p>
          </main>
        ) : isDataLoaded ? (
          <SignedInShell />
        ) : (
          <main>
            <p className="hint" style={{ textAlign: 'center', paddingTop: '2rem' }}>
              Loading…
            </p>
          </main>
        )
      ) : (
        <main>
          <SignedOutScreen />
        </main>
      )}

      {isSignedIn && <BottomTabBar />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
