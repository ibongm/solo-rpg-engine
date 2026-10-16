/**
 * Firebase ID-token verification for every /api route, plus a lazily created Firebase Admin
 * app for Storage uploads (only /api/paint-scene needs it).
 *
 * Tokens are verified directly with `jose` (Google's published securetoken JWKS), not with
 * firebase-admin/auth: that module pulls in jwks-rsa, which require()s the ESM-only jose@6 and
 * crashes on Vercel's function runtime (ERR_REQUIRE_ESM).
 *  - Production: RS256 signature, issuer, audience, expiry and subject are all checked.
 *  - Emulators (FIREBASE_AUTH_EMULATOR_HOST set): emulator tokens are unsigned, so only the
 *    claims are checked — never enable this outside local development.
 */
import { createRemoteJWKSet, jwtVerify, decodeJwt } from 'jose';
import { parseServiceAccount } from './credentials.js';

export class HttpError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const GOOGLE_SECURETOKEN_JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let jwks = null;

function projectId() {
  return process.env.VITE_FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID;
}

export function storageBucketName() {
  return process.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId()}.appspot.com`;
}

function usingAuthEmulator() {
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) return false;
  // Unsigned emulator tokens must never be accepted on a real deployment.
  if (process.env.VERCEL) throw new HttpError(500, 'Server misconfigured: FIREBASE_AUTH_EMULATOR_HOST must not be set on Vercel.');
  return true;
}

/** Verifies a Firebase ID token and returns its uid. Exported for tests. */
export async function verifyIdToken(token) {
  const pid = projectId();
  if (!pid) throw new HttpError(500, 'Server misconfigured: set VITE_FIREBASE_PROJECT_ID or GCP_PROJECT_ID.');
  let payload;
  if (usingAuthEmulator()) {
    payload = decodeJwt(token);
    const now = Math.floor(Date.now() / 1000);
    if (payload.aud !== pid) throw new Error(`aud mismatch (${payload.aud})`);
    if (typeof payload.exp === 'number' && payload.exp < now) throw new Error('token expired');
  } else {
    if (!jwks) jwks = createRemoteJWKSet(new URL(GOOGLE_SECURETOKEN_JWKS));
    ({ payload } = await jwtVerify(token, jwks, {
      issuer: `https://securetoken.google.com/${pid}`,
      audience: pid,
      algorithms: ['RS256'],
    }));
    if (typeof payload.auth_time === 'number' && payload.auth_time > Math.floor(Date.now() / 1000) + 300) throw new Error('auth_time is in the future');
  }
  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) throw new Error('missing subject');
  return payload.sub;
}

/** Verifies `Authorization: Bearer <Firebase ID token>`; returns the uid. */
export async function verifyRequest(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(String(header));
  if (!match) throw new HttpError(401, 'Missing bearer token.');
  try {
    return await verifyIdToken(match[1].trim());
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(401, 'Invalid or expired session. Please sign in again.', String(err?.code || err?.message || ''));
  }
}

/** Firebase Admin Storage bucket (loaded on demand so other routes never import firebase-admin). */
export async function getAdminBucket() {
  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getStorage } = await import('firebase-admin/storage');
  let app = getApps().find((a) => a.name === 'solo-rpg-admin');
  if (!app) {
    const pid = projectId();
    if (!pid) throw new HttpError(500, 'Server misconfigured: set VITE_FIREBASE_PROJECT_ID or GCP_PROJECT_ID.');
    const options = { projectId: pid, storageBucket: storageBucketName() };
    if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST && process.env.GCP_SERVICE_ACCOUNT_KEY) {
      options.credential = cert(parseServiceAccount(process.env.GCP_SERVICE_ACCOUNT_KEY));
    }
    app = initializeApp(options, 'solo-rpg-admin');
  }
  return getStorage(app).bucket(storageBucketName());
}
