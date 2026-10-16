import { describe, it, expect } from 'vitest';
import {
  parseImportFile,
  fromAiConversion,
  characterFromParts,
  matchClass,
  matchSpecies,
  matchSkill,
  matchItem,
  UnrecognizedImportError,
} from './importers.js';
import { exportCharacterBundle } from './exporters.js';
import { startingHp, hpGainPerLevel } from './progression.js';

// Minimal hand-built fixtures in each tool's documented shape.
const DDB = {
  data: {
    name: 'Kethra',
    stats: [
      { id: 1, value: 8 },
      { id: 2, value: 14 },
      { id: 3, value: 13 },
      { id: 4, value: 15 },
      { id: 5, value: 12 },
      { id: 6, value: 10 },
    ],
    bonusStats: [{ id: 4, value: null }],
    overrideStats: [{ id: 1, value: null }],
    race: { fullName: 'High Elf', baseName: 'Elf' },
    classes: [{ level: 5, definition: { name: 'Wizard', hitDice: 6 } }],
    modifiers: {
      race: [{ type: 'bonus', subType: 'dexterity-score', value: 2 }, { type: 'bonus', subType: 'intelligence-score', value: 1 }],
      class: [{ type: 'proficiency', subType: 'arcana' }, { type: 'proficiency', subType: 'investigation' }],
      background: [{ type: 'proficiency', subType: 'sleight-of-hand' }],
    },
    inventory: [{ definition: { name: 'Quarterstaff' }, quantity: 1, equipped: true }, { definition: { name: 'Bag of Holding' }, quantity: 1 }],
    currencies: { gp: 42, sp: 15 },
    notes: { backstory: 'Raised in a library.' },
  },
};

const ROLL20 = {
  schema_version: 2,
  character: {
    name: 'Brakka',
    bio: 'Mercenary.',
    attribs: [
      { name: 'strength', current: '16' },
      { name: 'dexterity', current: '12' },
      { name: 'constitution', current: '15' },
      { name: 'intelligence', current: '8' },
      { name: 'wisdom', current: '11' },
      { name: 'charisma', current: '10' },
      { name: 'class', current: 'Fighter' },
      { name: 'base_level', current: '3' },
      { name: 'race', current: 'Half-Orc' },
      { name: 'hp', current: '999', max: '999' },
      { name: 'ac', current: '25' },
      { name: 'athletics_prof', current: '(@{pb}*@{athletics_type})' },
      { name: 'stealth_prof', current: '0' },
      { name: 'repeating_inventory_-abc_itemname', current: 'Greataxe' },
      { name: 'repeating_inventory_-abc_itemcount', current: '1' },
      { name: 'repeating_inventory_-abc_equipped', current: '1' },
      { name: 'gp', current: '25' },
    ],
  },
};

const GENERIC = { name: 'Vex', class: 'Rogue', race: 'Halfling', level: 2, abilities: { strength: 8, dexterity: 17, constitution: 12, intelligence: 13, wisdom: 10, charisma: 14 }, skills: ['Stealth', 'Sleight of Hand', 'Deception'], inventory: ['Shortsword', { name: 'Dagger', quantity: 2 }], hp: 400 };

const MD_SHEET = `# Mara — Level 3 Human Paladin

**Name:** Mara Vell
**Class:** Paladin
**Race:** Human
HP: 300 · AC: 30

| STR | DEX | CON | INT | WIS | CHA |
|-----|-----|-----|-----|-----|-----|
| 16  | 10  | 14  | 8   | 12  | 15  |

**Skills:** Athletics, Persuasion (+4)

## Inventory
- Longsword
- 2x Javelin
- Lucky coin
`;

const FOUNDRY_JOURNAL = {
  name: 'The Drowned Ferry',
  pages: [
    { name: 'Overview', text: { content: '<p>A river town where the dead sing beneath the water.</p>' } },
    { name: 'The Ferrywoman', text: { content: '<p>Mira knows <b>every</b> current.</p>' } },
  ],
};

