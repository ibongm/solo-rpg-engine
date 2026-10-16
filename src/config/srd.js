/**
 * D&D 5e character-creation rules data (SRD 5.1).
 *
 * This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by
 * Wizards of the Coast LLC, available at https://dnd.wizards.com/resources/systems-reference-document.
 * The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License,
 * available at https://creativecommons.org/licenses/by/4.0/legalcode.
 * Descriptions here are condensed paraphrases. Backgrounds other than Acolyte are original
 * to this project and follow the same mechanical shape (two skills, tools/languages, gear, coin).
 *
 * Ids are stable and genre-neutral; display names per genre come from srdReskins.js.
 * Costs are in gold pieces (1 gp ≈ 1 unit of the campaign currency).
 */

// ── Weapons ──────────────────────────────────────────────────────

const W = (id, name, category, range, cost, damageDice, damageType, properties = [], extra = {}) => ({
  id,
  name,
  kind: 'weapon',
  category, // 'simple' | 'martial'
  range, // 'melee' | 'ranged'
  cost,
  damageDice,
  damageType,
  properties,
  ...extra,
});

export const WEAPONS = [
  // Simple melee
  W('club', 'Club', 'simple', 'melee', 0.1, '1d4', 'bludgeoning', ['light']),
  W('dagger', 'Dagger', 'simple', 'melee', 2, '1d4', 'piercing', ['finesse', 'light', 'thrown'], { throwRange: '20/60' }),
  W('greatclub', 'Greatclub', 'simple', 'melee', 0.2, '1d8', 'bludgeoning', ['two-handed']),
  W('handaxe', 'Handaxe', 'simple', 'melee', 5, '1d6', 'slashing', ['light', 'thrown'], { throwRange: '20/60' }),
  W('javelin', 'Javelin', 'simple', 'melee', 0.5, '1d6', 'piercing', ['thrown'], { throwRange: '30/120' }),
  W('light_hammer', 'Light Hammer', 'simple', 'melee', 2, '1d4', 'bludgeoning', ['light', 'thrown'], { throwRange: '20/60' }),
  W('mace', 'Mace', 'simple', 'melee', 5, '1d6', 'bludgeoning'),
  W('quarterstaff', 'Quarterstaff', 'simple', 'melee', 0.2, '1d6', 'bludgeoning', ['versatile'], { versatileDice: '1d8' }),
  W('sickle', 'Sickle', 'simple', 'melee', 1, '1d4', 'slashing', ['light']),
  W('spear', 'Spear', 'simple', 'melee', 1, '1d6', 'piercing', ['thrown', 'versatile'], { throwRange: '20/60', versatileDice: '1d8' }),
  // Simple ranged
  W('light_crossbow', 'Light Crossbow', 'simple', 'ranged', 25, '1d8', 'piercing', ['ammunition', 'loading', 'two-handed'], { rangeFt: '80/320', ammo: 'bolts' }),
  W('dart', 'Dart', 'simple', 'ranged', 0.05, '1d4', 'piercing', ['finesse', 'thrown'], { rangeFt: '20/60' }),
  W('shortbow', 'Shortbow', 'simple', 'ranged', 25, '1d6', 'piercing', ['ammunition', 'two-handed'], { rangeFt: '80/320', ammo: 'arrows' }),
  W('sling', 'Sling', 'simple', 'ranged', 0.1, '1d4', 'bludgeoning', ['ammunition'], { rangeFt: '30/120', ammo: 'sling_bullets' }),
  // Martial melee
  W('battleaxe', 'Battleaxe', 'martial', 'melee', 10, '1d8', 'slashing', ['versatile'], { versatileDice: '1d10' }),
  W('flail', 'Flail', 'martial', 'melee', 10, '1d8', 'bludgeoning'),
  W('glaive', 'Glaive', 'martial', 'melee', 20, '1d10', 'slashing', ['heavy', 'reach', 'two-handed']),
  W('greataxe', 'Greataxe', 'martial', 'melee', 30, '1d12', 'slashing', ['heavy', 'two-handed']),
  W('greatsword', 'Greatsword', 'martial', 'melee', 50, '2d6', 'slashing', ['heavy', 'two-handed']),
  W('halberd', 'Halberd', 'martial', 'melee', 20, '1d10', 'slashing', ['heavy', 'reach', 'two-handed']),
  W('lance', 'Lance', 'martial', 'melee', 10, '1d12', 'piercing', ['reach', 'special']),
  W('longsword', 'Longsword', 'martial', 'melee', 15, '1d8', 'slashing', ['versatile'], { versatileDice: '1d10' }),
  W('maul', 'Maul', 'martial', 'melee', 10, '2d6', 'bludgeoning', ['heavy', 'two-handed']),
  W('morningstar', 'Morningstar', 'martial', 'melee', 15, '1d8', 'piercing'),
  W('pike', 'Pike', 'martial', 'melee', 5, '1d10', 'piercing', ['heavy', 'reach', 'two-handed']),
  W('rapier', 'Rapier', 'martial', 'melee', 25, '1d8', 'piercing', ['finesse']),
  W('scimitar', 'Scimitar', 'martial', 'melee', 25, '1d6', 'slashing', ['finesse', 'light']),
  W('shortsword', 'Shortsword', 'martial', 'melee', 10, '1d6', 'piercing', ['finesse', 'light']),
  W('trident', 'Trident', 'martial', 'melee', 5, '1d6', 'piercing', ['thrown', 'versatile'], { throwRange: '20/60', versatileDice: '1d8' }),
  W('war_pick', 'War Pick', 'martial', 'melee', 5, '1d8', 'piercing'),
  W('warhammer', 'Warhammer', 'martial', 'melee', 15, '1d8', 'bludgeoning', ['versatile'], { versatileDice: '1d10' }),
  W('whip', 'Whip', 'martial', 'melee', 2, '1d4', 'slashing', ['finesse', 'reach']),
  // Martial ranged
  W('blowgun', 'Blowgun', 'martial', 'ranged', 10, '1', 'piercing', ['ammunition', 'loading'], { rangeFt: '25/100', ammo: 'needles' }),
  W('hand_crossbow', 'Hand Crossbow', 'martial', 'ranged', 75, '1d6', 'piercing', ['ammunition', 'light', 'loading'], { rangeFt: '30/120', ammo: 'bolts' }),
  W('heavy_crossbow', 'Heavy Crossbow', 'martial', 'ranged', 50, '1d10', 'piercing', ['ammunition', 'heavy', 'loading', 'two-handed'], { rangeFt: '100/400', ammo: 'bolts' }),
  W('longbow', 'Longbow', 'martial', 'ranged', 50, '1d8', 'piercing', ['ammunition', 'heavy', 'two-handed'], { rangeFt: '150/600', ammo: 'arrows' }),
  W('net', 'Net', 'martial', 'ranged', 1, null, null, ['special', 'thrown'], { rangeFt: '5/15' }),
];

