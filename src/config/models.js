/**
 * Single source of truth for Vertex AI model IDs, endpoints, capabilities and pricing.
 * Shared by the frontend (model switcher, cost telemetry) and the backend (api/*).
 *
 * Model IDs verified against Google Cloud "Model versions and lifecycle" on 2026-10-16:
 *   gemini-3.8-flash  — stable, retires no earlier than 2027-09-02
 *   gemini-3.7-flash  — shorter-availability tier, retires 2027-01-28
 *                       (replaces blueprint's gemini-3.6-flash, which retires 2026-11-19)
 *   gemini-4-argon    — stable, released 2026-10-13; implicit caching only; ignores temperature
 *   gemini-3.1-flash-image — stable image model (replaces discontinued imagen-3.0-generate-002)
 *
 * Pricing (USD per 1M tokens) sourced 2026-10-16 from the Vertex AI pricing page and
 * corroborating aggregators. Both Flash and Argon have introductory rates that end on the
 * listed date — re-verify at https://cloud.google.com/vertex-ai/generative-ai/pricing
 * when they change. `effectiveUntil` is inclusive (UTC date string).
 */

export const TEXT_MODELS = {
  'gemini-3.8-flash': {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    role: 'Default Daily Driver',
    location: null, // null → use GCP_LOCATION
    supportsExplicitCache: true,
    supportsTemperature: true,
    thinkingLevel: 'LOW',
    pricing: [
      { effectiveUntil: '2026-12-31', input: 0.75, output: 3.75, cached: 0.075 },
      { effectiveUntil: null, input: 1.5, output: 7.5, cached: 0.15 },
    ],
  },
  'gemini-3.7-flash': {
    id: 'gemini-3.7-flash',
    label: 'Gemini 3.7 Flash',
    role: 'Fast Fallback / Alternate Prose',
    location: null,
    supportsExplicitCache: true,
    supportsTemperature: true,
    thinkingLevel: 'LOW',
    pricing: [
      { effectiveUntil: '2026-12-31', input: 0.75, output: 3.75, cached: 0.075 },
      { effectiveUntil: null, input: 1.5, output: 7.5, cached: 0.15 },
    ],
  },
  'gemini-4-argon': {
    id: 'gemini-4-argon',
    label: 'Gemini 4 Argon',
    role: 'Heavy Reasoning / World Seeding / Mysteries',
    location: 'global',
    supportsExplicitCache: false, // implicit caching only (prompts ≥ 4,096 tokens)
    supportsTemperature: false, // temperature/top_p/top_k are ignored
    thinkingLevel: 'MEDIUM',
    pricing: [
      { effectiveUntil: '2026-11-30', input: 2.0, output: 10.0, cached: 0.1 },
      { effectiveUntil: null, input: 4.0, output: 20.0, cached: 0.2 },
    ],
  },
};

export const IMAGE_MODEL = {
  id: 'gemini-3.1-flash-image',
  label: 'Gemini 3.1 Flash Image',
  location: 'global',
  aspectRatio: '16:9',
  pricing: [
    // Input text tokens + a flat per-image output estimate at the default 1024px tier.
    { effectiveUntil: null, input: 0.5, perImage: 0.0672 },
  ],
};

export const DEFAULT_MODEL = 'gemini-3.8-flash';
export const FALLBACK_MODEL = 'gemini-3.7-flash';
export const HEAVY_MODEL = 'gemini-4-argon';

export const MODEL_IDS = Object.keys(TEXT_MODELS);

/** Explicit-cache minimum (tokens) — below this we rely on implicit caching only. */
export const EXPLICIT_CACHE_MIN_TOKENS = 4096;
/** Explicit cache TTL in seconds. */
export const EXPLICIT_CACHE_TTL_SECONDS = 3600;

function pickRate(pricing, at) {
  const day = (at instanceof Date ? at : new Date(at ?? Date.now())).toISOString().slice(0, 10);
  for (const tier of pricing) {
    if (tier.effectiveUntil === null || day <= tier.effectiveUntil) return tier;
  }
  return pricing[pricing.length - 1];
}

/** Returns the active price tier for a text model at a given time. */
export function getTextRate(modelId, at = new Date()) {
  const model = TEXT_MODELS[modelId] ?? TEXT_MODELS[DEFAULT_MODEL];
  return pickRate(model.pricing, at);
}

/**
 * Deterministic USD cost for one text call.
 * `inputTokens` is the full prompt count reported by Vertex (it INCLUDES cached tokens),
 * so cached tokens are billed at the cached rate and the remainder at the input rate.
 * Thinking tokens are billed as output.
 */
export function computeTextCost(modelId, usage, at = new Date()) {
  const rate = getTextRate(modelId, at);
  const input = Math.max(0, usage.inputTokens || 0);
  const cached = Math.min(input, Math.max(0, usage.cachedTokens || 0));
  const output = Math.max(0, (usage.outputTokens || 0) + (usage.thoughtTokens || 0));
  const usd = ((input - cached) * rate.input + cached * rate.cached + output * rate.output) / 1_000_000;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

/** Deterministic USD cost for one image generation call. */
export function computeImageCost(usage, at = new Date()) {
  const rate = pickRate(IMAGE_MODEL.pricing, at);
  const input = Math.max(0, usage.inputTokens || 0);
  const images = Math.max(0, usage.images ?? 1);
  const usd = (input * rate.input) / 1_000_000 + images * rate.perImage;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

export function isValidModel(modelId) {
  return Object.prototype.hasOwnProperty.call(TEXT_MODELS, modelId);
}
