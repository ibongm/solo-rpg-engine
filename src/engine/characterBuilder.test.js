import { describe, it, expect } from 'vitest';
import {
  finalAbilityScores,
  grantedSkills,
  resolveKit,
  kitPickSlots,
  optionAllowed,
  buildProficiencies,
  validateBuild,
  buildSrdCharacter,
  backgroundKit,
  srdInventoryItems,
  rollStartingWealth,
  averageStartingWealth,
  isWeaponProficient,
} from './characterBuilder.js';
import { buildCheck, effectiveAc, effectiveSpeed, damageExpression } from './diceEngine.js';
import { toggleEquip } from './stateMutator.js';
import { applyXp } from './progression.js';
import { CLASSES } from '../config/srd.js';
import { seededRng } from './rng.js';

const base = { str: 15, dex: 14, con: 13, int: 8, wis: 12, cha: 10 };

function fighter(extra = {}) {
  const build = {
    name: 'Mara',
    genre: 'fantasy',
    speciesId: 'human',
    classId: 'fighter',
    backgroundId: 'veteran',
    baseStats: base,
    classSkills: ['perception', 'survival'],
    fightingStyle: 'defense',
    equipment: [...resolveKit({ classId: 'fighter', choices: { 0: 0, 1: 0, 2: 1, 3: 1 }, anyPicks: { '1:0:0:0': 'longsword' } }), ...backgroundKit('veteran')],
    currency: 10,
    ...extra,
  };
  return { build, character: buildSrdCharacter(build) };
}

