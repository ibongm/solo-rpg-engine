/**
 * Spellcasting — deterministic and visible.
 *  - Spell attacks build a normal attack check (see diceEngine buildCheck with a spell).
 *  - Save spells: the engine rolls the target's save openly (d20 + ENEMY_SAVE_BONUS) against your DC.
 *    Area spells roll damage once and an open save for every engaged enemy.
 *  - Healing, auto-hit damage and temporary HP are rolled by the engine.
 *  - Slots are tracked on the character and restored by rests; leveled spells can be cast with a
 *    higher slot (upcasting). Warlocks also get Mystic Arcanum (once per long rest, no slot).
 *  - Slot maximums and new picks come from class + level (see spellProgress.js).
 */
import { SPELLS_BY_ID, CLASS_SPELL_LISTS } from '../config/spells.js';
import { CLASSES_BY_ID, SPECIES_BY_ID } from '../config/srd.js';
import { abilityMod, proficiencyBonus } from './progression.js';
import { effectiveAbility, rollDice, spellAbilityFor, spellDamageAt, upcastDice } from './diceEngine.js';
import { rollDie, getDefaultRng } from './rng.js';
import { buildSpellcasting, buildSpeciesCantrip, preparedLimitFor } from './characterBuilder.js';
import { casterDef, syncSpellcasting, preparedLimitAt, classSpellIds, maxSpellLevelFor } from './spellProgress.js';

export { buildSpellcasting, buildSpeciesCantrip, preparedLimitFor };

/** Visible flat bonus used for enemy saving throws (enemies have no stat blocks). */
export const ENEMY_SAVE_BONUS = 2;

/** Most enemies a single area spell resolves against. */
export const AREA_TARGET_CAP = 8;

const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
export const ordinal = (n) => ORDINALS[n] || `${n}th`;

export function hasSpellcasting(character) {
  return Boolean(syncSpellcasting(character)?.spellcasting || character?.speciesCantrip);
}

export function spellModFor(character, spellId) {
  const ability = spellAbilityFor(character, spellId);
  return ability ? abilityMod(effectiveAbility(character, ability)) : 0;
}

export function spellAttackBonus(character, spellId = null) {
  return proficiencyBonus(character.level || 1) + spellModFor(character, spellId);
}

export function spellSaveDc(character, spellId = null) {
  return 8 + proficiencyBonus(character.level || 1) + spellModFor(character, spellId);
}

/** Leveled spells a prepared caster may prepare: Wis/Int/Cha mod + level (half casters: half level), minimum 1. */
export function preparedLimit(character) {
  const sc = syncSpellcasting(character)?.spellcasting;
  if (!sc) return 0;
  return preparedLimitAt(character.classId, character.level || 1, abilityMod(effectiveAbility(character, sc.ability)));
}

/** The class's spell list: { cantrips, level1, byLevel: {1..9} }. */
export function classSpellOptions(classId) {
  const list = casterDef(classId)?.list;
  return (list && CLASS_SPELL_LISTS[list]) || { cantrips: [], level1: [], byLevel: {} };
}

/** Highest spell level this character can cast with a slot (0 = cantrips only). */
export function maxSpellLevel(character) {
  return maxSpellLevelFor(character?.classId, character?.level || 1);
}

/**
 * Spells a prepared caster can choose from right now: the spellbook (wizard) or the whole class list
 * up to the highest castable level (cleric, druid, paladin), minus always-prepared spells.
 */
export function preparableSpells(character) {
  const sc = syncSpellcasting(character)?.spellcasting;
  if (!sc) return [];
  const max = maxSpellLevel(character);
  const pool = sc.spellbook?.length ? sc.spellbook.filter((id) => (SPELLS_BY_ID[id]?.level || 0) <= max) : classSpellIds(sc.list, max);
  return pool.filter((id) => !(sc.alwaysPrepared || []).includes(id));
}