const MD_CAMPAIGN = `# Ashfall Valley

## Region
A volcanic valley under permanent ash.

## Factions
- The Ember Choir
- Salt Wardens

## Locations
- Cinder Market

## NPCs
- Old Tamsin, smuggler

## Quests
- Find the lost bellows
`;

describe('name matching', () => {
  it('maps free-form names (and genre reskins) to SRD ids', () => {
    expect(matchClass('Wizard 5')).toBe('wizard');
    expect(matchClass('Fighter (Champion)')).toBe('fighter');
    expect(matchClass('Gunhand')).toBe('fighter');
    expect(matchClass('Accountant')).toBeNull();
    expect(matchSpecies('Half-Elf')).toBe('half_elf');
    expect(matchSpecies('High Elf')).toBe('elf');
    expect(matchSpecies('Lightfoot Halfling')).toBe('halfling');
    expect(matchSkill('Sleight of Hand')).toBe('sleight_of_hand');
    expect(matchSkill('sleight of hand')).toBe('sleight_of_hand');
    expect(matchSkill('Detective Work')).toBe('investigation');
    expect(matchItem('Javelins')).toBe('javelin');
    expect(matchItem('Six-Shooter')).toBe('hand_crossbow');
  });
});

describe('character imports', () => {
  it('reads a D&D Beyond character (with racial bonuses) and recomputes HP', () => {
    const r = parseImportFile(JSON.stringify(DDB), 'kethra.json');
    expect(r).toMatchObject({ kind: 'character', source: 'ddb', sourceLabel: 'D&D Beyond' });
    const c = r.data;
    expect(c.stats).toEqual({ str: 8, dex: 16, con: 13, int: 16, wis: 12, cha: 10 });
    expect(c).toMatchObject({ name: 'Kethra', level: 5, classId: 'wizard', speciesId: 'elf', hitDie: 6 });
    expect(c.skillProficiencies.sort()).toEqual(['arcana', 'investigation', 'sleight_of_hand']);
    expect(c.inventory.map((i) => i.name)).toEqual(['Quarterstaff', 'Bag of Holding']);
    expect(c.inventory[0].equipped).toBe(true);
    expect(c.currency.amount).toBe(43);
    expect(c.backstory).toBe('Raised in a library.');
  });

  it('reads a Roll20 character and ignores its HP and AC', () => {
    const r = parseImportFile(JSON.stringify(ROLL20), 'brakka.json');
    expect(r.source).toBe('roll20');
    const c = r.data;
    expect(c).toMatchObject({ name: 'Brakka', level: 3, classId: 'fighter', speciesId: 'half_orc' });
    expect(c.skillProficiencies).toEqual(['athletics']);
    expect(c.vitals.maxHp).toBe(startingHp(10, 15) + 2 * hpGainPerLevel(10, 15));
    expect(c.vitals.ac).toBe(11);
    expect(c.inventory[0]).toMatchObject({ name: 'Greataxe', equipped: true });
  });

  it('reads generic JSON (e.g. from a chatbot)', () => {
    const r = parseImportFile(JSON.stringify(GENERIC), 'vex.json');
    expect(r.source).toBe('generic');
    expect(r.data).toMatchObject({ name: 'Vex', classId: 'rogue', speciesId: 'halfling', level: 2 });
    expect(r.data.stats.dex).toBe(17);
    expect(r.data.skillProficiencies).toEqual(['stealth', 'sleight_of_hand', 'deception']);
    expect(r.data.inventory.filter((i) => i.name === 'Dagger')).toHaveLength(2);
    expect(r.data.vitals.maxHp).toBeLessThan(400);
  });

  it('reads a Markdown character sheet (table, skills, inventory) in the chosen genre', () => {
    const r = parseImportFile(MD_SHEET, 'mara.md', { genre: 'frontier_noir' });
    expect(r.source).toBe('markdown');
    const c = r.data;
    expect(c).toMatchObject({ name: 'Mara Vell', level: 3, classId: 'paladin', classOrArchetype: 'Lawman', genre: 'frontier_noir' });
    expect(c.stats).toEqual({ str: 16, dex: 10, con: 14, int: 8, wis: 12, cha: 15 });
    expect(c.skillProficiencies).toEqual(['athletics', 'persuasion']);
    expect(c.inventory.map((i) => i.name)).toEqual(['Cavalry Saber', 'Throwing Spike', 'Throwing Spike', 'Lucky coin']);
    expect(c.vitals.maxHp).toBeLessThan(300);
    expect(c.vitals.ac).toBe(10);
  });

  it('still reads native bundles', () => {
    const native = characterFromParts({ name: 'N', stats: { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 } });
    const r = parseImportFile(JSON.stringify(exportCharacterBundle(native)), 'n.json');
    expect(r).toMatchObject({ kind: 'character', source: 'native' });
  });

  it('clamps ability scores and level from any source', () => {
    const c = characterFromParts({ name: 'X', level: 99, stats: { str: 90, dex: -4, con: 'abc' } });
    expect(c.level).toBe(20);
    expect(c.stats).toMatchObject({ str: 30, dex: 1, con: 10 });
  });
});