// ── Armor ────────────────────────────────────────────────────────

const A = (id, name, armorCategory, cost, baseAc, dexCap, strReq = 0, stealthDisadvantage = false) => ({
  id,
  name,
  kind: 'armor',
  armorCategory, // 'light' | 'medium' | 'heavy' | 'shield'
  cost,
  baseAc,
  dexCap, // null = full Dex, 2 = max +2, 0 = no Dex
  strReq,
  stealthDisadvantage,
});

export const ARMOR = [
  A('padded', 'Padded Armor', 'light', 5, 11, null, 0, true),
  A('leather', 'Leather Armor', 'light', 10, 11, null),
  A('studded_leather', 'Studded Leather', 'light', 45, 12, null),
  A('hide', 'Hide Armor', 'medium', 10, 12, 2),
  A('chain_shirt', 'Chain Shirt', 'medium', 50, 13, 2),
  A('scale_mail', 'Scale Mail', 'medium', 50, 14, 2, 0, true),
  A('breastplate', 'Breastplate', 'medium', 400, 14, 2),
  A('half_plate', 'Half Plate', 'medium', 750, 15, 2, 0, true),
  A('ring_mail', 'Ring Mail', 'heavy', 30, 14, 0, 0, true),
  A('chain_mail', 'Chain Mail', 'heavy', 75, 16, 0, 13, true),
  A('splint', 'Splint Armor', 'heavy', 200, 17, 0, 15, true),
  A('plate', 'Plate Armor', 'heavy', 1500, 18, 0, 15, true),
  A('shield', 'Shield', 'shield', 10, 2, 0),
];

// ── Gear ─────────────────────────────────────────────────────────

const G = (id, name, cost, extra = {}) => ({ id, name, kind: 'gear', cost, ...extra });

