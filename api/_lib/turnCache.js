/**
 * Short-lived, per-instance dedup for /api/dm-turn.
 *
 * When a phone backgrounds the app mid-turn, the browser drops the request but this function keeps
 * generating. The client resends the same turnId when it comes back; if that retry reaches the same
 * warm instance, it gets the finished (or still-running) result instead of paying for a second
 * generation. It is best-effort: a retry that lands on another instance simply generates again.
 */
export function createTurnCache({ ttlMs = 5 * 60_000, maxEntries = 500, now = () => Date.now() } = {}) {
  const entries = new Map();

  function prune() {
    const t = now();
    for (const [key, e] of entries) if (e.expires <= t) entries.delete(key);
    while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
  }

  return {
    /**
     * Runs `generate` once per key within the TTL. Failed generations are forgotten so a retry can try again.
     * @returns {{ promise: Promise<any>, cached: boolean }}
     */
    run(key, generate) {
      prune();
      const hit = entries.get(key);
      if (hit) return { promise: hit.promise, cached: true };
      const promise = Promise.resolve().then(generate);
      entries.set(key, { promise, expires: now() + ttlMs });
      promise.catch(() => entries.delete(key));
      return { promise, cached: false };
    },
    size() {
      prune();
      return entries.size;
    },
  };
}

const SAFE_TURN_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** A client turn id we are willing to use as a cache key, or null. */
export function cleanTurnId(turnId) {
  return typeof turnId === 'string' && SAFE_TURN_ID.test(turnId) ? turnId : null;
}
