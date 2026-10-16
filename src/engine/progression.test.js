import { describe, it, expect } from 'vitest';
import {
  abilityMod,
  levelForXp,
  proficiencyBonus,
  applyXp,
  pointBuyCost,
  roll4d6DropLowest,
  createCharacter,
  canUnlockPerk,
  unlockPerk,
  perkPointsAvailable,
  normalizePerkTree,
  cloneCharacter,
  hpGainPerLevel,
} from './progression.js';
import { seededRng } from './rng.js';

const stats = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };

describe('progression', () => {
  it('computes 5e ability modifiers', () => {
    expect(abilityMod(10)).toBe(0);
    expect(abilityMod(11)).toBe(0);
    expect(abilityMod(8)).toBe(-1);
    expect(abilityMod(15)).toBe(2);
    expect(abilityMod(20)).toBe(5);
    expect(abilityMod(1)).toBe(-5);
  });

  it('maps XP to level and proficiency', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(299)).toBe(1);
    expect(levelForXp(300)).toBe(2);
    expect(levelForXp(6500)).toBe(5);
    expect(levelForXp(999999)).toBe(20);
    expect(proficiencyBonus(1)).toBe(2);
    expect(proficiencyBonus(4)).toBe(2);
    expect(proficiencyBonus(5)).toBe(3);
    expect(proficiencyBonus(17)).toBe(6);
  });

  it('point buy cost matches the 27-point standard array', () => {
    expect(pointBuyCost(stats)).toBe(27);
    expect(pointBuyCost({ ...stats, str: 16 })).toBe(Infinity);
  });

  it('4d6 drop lowest is deterministic with a seed and in range', () => {
    const a = roll4d6DropLowest(seededRng('x'));
    const b = roll4d6DropLowest(seededRng('x'));
    expect(a).toEqual(b);
    expect(a.score).toBeGreaterThanOrEqual(3);
    expect(a.score).toBeLessThanOrEqual(18);
    expect(a.score).toBe(a.rolls.reduce((s, r) => s + r, 0) - a.dropped);
  });

  it('creates a level-1 character with fixed HP and a starter kit', () => {
    const c = createCharacter({ name: 'Mara', genre: 'fantasy', classOrArchetype: 'Fighter', stats, skillProficiencies: ['athletics', 'perception', 'bogus'] });
    expect(c.hitDie).toBe(10);
    expect(c.vitals.maxHp).toBe(11); // d10 + CON 13 (+1)
    expect(c.vitals.ac).toBe(12); // 10 + DEX 14 (+2)
    expect(c.skillProficiencies).toEqual(['athletics', 'perception']);
    expect(c.inventory.some((i) => i.type === 'weapon' && i.equipped)).toBe(true);
    expect(c.inventory.filter((i) => i.craftingTags.includes('ration')).length).toBe(3);
  });

  it('levels up with average HP gains and never de-levels', () => {
    const c = createCharacter({ name: 'M', classOrArchetype: 'Fighter', stats });
    const { character, levelsGained } = applyXp(c, 900);
    expect(levelsGained).toBe(2);
    expect(character.level).toBe(3);
    expect(character.vitals.maxHp).toBe(11 + 2 * hpGainPerLevel(10, 13));
    expect(applyXp(character, -5000).character.xp).toBe(0);
    expect(applyXp(character, -5000).character.level).toBe(3);
  });

  it('enforces perk tier gating and points', () => {
    const tree = normalizePerkTree([
      { id: 'a', tier: 1, name: 'A', description: '', modifiers: { perception: 1, bogus: 4 } },
      { id: 'b', tier: 2, name: 'B', description: '', modifiers: { ac: 9 } },
    ]);
    expect(tree[0].modifiers).toEqual({ perception: 1 });
    expect(tree[1].modifiers).toEqual({ ac: 3 });
    let c = { ...createCharacter({ name: 'M', stats }), customPerkTree: tree };
    expect(perkPointsAvailable(c)).toBe(1);
    expect(canUnlockPerk(c, 'b').ok).toBe(false);
    c = unlockPerk(c, 'a');
    expect(perkPointsAvailable(c)).toBe(0);
    c = { ...c, level: 4 };
    expect(canUnlockPerk(c, 'b').ok).toBe(true);
  });

  it('clones without campaign binding', () => {
    const c = { ...createCharacter({ name: 'M', stats }), id: 'x', activeCampaignId: 'camp' };
    const k = cloneCharacter(c);
    expect(k.id).toBeUndefined();
    expect(k.activeCampaignId).toBeNull();
    expect(k.inventory[0].id).not.toBe(c.inventory[0].id);
  });
});