export const GEAR = [
  // Packs (rations: how many day-rations the pack contributes to the inventory)
  G('burglars_pack', "Burglar's Pack", 16, { pack: true, rations: 5, contents: 'Backpack, ball bearings, string, bell, candles, crowbar, hammer, pitons, hooded lantern, oil, rations, tinderbox, waterskin, 50 ft rope' }),
  G('diplomats_pack', "Diplomat's Pack", 39, { pack: true, rations: 0, contents: 'Chest, map/scroll cases, fine clothes, ink and pen, lamp, oil, paper, perfume, sealing wax, soap' }),
  G('dungeoneers_pack', "Dungeoneer's Pack", 12, { pack: true, rations: 10, contents: 'Backpack, crowbar, hammer, pitons, torches, tinderbox, rations, waterskin, 50 ft rope' }),
  G('entertainers_pack', "Entertainer's Pack", 40, { pack: true, rations: 5, contents: 'Backpack, bedroll, costumes, candles, rations, waterskin, disguise kit' }),
  G('explorers_pack', "Explorer's Pack", 10, { pack: true, rations: 10, contents: 'Backpack, bedroll, mess kit, tinderbox, torches, rations, waterskin, 50 ft rope' }),
  G('priests_pack', "Priest's Pack", 19, { pack: true, rations: 2, contents: 'Backpack, blanket, candles, tinderbox, alms box, incense, censer, vestments, rations, waterskin' }),
  G('scholars_pack', "Scholar's Pack", 40, { pack: true, rations: 0, contents: 'Backpack, book of lore, ink and pen, parchment, bag of sand, small knife' }),
  // Ammunition
  G('arrows', 'Arrows (20)', 1, { ammo: 'arrows' }),
  G('bolts', 'Crossbow Bolts (20)', 1, { ammo: 'bolts' }),
  G('sling_bullets', 'Sling Bullets (20)', 0.04, { ammo: 'sling_bullets' }),
  G('needles', 'Blowgun Needles (50)', 1, { ammo: 'needles' }),
  // Spellcasting & class tools
  G('component_pouch', 'Component Pouch', 25, { focus: true }),
  G('arcane_focus', 'Arcane Focus', 10, { focus: true }),
  G('druidic_focus', 'Druidic Focus', 1, { focus: true }),
  G('holy_symbol', 'Holy Symbol', 5, { focus: true }),
  G('spellbook', 'Spellbook', 50),
  G('thieves_tools', "Thieves' Tools", 25, { tool: true }),
  G('lute', 'Lute', 35, { instrument: true }),
  G('flute', 'Flute', 2, { instrument: true }),
  G('drum', 'Drum', 6, { instrument: true }),
  G('lyre', 'Lyre', 30, { instrument: true }),
  G('herbalism_kit', 'Herbalism Kit', 5, { tool: true }),
  G('disguise_kit', 'Disguise Kit', 25, { tool: true }),
  G('forgery_kit', 'Forgery Kit', 15, { tool: true }),
  G('healers_kit', "Healer's Kit", 5, { tool: true }),
  G('tinkers_tools', "Tinker's Tools", 50, { tool: true }),
  G('smiths_tools', "Smith's Tools", 20, { tool: true }),
  G('gaming_set', 'Gaming Set (dice)', 0.1, { tool: true }),
  // Adventuring basics
  G('rations', 'Rations (1 day)', 0.5, { ration: true }),
  G('potion_healing', 'Potion of Healing', 50, { heal: '2d4+2' }),
  G('antitoxin', 'Antitoxin', 50, { antidote: true }),
  G('rope', 'Hempen Rope (50 ft)', 1),
  G('torch', 'Torch', 0.01),
  G('lantern', 'Hooded Lantern', 5),
  G('crowbar', 'Crowbar', 2),
  G('bedroll', 'Bedroll', 1),
  G('waterskin', 'Waterskin', 0.2),
  G('clothes_common', 'Common Clothes', 0.5),
  G('clothes_fine', 'Fine Clothes', 15),
  G('prayer_book', 'Prayer Book', 25),
  G('incense', 'Incense (5 sticks)', 0.05),
  G('vestments', 'Vestments', 1),
  G('ink_quill', 'Ink, Quill & Parchment', 10),
  G('trinket', 'Keepsake Trinket', 0.1),
];

export const ITEMS = Object.fromEntries([...WEAPONS, ...ARMOR, ...GEAR].map((i) => [i.id, i]));

export const INSTRUMENT_IDS = GEAR.filter((g) => g.instrument).map((g) => g.id);

/** Weapon/item filters used by "any …" equipment choices. */
export const ITEM_FILTERS = {
  simple: (i) => i.kind === 'weapon' && i.category === 'simple',
  simple_melee: (i) => i.kind === 'weapon' && i.category === 'simple' && i.range === 'melee',
  martial: (i) => i.kind === 'weapon' && i.category === 'martial',
  martial_melee: (i) => i.kind === 'weapon' && i.category === 'martial' && i.range === 'melee',
  instrument: (i) => Boolean(i.instrument),
};

export const ANY_LABELS = {
  simple: 'any simple weapon',
  simple_melee: 'any simple melee weapon',
  martial: 'any martial weapon',
  martial_melee: 'any martial melee weapon',
  instrument: 'any musical instrument',
};

// ── Species ──────────────────────────────────────────────────────