/** Every spell the character can cast right now, with its source. */
export function castableSpells(character) {
  const ch = syncSpellcasting(character);
  const sc = ch?.spellcasting;
  const out = [];
  const seen = new Set();
  const add = (id, source) => {
    if (!SPELLS_BY_ID[id] || seen.has(id)) return;
    seen.add(id);
    out.push({ spell: SPELLS_BY_ID[id], source });
  };
  if (ch?.speciesCantrip) add(ch.speciesCantrip.id, 'species');
  if (sc) {
    for (const id of sc.cantrips || []) add(id, 'class');
    for (const id of sc.alwaysPrepared || []) add(id, 'domain');
    for (const id of sc.prepared?.length ? sc.prepared : sc.known || []) add(id, 'class');
    for (const id of Object.values(sc.arcanum || {})) add(id, 'arcanum');
  }
  return out;
}

export function slotsFor(character, level = 1) {
  const sc = syncSpellcasting(character)?.spellcasting;
  if (!sc?.slots) return { max: 0, used: 0, left: 0 };
  const max = sc.slots.max?.[level - 1] || 0;
  const used = Math.min(max, sc.slots.used?.[level - 1] || 0);
  return { max, used, left: max - used };
}

/** Every slot level that has a slot left, from 1st to 9th: [{ level, max, used, left }]. */
export function slotLevels(character) {
  const sc = syncSpellcasting(character)?.spellcasting;
  const out = [];
  for (let l = 1; l <= (sc?.slots?.max || []).length; l++) {
    const s = slotsFor(character, l);
    if (s.max > 0) out.push({ level: l, ...s });
  }
  return out;
}

/** Slot levels a leveled spell could be cast with right now (lowest first). */
export function castSlotOptions(character, spell) {
  if (!spell || spell.level === 0) return [];
  return slotLevels(character)
    .filter((s) => s.level >= spell.level && s.left > 0)
    .map((s) => s.level);
}

function isArcanum(character, spell) {
  const sc = character?.spellcasting;
  return Boolean(spell && spell.level >= 6 && sc?.arcanum?.[spell.level] === spell.id);
}

/**
 * Validates a cast. Returns { ok, error, spell, slotLevel, arcanum }.
 * slotLevel: the slot to spend (defaults to the lowest free slot that fits); 0 for cantrips and arcana.
 */
export function canCast(character, spellId, slotLevel = null) {
  const ch = syncSpellcasting(character);
  const spell = SPELLS_BY_ID[spellId];
  if (!spell) return { ok: false, error: 'Unknown spell.' };
  if (!castableSpells(ch).some((c) => c.spell.id === spellId)) return { ok: false, error: `${spell.name} is not prepared.` };
  if ((ch.vitals?.hp ?? 0) <= 0) return { ok: false, error: 'You cannot cast while unconscious.' };
  if (spell.level === 0) return { ok: true, error: null, spell, slotLevel: 0, arcanum: false };
  if (isArcanum(ch, spell)) {
    if (ch.spellcasting.arcanumUsed?.[spell.level]) return { ok: false, error: `${spell.name} (Mystic Arcanum) returns after a long rest.` };
    return { ok: true, error: null, spell, slotLevel: 0, arcanum: true };
  }
  const options = castSlotOptions(ch, spell);
  if (!options.length) return { ok: false, error: `No ${ordinal(spell.level)}-level or higher slots left — rest to recover them.` };
  if (slotLevel !== null && slotLevel !== undefined) {
    if (!options.includes(Number(slotLevel))) return { ok: false, error: `No free ${ordinal(Number(slotLevel))}-level slot for ${spell.name}.` };
    return { ok: true, error: null, spell, slotLevel: Number(slotLevel), arcanum: false };
  }
  return { ok: true, error: null, spell, slotLevel: options[0], arcanum: false };
}

/** Damage dice for a spell: cantrips scale with character level, leveled spells with the slot used. */
export function spellDamageDice(character, spell, slotLevel = null) {
  return spellDamageAt(spell, character?.level || 1, slotLevel);
}

const extraLevels = (spell, slotLevel) => (spell.level > 0 && slotLevel ? Math.max(0, Math.min(9, slotLevel) - spell.level) : 0);

/**
 * Save spell against one target, fully resolved by the engine.
 * @returns {{ save: {natural,total,dc,saved,bonus}, damage: {expr,rolls,total}|null, dealt }}
 */
