/**
 * Spellcasting — deterministic and visible.
 *  - Spell attacks build a normal attack check (see diceEngine buildCheck with a spell).
 *  - Save spells: the engine rolls the target's save openly (d20 + ENEMY_SAVE_BONUS) against your DC.
 *  - Healing, Magic Missile and temporary HP are rolled by the engine.
 *  - Slots are tracked on the character and restored by rests.
 */
import { SPELLS_BY_ID, CLASS_SPELL_LISTS } from '../config/spells.js';
import { CLASSES_BY_ID, SPECIES_BY_ID } from '../config/srd.js';
import { abilityMod, proficiencyBonus } from './progression.js';
import { effectiveAbility, rollDice, scaleCantripDice, spellAbilityFor } from './diceEngine.js';
import { rollDie, getDefaultRng } from './rng.js';
import { buildSpellcasting, buildSpeciesCantrip, preparedLimitFor } from './characterBuilder.js';

export { buildSpellcasting, buildSpeciesCantrip, preparedLimitFor };

/** Visible flat bonus used for enemy saving throws (enemies have no stat blocks). */
export const ENEMY_SAVE_BONUS = 2;

export function hasSpellcasting(character) {
  return Boolean(character?.spellcasting || character?.speciesCantrip);
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

/** Leveled spells a prepared caster may prepare: Wis/Int mod + level (minimum 1). */
export function preparedLimit(character) {
  const sc = character?.spellcasting;
  if (!sc) return 0;
  return Math.max(1, abilityMod(effectiveAbility(character, sc.ability)) + (character.level || 1));
}

export function classSpellOptions(classId) {
  const sc = CLASSES_BY_ID[classId]?.spellcasting;
  return sc ? CLASS_SPELL_LISTS[sc.list] || { cantrips: [], level1: [] } : { cantrips: [], level1: [] };
}

/** Every spell the character can cast right now, with its source. */
export function castableSpells(character) {
  const sc = character?.spellcasting;
  const out = [];
  const seen = new Set();
  const add = (id, source) => {
    if (!SPELLS_BY_ID[id] || seen.has(id)) return;
    seen.add(id);
    out.push({ spell: SPELLS_BY_ID[id], source });
  };
  if (character?.speciesCantrip) add(character.speciesCantrip.id, 'species');
  if (sc) {
    for (const id of sc.cantrips || []) add(id, 'class');
    for (const id of sc.alwaysPrepared || []) add(id, 'domain');
    for (const id of sc.prepared?.length ? sc.prepared : sc.known || []) add(id, 'class');
  }
  return out;
}

export function slotsFor(character, level = 1) {
  const sc = character?.spellcasting;
  if (!sc?.slots) return { max: 0, used: 0, left: 0 };
  const max = sc.slots.max?.[level - 1] || 0;
  const used = Math.min(max, sc.slots.used?.[level - 1] || 0);
  return { max, used, left: max - used };
}

/** Validates a cast. Returns { ok, error, spell, slotLevel }. */
export function canCast(character, spellId) {
  const spell = SPELLS_BY_ID[spellId];
  if (!spell) return { ok: false, error: 'Unknown spell.' };
  if (!castableSpells(character).some((c) => c.spell.id === spellId)) return { ok: false, error: `${spell.name} is not prepared.` };
  if ((character.vitals?.hp ?? 0) <= 0) return { ok: false, error: 'You cannot cast while unconscious.' };
  if (spell.level > 0 && slotsFor(character, spell.level).left <= 0) return { ok: false, error: `No level-${spell.level} slots left — rest to recover them.` };
  return { ok: true, error: null, spell, slotLevel: spell.level > 0 ? spell.level : 0 };
}

/** Damage dice for a spell at the character's level (cantrips scale). */
export function spellDamageDice(character, spell) {
  if (!spell?.damage) return null;
  return spell.scales ? scaleCantripDice(spell.damage, character.level || 1) : spell.damage;
}

/**
 * Save spell against one target, fully resolved by the engine.
 * @returns {{ save: {natural,total,dc,saved}, damage: {expr,rolls,total}|null, dealt }}
 */
export function resolveSaveSpell(character, spell, rng = getDefaultRng()) {
  const dc = spellSaveDc(character, spell.id);
  const natural = rollDie(20, rng);
  const total = natural + ENEMY_SAVE_BONUS;
  const saved = natural !== 1 && (natural === 20 || total >= dc);
  const expr = spellDamageDice(character, spell);
  const damage = expr ? rollDice(expr, { rng }) : null;
  const dealt = !damage ? 0 : saved ? (spell.onSave === 'half' ? Math.floor(damage.total / 2) : 0) : damage.total;
  return { save: { natural, total, dc, saved, bonus: ENEMY_SAVE_BONUS }, damage, dealt };
}

/** Healing: dice + spellcasting modifier (+ Disciple of Life for Life clerics). */
export function resolveHealing(character, spell, rng = getDefaultRng()) {
  const roll = rollDice(spell.heal, { rng });
  const mod = spellModFor(character, spell.id);
  const life = character.classId === 'cleric' && character.subclass === 'Life Domain' ? 2 + spell.level : 0;
  return { roll, mod, life, total: Math.max(1, roll.total + mod + life) };
}

export function resolveAuto(character, spell, rng = getDefaultRng()) {
  return rollDice(spellDamageDice(character, spell), { rng });
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
