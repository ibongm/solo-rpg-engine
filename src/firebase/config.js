/**
 * Firebase initialization: Auth, Firestore, Cloud Storage.
 * Set VITE_USE_EMULATORS=true to run fully offline against the Firebase Emulator Suite.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const env = import.meta.env;

export const useEmulators = env.VITE_USE_EMULATORS === 'true';

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || (useEmulators ? 'demo-key' : undefined),
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || (useEmulators ? 'localhost' : undefined),
  projectId: env.VITE_FIREBASE_PROJECT_ID || (useEmulators ? 'demo-solo-rpg' : undefined),
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || (useEmulators ? 'demo-solo-rpg.appspot.com' : undefined),
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined,
  appId: env.VITE_FIREBASE_APP_ID || undefined,
};

/** True when enough config exists to talk to Firebase (real project or emulators). */
export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export const missingFirebaseKeys = [
  ['VITE_FIREBASE_API_KEY', firebaseConfig.apiKey],
  ['VITE_FIREBASE_AUTH_DOMAIN', firebaseConfig.authDomain],
  ['VITE_FIREBASE_PROJECT_ID', firebaseConfig.projectId],
  ['VITE_FIREBASE_STORAGE_BUCKET', firebaseConfig.storageBucket],
]
  .filter(([, v]) => !v)
  .map(([k]) => k);

let app = null;
let auth = null;
let db = null;
let storage = null;

if (firebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = initializeFirestore(app, { ignoreUndefinedProperties: true });
  storage = getStorage(app);
  if (useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
  }
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export { app, auth, db, storage };
