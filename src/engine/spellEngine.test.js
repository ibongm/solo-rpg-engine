import { describe, it, expect } from 'vitest';
import { buildSrdCharacter } from './characterBuilder.js';
import {
  spellAttackBonus,
  spellSaveDc,
  castableSpells,
  slotsFor,
  canCast,
  resolveSaveSpell,
  resolveHealing,
  resolveAuto,
  validateSpells,
  preparedLimitFor,
  spellDamageDice,
  ENEMY_SAVE_BONUS,
} from './spellEngine.js';
import { buildCheck, damageExpression, effectiveAc, effectiveSpeed, normalizeSkillOrStat, scaleCantripDice } from './diceEngine.js';
import { computeTurnState } from './stateMutator.js';
import { planRest } from './economyEngine.js';
import { SPELLS_BY_ID } from '../config/spells.js';
import { seededRng } from './rng.js';

const wizStats = { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 };

function wizard(spells = {}) {
  return {
    id: 'w1',
    ...buildSrdCharacter({
      name: 'Ilsa',
      speciesId: 'elf',
      classId: 'wizard',
      backgroundId: 'scholar',
      baseStats: wizStats,
      classSkills: ['arcana', 'investigation'],
      equipment: [],
      spells: { cantrips: ['fire_bolt', 'ray_of_frost', 'mage_hand'], spellbook: ['magic_missile', 'mage_armor', 'burning_hands', 'shield', 'sleep', 'thunderwave'], prepared: ['magic_missile', 'mage_armor', 'burning_hands'], speciesCantrip: 'light', ...spells },
    }),
  };
}

