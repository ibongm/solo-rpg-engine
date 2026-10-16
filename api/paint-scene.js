/**
 * POST /api/paint-scene — scene illustration with gemini-3.1-flash-image (replaces the
 * discontinued imagen-3.0-generate-002), uploaded to Firebase Storage.
 * Body: { campaignId, turnId, prompt, genre }
 * Returns: { imageUrl, usage, model }
 */
import crypto from 'node:crypto';
import { withHandler, HttpError, isMock, requireString } from './_lib/http.js';
import { generateSceneImage } from './_lib/vertex.js';
import { getAdminBucket, storageBucketName } from './_lib/auth.js';
import { mockImage } from './_lib/mock.js';
import { IMAGE_MODEL } from '../src/config/models.js';

const GENRE_STYLE = {
  fantasy: 'painterly high-fantasy illustration, warm candlelit palette, oil on canvas texture, cinematic composition',
  frontier_noir: 'gritty western comic-noir panel, heavy ink lines, stark cream and charcoal palette with a single crimson accent, dramatic shadows',
  scifi: 'cinematic science-fiction concept art, deep obsidian shadows, cyan and emerald neon rim light, volumetric haze',
  post_apoc: 'post-apocalyptic concept art, rust and dust palette, harsh sunlight, desolate scale',
  custom: 'cinematic illustrated concept art, rich lighting, detailed environment',
};

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;

function publicUrl(bucket, path, token) {
  const emulator = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  const base = emulator ? `http://${emulator}` : 'https://firebasestorage.googleapis.com';
  return `${base}/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

export default withHandler(async ({ body, uid }) => {
  const prompt = requireString(body.prompt, 'prompt', 2000);
  if (!SAFE_ID.test(String(body.campaignId || '')) || !SAFE_ID.test(String(body.turnId || ''))) throw new HttpError(400, 'Invalid campaign or turn id.');
  const style = GENRE_STYLE[body.genre] || GENRE_STYLE.custom;
  const fullPrompt = `${prompt}\n\nStyle: ${style}. Wide 16:9 establishing shot. No text, no captions, no UI, no watermarks.`;

  const image = isMock() ? mockImage(prompt) : await generateSceneImage({ prompt: fullPrompt });
  const ext = image.mimeType.includes('svg') ? 'svg' : image.mimeType.includes('jpeg') ? 'jpg' : image.mimeType.includes('webp') ? 'webp' : 'png';
  const path = `users/${uid}/campaigns/${body.campaignId}/scenes/${body.turnId}-${Date.now()}.${ext}`;
  const token = crypto.randomUUID();
  try {
    const bucket = await getAdminBucket();
    await bucket.file(path).save(Buffer.from(image.base64, 'base64'), {
      resumable: false,
      contentType: image.mimeType,
      metadata: { cacheControl: 'public, max-age=31536000', metadata: { firebaseStorageDownloadTokens: token } },
    });
  } catch (err) {
    throw new HttpError(502, 'Could not upload the image to Firebase Storage — check the service account has Storage Object Admin (see SETUP.md).', String(err?.message || err).slice(0, 400));
  }
  return { imageUrl: publicUrl(storageBucketName(), path, token), usage: image.usage, model: IMAGE_MODEL.id, mock: isMock() || undefined };
});
