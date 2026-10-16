/**
 * Mobile turn recovery decisions — pure, so they can be tested without a browser.
 *
 * Phones suspend a backgrounded page and abort its fetch. That is not a real failure: the queued
 * turn (already saved locally) should quietly pause and resume when the player returns.
 */

/** Automatic retries allowed for a genuinely failed (retryable) turn before the player must press Retry. */
export const MAX_AUTO_RETRIES = 2;

/** A returning page within this window is treated as having been backgrounded during the request. */
export const BACKGROUND_GRACE_MS = 2000;

/**
 * Was this error caused by the app going to the background?
 * @param {{ code?: string }} err      ApiError from callApi
 * @param {object} p
 * @param {'visible'|'hidden'} p.visibility  document.visibilityState now
 * @param {number} p.startedAt     when the request started (ms)
 * @param {number} p.lastHiddenAt  last time the page became hidden (ms, 0 = never)
 * @param {number} p.lastVisibleAt last time the page became visible again (ms, 0 = never)
 * @param {number} p.now
 */
export function isBackgroundInterruption(err, { visibility, startedAt, lastHiddenAt = 0, lastVisibleAt = 0, now }) {
  if (!err || (err.code !== 'network' && err.code !== 'timeout')) return false;
  if (visibility === 'hidden') return true;
  if (lastHiddenAt >= startedAt) return true; // hidden at some point while the request was in flight
  return lastVisibleAt > 0 && now - lastVisibleAt <= BACKGROUND_GRACE_MS && lastHiddenAt > 0;
}

/**
 * Should a queued turn resume on its own (page visible again / back online)?
 * Paused turns always resume; failed ones only if retryable and under the auto-retry cap.
 */
export function shouldAutoResume(queue) {
  if (!queue) return false;
  if (queue.status === 'paused_background') return true;
  return queue.status === 'failed' && queue.retryable !== false && (queue.autoRetries || 0) < MAX_AUTO_RETRIES;
}
