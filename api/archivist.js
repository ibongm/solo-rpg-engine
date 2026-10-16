/**
 * POST /api/archivist — background 20-turn summarizer & Codex updater.
 * Body: { model, title, genre, previousChapters, existingCodex, turnsToCondense, recentTurns, currentState }
 * Returns: { result (ARCHIVIST_SCHEMA), usage, model }
 */
import { withHandler, HttpError, isMock } from './_lib/http.js';
import { generateStructured, resolveModel } from './_lib/vertex.js';
import { ARCHIVIST_SCHEMA } from './_lib/schemas.js';
import { ARCHIVIST_RULES, renderArchivistRequest } from './_lib/prompts.js';
import { mockArchivist, MOCK_USAGE } from './_lib/mock.js';

export default withHandler(async ({ body }) => {
  if (!Array.isArray(body.turnsToCondense) || body.turnsToCondense.length === 0) throw new HttpError(400, 'Nothing to archive.');
  if (body.turnsToCondense.length > 30) throw new HttpError(413, 'Too many turns in one archive batch.');
  const model = resolveModel(body.model);
  if (isMock()) return { result: mockArchivist(body), usage: MOCK_USAGE, model: model.id, mock: true };
  const { data, usage } = await generateStructured({
    modelId: model.id,
    systemInstruction: ARCHIVIST_RULES,
    dynamicText: renderArchivistRequest(body),
    schema: ARCHIVIST_SCHEMA,
    temperature: 0.6,
    maxOutputTokens: 8192,
  });
  return { result: data, usage, model: model.id };
});