describe('character builder', () => {
  it('applies species bonuses, including flexible half-elf +1s', () => {
    expect(finalAbilityScores(base, 'human')).toEqual({ str: 16, dex: 15, con: 14, int: 9, wis: 13, cha: 11 });
    const he = finalAbilityScores(base, 'half_elf', ['str', 'con']);
    expect(he).toMatchObject({ cha: 12, str: 16, con: 14, dex: 14 });
    expect(finalAbilityScores(base, 'half_elf', ['cha', 'str']).cha).toBe(12); // cha excluded from flexible picks
  });

  it('collects granted skills from species and background', () => {
    expect(grantedSkills({ speciesId: 'elf', backgroundId: 'acolyte' }).sort()).toEqual(['insight', 'perception', 'religion']);
    expect(grantedSkills({ speciesId: 'human', backgroundId: 'custom', backgroundSkillChoices: ['stealth', 'arcana'] }).sort()).toEqual(['arcana', 'stealth']);
  });

  it('resolves kit choices, including "any" picks and two-of picks', () => {
    const kit = resolveKit({ classId: 'fighter', choices: { 0: 1, 1: 1, 2: 0, 3: 0 }, anyPicks: { '1:1:0:0': 'greatsword', '1:1:0:1': 'rapier' } });
    expect(kit.map((k) => k.id)).toEqual(['leather', 'longbow', 'arrows', 'greatsword', 'rapier', 'light_crossbow', 'bolts', 'dungeoneers_pack']);
    expect(kitPickSlots({ classId: 'fighter', choices: { 1: 1 } }).map((s) => s.key)).toEqual(['1:1:0:0', '1:1:0:1']);
    // an "any martial" slot ignores a simple weapon
    expect(resolveKit({ classId: 'fighter', choices: { 1: 0 }, anyPicks: { '1:0:0:0': 'club' } }).some((k) => k.id === 'club')).toBe(false);
  });

  it('gates kit options on proficiency (cleric warhammer)', () => {
    const cleric = CLASSES.find((c) => c.id === 'cleric');
    const humanProfs = buildProficiencies('human', 'cleric');
    const dwarfProfs = buildProficiencies('dwarf', 'cleric');
    expect(optionAllowed(cleric.equipment[0].choose[1], humanProfs)).toBe(false);
    expect(optionAllowed(cleric.equipment[0].choose[1], dwarfProfs)).toBe(true);
    expect(optionAllowed(cleric.equipment[1].choose[2], humanProfs)).toBe(true); // Life domain grants heavy armor
  });

  it('validates required choices', () => {
    const errs = validateBuild({ name: 'X', speciesId: 'half_elf', classId: 'rogue', backgroundId: 'custom', classSkills: [], speciesSkills: [], flexibleBonuses: [] });
    expect(errs.join(' ')).toMatch(/\+1 bonuses/);
    expect(errs.join(' ')).toMatch(/species skills/);
    expect(errs.join(' ')).toMatch(/background skills/);
    expect(errs.join(' ')).toMatch(/4 class skills/);
    expect(errs.join(' ')).toMatch(/Expertise/);
    expect(validateBuild(fighter().build)).toEqual([]);
  });

  it('builds a complete fighter with HP, proficiencies and an equipped loadout', () => {
    const { character } = fighter();
    expect(character.rules).toBe('srd51');
    expect(character.vitals.maxHp).toBe(12); // d10 + Con 14 (+2)
    expect(character.savingThrows).toEqual(['str', 'con']);
    expect(character.skillProficiencies.sort()).toEqual(['athletics', 'intimidation', 'perception', 'survival']);
    const eq = character.inventory.filter((i) => i.equipped).map((i) => i.srdId).sort();
    expect(eq).toEqual(['chain_mail', 'longsword', 'shield']);
    // Chain mail 16 + shield 2 + Defense 1
    expect(effectiveAc(character)).toBe(19);
    expect(character.inventory.filter((i) => i.craftingTags.includes('ration')).length).toBe(5);
  });

  it('reskins names per genre without changing mechanics', () => {
    const [gun] = srdInventoryItems('hand_crossbow', 1, 'frontier_noir');
    expect(gun.name).toBe('Six-Shooter');
    expect(gun.damageDice).toBe('1d6');
    const { character } = fighter({ genre: 'post_apoc' });
    expect(character.classOrArchetype).toBe('Road Warrior');
    expect(character.currency.label).toBe('Caps');
  });

  it('rolls starting wealth visibly and deterministically', () => {
    const w = rollStartingWealth('fighter', seededRng('x'));
    expect(w.rolls).toHaveLength(5);
    expect(w.total).toBe(w.rolls.reduce((a, b) => a + b, 0) * 10);
    expect(averageStartingWealth('monk')).toBe(12);
  });

  it('adds Dwarven Toughness / Draconic HP per level, including on level up', () => {
    const { character } = fighter({ speciesId: 'dwarf' });
    expect(character.hpBonusPerLevel).toBe(1);
    const before = character.vitals.maxHp;
    const up = applyXp(character, 300).character;
    expect(up.vitals.maxHp - before).toBe(6 + 2 + 1); // avg d10 (6) + Con mod + toughness
  });
});