export const SPECIES = [
  {
    id: 'dwarf',
    name: 'Hill Dwarf',
    abilityBonuses: { con: 2, wis: 1 },
    size: 'medium',
    speed: 25,
    darkvision: 60,
    languages: ['Common', 'Dwarvish'],
    weaponProficiencies: ['battleaxe', 'handaxe', 'light_hammer', 'warhammer'],
    toolChoice: ['smiths_tools', "Brewer's Supplies", "Mason's Tools"],
    hpBonusPerLevel: 1,
    ignoresHeavyArmorSpeed: true,
    traits: [
      ['Darkvision', 'See in dim light within 60 ft as if bright, and in darkness as if dim.'],
      ['Dwarven Resilience', 'Advantage on saves against poison and resistance to poison damage.'],
      ['Dwarven Combat Training', 'Proficient with battleaxe, handaxe, light hammer and warhammer.'],
      ['Stonecunning', 'Double proficiency on History checks about stonework.'],
      ['Dwarven Toughness', '+1 hit point per level.'],
      ['Steady Gait', 'Heavy armor never slows you.'],
    ],
  },
  {
    id: 'elf',
    name: 'High Elf',
    abilityBonuses: { dex: 2, int: 1 },
    size: 'medium',
    speed: 30,
    darkvision: 60,
    languages: ['Common', 'Elvish'],
    extraLanguages: 1,
    skills: ['perception'],
    weaponProficiencies: ['longsword', 'shortsword', 'shortbow', 'longbow'],
    bonusCantrip: { list: 'wizard', ability: 'int' },
    traits: [
      ['Darkvision', 'See in dim light within 60 ft as if bright, and in darkness as if dim.'],
      ['Keen Senses', 'Proficient in Perception.'],
      ['Fey Ancestry', 'Advantage on saves against being charmed; magic cannot put you to sleep.'],
      ['Trance', 'Four hours of meditation give you the benefit of a long rest.'],
      ['Elf Weapon Training', 'Proficient with longsword, shortsword, shortbow and longbow.'],
      ['Cantrip', 'You know one wizard cantrip (Intelligence).'],
    ],
  },
  {
    id: 'halfling',
    name: 'Lightfoot Halfling',
    abilityBonuses: { dex: 2, cha: 1 },
    size: 'small',
    speed: 25,
    darkvision: 0,
    languages: ['Common', 'Halfling'],
    traits: [
      ['Lucky', 'When you roll a natural 1 on an attack, check or save, you may reroll it.'],
      ['Brave', 'Advantage on saves against being frightened.'],
      ['Halfling Nimbleness', 'Move through the space of any creature larger than you.'],
      ['Naturally Stealthy', 'You can hide behind a creature at least one size larger than you.'],
    ],
  },
  {
    id: 'human',
    name: 'Human',
    abilityBonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    size: 'medium',
    speed: 30,
    darkvision: 0,
    languages: ['Common'],
    extraLanguages: 1,
    traits: [['Versatile', '+1 to every ability score and one extra language.']],
  },
  {
    id: 'dragonborn',
    name: 'Dragonborn',
    abilityBonuses: { str: 2, cha: 1 },
    size: 'medium',
    speed: 30,
    darkvision: 0,
    languages: ['Common', 'Draconic'],
    ancestryChoice: true,
    traits: [
      ['Draconic Ancestry', 'Your ancestry sets your breath weapon and resistance damage type.'],
      ['Breath Weapon', 'Exhale destructive energy: 2d6 damage, save DC 8 + Con mod + proficiency; once per short rest.'],
      ['Damage Resistance', 'Resistance to your ancestry’s damage type.'],
    ],
  },
  {
    id: 'gnome',
    name: 'Rock Gnome',
    abilityBonuses: { int: 2, con: 1 },
    size: 'small',
    speed: 25,
    darkvision: 60,
    languages: ['Common', 'Gnomish'],
    tools: ['tinkers_tools'],
    traits: [
      ['Darkvision', 'See in dim light within 60 ft as if bright, and in darkness as if dim.'],
      ['Gnome Cunning', 'Advantage on Intelligence, Wisdom and Charisma saves against magic.'],
      ["Artificer's Lore", 'Double proficiency on History checks about magic items and devices.'],
      ['Tinker', "Proficient with tinker's tools; build small clockwork gadgets."],
    ],
  },
  {
    id: 'half_elf',
    name: 'Half-Elf',
    abilityBonuses: { cha: 2 },
    flexibleBonuses: { count: 2, amount: 1, exclude: ['cha'] },
    size: 'medium',
    speed: 30,
    darkvision: 60,
    languages: ['Common', 'Elvish'],
    extraLanguages: 1,
    skillChoices: 2,
    traits: [
      ['Darkvision', 'See in dim light within 60 ft as if bright, and in darkness as if dim.'],
      ['Fey Ancestry', 'Advantage on saves against being charmed; magic cannot put you to sleep.'],
      ['Skill Versatility', 'Proficiency in two skills of your choice.'],
    ],
  },
  {
    id: 'half_orc',
    name: 'Half-Orc',
    abilityBonuses: { str: 2, con: 1 },
    size: 'medium',
    speed: 30,
    darkvision: 60,
    languages: ['Common', 'Orc'],
    skills: ['intimidation'],
    traits: [
      ['Darkvision', 'See in dim light within 60 ft as if bright, and in darkness as if dim.'],
      ['Menacing', 'Proficient in Intimidation.'],
      ['Relentless Endurance', 'Once per long rest, drop to 1 HP instead of 0.'],
      ['Savage Attacks', 'On a melee critical hit, roll one weapon damage die again and add it.'],
    ],
  },
  {
    id: 'tiefling',
    name: 'Tiefling',
    abilityBonuses: { cha: 2, int: 1 },
    size: 'medium',
    speed: 30,
    darkvision: 60,
    languages: ['Common', 'Infernal'],
    bonusCantrip: { fixed: 'thaumaturgy', ability: 'cha' },
    traits: [
      ['Darkvision', 'See in dim light within 60 ft as if bright, and in darkness as if dim.'],
      ['Hellish Resistance', 'Resistance to fire damage.'],
      ['Infernal Legacy', 'You know the thaumaturgy cantrip (Charisma).'],
    ],
  },
];

export const DRAGON_ANCESTRIES = [
  { id: 'black', name: 'Black', damage: 'acid' },
  { id: 'blue', name: 'Blue', damage: 'lightning' },
  { id: 'brass', name: 'Brass', damage: 'fire' },
  { id: 'bronze', name: 'Bronze', damage: 'lightning' },
  { id: 'copper', name: 'Copper', damage: 'acid' },
  { id: 'gold', name: 'Gold', damage: 'fire' },
  { id: 'green', name: 'Green', damage: 'poison' },
  { id: 'red', name: 'Red', damage: 'fire' },
  { id: 'silver', name: 'Silver', damage: 'cold' },
  { id: 'white', name: 'White', damage: 'cold' },
];

export const LANGUAGES = ['Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Orc', 'Abyssal', 'Celestial', 'Draconic', 'Deep Speech', 'Infernal', 'Primordial', 'Sylvan', 'Undercommon'];

