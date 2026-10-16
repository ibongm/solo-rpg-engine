/**
 * Google Cloud Vertex AI gateway via @google/genai (vertexai: true).
 * - Strict responseSchema enforcement + server-side re-validation
 * - Per-model endpoint routing (e.g. gemini-4-argon → global)
 * - Explicit context caching for models that support it, implicit otherwise
 * - Image generation with gemini-3.1-flash-image
 */
import crypto from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import {
  TEXT_MODELS,
  IMAGE_MODEL,
  DEFAULT_MODEL,
  EXPLICIT_CACHE_MIN_TOKENS,
  EXPLICIT_CACHE_TTL_SECONDS,
  isValidModel,
} from '../../src/config/models.js';
import { parseServiceAccount } from './credentials.js';
import { validateSchema, coerceIntegers } from './validate.js';
import { HttpError } from './auth.js';

const clients = new Map();

function resolveLocation(modelLocation) {
  return modelLocation || process.env.GCP_LOCATION || 'us-central1';
}

function getClient(location) {
  if (clients.has(location)) return clients.get(location);
  const project = process.env.GCP_PROJECT_ID;
  if (!project) throw new HttpError(500, 'Server misconfigured: GCP_PROJECT_ID is not set.');
  if (!process.env.GCP_SERVICE_ACCOUNT_KEY) throw new HttpError(500, 'Server misconfigured: GCP_SERVICE_ACCOUNT_KEY is not set.');
  const credentials = parseServiceAccount(process.env.GCP_SERVICE_ACCOUNT_KEY);
  const client = new GoogleGenAI({
    vertexai: true,
    project,
    location,
    googleAuthOptions: {
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    },
  });
  clients.set(location, client);
  return client;
}

export function resolveModel(modelId) {
  const id = isValidModel(modelId) ? modelId : DEFAULT_MODEL;
  return TEXT_MODELS[id];
}

function extractUsage(response) {
  const u = response?.usageMetadata || {};
  return {
    inputTokens: u.promptTokenCount || 0,
    outputTokens: u.candidatesTokenCount || 0,
    cachedTokens: u.cachedContentTokenCount || 0,
    thoughtTokens: u.thoughtsTokenCount || 0,
  };
}

function wrapVertexError(err) {
  if (err instanceof HttpError) return err;
  const status = Number(err?.status || err?.code) || 0;
  const msg = String(err?.message || err);
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) return new HttpError(429, 'Vertex AI quota exceeded — wait a moment and retry.', msg.slice(0, 500));
  if (status === 403 || /PERMISSION_DENIED/i.test(msg)) return new HttpError(502, 'Vertex AI permission denied — check the service account roles (see SETUP.md).', msg.slice(0, 500));
  if (status === 404 || /NOT_FOUND/i.test(msg)) return new HttpError(502, 'Vertex AI model or resource not found — check the model ID and GCP_LOCATION.', msg.slice(0, 500));
  return new HttpError(502, 'Vertex AI request failed.', msg.slice(0, 500));
}

function isCacheError(err) {
  return /cache|cachedContent/i.test(String(err?.message || ''));
}

function isConfigArgumentError(err) {
  const msg = String(err?.message || '');
  return (Number(err?.status) === 400 || /INVALID_ARGUMENT/i.test(msg)) && /thinking|temperature/i.test(msg);
}

/** Rough token estimate (≈4 chars/token) used only to decide whether explicit caching is worthwhile. */
export function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 4);
}

export function hashText(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex').slice(0, 32);
}

/**
 * Ensures an explicit context cache exists for (model, static prefix).
 * Returns a cacheRef {name, hash, model, expireTime} or null if caching is not applicable.
 */
