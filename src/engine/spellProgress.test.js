import { describe, it, expect } from 'vitest';
import { buildSrdCharacter } from './characterBuilder.js';
import {
  slotTable,
  maxSpellLevelFor,
  syncSpellcasting,
  pendingSpellChoices,
  spellChoiceOptions,
  applySpellChoices,
  alwaysPreparedFor,
  preparedLimitAt,
  arcanumLevelsFor,
} from './spellProgress.js';
import { canCast, castSlotOptions, castableSpells, resolveAreaSaveSpell, resolveHealing, spellDamageDice, preparableSpells, slotLevels } from './spellEngine.js';
import { applyXp, XP_THRESHOLDS } from './progression.js';
import { buildCheck, normalizeSkillOrStat, upcastDice } from './diceEngine.js';
import { computeTurnState } from './stateMutator.js';
import { SPELLS, SPELLS_BY_ID, CLASS_SPELL_LISTS } from '../config/spells.js';
import { seededRng } from './rng.js';

const stats = { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 15 };

function build(classId, extra = {}) {
  return {
    id: `c-${classId}`,
    ...buildSrdCharacter({
      name: 'Test',
      speciesId: 'human',
      classId,
      backgroundId: 'scholar',
      baseStats: stats,
      classSkills: [],
      equipment: [],
      ...extra,
    }),
  };
}

const wizard = () =>
  build('wizard', {
    spells: { cantrips: ['fire_bolt', 'ray_of_frost', 'mage_hand'], spellbook: ['magic_missile', 'mage_armor', 'burning_hands', 'shield', 'sleep', 'thunderwave'], prepared: ['magic_missile', 'burning_hands'] },
  });

/** Levels a character up through the engine's own XP path. */
const toLevel = (character, level) => applyXp(character, XP_THRESHOLDS[level - 1] - (character.xp || 0)).character;

describe('spell data', () => {
  it('has every SRD spell, cantrips through 9th level, with valid fields', () => {
    expect(SPELLS.length).toBe(319);
    const KINDS = new Set(['attack', 'save', 'auto', 'heal', 'temp_hp', 'utility']);
    for (const s of SPELLS) {
      expect(KINDS.has(s.kind), s.id).toBe(true);
      expect(s.level >= 0 && s.level <= 9, s.id).toBe(true);
      if (s.kind === 'save') expect(['str', 'dex', 'con', 'int', 'wis', 'cha']).toContain(s.save);
      if (s.kind === 'attack') expect(['ranged', 'melee']).toContain(s.attackType);
      if (s.kind === 'heal') expect(s.heal).toBeTruthy();
      expect(s.desc.length, s.id).toBeGreaterThan(10);
    }
    for (let l = 0; l <= 9; l++) expect(SPELLS.some((s) => s.level === l)).toBe(true);
  });

  it('only lists real spells of the right level on every class list', () => {
    for (const [cls, list] of Object.entries(CLASS_SPELL_LISTS)) {
      for (const id of list.cantrips) expect(SPELLS_BY_ID[id]?.level, `${cls}:${id}`).toBe(0);
      for (const [lvl, ids] of Object.entries(list.byLevel)) for (const id of ids) expect(SPELLS_BY_ID[id]?.level, `${cls}:${id}`).toBe(Number(lvl));
    }
    expect(CLASS_SPELL_LISTS.wizard.byLevel[9]).toContain('wish');
    expect(CLASS_SPELL_LISTS.warlock.byLevel[3]).toContain('fireball'); // Fiend expanded list
    expect(CLASS_SPELL_LISTS.paladin.byLevel[5]).toContain('raise_dead');
  });
});

