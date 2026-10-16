import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { Dices, LogIn } from 'lucide-react';
import { auth, googleProvider, useEmulators } from '../../firebase/config.js';
import { Spinner } from '../common/ui.jsx';

export default function SignIn() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const signIn = async () => {
    setBusy(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') setError(err?.message || 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card w-full max-w-md p-8 text-center">
        <Dices className="mx-auto mb-3 h-12 w-12 text-accent" />
        <h1 className="text-3xl font-bold">Solo RPG Engine</h1>
        <p className="mt-2 text-muted">A personal tabletop RPG with honest dice, a living world, and permanent consequences.</p>
        <button className="btn-primary mt-6 w-full py-2.5 text-base" onClick={signIn} disabled={busy}>
          {busy ? <Spinner /> : <LogIn className="h-4 w-4" />} Sign in with Google
        </button>
        {useEmulators && <p className="mt-3 text-xs text-muted">Emulator mode: any fake Google account works.</p>}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