// ── Classes ──────────────────────────────────────────────────────

const ALL_SKILLS = 'any';

/**
 * equipment: ordered list of groups. A group is either { items: [...] } (always granted) or
 * { choose: [[...], [...]] } (pick one option). Item refs: { id, qty } or { any: filterKey, qty },
 * optionally { requires: 'heavy' | weaponId } meaning the option needs that proficiency.
 */
export const CLASSES = [
  {
    id: 'barbarian',
    name: 'Barbarian',
    hitDie: 12,
    savingThrows: ['str', 'con'],
    armor: ['light', 'medium', 'shield'],
    weapons: ['simple', 'martial'],
    skillCount: 2,
    skillList: ['animal_handling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'],
    unarmoredDefense: 'con',
    startingWealth: { dice: '2d4', multiplier: 10 },
    primary: ['str', 'con'],
    equipment: [
      { choose: [[{ id: 'greataxe' }], [{ any: 'martial_melee' }]] },
      { choose: [[{ id: 'handaxe', qty: 2 }], [{ any: 'simple' }]] },
      { items: [{ id: 'explorers_pack' }, { id: 'javelin', qty: 4 }] },
    ],
    features: [
      ['Rage', 'Bonus action, 2 per long rest: +2 melee damage with Strength, advantage on Strength checks and saves, resistance to bludgeoning, piercing and slashing damage for 1 minute.'],
      ['Unarmored Defense', 'Without armor, AC = 10 + Dex mod + Con mod (a shield still adds).'],
    ],
  },
  {
    id: 'bard',
    name: 'Bard',
    hitDie: 8,
    savingThrows: ['dex', 'cha'],
    armor: ['light'],
    weapons: ['simple', 'hand_crossbow', 'longsword', 'rapier', 'shortsword'],
    tools: ['Three musical instruments'],
    skillCount: 3,
    skillList: ALL_SKILLS,
    startingWealth: { dice: '5d4', multiplier: 10 },
    primary: ['cha', 'dex'],
    spellcasting: { ability: 'cha', list: 'bard', cantrips: 2, known: 4, slots: [2] },
    equipment: [
      { choose: [[{ id: 'rapier' }], [{ id: 'longsword' }], [{ any: 'simple' }]] },
      { choose: [[{ id: 'diplomats_pack' }], [{ id: 'entertainers_pack' }]] },
      { choose: [[{ id: 'lute' }], [{ any: 'instrument' }]] },
      { items: [{ id: 'leather' }, { id: 'dagger' }] },
    ],
    features: [
      ['Spellcasting', 'Charisma-based caster: 2 cantrips, 4 spells known, two 1st-level slots.'],
      ['Bardic Inspiration', 'Bonus action: give an ally a d6 to add to one roll. Uses = Cha mod per long rest.'],
    ],
  },
  {
    id: 'cleric',
    name: 'Cleric',
    subclass: 'Life Domain',
    hitDie: 8,
    savingThrows: ['wis', 'cha'],
    armor: ['light', 'medium', 'heavy', 'shield'],
    weapons: ['simple'],
    skillCount: 2,
    skillList: ['history', 'insight', 'medicine', 'persuasion', 'religion'],
    startingWealth: { dice: '5d4', multiplier: 10 },
    primary: ['wis', 'con'],
    spellcasting: { ability: 'wis', list: 'cleric', cantrips: 3, prepared: true, slots: [2], alwaysPrepared: ['bless', 'cure_wounds'] },
    equipment: [
      { choose: [[{ id: 'mace' }], [{ id: 'warhammer', requires: 'warhammer' }]] },
      { choose: [[{ id: 'scale_mail' }], [{ id: 'leather' }], [{ id: 'chain_mail', requires: 'heavy' }]] },
      { choose: [[{ id: 'light_crossbow' }, { id: 'bolts' }], [{ any: 'simple' }]] },
      { choose: [[{ id: 'priests_pack' }], [{ id: 'explorers_pack' }]] },
      { items: [{ id: 'shield' }, { id: 'holy_symbol' }] },
    ],
    features: [
      ['Spellcasting', 'Wisdom-based caster: 3 cantrips, prepare Wis mod + level spells, two 1st-level slots.'],
      ['Divine Domain: Life', 'Bonus proficiency with heavy armor. Bless and Cure Wounds are always prepared.'],
      ['Disciple of Life', 'Healing spells restore an extra 2 + the spell’s level hit points.'],
    ],
  },
  {
    id: 'druid',
    name: 'Druid',
    hitDie: 8,
    savingThrows: ['int', 'wis'],
    armor: ['light', 'medium', 'shield'],
    weapons: ['club', 'dagger', 'dart', 'javelin', 'mace', 'quarterstaff', 'scimitar', 'sickle', 'sling', 'spear'],
    tools: ['herbalism_kit'],
    skillCount: 2,
    skillList: ['arcana', 'animal_handling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'],
    startingWealth: { dice: '2d4', multiplier: 10 },
    primary: ['wis', 'con'],
    spellcasting: { ability: 'wis', list: 'druid', cantrips: 2, prepared: true, slots: [2] },
    equipment: [
      { choose: [[{ id: 'shield' }], [{ any: 'simple' }]] },
      { choose: [[{ id: 'scimitar' }], [{ any: 'simple_melee' }]] },
      { items: [{ id: 'leather' }, { id: 'explorers_pack' }, { id: 'druidic_focus' }] },
    ],
    features: [
      ['Druidic', 'You know the secret language of druids.'],
      ['Spellcasting', 'Wisdom-based caster: 2 cantrips, prepare Wis mod + level spells, two 1st-level slots. Druids avoid metal armor and shields.'],
    ],
  },
  {
    id: 'fighter',
    name: 'Fighter',
    hitDie: 10,
    savingThrows: ['str', 'con'],
    armor: ['light', 'medium', 'heavy', 'shield'],
    weapons: ['simple', 'martial'],
    skillCount: 2,
    skillList: ['acrobatics', 'animal_handling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'],
    startingWealth: { dice: '5d4', multiplier: 10 },
    primary: ['str', 'con'],
    fightingStyle: true,
    equipment: [
      { choose: [[{ id: 'chain_mail' }], [{ id: 'leather' }, { id: 'longbow' }, { id: 'arrows' }]] },
      { choose: [[{ any: 'martial' }, { id: 'shield' }], [{ any: 'martial', qty: 2 }]] },
      { choose: [[{ id: 'light_crossbow' }, { id: 'bolts' }], [{ id: 'handaxe', qty: 2 }]] },
      { choose: [[{ id: 'dungeoneers_pack' }], [{ id: 'explorers_pack' }]] },
    ],
    features: [
      ['Fighting Style', 'A combat specialty (chosen below).'],
      ['Second Wind', 'Bonus action, once per short rest: regain 1d10 + fighter level HP.'],
    ],
  },
  {
    id: 'monk',
    name: 'Monk',
    hitDie: 8,
    savingThrows: ['str', 'dex'],
    armor: [],
    weapons: ['simple', 'shortsword'],
    tools: ["One artisan's tool or musical instrument"],
    skillCount: 2,
    skillList: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'],
    unarmoredDefense: 'wis',
    martialArts: true,
    startingWealth: { dice: '5d4', multiplier: 1 },
    primary: ['dex', 'wis'],
    equipment: [
      { choose: [[{ id: 'shortsword' }], [{ any: 'simple' }]] },
      { choose: [[{ id: 'dungeoneers_pack' }], [{ id: 'explorers_pack' }]] },
      { items: [{ id: 'dart', qty: 10 }] },
    ],
    features: [
      ['Unarmored Defense', 'Without armor or shield, AC = 10 + Dex mod + Wis mod.'],
      ['Martial Arts', 'With unarmed strikes and monk weapons (shortsword, simple melee without two-handed/heavy): use Dex if higher, unarmed strikes deal 1d4, and make one unarmed strike as a bonus action.'],
    ],
  },
  {
    id: 'paladin',
    name: 'Paladin',
    hitDie: 10,
    savingThrows: ['wis', 'cha'],
    armor: ['light', 'medium', 'heavy', 'shield'],
    weapons: ['simple', 'martial'],
    skillCount: 2,
    skillList: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'],
    startingWealth: { dice: '5d4', multiplier: 10 },
    primary: ['str', 'cha'],
    equipment: [
      { choose: [[{ any: 'martial' }, { id: 'shield' }], [{ any: 'martial', qty: 2 }]] },
      { choose: [[{ id: 'javelin', qty: 5 }], [{ any: 'simple_melee' }]] },
      { choose: [[{ id: 'priests_pack' }], [{ id: 'explorers_pack' }]] },
      { items: [{ id: 'chain_mail' }, { id: 'holy_symbol' }] },
    ],
    features: [
      ['Divine Sense', 'Action, 1 + Cha mod times per long rest: sense celestials, fiends and undead within 60 ft.'],
      ['Lay on Hands', 'A pool of 5 × level HP of healing per long rest; 5 points cure a disease or poison.'],
    ],
  },
  {
    id: 'ranger',
    name: 'Ranger',
    hitDie: 10,
    savingThrows: ['str', 'dex'],
    armor: ['light', 'medium', 'shield'],
    weapons: ['simple', 'martial'],
    skillCount: 3,
    skillList: ['animal_handling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'],
    startingWealth: { dice: '5d4', multiplier: 10 },
    primary: ['dex', 'wis'],
    equipment: [
      { choose: [[{ id: 'scale_mail' }], [{ id: 'leather' }]] },
      { choose: [[{ id: 'shortsword', qty: 2 }], [{ any: 'simple_melee', qty: 2 }]] },
      { choose: [[{ id: 'dungeoneers_pack' }], [{ id: 'explorers_pack' }]] },
      { items: [{ id: 'longbow' }, { id: 'arrows' }] },
    ],
    features: [
      ['Favored Enemy', 'Advantage on Survival checks to track, and Intelligence checks to recall information, about one chosen enemy type; learn one of their languages.'],
      ['Natural Explorer', 'In one favored terrain: double proficiency on related Int/Wis checks, difficult terrain does not slow your group, and you forage and track expertly.'],
    ],
  },
  {
    id: 'rogue',
    name: 'Rogue',
    hitDie: 8,
    savingThrows: ['dex', 'int'],
    armor: ['light'],
    weapons: ['simple', 'hand_crossbow', 'longsword', 'rapier', 'shortsword'],
    tools: ['thieves_tools'],
    skillCount: 4,
    skillList: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleight_of_hand', 'stealth'],
    expertise: 2,
    startingWealth: { dice: '4d4', multiplier: 10 },
    primary: ['dex', 'int'],
    equipment: [
      { choose: [[{ id: 'rapier' }], [{ id: 'shortsword' }]] },
      { choose: [[{ id: 'shortbow' }, { id: 'arrows' }], [{ id: 'shortsword' }]] },
      { choose: [[{ id: 'burglars_pack' }], [{ id: 'dungeoneers_pack' }], [{ id: 'explorers_pack' }]] },
      { items: [{ id: 'leather' }, { id: 'dagger', qty: 2 }, { id: 'thieves_tools' }] },
    ],
    features: [
      ['Expertise', 'Double proficiency bonus in two chosen proficient skills.'],
      ['Sneak Attack', 'Once per turn, +1d6 damage with a finesse or ranged weapon when you have advantage or an ally is next to the target.'],
      ["Thieves' Cant", 'A secret mix of jargon and signs known to rogues.'],
    ],
  },
  {
    id: 'sorcerer',
    name: 'Sorcerer',
    subclass: 'Draconic Bloodline',
    hitDie: 6,
    savingThrows: ['con', 'cha'],
    armor: [],
    weapons: ['dagger', 'dart', 'sling', 'quarterstaff', 'light_crossbow'],
    skillCount: 2,
    skillList: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'],
    hpBonusPerLevel: 1,
    unarmoredDefense: 'draconic',
    extraLanguages: ['Draconic'],
    startingWealth: { dice: '3d4', multiplier: 10 },
    primary: ['cha', 'con'],
    spellcasting: { ability: 'cha', list: 'sorcerer', cantrips: 4, known: 2, slots: [2] },
    equipment: [
      { choose: [[{ id: 'light_crossbow' }, { id: 'bolts' }], [{ any: 'simple' }]] },
      { choose: [[{ id: 'component_pouch' }], [{ id: 'arcane_focus' }]] },
      { choose: [[{ id: 'dungeoneers_pack' }], [{ id: 'explorers_pack' }]] },
      { items: [{ id: 'dagger', qty: 2 }] },
    ],
    features: [
      ['Spellcasting', 'Charisma-based caster: 4 cantrips, 2 spells known, two 1st-level slots.'],
      ['Draconic Bloodline', 'You speak Draconic and gain +1 hit point per level.'],
      ['Draconic Resilience', 'Without armor, AC = 13 + Dex mod.'],
    ],
  },
  {
    id: 'warlock',
    name: 'Warlock',
    subclass: 'The Fiend',
    hitDie: 8,
    savingThrows: ['wis', 'cha'],
    armor: ['light'],
    weapons: ['simple'],
    skillCount: 2,
    skillList: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'],
    startingWealth: { dice: '4d4', multiplier: 10 },
    primary: ['cha', 'con'],
    spellcasting: { ability: 'cha', list: 'warlock', cantrips: 2, known: 2, slots: [1], pact: true },
    equipment: [
      { choose: [[{ id: 'light_crossbow' }, { id: 'bolts' }], [{ any: 'simple' }]] },
      { choose: [[{ id: 'component_pouch' }], [{ id: 'arcane_focus' }]] },
      { choose: [[{ id: 'scholars_pack' }], [{ id: 'dungeoneers_pack' }]] },
      { items: [{ id: 'leather' }, { any: 'simple' }, { id: 'dagger', qty: 2 }] },
    ],
    features: [
      ['Otherworldly Patron: The Fiend', 'Dark One’s Blessing: when you drop a hostile creature to 0 HP, gain temporary HP equal to Cha mod + warlock level.'],
      ['Pact Magic', 'Charisma-based caster: 2 cantrips, 2 spells known, one slot that returns on a short rest.'],
    ],
  },
  {
    id: 'wizard',
    name: 'Wizard',
    hitDie: 6,
    savingThrows: ['int', 'wis'],
    armor: [],
    weapons: ['dagger', 'dart', 'sling', 'quarterstaff', 'light_crossbow'],
    skillCount: 2,
    skillList: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'],
    startingWealth: { dice: '4d4', multiplier: 10 },
    primary: ['int', 'con'],
    spellcasting: { ability: 'int', list: 'wizard', cantrips: 3, spellbook: 6, prepared: true, slots: [2] },
    equipment: [
      { choose: [[{ id: 'quarterstaff' }], [{ id: 'dagger' }]] },
      { choose: [[{ id: 'component_pouch' }], [{ id: 'arcane_focus' }]] },
      { choose: [[{ id: 'scholars_pack' }], [{ id: 'explorers_pack' }]] },
      { items: [{ id: 'spellbook' }] },
    ],
    features: [
      ['Spellcasting', 'Intelligence-based caster: 3 cantrips, a spellbook of six 1st-level spells, prepare Int mod + level, two 1st-level slots.'],
      ['Arcane Recovery', 'Once per day after a short rest, recover expended slots totalling up to half your wizard level (rounded up).'],
    ],
  },
];