describe('slot tables', () => {
  it('follows the SRD full-caster table', () => {
    expect(slotTable('wizard', 1)).toEqual([2]);
    expect(slotTable('wizard', 3)).toEqual([4, 2]);
    expect(slotTable('wizard', 5)).toEqual([4, 3, 2]);
    expect(slotTable('cleric', 9)).toEqual([4, 3, 3, 3, 1]);
    expect(slotTable('druid', 17)).toEqual([4, 3, 3, 3, 2, 1, 1, 1, 1]);
    expect(slotTable('bard', 20)).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1]);
    expect(maxSpellLevelFor('sorcerer', 17)).toBe(9);
  });

  it('gives half casters slots from level 2, up to 5th level', () => {
    expect(slotTable('paladin', 1)).toEqual([]);
    expect(slotTable('paladin', 2)).toEqual([2]);
    expect(slotTable('ranger', 5)).toEqual([4, 2]);
    expect(maxSpellLevelFor('paladin', 20)).toBe(5);
  });

  it('models warlock pact magic and Mystic Arcanum', () => {
    expect(slotTable('warlock', 1)).toEqual([1]);
    expect(slotTable('warlock', 5)).toEqual([0, 0, 2]);
    expect(slotTable('warlock', 11)).toEqual([0, 0, 0, 0, 3]);
    expect(arcanumLevelsFor('warlock', 10)).toEqual([]);
    expect(arcanumLevelsFor('warlock', 15)).toEqual([6, 7, 8]);
    expect(arcanumLevelsFor('wizard', 20)).toEqual([]);
  });
});

describe('levelling up spellcasting', () => {
  it('grows a wizard from 1 to 5: slots, cantrip and spellbook picks owed', () => {
    const w5 = toLevel(wizard(), 5);
    expect(w5.level).toBe(5);
    expect(w5.spellcasting.slots).toEqual({ max: [4, 3, 2], used: [0, 0, 0] });
    expect(pendingSpellChoices(w5)).toEqual({ cantrips: 1, known: 0, spellbook: 8, arcanum: [], maxLevel: 3 });
    const opts = spellChoiceOptions(w5);
    expect(opts.spellbook).toContain('fireball');
    expect(opts.spellbook).not.toContain('cone_of_cold'); // 5th level — too high at level 5
  });

  it('heals an old save that still has level-1 slots at level 5', () => {
    const old = { ...wizard(), level: 5, xp: 6500 };
    expect(old.spellcasting.slots.max).toEqual([2]);
    const fixed = syncSpellcasting(old);
    expect(fixed.spellcasting.slots).toEqual({ max: [4, 3, 2], used: [0, 0, 0] });
    expect(syncSpellcasting(fixed)).toBe(fixed); // idempotent: unchanged objects are returned as-is
  });

  it('turns a paladin into a caster at level 2, with prepared spells from the whole list', () => {
    const p1 = build('paladin', { fightingStyle: 'defense' });
    expect(p1.spellcasting ?? null).toBeNull();
    expect(syncSpellcasting(p1)).toBe(p1);
    const p2 = toLevel(p1, 2);
    expect(p2.spellcasting).toMatchObject({ ability: 'cha', list: 'paladin', slots: { max: [2], used: [0] } });
    expect(preparableSpells(p2)).toContain('cure_wounds');
    expect(preparableSpells(p2)).not.toContain('aid'); // 2nd level needs paladin 5
    expect(preparedLimitAt('paladin', 5, 2)).toBe(4); // CHA +2 + half of 5
    expect(pendingSpellChoices(p2)).toMatchObject({ cantrips: 0, known: 0, spellbook: 0 });
  });

  it('gives a ranger spells known at level 2', () => {
    const r2 = toLevel(build('ranger'), 2);
    expect(pendingSpellChoices(r2).known).toBe(2);
    const learned = applySpellChoices(r2, { known: ['hunters_mark', 'cure_wounds'] });
    expect(learned.spellcasting.known).toEqual(['hunters_mark', 'cure_wounds']);
    expect(castableSpells(learned).map((c) => c.spell.id)).toContain('hunters_mark');
    expect(() => applySpellChoices(r2, { known: ['fireball'] })).toThrow(/not available/);
    expect(() => applySpellChoices(r2, { known: ['alarm', 'jump', 'longstrider'] })).toThrow(/2 more/);
  });

  it('adds Life Domain spells as the cleric levels', () => {
    expect(alwaysPreparedFor('cleric', 1, 'Life Domain')).toEqual(['bless', 'cure_wounds']);
    expect(alwaysPreparedFor('cleric', 5, 'Life Domain')).toEqual(['bless', 'cure_wounds', 'lesser_restoration', 'spiritual_weapon', 'beacon_of_hope', 'revivify']);
  });

  it('lets a warlock pick and spend a Mystic Arcanum once per long rest', () => {
    let w = toLevel(build('warlock', { spells: { cantrips: ['eldritch_blast', 'mage_hand'], known: ['hellish_rebuke', 'charm_person'] } }), 11);
    expect(pendingSpellChoices(w).arcanum).toEqual([6]);
    w = applySpellChoices(w, { arcanum: { 6: 'circle_of_death' } });
    expect(canCast(w, 'circle_of_death')).toMatchObject({ ok: true, arcanum: true, slotLevel: 0 });
    const spent = computeTurnState({ campaign: { meta: {}, turnCount: 0 }, character: w, engine: { arcanum_used: 6 } }).character;
    expect(canCast(spent, 'circle_of_death').ok).toBe(false);
    const rested = computeTurnState({ campaign: { meta: {}, turnCount: 0 }, character: spent, engine: { restore_spell_slots: 'all' } }).character;
    expect(canCast(rested, 'circle_of_death').ok).toBe(true);
  });
});

