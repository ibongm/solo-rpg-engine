/**
 * Spellcasting growth — pure and derived from class + level, so old saves heal themselves.
 *  - Slot maximums come from the SRD class tables (src/config/spellProgression.js), never from storage.
 *  - Paladins and Rangers gain spellcasting at level 2.
 *  - "Pending" picks (new cantrips, spells known, spellbook pages, Mystic Arcanum) are the difference
 *    between what the class table allows at this level and what the character has chosen.
 */
import { CLASSES_BY_ID } from '../config/srd.js';
import { CLASS_SPELL_LISTS, SPELLS_BY_ID } from '../config/spells.js';
import { SPELL_PROGRESSION, LATE_CASTERS, MYSTIC_ARCANUM, LIFE_DOMAIN_SPELLS, wizardSpellbookSize } from '../config/spellProgression.js';

const clampLevel = (level) => Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));

/** The class's spellcasting definition, including half casters who only gain it at level 2. */
export function casterDef(classId) {
  return CLASSES_BY_ID[classId]?.spellcasting || LATE_CASTERS[classId] || null;
}

/** Max slots per slot level at a class level, e.g. wizard 5 → [4, 3, 2]. Empty when the class has none yet. */
export function slotTable(classId, level) {
  const rows = SPELL_PROGRESSION[classId]?.slots;
  return rows ? rows[clampLevel(level) - 1].slice() : [];
}

/** Highest slot level available (0 = cantrips only / no spellcasting). */
export function maxSpellLevelFor(classId, level) {
  const t = slotTable(classId, level);
  for (let i = t.length - 1; i >= 0; i--) if (t[i] > 0) return i + 1;
  return 0;
}

export function cantripsKnownFor(classId, level) {
  return SPELL_PROGRESSION[classId]?.cantrips?.[clampLevel(level) - 1] || 0;
}

/** Spells known for known-casters (bard, ranger, sorcerer, warlock); null for prepared casters. */
export function spellsKnownFor(classId, level) {
  const k = SPELL_PROGRESSION[classId]?.known;
  return k ? k[clampLevel(level) - 1] : null;
}

/** Spells a prepared caster may prepare: ability mod + level (half casters: + half level), minimum 1. */
export function preparedLimitAt(classId, level, abilityModifier) {
  const def = casterDef(classId);
  if (!def?.prepared) return 0;
  const lv = clampLevel(level);
  return Math.max(1, abilityModifier + (def.halfCaster ? Math.floor(lv / 2) : lv));
}

/** Always-prepared spells: Life Domain grows with cleric level; other classes use their static list. */
export function alwaysPreparedFor(classId, level, subclass) {
  if (classId === 'cleric' && /life/i.test(subclass || '')) {
    const lv = clampLevel(level);
    return Object.entries(LIFE_DOMAIN_SPELLS)
      .filter(([at]) => lv >= Number(at))
      .flatMap(([, ids]) => ids);
  }
  return (casterDef(classId)?.alwaysPrepared || []).slice();
}

/** Every leveled spell id on a class list up to a spell level. */
export function classSpellIds(listId, maxLevel) {
  const list = CLASS_SPELL_LISTS[listId];
  if (!list) return [];
  const out = [];
  for (let l = 1; l <= maxLevel; l++) out.push(...(list.byLevel?.[l] || []));
  return out;
}

/** Mystic Arcanum spell levels unlocked at a warlock level, e.g. 13 → [6, 7]. */
export function arcanumLevelsFor(classId, level) {
  if (classId !== 'warlock') return [];
  const lv = clampLevel(level);
  return Object.entries(MYSTIC_ARCANUM)
    .filter(([at]) => lv >= Number(at))
    .map(([, spellLevel]) => spellLevel);
}

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Brings a character's spellcasting block in line with its class and level: slot maximums, used-slot
 * padding, always-prepared spells, and a fresh block for a Paladin or Ranger reaching level 2.
 * Returns the same object when nothing changes.
 */
export function syncSpellcasting(character) {
  if (!character) return character;
  const def = casterDef(character.classId);
  if (!def) return character;
  const level = clampLevel(character.level);
  const has = character.spellcasting;
  if (!has && level < (def.startsAt || 1)) return character;
  const sc = has
    ? { ...has }
    : { ability: def.ability, list: def.list, pact: Boolean(def.pact), cantrips: [], alwaysPrepared: [], slots: { max: [], used: [] }, known: [], prepared: [], spellbook: [] };
  const max = slotTable(character.classId, level);
  const prevUsed = sc.slots?.used || [];
  sc.slots = { max, used: max.map((m, i) => Math.max(0, Math.min(m, prevUsed[i] || 0))) };
  sc.alwaysPrepared = alwaysPreparedFor(character.classId, level, character.subclass);
  if (sc.prepared?.length) sc.prepared = sc.prepared.filter((id) => !sc.alwaysPrepared.includes(id));
  const arcana = arcanumLevelsFor(character.classId, level);
  if (arcana.length || sc.arcanum) {
    sc.arcanum = { ...(sc.arcanum || {}) };
    sc.arcanumUsed = { ...(sc.arcanumUsed || {}) };
  }
  if (has && sameJson(has, sc)) return character;
  return { ...character, spellcasting: sc };
}

