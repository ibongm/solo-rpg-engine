import { describe, it, expect, afterEach } from 'vitest';
import { verifyIdToken, verifyRequest } from './auth.js';

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const unsigned = (payload) => `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(payload)}.`;
const saved = { ...process.env };

afterEach(() => {
  for (const k of ['FIREBASE_AUTH_EMULATOR_HOST', 'VERCEL', 'VITE_FIREBASE_PROJECT_ID', 'GCP_PROJECT_ID']) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('Firebase ID token verification', () => {
  it('rejects requests without a bearer token', async () => {
    await expect(verifyRequest({ headers: {} })).rejects.toMatchObject({ status: 401 });
  });

  it('accepts emulator tokens only when the emulator is configured', async () => {
    process.env.VITE_FIREBASE_PROJECT_ID = 'demo-p';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    const now = Math.floor(Date.now() / 1000);
    expect(await verifyIdToken(unsigned({ aud: 'demo-p', sub: 'u1', exp: now + 600 }))).toBe('u1');
    await expect(verifyIdToken(unsigned({ aud: 'other', sub: 'u1', exp: now + 600 }))).rejects.toThrow(/aud/);
    await expect(verifyIdToken(unsigned({ aud: 'demo-p', sub: 'u1', exp: now - 10 }))).rejects.toThrow(/expired/);
  });

  it('never accepts unsigned tokens on Vercel, even if the emulator variable leaks in', async () => {
    process.env.VITE_FIREBASE_PROJECT_ID = 'demo-p';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    process.env.VERCEL = '1';
    await expect(verifyIdToken(unsigned({ aud: 'demo-p', sub: 'u1' }))).rejects.toMatchObject({ status: 500 });
  });

  it('rejects unsigned tokens in production mode', async () => {
    process.env.VITE_FIREBASE_PROJECT_ID = 'demo-p';
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    await expect(verifyRequest({ headers: { authorization: `Bearer ${unsigned({ aud: 'demo-p', sub: 'u1' })}` } })).rejects.toMatchObject({ status: 401 });
  });
});
