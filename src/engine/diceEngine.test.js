import { describe, it, expect } from 'vitest';
import {
  successChance,
  parseDice,
  rollDice,
  totalManualDice,
  buildCheck,
  resolveCheck,
  rollCheck,
  normalizeSkillOrStat,
  weatherModifierFor,
  combineAdvantage,
  damageExpression,
  effectiveAc,
} from './diceEngine.js';
import { createCharacter } from './progression.js';
import { buildSkin } from '../config/genreSkins.js';
import { seededRng } from './rng.js';

const stats = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
const hero = () => createCharacter({ name: 'H', classOrArchetype: 'Fighter', stats, skillProficiencies: ['perception', 'athletics'] });

describe('dice expressions', () => {
  it('parses dice', () => {
    expect(parseDice('2d6+3')).toEqual({ count: 2, sides: 6, bonus: 3 });
    expect(parseDice('d20')).toEqual({ count: 1, sides: 20, bonus: 0 });
    expect(parseDice('1d8 - 1')).toEqual({ count: 1, sides: 8, bonus: -1 });
    expect(parseDice('4')).toEqual({ count: 0, sides: 0, bonus: 4 });
    expect(parseDice('banana')).toBeNull();
  });

  it('rolls within bounds and doubles dice on crits', () => {
    const rng = seededRng('dice');
    for (let i = 0; i < 200; i++) {
      const r = rollDice('2d6+1', { rng });
      expect(r.total).toBeGreaterThanOrEqual(3);
      expect(r.total).toBeLessThanOrEqual(13);
    }
    expect(rollDice('1d8', { critical: true, rng }).rolls.length).toBe(2);
  });

  it('validates manual physical dice', () => {
    expect(totalManualDice('2d6+2', [3, 4]).total).toBe(9);
    expect(() => totalManualDice('2d6', [7, 1])).toThrow();
    expect(() => totalManualDice('1d8', [3])).not.toThrow();
    expect(() => totalManualDice('1d8', [3], { critical: true })).toThrow();
  });
});

describe('checks', () => {
  it('normalizes reskinned and free-form names', () => {
    const skin = buildSkin('frontier_noir');
    expect(normalizeSkillOrStat('Card Sharping', skin)).toEqual({ kind: 'skill', key: 'sleight_of_hand' });
    expect(normalizeSkillOrStat('Wisdom (Perception)')).toEqual({ kind: 'skill', key: 'perception' });
    expect(normalizeSkillOrStat('DEX save')).toEqual({ kind: 'save', key: 'dex' });
    expect(normalizeSkillOrStat('Dexterity Saving Throw')).toEqual({ kind: 'save', key: 'dex' });
    expect(normalizeSkillOrStat('attack')).toEqual({ kind: 'attack', key: 'weapon' });
    expect(normalizeSkillOrStat('Strength')).toEqual({ kind: 'ability', key: 'str' });
    expect(normalizeSkillOrStat('Initiative')).toEqual({ kind: 'initiative', key: 'dex' });
  });

  it('sums d20 + stat + proficiency + weather + items', () => {
    const c = hero();
    c.inventory.push({ id: 'ring', name: 'Ring', type: 'key', equipped: true, statModifiers: { perception: 1 }, craftingTags: [] });
    const weather = { type: 'Heavy Rain', mechanicalEffect: '-2 to Ranged Attacks & Perception.', modifierValue: -2 };
    const check = buildCheck({ character: c, skillOrStat: 'perception', dc: 12, weather });
    expect(check.statMod).toBe(0);
    expect(check.proficiency).toBe(2);
    expect(check.weatherMod).toBe(-2);
    expect(check.itemMod).toBe(1);
    expect(check.totalModifier).toBe(1);
    expect(check.breakdown.map((b) => b.value)).toEqual([0, 2, -2, 1]);
    const r = resolveCheck(check, [11]);
    expect(r.total).toBe(12);
    expect(r.success).toBe(true);
    expect(resolveCheck(check, [10]).success).toBe(false);
  });

  it('weather only applies to affected rolls', () => {
    const w = { type: 'Gale', mechanicalEffect: '-2 to Ranged Attacks.', modifierValue: -2 };
    expect(weatherModifierFor(w, { isAttack: true, isRanged: true })).toBe(-2);
    expect(weatherModifierFor(w, { isAttack: true, isRanged: false })).toBe(0);
    expect(weatherModifierFor(w, { skill: 'perception' })).toBe(0);
    expect(weatherModifierFor({ ...w, affects: ['all'] }, { skill: 'stealth' })).toBe(-2);
  });

  it('handles advantage/disadvantage and conditions', () => {
    expect(combineAdvantage(['advantage', 'disadvantage'])).toBe('normal');
    const c = hero();
    c.vitals.conditions = ['poisoned'];
    const check = buildCheck({ character: c, skillOrStat: 'athletics', dc: 10, advantage: 'normal' });
    expect(check.advantage).toBe('disadvantage');
    expect(resolveCheck(check, [18, 4]).natural).toBe(4);
    const adv = buildCheck({ character: c, skillOrStat: 'athletics', dc: 10, advantage: 'advantage' });
    expect(adv.advantage).toBe('normal');
    expect(() => resolveCheck(check, [10])).toThrow();
    expect(() => resolveCheck(adv, [21])).toThrow();
  });

  it('attack rolls: STR for melee, nat 20 always hits, nat 1 always misses', () => {
    const c = hero();
    const check = buildCheck({ character: c, skillOrStat: 'attack', dc: 25 });
    expect(check.isAttack).toBe(true);
    expect(check.ability).toBe('str');
    expect(check.totalModifier).toBe(4);
    expect(resolveCheck(check, [20]).success).toBe(true);
    expect(resolveCheck({ ...check, dc: 2 }, [1]).success).toBe(false);
    expect(damageExpression(check, c).expr).toBe('1d8+2');
  });

  it('effective AC includes equipped armor', () => {
    expect(effectiveAc(hero())).toBe(13);
  });

  it('rollCheck is reproducible with a seeded RNG', () => {
    const check = buildCheck({ character: hero(), skillOrStat: 'perception', dc: 12 });
    expect(rollCheck(check, seededRng('a'))).toEqual(rollCheck(check, seededRng('a')));
  });
});

describe('successChance', () => {
  it('counts d20 faces that meet the DC, with natural 1 and 20 rules', () => {
    expect(successChance(0, 11)).toBeCloseTo(0.5);
    expect(successChance(4, 15)).toBeCloseTo(0.5);
    expect(successChance(10, 5)).toBeCloseTo(0.95); // a natural 1 still fails
    expect(successChance(-5, 30)).toBeCloseTo(0.05); // a natural 20 still succeeds
    expect(successChance(2, null)).toBeNull();
  });

  it('applies advantage and disadvantage', () => {
    expect(successChance(0, 11, 'advantage')).toBeCloseTo(0.75);
    expect(successChance(0, 11, 'disadvantage')).toBeCloseTo(0.25);
  });
});
