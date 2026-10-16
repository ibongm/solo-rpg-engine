import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, firebaseConfigured } from './firebase/config.js';
import { useGameStore } from './store/useGameStore.js';
import { Toasts, Spinner } from './components/common/ui.jsx';
import SignIn from './components/auth/SignIn.jsx';
import SetupRequired from './components/auth/SetupRequired.jsx';
import GuildhallHub from './components/hub/GuildhallHub.jsx';
import GameStage from './components/stage/GameStage.jsx';

export default function App() {
  const user = useGameStore((s) => s.user);
  const authReady = useGameStore((s) => s.authReady);
  const setUser = useGameStore((s) => s.setUser);
  const view = useGameStore((s) => s.view);

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
      {!user ? <SignIn /> : view === 'game' ? <GameStage /> : <GuildhallHub />}
      <Toasts />
    </>
  );
}
