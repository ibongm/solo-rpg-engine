/**
 * Firebase Admin bootstrap + ID-token verification for every /api route.
 * - With emulators (FIREBASE_AUTH_EMULATOR_HOST set): no credentials needed.
 * - In production: reuses GCP_SERVICE_ACCOUNT_KEY (a Firebase project is a GCP project),
 *   so no extra env vars are required. ID-token verification itself needs only the project ID.
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { parseServiceAccount } from './credentials.js';

export class HttpError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function projectId() {
  return process.env.VITE_FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID;
}

export function storageBucketName() {
  return process.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId()}.appspot.com`;
}

export function getAdminApp() {
  const existing = getApps().find((a) => a.name === 'solo-rpg-admin');
  if (existing) return existing;
  const pid = projectId();
  if (!pid) throw new HttpError(500, 'Server misconfigured: set VITE_FIREBASE_PROJECT_ID or GCP_PROJECT_ID.');
  const options = { projectId: pid, storageBucket: storageBucketName() };
  const usingEmulators = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
  if (!usingEmulators && process.env.GCP_SERVICE_ACCOUNT_KEY) {
    options.credential = cert(parseServiceAccount(process.env.GCP_SERVICE_ACCOUNT_KEY));
  }
  return initializeApp(options, 'solo-rpg-admin');
}

/** Verifies `Authorization: Bearer <Firebase ID token>`; returns the uid. */
export async function verifyRequest(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(String(header));
  if (!match) throw new HttpError(401, 'Missing bearer token.');
  try {
    const decoded = await getAuth(getAdminApp()).verifyIdToken(match[1]);
    return decoded.uid;
  } catch (err) {
    throw new HttpError(401, 'Invalid or expired session. Please sign in again.', String(err?.code || err?.message || ''));
  }
}

export function getAdminBucket() {
  return getStorage(getAdminApp()).bucket(storageBucketName());
}
