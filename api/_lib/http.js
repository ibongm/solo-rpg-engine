/**
 * Shared handler wrapper: POST-only, JSON body, Firebase auth, uniform JSON errors.
 */
import { verifyRequest, HttpError } from './auth.js';

export { HttpError };

export function isMock() {
  return process.env.VERTEX_MOCK === '1' || process.env.VERTEX_MOCK === 'true';
}

export function withHandler(fn) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed.' });
    }
    try {
      let body = req.body;
      if (typeof body === 'string') body = body ? JSON.parse(body) : {};
      if (!body || typeof body !== 'object') throw new HttpError(400, 'Expected a JSON body.');
      const uid = await verifyRequest(req);
      const result = await fn({ body, uid, req });
      return res.status(200).json(result);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : err?.status && Number.isInteger(err.status) ? err.status : 500;
      if (status >= 500) console.error('[api]', err);
      return res.status(status).json({ error: err.message || 'Internal error', details: err.details ?? null });
    }
  };
}

export function requireString(value, name, max = 20000) {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, `"${name}" is required.`);
  if (value.length > max) throw new HttpError(413, `"${name}" is too long.`);
  return value;
}