describe('casting with higher slots', () => {
  const w5 = () => applySpellChoices(toLevel(wizard(), 5), { spellbook: ['fireball', 'scorching_ray'] });
  const prepped = () => ({ ...w5(), spellcasting: { ...w5().spellcasting, prepared: ['magic_missile', 'burning_hands', 'fireball'] } });

  it('chooses the lowest free slot, or any higher one to upcast', () => {
    const w = prepped();
    expect(castSlotOptions(w, SPELLS_BY_ID.burning_hands)).toEqual([1, 2, 3]);
    expect(canCast(w, 'burning_hands').slotLevel).toBe(1);
    expect(canCast(w, 'burning_hands', 3)).toMatchObject({ ok: true, slotLevel: 3 });
    expect(canCast(w, 'fireball', 2).ok).toBe(false);
    const noThirds = { ...w, spellcasting: { ...w.spellcasting, slots: { max: [4, 3, 2], used: [0, 0, 2] } } };
    expect(canCast(noThirds, 'fireball').error).toMatch(/3rd-level or higher/);
  });

  it('adds upcast dice for damage and healing', () => {
    const w = prepped();
    expect(upcastDice('8d6', '1d6', 2)).toBe('10d6');
    expect(spellDamageDice(w, SPELLS_BY_ID.fireball)).toBe('8d6');
    expect(spellDamageDice(w, SPELLS_BY_ID.fireball, 5)).toBe('10d6');
    expect(spellDamageDice(w, SPELLS_BY_ID.burning_hands, 3)).toBe('5d6');
    const h = resolveHealing({ ...w, classId: 'bard' }, SPELLS_BY_ID.cure_wounds, seededRng('heal'), 3);
    expect(h.roll.rolls).toHaveLength(3);
  });

  it('carries the slot into storyteller-requested spell attacks', () => {
    expect(normalizeSkillOrStat('spell_attack:acid_arrow:4')).toEqual({ kind: 'attack', key: 'spell', spellId: 'acid_arrow', spellSlot: 4 });
    const check = buildCheck({ character: prepped(), skillOrStat: 'spell_attack:acid_arrow:4', dc: 13 });
    expect(check.spell.damageDice).toBe('6d4');
  });

  it('rolls area damage once and an open save for each enemy', () => {
    const w = prepped();
    const targets = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
    const r = resolveAreaSaveSpell(w, SPELLS_BY_ID.fireball, targets, seededRng('area'), 3);
    expect(r.results).toHaveLength(3);
    for (const x of r.results) expect(x.dealt).toBe(x.save.saved ? Math.floor(r.damage.total / 2) : r.damage.total);
    expect(r.damage.rolls).toHaveLength(8);
  });

  it('spends the chosen slot level in the turn engine', () => {
    const w = prepped();
    const after = computeTurnState({ campaign: { meta: {}, turnCount: 0 }, character: w, engine: { spell_slot_used: 3 } }).character;
    expect(slotLevels(after).find((s) => s.level === 3)).toMatchObject({ used: 1, left: 1 });
  });
});
