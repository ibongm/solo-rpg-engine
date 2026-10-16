/**
 * POST /api/dm-turn — the main turn handler.
 * Body: { model, context: { static, dynamic }, action, cacheRef, turnId? }
 * Returns: { result (DM_TURN_SCHEMA), usage, model, cacheRef, cacheUsed, deduplicated? }
 * The storyteller only PROPOSES state; the client's deterministic engine applies it.
 * A repeated turnId from the same player within 5 minutes reuses the first generation (see turnCache.js).
 */
import { withHandler, HttpError, isMock } from './_lib/http.js';
import { generateStructured, ensureContextCache, resolveModel } from './_lib/vertex.js';
import { DM_TURN_SCHEMA } from './_lib/schemas.js';
import { DM_SYSTEM_RULES, renderStatic, renderDynamic } from './_lib/prompts.js';
import { mockDmTurn, MOCK_USAGE } from './_lib/mock.js';
import { createTurnCache, cleanTurnId } from './_lib/turnCache.js';

const ACTION_KINDS = new Set(['action', 'roll_result', 'travel', 'death_save', 'event', 'companion_talk']);

export const TURN_RESULT_CACHE = createTurnCache();

export default withHandler(async ({ body, uid }) => {
  const { context, action } = body;
  if (!context || typeof context !== 'object' || !context.static || !context.dynamic) throw new HttpError(400, 'Missing turn context.');
  if (!action || typeof action !== 'object' || !ACTION_KINDS.has(action.kind)) throw new HttpError(400, 'Missing or invalid action.');
  if (action.text && String(action.text).length > 4000) throw new HttpError(413, 'Action text is too long.');
  const turnId = cleanTurnId(body.turnId);
  if (!turnId) return generateTurn(body);
  const { promise, cached } = TURN_RESULT_CACHE.run(`${uid}:${turnId}`, () => generateTurn(body));
  const out = await promise;
  return cached ? { ...out, deduplicated: true } : out;
});

async function generateTurn(body) {
  const { context, action } = body;
  const model = resolveModel(body.model);

  if (isMock()) {
    return { result: mockDmTurn(context, action), usage: MOCK_USAGE, model: model.id, cacheRef: body.cacheRef || null, cacheUsed: false, mock: true };
  }

  const staticText = renderStatic(context);
  const dynamicText = renderDynamic(context, action);
  const cacheRef = await ensureContextCache({ modelId: model.id, systemInstruction: DM_SYSTEM_RULES, staticText, cacheRef: body.cacheRef });

  const attempt = () =>
    generateStructured({
      modelId: model.id,
      systemInstruction: DM_SYSTEM_RULES,
      staticText,
      dynamicText,
      schema: DM_TURN_SCHEMA,
      cacheRef,
      temperature: 0.95,
      maxOutputTokens: 8192,
    });

  const addUsage = (a, b) => ({
    inputTokens: (a?.inputTokens || 0) + (b?.inputTokens || 0),
    outputTokens: (a?.outputTokens || 0) + (b?.outputTokens || 0),
    cachedTokens: (a?.cachedTokens || 0) + (b?.cachedTokens || 0),
    thoughtTokens: (a?.thoughtTokens || 0) + (b?.thoughtTokens || 0),
  });

  let out;
  try {
    out = await attempt();
  } catch (err) {
    // One retry on malformed / schema-invalid output; other errors propagate.
    if (err instanceof HttpError && err.status === 502 && /schema|malformed|no content/i.test(err.message)) out = await attempt();
    else throw err;
  }

  // No secret DCs: a requested roll must carry a skill and a DC. Retry once, then fall back to a
  // visible default so the player always sees the number before rolling.
  let usage = out.usage;
  if (!isCompleteRollRequest(out.data.roll_request)) {
    try {
      const second = await attempt();
      usage = addUsage(usage, second.usage);
      if (isCompleteRollRequest(second.data.roll_request) || !second.data.roll_request?.required) out = second;
    } catch {
      // keep the first response and repair it below
    }
  }
  const result = repairRollRequest(out.data, action);
  return { result, usage, model: out.model, cacheRef: cacheRef || null, cacheUsed: out.cacheUsed };
}

export const DEFAULT_DC = 12;

function isCompleteRollRequest(rr) {
  return !rr?.required || (Boolean(rr.skill_or_stat) && Number.isInteger(rr.dc));
}

/** Fills a missing skill/DC on a required roll with visible defaults. */
export function repairRollRequest(data, action) {
  const rr = data.roll_request;
  if (!rr?.required || isCompleteRollRequest(rr)) return data;
  const skill = rr.skill_or_stat || action?.preferredSkill || 'wis';
  const notes = [];
  if (!rr.skill_or_stat) notes.push('skill defaulted');
  if (!Number.isInteger(rr.dc)) notes.push(`default DC ${DEFAULT_DC}`);
  return {
    ...data,
    roll_request: {
      ...rr,
      skill_or_stat: skill,
      dc: Number.isInteger(rr.dc) ? rr.dc : DEFAULT_DC,
      advantage_state: rr.advantage_state || 'normal',
      reason: `${rr.reason || 'Uncertain outcome'} (${notes.join(', ')} — the storyteller omitted it)`,
    },
  };
}
