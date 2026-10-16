/**
 * Authenticated client for the Vercel serverless gateway (/api/*).
 * Attaches the Firebase ID token and enforces a timeout so the Retry Queue can recover.
 */
import { auth } from './config.js';

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'http', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code; // 'timeout' | 'network' | 'http' | 'auth'
    this.details = details;
  }

  get retryable() {
    return this.code === 'timeout' || this.code === 'network' || this.status >= 500 || this.status === 429;
  }
}

export const DEFAULT_TIMEOUT_MS = 90_000;

export async function callApi(route, body, { timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {}) {
  const user = auth?.currentUser;
  if (!user) throw new ApiError('You must be signed in.', { status: 401, code: 'auth' });
  const token = await user.getIdToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), timeoutMs);
  const onAbort = () => controller.abort(signal.reason);
  if (signal) signal.addEventListener('abort', onAbort, { once: true });
  let res;
  try {
    res = await fetch(`/api/${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (controller.signal.aborted && controller.signal.reason?.name === 'TimeoutError') {
      throw new ApiError(`The storyteller took longer than ${Math.round(timeoutMs / 1000)}s to respond.`, { code: 'timeout' });
    }
    throw new ApiError('Network error — check your connection.', { code: 'network', details: String(err?.message || err) });
  } finally {
    if (signal) signal.removeEventListener('abort', onAbort);
  }
  clearTimeout(timer);
  let payload = null;
  const text = await res.text();
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { error: text.slice(0, 300) };
  }
  if (!res.ok) {
    throw new ApiError(payload?.error || `Request failed (${res.status}).`, {
      status: res.status,
      code: res.status === 401 ? 'auth' : 'http',
      details: payload?.details ?? null,
    });
  }
  return payload;
}
