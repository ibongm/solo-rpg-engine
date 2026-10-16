/**
 * TV series / movie "media skins": an AI-generated reskin of the SRD names (species, classes,
 * backgrounds, skills, languages, terms) for a chosen universe. It holds names and flavor only —
 * never numbers — and is sanitized on the server and again before use, so a bad generation can
 * never change the rules.
 */
import { SPECIES, CLASSES, BACKGROUNDS } from '../config/srd.js';
import { SKILL_KEYS, THEME_IDS } from '../config/genreSkins.js';

export const MEDIA_SPECIES_IDS = SPECIES.map((s) => s.id);
export const MEDIA_CLASS_IDS = CLASSES.map((c) => c.id);
export const MEDIA_BACKGROUND_IDS = BACKGROUNDS.filter((b) => b.id !== 'custom').map((b) => b.id);
export const MEDIA_TERM_KEYS = ['species', 'class', 'background', 'spells', 'cantrips', 'spell'];

const str = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

function pickMap(src, ids, fn) {
  const out = {};
  for (const id of ids) {
    const v = fn(src?.[id]);
    if (v) out[id] = v;
  }
  return out;
}

/**
 * Cleans a generated media skin: trims every string, drops unknown keys and empty values,
 * and forces the theme to a real one. Returns null if nothing usable is left.
 */
export function sanitizeMediaSkin(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = str(raw.title, 120);
  if (!title) return null;
  const terms = pickMap(raw.terms, MEDIA_TERM_KEYS, (v) => str(v, 40));
  const skin = {
    title,
    theme: THEME_IDS.includes(raw.theme) ? raw.theme : 'frontier_noir',
    currencyLabel: str(raw.currencyLabel, 40) || 'Resources',
    rationLabel: str(raw.rationLabel, 40) || 'Rations',
    terms,
    skillLabels: pickMap(raw.skillLabels, SKILL_KEYS, (v) => str(v, 40)),
    species: pickMap(raw.species, MEDIA_SPECIES_IDS, (v) => {
      const name = str(v?.name, 60);
      return name ? { name, blurb: str(v?.blurb, 240) } : null;
    }),
    classes: pickMap(raw.classes, MEDIA_CLASS_IDS, (v) => str(v, 60)),
    backgrounds: pickMap(raw.backgrounds, MEDIA_BACKGROUND_IDS, (v) => str(v, 60)),
    languages: Array.from(new Set((Array.isArray(raw.languages) ? raw.languages : []).map((l) => str(l, 40)).filter(Boolean))).slice(0, 12),
    worldPromptSuggestion: typeof raw.worldPromptSuggestion === 'string' ? raw.worldPromptSuggestion.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 3000) : '',
  };
  return skin;
}

/** Campaign skin overrides (currency, rations, skill labels) for buildSkin(). */
export function mediaSkinOverrides(media) {
  if (!media) return {};
  return { currencyLabel: media.currencyLabel, rationLabel: media.rationLabel, skillLabels: media.skillLabels || {} };
}
