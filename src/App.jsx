import { Suspense, lazy, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, firebaseConfigured } from './firebase/config.js';
import { useGameStore } from './store/useGameStore.js';
import { Toasts, Spinner } from './components/common/ui.jsx';
import SignIn from './components/auth/SignIn.jsx';
import SetupRequired from './components/auth/SetupRequired.jsx';
import AlmanacLauncher from './components/common/AlmanacLauncher.jsx';

// The hub and the game stage are separate views; each loads its own chunk on first use.
const GuildhallHub = lazy(() => import('./components/hub/GuildhallHub.jsx'));
const GameStage = lazy(() => import('./components/stage/GameStage.jsx'));
// The Almanac (all rules, gear and spells) loads the first time it is opened.
const AlmanacWindow = lazy(() => import('./components/common/AlmanacWindow.jsx'));
const AlmanacStandalone = lazy(() => import('./components/common/AlmanacWindow.jsx').then((m) => ({ default: m.AlmanacStandalone })));

/** The pop-out Almanac window (`/?almanac=1`) is static reference data: it needs no sign-in. */
const IS_ALMANAC_POPOUT = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('almanac') === '1';

function ViewFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center gap-2 text-muted">
      <Spinner className="h-5 w-5" /> Loading…
    </div>
  );
}

export default function App() {
  if (IS_ALMANAC_POPOUT) {
    return (
      <Suspense fallback={<ViewFallback />}>
        <AlmanacStandalone />
      </Suspense>
    );
  }
  return <GameApp />;
}

function GameApp() {
  const user = useGameStore((s) => s.user);
  const authReady = useGameStore((s) => s.authReady);
  const setUser = useGameStore((s) => s.setUser);
  const view = useGameStore((s) => s.view);
  const almanacOpen = useGameStore((s) => s.almanacOpen);

  useEffect(() => {
    if (!firebaseConfigured) return undefined;
    return onAuthStateChanged(auth, (u) => setUser(u ? { uid: u.uid, displayName: u.displayName, email: u.email, photoURL: u.photoURL } : null));
  }, [setUser]);

  if (!firebaseConfigured) return <SetupRequired />;

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-muted">
        <Spinner className="h-5 w-5" /> Opening the Guildhall…
      </div>
    );
  }

  return (
    <>
      <Suspense fallback={<ViewFallback />}>
        {!user ? <SignIn /> : view === 'game' ? <GameStage /> : <GuildhallHub />}
      </Suspense>
      <AlmanacLauncher />
      {almanacOpen && (
        <Suspense fallback={null}>
          <AlmanacWindow />
        </Suspense>
      )}
      <Toasts />
    </>
  );
}
