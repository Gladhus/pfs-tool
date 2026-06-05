import { AuthProvider } from './auth/AuthProvider';
import { useAuthStore, selectIsSignedIn } from './stores/auth.store';
import Header from './components/Header';
import TabBar from './components/TabBar';
import StatusBar from './components/StatusBar';
import SignedOutScreen from './components/SignedOutScreen';
import SignedInShell from './components/SignedInShell';

function AppShell() {
  const isSignedIn = useAuthStore(selectIsSignedIn);
  const isDataLoaded = useAuthStore((s) => s.isDataLoaded);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <Header />
      <StatusBar />

      {isSignedIn ? (
        <>
          <TabBar />
          {isBootstrapping ? (
            <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
              Setting up your sheet…
            </div>
          ) : isDataLoaded ? (
            <SignedInShell />
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
              Loading…
            </div>
          )}
        </>
      ) : (
        <SignedOutScreen />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
