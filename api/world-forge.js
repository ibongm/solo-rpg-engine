/**
 * POST /api/world-forge
 *  mode "seed":     AI World Seeder (gemini-4-argon) — region, 3 factions, 5 rumors, starting node,
 *                   nearby nodes, main quest, opening scene.
 *  mode "perkTree": Custom 5-tier Perk Tree generator for a character concept.
 */
import { withHandler, HttpError, isMock, requireString } from './_lib/http.js';
import { generateStructured } from './_lib/vertex.js';
import { WORLD_SEED_SCHEMA, PERK_TREE_SCHEMA } from './_lib/schemas.js';
import { WORLD_FORGE_RULES, PERK_TREE_RULES, renderWorldForgeRequest, renderPerkTreeRequest } from './_lib/prompts.js';
import { mockWorldSeed, mockPerkTree, MOCK_USAGE } from './_lib/mock.js';
import { HEAVY_MODEL, DEFAULT_MODEL, isValidModel } from '../src/config/models.js';
import { SKILL_KEYS } from '../src/config/genreSkins.js';

export default withHandler(async ({ body }) => {
  const mode = body.mode;
  if (mode === 'seed') {
    requireString(body.prompt, 'prompt', 4000);
    const model = isValidModel(body.model) ? body.model : HEAVY_MODEL;
    if (isMock()) return { result: mockWorldSeed(body), usage: MOCK_USAGE, model, mock: true };
    const { data, usage } = await generateStructured({
      modelId: model,
      systemInstruction: WORLD_FORGE_RULES,
      dynamicText: renderWorldForgeRequest(body),
      schema: WORLD_SEED_SCHEMA,
      temperature: 1.0,
      maxOutputTokens: 12000,
    });
    return { result: data, usage, model };
  }
  if (mode === 'perkTree') {
    requireString(body.concept, 'concept', 2000);
    const model = isValidModel(body.model) ? body.model : DEFAULT_MODEL;
    const payload = { ...body, skillKeys: SKILL_KEYS };
    if (isMock()) return { result: mockPerkTree(payload), usage: MOCK_USAGE, model, mock: true };
    const { data, usage } = await generateStructured({
      modelId: model,
      systemInstruction: PERK_TREE_RULES,
      dynamicText: renderPerkTreeRequest(payload),
      schema: PERK_TREE_SCHEMA,
      temperature: 0.9,
      maxOutputTokens: 4000,
    });
    return { result: data, usage, model };
  }
  throw new HttpError(400, 'mode must be "seed" or "perkTree".');
});