export function resolveSaveSpell(character, spell, rng = getDefaultRng(), slotLevel = null) {
  const dc = spellSaveDc(character, spell.id);
  const natural = rollDie(20, rng);
  const total = natural + ENEMY_SAVE_BONUS;
  const saved = natural !== 1 && (natural === 20 || total >= dc);
  const expr = spellDamageDice(character, spell, slotLevel);
  const damage = expr ? rollDice(expr, { rng }) : null;
  const dealt = !damage ? 0 : saved ? (spell.onSave === 'half' ? Math.floor(damage.total / 2) : 0) : damage.total;
  return { save: { natural, total, dc, saved, bonus: ENEMY_SAVE_BONUS }, damage, dealt };
}

/**
 * Area save spell: one damage roll, then an open save per target (5e). Targets beyond AREA_TARGET_CAP are ignored.
 * @returns {{ damage, dc, results: Array<{ target, save, dealt }> }}
 */
export function resolveAreaSaveSpell(character, spell, targets, rng = getDefaultRng(), slotLevel = null) {
  const dc = spellSaveDc(character, spell.id);
  const expr = spellDamageDice(character, spell, slotLevel);
  const damage = expr ? rollDice(expr, { rng }) : null;
  const results = (targets || []).slice(0, AREA_TARGET_CAP).map((target) => {
    const natural = rollDie(20, rng);
    const total = natural + ENEMY_SAVE_BONUS;
    const saved = natural !== 1 && (natural === 20 || total >= dc);
    const dealt = !damage ? 0 : saved ? (spell.onSave === 'half' ? Math.floor(damage.total / 2) : 0) : damage.total;
    return { target, save: { natural, total, dc, saved, bonus: ENEMY_SAVE_BONUS }, dealt };
  });
  return { damage, dc, results };
}

/** Healing: dice (+ upcast dice) + spellcasting modifier (+ Disciple of Life for Life clerics). */
export function resolveHealing(character, spell, rng = getDefaultRng(), slotLevel = null) {
  const slot = spell.level > 0 ? Math.max(spell.level, Math.min(9, slotLevel || spell.level)) : 0;
  const roll = rollDice(upcastDice(spell.heal, spell.upcast, extraLevels(spell, slot)), { rng });
  const mod = spell.healMod === false ? 0 : spellModFor(character, spell.id);
  const life = character.classId === 'cleric' && /life/i.test(character.subclass || '') && spell.level > 0 ? 2 + slot : 0;
  return { roll, mod, life, total: Math.max(1, roll.total + mod + life) };
}

export function resolveAuto(character, spell, rng = getDefaultRng(), slotLevel = null) {
  return rollDice(spellDamageDice(character, spell, slotLevel), { rng });
}

export function resolveTempHp(spell, rng = getDefaultRng()) {
  return rollDice(spell.tempHp, { rng });
}

/** Validation for the creator's Spells step. Returns a list of problems. */
export function validateSpells({ classId, speciesId, finalStats, cantrips = [], known = [], prepared = [], spellbook = [], speciesCantrip = null }) {
  const errors = [];
  const sc = CLASSES_BY_ID[classId]?.spellcasting;
  if (sc) {
    if (new Set(cantrips).size !== sc.cantrips) errors.push(`Choose ${sc.cantrips} cantrips.`);
    if (sc.known && new Set(known).size !== sc.known) errors.push(`Choose ${sc.known} 1st-level spells.`);
    if (sc.spellbook && new Set(spellbook).size !== sc.spellbook) errors.push(`Choose ${sc.spellbook} spells for your spellbook.`);
    if (sc.prepared) {
      const limit = preparedLimitFor(classId, finalStats);
      const n = new Set(prepared).size;
      if (n < 1 || n > limit) errors.push(`Prepare between 1 and ${limit} spells.`);
    }
  }
  const bc = SPECIES_BY_ID[speciesId]?.bonusCantrip;
  if (bc && !bc.fixed && !speciesCantrip) errors.push('Choose your species cantrip.');
  return errors;
}
