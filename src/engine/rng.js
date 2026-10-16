/**
 * Randomness source for the deterministic rules engine.
 * - Default RNG uses crypto.getRandomValues (unbiased, unpredictable, visible to the player).
 * - Seeded RNG (mulberry32 over a string hash) for reproducible content such as
 *   merchant stock and daily weather, and for unit tests.
 */

/** xmur3 string hash → 32-bit seed generator. */
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(a) {
  let s = a >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Reproducible RNG from any string/number seed. Returns () => float in [0, 1). */
export function seededRng(seed) {
  return mulberry32(xmur3(String(seed))());
}

/** Cryptographically sourced RNG. Returns () => float in [0, 1). */
export function cryptoRng() {
  const buf = new Uint32Array(1);
  return () => {
    globalThis.crypto.getRandomValues(buf);
    return buf[0] / 4294967296;
  };
}

let defaultRng = cryptoRng();

/** Overrides the module-wide default RNG (used by tests). Pass null to restore crypto RNG. */
export function setDefaultRng(rng) {
  defaultRng = rng ?? cryptoRng();
}

export function getDefaultRng() {
  return defaultRng;
}

/** Inclusive integer in [min, max]. */
export function randInt(min, max, rng = defaultRng) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function rollDie(sides, rng = defaultRng) {
  return randInt(1, sides, rng);
}

export function pick(array, rng = defaultRng) {
  if (!array.length) return undefined;
  return array[Math.floor(rng() * array.length)];
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle(array, rng = defaultRng) {
  const out = array.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Short unique id (not security sensitive). */
export function uid(prefix = 'id') {
  const buf = new Uint32Array(2);
  globalThis.crypto.getRandomValues(buf);
  return `${prefix}_${buf[0].toString(36)}${buf[1].toString(36)}`;
}
