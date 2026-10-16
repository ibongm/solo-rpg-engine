import { Settings } from 'lucide-react';
import { missingFirebaseKeys } from '../../firebase/config.js';

export default function SetupRequired() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card w-full max-w-lg p-8">
        <Settings className="mb-3 h-10 w-10 text-accent" />
        <h1 className="text-2xl font-bold">Firebase is not configured</h1>
        <p className="mt-2 text-muted">
          Create <code className="font-mono">.env.local</code> from <code className="font-mono">.env.example</code> and fill in your Firebase web app keys, or set{' '}
          <code className="font-mono">VITE_USE_EMULATORS=true</code> to run locally against the Firebase Emulator Suite. Full steps are in <code className="font-mono">SETUP.md</code>.
        </p>
        {missingFirebaseKeys.length > 0 && (
          <div className="card-inset mt-4 p-3">
            <div className="label">Missing</div>
            <ul className="font-mono text-sm">
              {missingFirebaseKeys.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-4 text-sm text-muted">Restart <code className="font-mono">npm run dev</code> after editing environment variables.</p>
      </div>
    </div>
  );
}