describe('campaign imports', () => {
  it('turns a Foundry journal into a World Forge seed', () => {
    const r = parseImportFile(JSON.stringify(FOUNDRY_JOURNAL), 'ferry.json');
    expect(r).toMatchObject({ kind: 'worldSeed', source: 'foundry_journal' });
    expect(r.data.title).toBe('The Drowned Ferry');
    expect(r.data.lore).toEqual(['Overview: A river town where the dead sing beneath the water.', 'The Ferrywoman: Mira knows every current.']);
    expect(r.data.prompt).toContain('Drowned Ferry');
  });

  it('turns a Markdown campaign into a World Forge seed', () => {
    const r = parseImportFile(MD_CAMPAIGN, 'ashfall.md');
    expect(r).toMatchObject({ kind: 'worldSeed', source: 'markdown_campaign' });
    expect(r.data.title).toBe('Ashfall Valley');
    expect(r.data.prompt).toContain('volcanic valley');
    expect(r.data.prompt).toContain('Ember Choir');
    expect(r.data.prompt).toContain('Old Tamsin');
    expect(r.data.lore.length).toBeGreaterThan(0);
  });
});

describe('fallbacks', () => {
  it('flags unknown files so the AI converter can be offered', () => {
    expect(() => parseImportFile('Just some notes about my day.', 'notes.txt')).toThrow(UnrecognizedImportError);
    expect(() => parseImportFile('{"hello":1}', 'x.json')).toThrow(UnrecognizedImportError);
    expect(() => parseImportFile('{broken', 'x.json')).toThrow(UnrecognizedImportError);
  });

  it('rebuilds AI-extracted characters through the engine', () => {
    const r = fromAiConversion({ kind: 'character', character: { name: 'Ai', level: 4, className: 'Cleric', speciesName: 'Dwarf', stats: { str: 14, dex: 8, con: 15, int: 10, wis: 16, cha: 12 }, skills: ['Medicine'], inventory: [{ name: 'Mace', quantity: 1 }], currency: 10 } });
    expect(r).toMatchObject({ kind: 'character', source: 'ai' });
    expect(r.data).toMatchObject({ classId: 'cleric', level: 4, hitDie: 8 });
    expect(r.data.vitals.maxHp).toBe(startingHp(8, 15) + 3 * hpGainPerLevel(8, 15));
    const camp = fromAiConversion({ kind: 'campaign', campaign: { title: 'Saltmarsh', summary: 'Smugglers on the coast.', factions: ['Sea Princes'], lore: ['The haunted house is a front.'] } });
    expect(camp.kind).toBe('worldSeed');
    expect(camp.data.prompt).toContain('Sea Princes');
    expect(camp.data.lore).toEqual(['The haunted house is a front.']);
  });
});
