import { describe, it, expect } from 'vitest';
import {
  exportCharacterBundle,
  parseImportJson,
  toFoundryActor,
  fromFoundryActor,
  campaignToMarkdown,
  markdownToLoreEntries,
  exportCampaignBundle,
} from './exporters.js';
import { createCharacter } from './progression.js';

const stats = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };

describe('exporters', () => {
  it('round-trips a native character bundle', () => {
    const c = { ...createCharacter({ name: 'Mara', classOrArchetype: 'Rogue', stats, skillProficiencies: ['stealth'] }), id: 'abc', activeCampaignId: 'x' };
    const parsed = parseImportJson(JSON.stringify(exportCharacterBundle(c)));
    expect(parsed.kind).toBe('character');
    expect(parsed.data.name).toBe('Mara');
    expect(parsed.data.id).toBeUndefined();
    expect(parsed.data.activeCampaignId).toBeNull();
    expect(parsed.data.stats).toEqual(stats);
  });

  it('round-trips through Foundry dnd5e actor JSON', () => {
    const c = createCharacter({ name: 'Mara', classOrArchetype: 'Rogue', stats, skillProficiencies: ['stealth', 'perception'] });
    const actor = toFoundryActor(c);
    expect(actor.system.skills.ste.value).toBe(1);
    expect(actor.system.abilities.dex.value).toBe(14);
    const back = fromFoundryActor(actor);
    expect(back.stats).toEqual(stats);
    expect(back.skillProficiencies.sort()).toEqual(['perception', 'stealth']);
    expect(back.inventory.length).toBe(c.inventory.length);
    expect(back.classOrArchetype).toBe('Rogue');
    expect(parseImportJson(JSON.stringify(actor)).source).toBe('foundry');
  });

  it('imports a plain Foundry actor without native flags', () => {
    const actor = {
      name: 'Thorin',
      type: 'character',
      system: {
        abilities: { str: { value: 16 }, dex: { value: 10 }, con: { value: 14 }, int: { value: 8 }, wis: { value: 12 }, cha: { value: 10 } },
        attributes: { hp: { value: 20, max: 28 }, ac: { flat: 16 } },
        skills: { ath: { value: 1 }, itm: { value: 2 } },
        currency: { gp: 15, sp: 30 },
        details: { xp: { value: 900 } },
      },
      items: [
        { name: 'Fighter', type: 'class', system: { levels: 3, hitDice: 'd10' } },
        { name: 'Warhammer', type: 'weapon', system: { damage: { parts: [['1d8 + @mod', 'bludgeoning']] }, equipped: true } },
        { name: 'Torch', type: 'consumable', system: { quantity: 3 } },
      ],
    };
    const c = fromFoundryActor(actor);
    expect(c.level).toBe(3);
    expect(c.hitDie).toBe(10);
    expect(c.vitals.maxHp).toBe(28);
    expect(c.vitals.hp).toBe(20);
    expect(c.vitals.ac).toBe(16);
    expect(c.currency.amount).toBe(18);
    expect(c.skillProficiencies.sort()).toEqual(['athletics', 'intimidation']);
    expect(c.inventory.filter((i) => i.name === 'Torch').length).toBe(3);
    expect(c.inventory.find((i) => i.name === 'Warhammer').damageDice).toBe('1d8');
  });

  it('rejects unknown formats', () => {
    expect(() => parseImportJson('{"hello":1}')).toThrow();
    expect(() => parseImportJson('not json')).toThrow();
  });

  it('writes a Markdown StoryBook', () => {
    const md = campaignToMarkdown({
      campaign: { meta: { title: 'Ash', genreTheme: 'fantasy' }, quests: [{ title: 'Q', type: 'main', status: 'active', description: 'd' }], lorePinboard: ['Law'] },
      character: createCharacter({ name: 'Mara', stats }),
      diary: [{ index: 0, title: 'Arrival', summary: 'You came.' }],
      turns: [{ index: 1, player: { text: 'Hello' }, ai: { narrative_text: 'Hi.' }, roll: { label: 'Perception', total: 14, dc: 12, success: true } }],
      codex: [{ name: 'Oswin', type: 'npc', summary: 'Innkeeper' }],
    });
    expect(md).toContain('# Ash');
    expect(md).toContain('## Chapter 1: Arrival');
    expect(md).toContain('Perception: 14 vs DC 12 — Success');
    expect(md).toContain('### Oswin');
    expect(md).toContain('- Law');
  });

  it('round-trips a campaign bundle', () => {
    const b = exportCampaignBundle({ campaign: { id: 'c', meta: { title: 'T' } }, character: null, turns: [{ id: 't' }] });
    const parsed = parseImportJson(JSON.stringify(b));
    expect(parsed.kind).toBe('campaign');
    expect(parsed.data.turns).toHaveLength(1);
  });

  it('splits Markdown lore into pinboard entries', () => {
    const entries = markdownToLoreEntries('# Gods\n- **Sol** rules the day\n- Mora rules the night\n\n## Laws\nNo magic in the capital.\nViolators hang.');
    expect(entries).toEqual(['Gods: Sol rules the day', 'Gods: Mora rules the night', 'Laws: No magic in the capital. Violators hang.']);
  });
});