export async function ensureContextCache({ modelId, systemInstruction, staticText, cacheRef }) {
  const model = resolveModel(modelId);
  if (!model.supportsExplicitCache) return null;
  const hash = hashText(`${model.id}\n${systemInstruction}\n${staticText}`);
  const now = Date.now();
  if (cacheRef && cacheRef.hash === hash && cacheRef.model === model.id && cacheRef.name && Date.parse(cacheRef.expireTime) - now > 120_000) {
    return cacheRef;
  }
  if (estimateTokens(systemInstruction) + estimateTokens(staticText) < EXPLICIT_CACHE_MIN_TOKENS) return null;
  try {
    const client = getClient(resolveLocation(model.location));
    const cache = await client.caches.create({
      model: model.id,
      config: {
        displayName: `solo-rpg-${hash.slice(0, 12)}`,
        systemInstruction,
        contents: [{ role: 'user', parts: [{ text: staticText }] }],
        ttl: `${EXPLICIT_CACHE_TTL_SECONDS}s`,
      },
    });
    return {
      name: cache.name,
      hash,
      model: model.id,
      expireTime: cache.expireTime || new Date(now + EXPLICIT_CACHE_TTL_SECONDS * 1000).toISOString(),
    };
  } catch (err) {
    console.warn('[vertex] explicit cache creation failed, falling back to implicit caching:', err?.message);
    return null;
  }
}

/**
 * Structured JSON generation with schema enforcement.
 * When `cacheRef` is given, `systemInstruction` and `staticText` are already inside the cache.
 * @returns {{ data: object, usage: object, model: string, cacheUsed: boolean }}
 */
export async function generateStructured({ modelId, systemInstruction, staticText = '', dynamicText, schema, cacheRef = null, temperature = 0.9, maxOutputTokens = 8192 }) {
  const model = resolveModel(modelId);
  const client = getClient(resolveLocation(model.location));

  const buildRequest = ({ useCache, safeConfig }) => {
    const config = {
      responseMimeType: 'application/json',
      responseSchema: schema,
      maxOutputTokens,
    };
    if (!safeConfig) {
      if (model.supportsTemperature) config.temperature = temperature;
      if (model.thinkingLevel) config.thinkingConfig = { thinkingLevel: model.thinkingLevel };
    }
    let contents;
    if (useCache) {
      config.cachedContent = cacheRef.name;
      contents = [{ role: 'user', parts: [{ text: dynamicText }] }];
    } else {
      config.systemInstruction = systemInstruction;
      const parts = [];
      if (staticText) parts.push({ text: staticText });
      parts.push({ text: dynamicText });
      contents = [{ role: 'user', parts }];
    }
    return { model: model.id, contents, config };
  };

  let useCache = Boolean(cacheRef?.name);
  let safeConfig = false;
  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await client.models.generateContent(buildRequest({ useCache, safeConfig }));
      break;
    } catch (err) {
      if (useCache && isCacheError(err)) {
        useCache = false;
        continue;
      }
      if (!safeConfig && isConfigArgumentError(err)) {
        safeConfig = true;
        continue;
      }
      throw wrapVertexError(err);
    }
  }

  const usage = extractUsage(response);
  const text = response?.text;
  if (!text) {
    const reason = response?.candidates?.[0]?.finishReason || 'UNKNOWN';
    throw new HttpError(502, `The model returned no content (finish reason: ${reason}).`);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (parseErr) {
    const finishReason = response?.candidates?.[0]?.finishReason || 'UNKNOWN';
    throw new HttpError(502, 'The model returned malformed JSON.', {
      finishReason,
      parseError: String(parseErr.message).slice(0, 200),
      length: text.length,
      head: text.slice(0, 200),
      tail: text.slice(-300),
      usage,
    });
  }
  data = coerceIntegers(schema, data);
  const errors = validateSchema(schema, data);
  if (errors.length) {
    const err = new HttpError(502, 'The model response failed schema validation.', errors.slice(0, 20));
    err.usage = usage;
    throw err;
  }
  return { data, usage, model: model.id, cacheUsed: useCache };
}

/**
 * Generates one scene image. Returns { base64, mimeType, usage }.
 */
export async function generateSceneImage({ prompt, aspectRatio = IMAGE_MODEL.aspectRatio }) {
  const client = getClient(resolveLocation(IMAGE_MODEL.location));
  let response;
  try {
    response = await client.models.generateContent({
      model: IMAGE_MODEL.id,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio },
      },
    });
  } catch (err) {
    throw wrapVertexError(err);
  }
  const parts = response?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart) {
    const reason = response?.candidates?.[0]?.finishReason || 'NO_IMAGE';
    throw new HttpError(502, `Image generation returned no image (${reason}). The prompt may have been blocked.`);
  }
  const u = response?.usageMetadata || {};
  return {
    base64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || 'image/png',
    usage: { inputTokens: u.promptTokenCount || 0, outputTokens: u.candidatesTokenCount || 0, images: 1 },
  };
}