/**
 * Picks the character is owed at its current level.
 * @returns {{ cantrips: number, known: number, spellbook: number, arcanum: number[], maxLevel: number }}
 */
export function pendingSpellChoices(character) {
  const none = { cantrips: 0, known: 0, spellbook: 0, arcanum: [], maxLevel: 0 };
  const ch = syncSpellcasting(character);
  const sc = ch?.spellcasting;
  if (!sc) return none;
  const classId = ch.classId;
  const level = clampLevel(ch.level);
  const known = spellsKnownFor(classId, level);
  return {
    cantrips: Math.max(0, cantripsKnownFor(classId, level) - (sc.cantrips || []).length),
    known: known === null ? 0 : Math.max(0, known - (sc.known || []).length),
    spellbook: classId === 'wizard' ? Math.max(0, wizardSpellbookSize(level) - (sc.spellbook || []).length) : 0,
    arcanum: arcanumLevelsFor(classId, level).filter((l) => !sc.arcanum?.[l]),
    maxLevel: maxSpellLevelFor(classId, level),
  };
}

export function hasPendingSpellChoices(character) {
  const p = pendingSpellChoices(character);
  return p.cantrips + p.known + p.spellbook + p.arcanum.length > 0;
}

/** Options for each kind of pick, already filtered to legal, not-yet-chosen spells. */
export function spellChoiceOptions(character) {
  const ch = syncSpellcasting(character);
  const sc = ch?.spellcasting;
  if (!sc) return { cantrips: [], known: [], spellbook: [], arcanum: {} };
  const list = CLASS_SPELL_LISTS[sc.list] || { cantrips: [] };
  const maxLevel = maxSpellLevelFor(ch.classId, ch.level);
  const leveled = classSpellIds(sc.list, maxLevel);
  const arcanum = {};
  for (const l of arcanumLevelsFor(ch.classId, ch.level)) arcanum[l] = (list.byLevel?.[l] || []).slice();
  return {
    cantrips: (list.cantrips || []).filter((id) => !(sc.cantrips || []).includes(id)),
    known: leveled.filter((id) => !(sc.known || []).includes(id)),
    spellbook: leveled.filter((id) => !(sc.spellbook || []).includes(id)),
    arcanum,
  };
}

/**
 * Validates and applies new picks. Throws on anything illegal (wrong list, too high, too many).
 * @param {object} character
 * @param {{ cantrips?: string[], known?: string[], spellbook?: string[], arcanum?: Record<number,string> }} picks
 */
export function applySpellChoices(character, picks = {}) {
  const ch = syncSpellcasting(character);
  const sc = ch?.spellcasting;
  if (!sc) throw new Error('This character has no spellcasting.');
  const pending = pendingSpellChoices(ch);
  const opts = spellChoiceOptions(ch);
  const take = (ids, allowed, limit, what) => {
    const clean = Array.from(new Set(ids || []));
    if (clean.length > limit) throw new Error(`You can learn ${limit} more ${what}.`);
    for (const id of clean) if (!allowed.includes(id)) throw new Error(`${SPELLS_BY_ID[id]?.name || id} is not available to learn.`);
    return clean;
  };
  const cantrips = take(picks.cantrips, opts.cantrips, pending.cantrips, 'cantrips');
  const known = take(picks.known, opts.known, pending.known, 'spells');
  const spellbook = take(picks.spellbook, opts.spellbook, pending.spellbook, 'spellbook spells');
  const arcanum = { ...(sc.arcanum || {}) };
  for (const [lvl, id] of Object.entries(picks.arcanum || {})) {
    const l = Number(lvl);
    if (!pending.arcanum.includes(l)) throw new Error(`No ${l}th-level Mystic Arcanum to choose.`);
    if (!opts.arcanum[l]?.includes(id)) throw new Error(`${SPELLS_BY_ID[id]?.name || id} is not a ${l}th-level warlock spell.`);
    arcanum[l] = id;
  }
  const next = {
    ...sc,
    cantrips: [...(sc.cantrips || []), ...cantrips],
    known: [...(sc.known || []), ...known],
    spellbook: [...(sc.spellbook || []), ...spellbook],
  };
  if (Object.keys(arcanum).length) next.arcanum = arcanum;
  return { ...ch, spellcasting: next };
}
