import { describe, it, expect } from 'vitest';
import { applyHpChange, resolveDeathSave, rollInitiative, companionAttack, mergeEnemies, scanOptions, ASSUMED_ENEMY_AC } from './combatEngine.js';
import { createCharacter } from './progression.js';
import { buildSkin } from '../config/genreSkins.js';
import { seededRng } from './rng.js';

const vit = (hp = 10, extra = {}) => ({ hp, maxHp: 10, tempHp: 0, ac: 12, speed: 30, deathSaves: { successes: 0, failures: 0 }, conditions: [], ...extra });

describe('HP and death saves', () => {
  it('temp HP absorbs damage first', () => {
    const r = applyHpChange(vit(10, { tempHp: 4 }), -6);
    expect(r.vitals.tempHp).toBe(0);
    expect(r.vitals.hp).toBe(8);
  });

  it('damage at 0 HP adds failures; crits add two', () => {
    expect(applyHpChange(vit(0), -2).vitals.deathSaves.failures).toBe(1);
    expect(applyHpChange(vit(0), -2, { critical: true }).vitals.deathSaves.failures).toBe(2);
    const dead = applyHpChange(vit(0, { deathSaves: { successes: 0, failures: 2 } }), -1);
    expect(dead.died).toBe(true);
  });

  it('healing at 0 HP revives and resets saves', () => {
    const r = applyHpChange(vit(0, { deathSaves: { successes: 1, failures: 2 }, conditions: ['unconscious'] }), 3);
    expect(r.revived).toBe(true);
    expect(r.vitals.hp).toBe(3);
    expect(r.vitals.deathSaves).toEqual({ successes: 0, failures: 0 });
    expect(r.vitals.conditions).not.toContain('unconscious');
  });

  it('resolves death saves per 5e', () => {
    expect(resolveDeathSave(vit(0), 10).outcome).toBe('success');
    expect(resolveDeathSave(vit(0), 9).outcome).toBe('failure');
    expect(resolveDeathSave(vit(0), 1).vitals.deathSaves.failures).toBe(2);
    const nat20 = resolveDeathSave(vit(0, { conditions: ['unconscious'] }), 20);
    expect(nat20.outcome).toBe('revived');
    expect(nat20.vitals.hp).toBe(1);
    const third = resolveDeathSave(vit(0, { deathSaves: { successes: 2, failures: 0 } }), 15, { rng: seededRng('s') });
    expect(third.outcome).toBe('stable');
    expect(third.vitals.hp).toBe(1);
    expect(third.stableHours).toBeGreaterThanOrEqual(1);
    expect(third.stableHours).toBeLessThanOrEqual(4);
    expect(resolveDeathSave(vit(0, { deathSaves: { successes: 0, failures: 2 } }), 5).outcome).toBe('dead');
    expect(resolveDeathSave(vit(0, { deathSaves: { successes: 0, failures: 1 } }), 1).outcome).toBe('dead');
    expect(() => resolveDeathSave(vit(0), 21)).toThrow();
  });
});

describe('combat', () => {
  const hero = createCharacter({ name: 'H', classOrArchetype: 'Fighter', stats: { str: 14, dex: 14, con: 14, int: 10, wis: 12, cha: 10 }, skillProficiencies: ['insight'] });

  it('rolls initiative for everyone, skipping defeated enemies and unrecruited companions', () => {
    const order = rollInitiative({
      character: hero,
      enemies: [{ id: 'a', name: 'A', health_tier: 'Healthy' }, { id: 'b', name: 'B', health_tier: 'Defeated' }],
      companions: [{ id: 'c', name: 'C', isRecruited: true, hp: 5, attackBonus: 4 }, { id: 'd', name: 'D', isRecruited: false }],
      rng: seededRng('i'),
    });
    expect(order.map((o) => o.id).sort()).toEqual(['a', 'c', 'player']);
    for (let i = 1; i < order.length; i++) expect(order[i - 1].initiative).toBeGreaterThanOrEqual(order[i].initiative);
  });

  it('companion attacks use revealed AC or a visible assumed AC', () => {
    const r = companionAttack({ companion: { id: 'c', name: 'C', attackBonus: 5, damageDice: '1d8+3' }, enemy: { id: 'e', name: 'E', inspected: false }, rng: seededRng('x') });
    expect(r.targetAc).toBe(ASSUMED_ENEMY_AC);
    expect(r.acAssumed).toBe(true);
    expect(r.total).toBe(r.natural + 5);
    const known = companionAttack({ companion: { id: 'c', name: 'C', attackBonus: 5, damageDice: '1d8+3' }, enemy: { id: 'e', name: 'E', inspected: true, revealed_ac: 18 }, rng: seededRng('x') });
    expect(known.targetAc).toBe(18);
  });

  it('never loses revealed info when merging', () => {
    const merged = mergeEnemies([{ id: 'e', name: 'E', inspected: true, revealed_ac: 15, revealed_traits: ['t'], distance: 'Near', health_tier: 'Healthy' }], [{ id: 'e', name: 'E', inspected: false, revealed_ac: null, distance: 'Melee', health_tier: 'Injured' }]);
    expect(merged[0]).toMatchObject({ inspected: true, revealed_ac: 15, revealed_traits: ['t'], distance: 'Melee', health_tier: 'Injured' });
  });

  it('offers the better of Insight and the genre lore skill for scans', () => {
    const [best] = scanOptions(hero, buildSkin('fantasy'));
    expect(best.key).toBe('insight');
    expect(best.dc).toBe(12);
  });
});