describe('spellcasting', () => {
  it('builds a wizard with slots, spellbook, prepared spells and an elf cantrip', () => {
    const w = wizard();
    expect(w.spellcasting.ability).toBe('int');
    expect(w.spellcasting.slots).toEqual({ max: [2], used: [0] });
    expect(w.spellcasting.spellbook).toHaveLength(6);
    expect(w.speciesCantrip).toEqual({ id: 'light', ability: 'int' });
    const ids = castableSpells(w).map((c) => c.spell.id);
    expect(ids).toEqual(expect.arrayContaining(['light', 'fire_bolt', 'magic_missile', 'mage_armor']));
    expect(ids).not.toContain('sleep'); // in the book but not prepared
  });

  it('computes attack bonus and save DC (Int 16 → +3, prof +2)', () => {
    const w = wizard();
    expect(spellAttackBonus(w, 'fire_bolt')).toBe(5);
    expect(spellSaveDc(w, 'burning_hands')).toBe(13);
  });

  it('normalizes spell attack requests and rolls spell damage', () => {
    expect(normalizeSkillOrStat('spell_attack:fire_bolt')).toEqual({ kind: 'attack', key: 'spell', spellId: 'fire_bolt' });
    const w = wizard();
    const check = buildCheck({ character: w, skillOrStat: 'spell_attack:fire_bolt', dc: 12 });
    expect(check.label).toBe('Spell Attack — Fire Bolt');
    expect(check.totalModifier).toBe(5);
    expect(check.isAttack).toBe(true);
    expect(damageExpression(check, w).expr).toBe('1d10');
  });

  it('scales cantrips at levels 5, 11 and 17', () => {
    expect(scaleCantripDice('1d10', 4)).toBe('1d10');
    expect(scaleCantripDice('1d10', 5)).toBe('2d10');
    expect(scaleCantripDice('1d8', 17)).toBe('4d8');
    expect(spellDamageDice({ level: 11 }, SPELLS_BY_ID.sacred_flame)).toBe('3d8');
    expect(spellDamageDice({ level: 11 }, SPELLS_BY_ID.guiding_bolt)).toBe('4d6');
  });

  it('resolves save spells visibly, halving on a save when the spell says so', () => {
    const w = wizard();
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const r = resolveSaveSpell(w, SPELLS_BY_ID.burning_hands, seededRng(seed));
      expect(r.save.total).toBe(r.save.natural + ENEMY_SAVE_BONUS);
      expect(r.save.dc).toBe(13);
      expect(r.dealt).toBe(r.save.saved ? Math.floor(r.damage.total / 2) : r.damage.total);
    }
    const sacred = resolveSaveSpell(w, SPELLS_BY_ID.sacred_flame, seededRng('x'));
    if (sacred.save.saved) expect(sacred.dealt).toBe(0);
  });

  it('heals with modifier and Disciple of Life for Life clerics', () => {
    const cleric = buildSrdCharacter({ name: 'C', speciesId: 'human', classId: 'cleric', backgroundId: 'acolyte', baseStats: { str: 12, dex: 10, con: 14, int: 8, wis: 15, cha: 12 }, classSkills: ['medicine', 'persuasion'], equipment: [], spells: { cantrips: ['sacred_flame', 'guidance', 'light'], prepared: ['healing_word'] } });
    expect(castableSpells(cleric).map((c) => c.spell.id)).toEqual(expect.arrayContaining(['bless', 'cure_wounds', 'healing_word']));
    const h = resolveHealing(cleric, SPELLS_BY_ID.cure_wounds, seededRng('h'));
    expect(h.mod).toBe(3);
    expect(h.life).toBe(3);
    expect(h.total).toBe(h.roll.total + 6);
    expect(resolveAuto(cleric, SPELLS_BY_ID.magic_missile, seededRng('m')).total).toBeGreaterThanOrEqual(6);
  });

  it('enforces slots: casting spends one; a long rest restores them; a short rest restores pact slots', () => {
    const w = wizard();
    const campaign = { meta: { rulesStrictness: 5 }, worldState: { clock: { day: 1, hour: 8, minute: 0, season: 'Spring' }, weather: null }, quests: [], factions: [], mapNodes: [], combat: { inCombat: false, enemies: [] }, seedKey: 'k' };
    let r = computeTurnState({ campaign, character: w, engine: { spell_slot_used: 1 } });
    expect(slotsFor(r.character).left).toBe(1);
    r = computeTurnState({ campaign, character: r.character, engine: { spell_slot_used: 1 } });
    expect(canCast(r.character, 'magic_missile').ok).toBe(false);
    expect(canCast(r.character, 'fire_bolt').ok).toBe(true); // cantrips are free
    const short = computeTurnState({ campaign, character: r.character, engine: planRest('short', r.character, campaign).engine });
    expect(slotsFor(short.character).left).toBe(0); // wizards do not recover on a short rest
    const long = computeTurnState({ campaign, character: r.character, engine: planRest('long', r.character, campaign).engine });
    expect(slotsFor(long.character).left).toBe(2);
    const lock = buildSrdCharacter({ name: 'L', speciesId: 'tiefling', classId: 'warlock', backgroundId: 'scholar', baseStats: wizStats, classSkills: ['deception', 'intimidation'], equipment: [], spells: { cantrips: ['eldritch_blast', 'mage_hand'], known: ['hellish_rebuke', 'command'] } });
    const spent = computeTurnState({ campaign, character: lock, engine: { spell_slot_used: 1 } });
    const pactRest = computeTurnState({ campaign, character: spent.character, engine: planRest('short', spent.character, campaign).engine });
    expect(slotsFor(pactRest.character).left).toBe(1);
    expect(lock.speciesCantrip).toEqual({ id: 'thaumaturgy', ability: 'cha' });
  });

  it('tracks Mage Armor, Shield of Faith and Longstrider, replacing concentration effects', () => {
    const w = wizard();
    const campaign = { meta: {}, worldState: { clock: { day: 1, hour: 8, minute: 0, season: 'Spring' } }, quests: [], factions: [], mapNodes: [], combat: { inCombat: false, enemies: [] }, seedKey: 'k' };
    const base = effectiveAc(w);
    const armored = computeTurnState({ campaign, character: w, engine: { active_effect: { id: 'mage_armor', name: 'Mage Armor' } } }).character;
    expect(effectiveAc(armored)).toBe(13 + 3); // elf Dex 16 → +3
    expect(effectiveAc(armored)).toBeGreaterThan(base);
    const faith = computeTurnState({ campaign, character: armored, engine: { active_effect: { id: 'shield_of_faith', concentration: true } } }).character;
    expect(effectiveAc(faith)).toBe(18);
    const bless = computeTurnState({ campaign, character: faith, engine: { active_effect: { id: 'bless', concentration: true } } }).character;
    expect(bless.activeEffects.map((e) => e.id).sort()).toEqual(['bless', 'mage_armor']);
    const fast = computeTurnState({ campaign, character: w, engine: { active_effect: { id: 'longstrider' } } }).character;
    expect(effectiveSpeed(fast)).toBe(40);
  });

  it('validates the creator spell picks', () => {
    const stats = { str: 8, dex: 14, con: 13, int: 16, wis: 12, cha: 10 };
    expect(preparedLimitFor('wizard', stats)).toBe(4);
    expect(validateSpells({ classId: 'wizard', speciesId: 'human', finalStats: stats, cantrips: ['fire_bolt'], spellbook: [], prepared: [] }).length).toBe(3);
    expect(validateSpells({ classId: 'fighter', speciesId: 'elf', finalStats: stats })).toEqual(['Choose your species cantrip.']);
  });
});
