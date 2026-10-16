/**
 * POST /api/world-forge
 *  mode "seed":     AI World Seeder (gemini-4-argon) — region, 3 factions, 5 rumors, starting node,
 *                   nearby nodes, main quest (unless quests are off), opening scene.
 *  mode "perkTree": Custom 5-tier Perk Tree generator for a character concept.
 *  mode "mediaSkin": TV series / movie universe skin (names only) for the tv_movie genre.
 */
import { withHandler, HttpError, isMock, requireString } from './_lib/http.js';
import { generateStructured } from './_lib/vertex.js';
import { worldSeedSchema, PERK_TREE_SCHEMA, MEDIA_SKIN_SCHEMA } from './_lib/schemas.js';
import { WORLD_FORGE_RULES, PERK_TREE_RULES, MEDIA_SKIN_RULES, renderWorldForgeRequest, renderPerkTreeRequest, renderMediaSkinRequest } from './_lib/prompts.js';
import { mockWorldSeed, mockPerkTree, mockMediaSkin, MOCK_USAGE } from './_lib/mock.js';
import { sanitizeMediaSkin } from '../src/engine/mediaSkin.js';
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
      schema: worldSeedSchema({ questsEnabled: body.questsEnabled !== false }),
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
  if (mode === 'mediaSkin') {
    requireString(body.mediaTitle, 'mediaTitle', 200);
    if (body.mediaNotes !== undefined && body.mediaNotes !== null && String(body.mediaNotes).length > 2000) throw new HttpError(413, '"mediaNotes" is too long.');
    const model = isValidModel(body.model) ? body.model : DEFAULT_MODEL;
    if (isMock()) return { result: sanitizeMediaSkin(mockMediaSkin(body)), usage: MOCK_USAGE, model, mock: true };
    const { data, usage } = await generateStructured({
      modelId: model,
      systemInstruction: MEDIA_SKIN_RULES,
      dynamicText: renderMediaSkinRequest(body),
      schema: MEDIA_SKIN_SCHEMA,
      temperature: 0.8,
      maxOutputTokens: 6000,
    });
    const result = sanitizeMediaSkin(data);
    if (!result) throw new HttpError(502, 'The storyteller returned an unusable universe skin. Try again.');
    return { result, usage, model };
  }
  throw new HttpError(400, 'mode must be "seed", "perkTree" or "mediaSkin".');
});