export const FIGHTING_STYLES = [
  { id: 'archery', name: 'Archery', text: '+2 to attack rolls with ranged weapons.' },
  { id: 'defense', name: 'Defense', text: '+1 AC while wearing armor.' },
  { id: 'dueling', name: 'Dueling', text: '+2 damage with a one-handed melee weapon and no other weapon.' },
  { id: 'great_weapon', name: 'Great Weapon Fighting', text: 'Reroll 1s and 2s on damage dice with two-handed or versatile melee weapons held in two hands.' },
  { id: 'protection', name: 'Protection', text: 'With a shield, impose disadvantage on an attack against an adjacent ally (reaction).' },
  { id: 'two_weapon', name: 'Two-Weapon Fighting', text: 'Add your ability modifier to the damage of your off-hand attack.' },
];

// ── Backgrounds ──────────────────────────────────────────────────

/** skills: fixed pair (null = choose any 2). tools/languages: proficiencies granted. gold: starting coin. */
export const BACKGROUNDS = [
  {
    id: 'acolyte',
    name: 'Acolyte',
    skills: ['insight', 'religion'],
    extraLanguages: 2,
    tools: [],
    equipment: [{ id: 'holy_symbol' }, { id: 'prayer_book' }, { id: 'incense' }, { id: 'vestments' }, { id: 'clothes_common' }],
    gold: 15,
    feature: ['Shelter of the Faithful', 'Temples of your faith will shelter and aid you and your companions.'],
  },
  {
    id: 'veteran',
    name: 'Veteran',
    skills: ['athletics', 'intimidation'],
    tools: ['gaming_set', 'Land vehicles'],
    equipment: [{ id: 'trinket' }, { id: 'gaming_set' }, { id: 'clothes_common' }],
    gold: 10,
    feature: ['Old Rank', 'Former comrades and soldiers of your old outfit recognize your authority.'],
  },
  {
    id: 'urchin',
    name: 'Street Rat',
    skills: ['sleight_of_hand', 'stealth'],
    tools: ['disguise_kit', 'thieves_tools'],
    equipment: [{ id: 'trinket' }, { id: 'clothes_common' }],
    gold: 10,
    feature: ['Back Alleys', 'You know the hidden routes through any settlement and travel them twice as fast.'],
  },
  {
    id: 'scholar',
    name: 'Scholar',
    skills: ['arcana', 'history'],
    extraLanguages: 2,
    tools: [],
    equipment: [{ id: 'ink_quill' }, { id: 'clothes_common' }],
    gold: 10,
    feature: ['Researcher', 'If you do not know a piece of lore, you usually know where to find it.'],
  },
  {
    id: 'wanderer',
    name: 'Wanderer',
    skills: ['athletics', 'survival'],
    extraLanguages: 1,
    tools: ['One musical instrument'],
    equipment: [{ id: 'trinket' }, { id: 'clothes_common' }],
    gold: 10,
    feature: ['Wayfinder', 'You never get lost and can find food and water for yourself and five others.'],
  },
  {
    id: 'swindler',
    name: 'Swindler',
    skills: ['deception', 'sleight_of_hand'],
    tools: ['disguise_kit', 'forgery_kit'],
    equipment: [{ id: 'disguise_kit' }, { id: 'clothes_fine' }],
    gold: 15,
    feature: ['False Identity', 'You keep a second identity with documents and contacts that hold up to scrutiny.'],
  },
  {
    id: 'folk_hero',
    name: 'Folk Hero',
    skills: ['animal_handling', 'survival'],
    tools: ["One artisan's tool", 'Land vehicles'],
    equipment: [{ id: 'clothes_common' }],
    gold: 10,
    feature: ['Common Hospitality', 'Ordinary folk will hide and shelter you, as long as you do not endanger them.'],
  },
  {
    id: 'noble',
    name: 'Noble',
    skills: ['history', 'persuasion'],
    extraLanguages: 1,
    tools: ['gaming_set'],
    equipment: [{ id: 'clothes_fine' }, { id: 'trinket' }],
    gold: 25,
    feature: ['Position of Privilege', 'High society welcomes you and commoners try to accommodate you.'],
  },
  {
    id: 'performer',
    name: 'Performer',
    skills: ['acrobatics', 'performance'],
    tools: ['disguise_kit', 'One musical instrument'],
    equipment: [{ id: 'flute' }, { id: 'clothes_fine' }],
    gold: 15,
    feature: ['By Popular Demand', 'You can always find a place to perform, earning free lodging and food.'],
  },
  {
    id: 'healer',
    name: 'Healer',
    skills: ['medicine', 'religion'],
    extraLanguages: 1,
    tools: ['herbalism_kit'],
    equipment: [{ id: 'herbalism_kit' }, { id: 'healers_kit' }, { id: 'clothes_common' }],
    gold: 5,
    feature: ['Field Medic', 'People in need seek you out, and you know where remedies can be found.'],
  },
  {
    id: 'custom',
    name: 'Custom Background',
    skills: null,
    extraLanguages: 1,
    tools: ['One tool of your choice'],
    equipment: [{ id: 'trinket' }, { id: 'clothes_common' }],
    gold: 10,
    feature: ['Your Story', 'Describe a personal advantage in your backstory; the storyteller will honor it.'],
  },
];

export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
export const CLASSES_BY_ID = Object.fromEntries(CLASSES.map((c) => [c.id, c]));
export const BACKGROUNDS_BY_ID = Object.fromEntries(BACKGROUNDS.map((b) => [b.id, b]));