describe('SRD combat rules in the dice engine', () => {
  it('uses class Unarmored Defense and caps Dex for medium armor', () => {
    const barb = buildSrdCharacter({ name: 'B', speciesId: 'half_orc', classId: 'barbarian', backgroundId: 'wanderer', baseStats: { str: 15, dex: 14, con: 14, int: 8, wis: 10, cha: 10 }, equipment: [] });
    expect(effectiveAc(barb)).toBe(10 + 2 + 2); // Dex 14 → +2, Con 14+1 = 15 → +2
    const rogue = buildSrdCharacter({ name: 'R', speciesId: 'elf', classId: 'rogue', backgroundId: 'urchin', baseStats: { str: 8, dex: 15, con: 12, int: 12, wis: 10, cha: 12 }, equipment: [{ id: 'half_plate' }] });
    // Dex 17 (+3) capped at +2 for medium armor — but a rogue lacks medium proficiency, so autoEquip skips it
    expect(rogue.inventory[0].equipped).toBe(false);
    const worn = { ...rogue, inventory: rogue.inventory.map((i) => ({ ...i, equipped: true })) };
    expect(effectiveAc(worn)).toBe(15 + 2);
    const stealth = buildCheck({ character: worn, skillOrStat: 'stealth' });
    expect(stealth.advantage).toBe('disadvantage');
    expect(stealth.conditionNotes.join(' ')).toMatch(/armor/);
  });

  it('applies weapon proficiency, finesse, saves and expertise', () => {
    const { character } = fighter();
    const atk = buildCheck({ character, skillOrStat: 'attack' });
    expect(atk.proficient).toBe(true);
    const wizard = buildSrdCharacter({ name: 'W', speciesId: 'human', classId: 'wizard', backgroundId: 'scholar', baseStats: base, equipment: [{ id: 'greatsword' }] });
    const sword = wizard.inventory.find((i) => i.srdId === 'greatsword');
    expect(isWeaponProficient(wizard, sword)).toBe(false);
    expect(buildCheck({ character: wizard, skillOrStat: 'attack', weapon: sword }).proficient).toBe(false);
    expect(buildCheck({ character, skillOrStat: 'str_save' }).proficient).toBe(true);
    expect(buildCheck({ character, skillOrStat: 'wis_save' }).proficient).toBe(false);
    const rogue = buildSrdCharacter({ name: 'R', speciesId: 'human', classId: 'rogue', backgroundId: 'urchin', baseStats: { str: 8, dex: 15, con: 13, int: 12, wis: 12, cha: 10 }, classSkills: ['perception', 'acrobatics', 'deception', 'insight'], expertise: ['stealth', 'perception'], equipment: [{ id: 'rapier' }] });
    const st = buildCheck({ character: rogue, skillOrStat: 'stealth' });
    expect(st.proficiency).toBe(4);
    const rapier = buildCheck({ character: rogue, skillOrStat: 'attack' });
    expect(rapier.ability).toBe('dex');
  });

  it('two-hands versatile weapons without a shield and adds Dueling with one', () => {
    const { character } = fighter({ fightingStyle: 'dueling' });
    const check = buildCheck({ character, skillOrStat: 'attack' });
    expect(damageExpression(check, character).expr).toBe('1d8+5'); // Str 16 (+3) + Dueling 2
    const noShield = toggleEquip(character, character.inventory.find((i) => i.srdId === 'shield').id);
    const c2 = buildCheck({ character: noShield, skillOrStat: 'attack' });
    expect(damageExpression(c2, noShield).expr).toBe('1d10+3');
  });

  it('Archery adds +2 to ranged attacks', () => {
    const { character } = fighter({ fightingStyle: 'archery', equipment: [{ id: 'longbow' }] });
    const c = buildCheck({ character, skillOrStat: 'attack' });
    expect(c.breakdown.some((b) => b.label === 'Archery style' && b.value === 2)).toBe(true);
  });

  it('slows characters in heavy armor without the Strength, except dwarves', () => {
    const weak = buildSrdCharacter({ name: 'W', speciesId: 'human', classId: 'fighter', backgroundId: 'veteran', baseStats: { ...base, str: 10 }, fightingStyle: 'defense', equipment: [{ id: 'plate' }] });
    expect(effectiveSpeed(weak)).toBe(20);
    const dwarf = buildSrdCharacter({ name: 'D', speciesId: 'dwarf', classId: 'fighter', backgroundId: 'veteran', baseStats: { ...base, str: 10 }, fightingStyle: 'defense', equipment: [{ id: 'plate' }] });
    expect(effectiveSpeed(dwarf)).toBe(25);
  });

  it('keeps a shield and a two-handed weapon mutually exclusive', () => {
    const { character } = fighter({ equipment: [{ id: 'greatsword' }, { id: 'shield' }, { id: 'longsword' }] });
    const gs = character.inventory.find((i) => i.srdId === 'greatsword');
    const after = toggleEquip(character, gs.id);
    expect(after.inventory.find((i) => i.srdId === 'shield').equipped).toBe(false);
    expect(after.inventory.find((i) => i.srdId === 'longsword').equipped).toBe(false);
  });

  it('Small creatures attack with heavy weapons at disadvantage', () => {
    const h = buildSrdCharacter({ name: 'H', speciesId: 'halfling', classId: 'fighter', backgroundId: 'veteran', baseStats: base, fightingStyle: 'defense', equipment: [{ id: 'greataxe' }] });
    expect(buildCheck({ character: h, skillOrStat: 'attack' }).advantage).toBe('disadvantage');
  });
});
