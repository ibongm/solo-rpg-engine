import { describe, it, expect } from 'vitest';
import { buildAlmanacIndex, searchAlmanac, ALMANAC_TABS } from './almanac.js';

describe('almanac', () => {
  const fantasy = buildAlmanacIndex({ genre: 'fantasy' });

  it('covers rules, origins, gear and every spell level', () => {
    const tabs = new Set(fantasy.map((e) => e.tab));
    for (const t of ['rules', 'origins', 'gear', 'powers']) expect(tabs.has(t)).toBe(true);
    const levels = new Set(fantasy.filter((e) => e.tab === 'powers').map((e) => e.level));
    expect([...levels].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(new Set(fantasy.map((e) => e.id)).size).toBe(fantasy.length);
    expect(ALMANAC_TABS.map((t) => t.id)).toEqual(['rules', 'origins', 'gear', 'powers', 'world']);
  });

  it('speaks the genre: reskinned names, SRD name kept as subtitle, genre currency', () => {
    const apoc = buildAlmanacIndex({ genre: 'post_apoc' });
    const dwarf = apoc.find((e) => e.id === 'species.dwarf');
    expect(dwarf.title).toBe('Homesteader / Prepper');
    expect(dwarf.subtitle).toBe('Hill Dwarf');
    expect(dwarf.body).toContain('Morse & Ham Code');
    const pistol = apoc.find((e) => e.id === 'weapon.hand_crossbow');
    expect(pistol.title).toBe('Pistol');
    expect(pistol.body).toContain('Barter / Ammo');
    expect(fantasy.find((e) => e.id === 'species.dwarf').subtitle).toBeNull();
  });

  it('searches every word across fields and filters by tab', () => {
    const hits = searchAlmanac(fantasy, 'fire save', 'powers').map((e) => e.id);
    expect(hits).toContain('spell.fireball');
    expect(hits.every((id) => id.startsWith('spell.'))).toBe(true);
    expect(searchAlmanac(fantasy, 'PRONE').some((e) => e.id === 'condition.prone')).toBe(true);
    expect(searchAlmanac(fantasy, '', 'rules').length).toBeGreaterThan(10);
    expect(searchAlmanac(fantasy, 'zzzz-no-such-thing')).toEqual([]);
  });

  it('adds the active campaign world, hiding undiscovered places', () => {
    const idx = buildAlmanacIndex({
      genre: 'fantasy',
      world: {
        codex: [{ id: 'mira', type: 'npc', name: 'Mira', summary: 'Ferrywoman who knows the river.', tags: ['river'] }],
        mapNodes: [
          { id: 'a', label: 'Oakford', type: 'town', discovered: true, rumors: ['Wolves on the road'] },
          { id: 'b', label: 'Secret Vault', type: 'dungeon', discovered: false },
        ],
        factions: [{ id: 'f', name: 'River Guild', status: 'Friendly' }],
        lorePinboard: ['The bridge fell in the flood of 1201.'],
      },
    });
    const w = searchAlmanac(idx, '', 'world');
    expect(w.map((e) => e.title)).toEqual(expect.arrayContaining(['Mira', 'Oakford', 'River Guild']));
    expect(w.some((e) => e.title === 'Secret Vault')).toBe(false);
    expect(searchAlmanac(idx, 'wolves', 'world')[0].title).toBe('Oakford');
  });
});
