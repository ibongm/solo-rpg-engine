import { describe, it, expect, vi } from 'vitest';
import { createTurnCache, cleanTurnId } from './turnCache.js';

describe('turn result cache', () => {
  it('runs a generation once per key and shares it with repeats', async () => {
    const cache = createTurnCache();
    const gen = vi.fn(async () => ({ result: 'story' }));
    const a = cache.run('u1:t1', gen);
    const b = cache.run('u1:t1', gen); // retry while the first is still running
    expect(a.cached).toBe(false);
    expect(b.cached).toBe(true);
    expect(await b.promise).toEqual({ result: 'story' });
    expect(cache.run('u1:t1', gen).cached).toBe(true); // retry after it finished
    expect(gen).toHaveBeenCalledTimes(1);
  });

  it('isolates players and turns', async () => {
    const cache = createTurnCache();
    const gen = vi.fn(async () => 'x');
    await cache.run('u1:t1', gen).promise;
    await cache.run('u2:t1', gen).promise;
    await cache.run('u1:t2', gen).promise;
    expect(gen).toHaveBeenCalledTimes(3);
  });

  it('expires after the TTL and forgets failures', async () => {
    let t = 0;
    const cache = createTurnCache({ ttlMs: 1000, now: () => t });
    const gen = vi.fn(async () => 'ok');
    await cache.run('k', gen).promise;
    t = 1001;
    expect(cache.run('k', gen).cached).toBe(false);
    const failing = createTurnCache();
    await expect(failing.run('k', async () => { throw new Error('vertex down'); }).promise).rejects.toThrow('vertex down');
    await Promise.resolve();
    expect(failing.run('k', async () => 'second try').cached).toBe(false);
  });

  it('caps its size', async () => {
    const cache = createTurnCache({ maxEntries: 2 });
    for (const k of ['a', 'b', 'c']) await cache.run(k, async () => k).promise;
    expect(cache.size()).toBe(2);
  });

  it('accepts only safe turn ids', () => {
    expect(cleanTurnId('turn_abc-123')).toBe('turn_abc-123');
    expect(cleanTurnId('../etc')).toBeNull();
    expect(cleanTurnId('x'.repeat(65))).toBeNull();
    expect(cleanTurnId(42)).toBeNull();
  });
});
