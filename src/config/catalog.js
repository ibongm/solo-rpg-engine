/**
 * Deterministic content tables: merchant item templates per genre, crafting recipes,
 * and safehouse upgrades. Item shape matches the Firestore inventory schema, plus a
 * `value` (base price in campaign currency).
 *
 * craftingTags doubles as the mechanical tag list read by the engine:
 *   weapons: 'melee' | 'ranged' | 'finesse' | 'heavy'
 *   consumables: 'healing' | 'ration' | 'antidote'
 *   materials: 'herb' | 'metal' | 'parts' | 'cloth' | 'upgrade'
 * statModifiers keys: ability keys (str…cha), 'ac', 'attack', 'damage', skill keys,
 *   'checks' (all ability checks), 'initiative', and for consumables 'heal' (dice string).
 */

const T = (name, type, fields = {}) => ({
  name,
  type,
  damageDice: fields.damageDice ?? null,
  statModifiers: fields.statModifiers ?? {},
  craftingTags: fields.craftingTags ?? [],
  description: fields.description ?? '',
  value: fields.value ?? 1,
});

const SHARED_MATERIALS = {
  fantasy: [
    T('Silverleaf Herb', 'material', { craftingTags: ['herb'], value: 3, description: 'A bitter medicinal leaf.' }),
    T('Iron Ingot', 'material', { craftingTags: ['metal', 'upgrade'], value: 8, description: 'Smithing stock for weapon and armor upgrades.' }),
    T('Linen Bandages', 'material', { craftingTags: ['cloth'], value: 2, description: 'Clean strips of cloth.' }),
  ],
  frontier_noir: [
    T('Sage Bundle', 'material', { craftingTags: ['herb'], value: 2, description: 'Prairie sage, good for poultices.' }),
    T('Gunsmith Parts', 'material', { craftingTags: ['parts', 'upgrade'], value: 10, description: 'Springs, pins and a fresh barrel liner.' }),
    T('Cotton Wadding', 'material', { craftingTags: ['cloth'], value: 1, description: 'Rolled cotton for dressings.' }),
  ],
  scifi: [
    T('Bio-Gel Culture', 'material', { craftingTags: ['herb'], value: 6, description: 'Living medical substrate.' }),
    T('Nanofiber Mod Kit', 'material', { craftingTags: ['parts', 'upgrade'], value: 18, description: 'Universal weapon/armor tuning kit.' }),
    T('Synth-Weave Patch', 'material', { craftingTags: ['cloth'], value: 3, description: 'Self-sealing fabric patch.' }),
  ],
  post_apoc: [
    T('Wild Herbs', 'material', { craftingTags: ['herb'], value: 2, description: 'Yarrow and plantain, foraged from the verge.' }),
    T('Scrap Metal', 'material', { craftingTags: ['metal', 'upgrade'], value: 4, description: 'Rebar, sheet steel and hose clamps.' }),
    T('Clean Cloth', 'material', { craftingTags: ['cloth'], value: 2, description: 'Boiled cotton strips for bandages.' }),
  ],
  wasteland: [
    T('Mutfruit Pulp', 'material', { craftingTags: ['herb'], value: 2, description: 'Smells awful. Heals anyway.' }),
    T('Scrap Metal', 'material', { craftingTags: ['metal', 'upgrade'], value: 4, description: 'Twisted rebar and sheet steel.' }),
    T('Rag Strips', 'material', { craftingTags: ['cloth'], value: 1, description: 'Mostly clean.' }),
  ],
};

export const MERCHANT_TEMPLATES = {
  fantasy: [
    T('Longsword', 'weapon', { damageDice: '1d8', craftingTags: ['melee'], value: 15, description: 'A versatile steel blade.' }),
    T('Shortbow', 'weapon', { damageDice: '1d6', craftingTags: ['ranged'], value: 25, description: 'Light hunting bow.' }),
    T('Rapier', 'weapon', { damageDice: '1d8', craftingTags: ['melee', 'finesse'], value: 25, description: 'A duelist’s thrusting blade.' }),
    T('Greataxe', 'weapon', { damageDice: '1d12', craftingTags: ['melee', 'heavy'], value: 30, description: 'Two-handed and brutal.' }),
    T('Leather Armor', 'armor', { statModifiers: { ac: 1 }, value: 10, description: '+1 AC.' }),
    T('Chain Shirt', 'armor', { statModifiers: { ac: 3, stealth: -1 }, value: 50, description: '+3 AC, -1 Stealth.' }),
    T('Potion of Healing', 'consumable', { statModifiers: { heal: '2d4+2' }, craftingTags: ['healing'], value: 50, description: 'Restores 2d4+2 HP.' }),
    T('Antitoxin', 'consumable', { craftingTags: ['antidote'], value: 50, description: 'Cures the Poisoned condition.' }),
    T('Trail Rations', 'consumable', { craftingTags: ['ration'], value: 1, description: 'One day of food.' }),
    T('Lucky Charm', 'key', { statModifiers: { checks: 1 }, value: 75, description: '+1 to all ability checks while carried and equipped.' }),
    ...SHARED_MATERIALS.fantasy,
  ],
  frontier_noir: [
    T('Six-Shooter', 'weapon', { damageDice: '1d8', craftingTags: ['ranged'], value: 20, description: 'Single-action revolver.' }),
    T('Lever-Action Rifle', 'weapon', { damageDice: '1d10', craftingTags: ['ranged', 'heavy'], value: 40, description: 'Long-range repeater.' }),
    T('Bowie Knife', 'weapon', { damageDice: '1d4', craftingTags: ['melee', 'finesse'], value: 5, description: 'Wicked and reliable.' }),
    T('Brass Knuckles', 'weapon', { damageDice: '1d4', craftingTags: ['melee'], value: 3, description: 'For persuasive conversations.' }),
    T('Duster Coat', 'armor', { statModifiers: { ac: 1 }, value: 8, description: '+1 AC.' }),
    T('Steel-Plated Vest', 'armor', { statModifiers: { ac: 2, acrobatics: -1 }, value: 35, description: '+2 AC, -1 Acrobatics.' }),
    T('Snake Oil Tonic', 'consumable', { statModifiers: { heal: '2d4+2' }, craftingTags: ['healing'], value: 15, description: 'Restores 2d4+2 HP. Probably.' }),
    T('Laudanum', 'consumable', { craftingTags: ['antidote'], value: 12, description: 'Cures Poisoned.' }),
    T('Hardtack & Jerky', 'consumable', { craftingTags: ['ration'], value: 1, description: 'One day of food.' }),
    T('Marked Deck', 'key', { statModifiers: { sleight_of_hand: 2 }, value: 30, description: '+2 Card Sharping when equipped.' }),
    ...SHARED_MATERIALS.frontier_noir,
  ],
  scifi: [
    T('Pulse Pistol', 'weapon', { damageDice: '1d8', craftingTags: ['ranged'], value: 60, description: 'Standard sidearm.' }),
    T('Rail Carbine', 'weapon', { damageDice: '1d10', craftingTags: ['ranged', 'heavy'], value: 140, description: 'Magnetic accelerator rifle.' }),
    T('Mono-Blade', 'weapon', { damageDice: '1d8', craftingTags: ['melee', 'finesse'], value: 90, description: 'Molecule-edge knife.' }),
    T('Shock Baton', 'weapon', { damageDice: '1d6', craftingTags: ['melee'], value: 40, description: 'Stun-capable riot baton.' }),
    T('Flex-Weave Suit', 'armor', { statModifiers: { ac: 1 }, value: 50, description: '+1 AC.' }),
    T('Combat Exo-Shell', 'armor', { statModifiers: { ac: 3, stealth: -2 }, value: 220, description: '+3 AC, -2 Stealth.' }),
    T('Med-Injector', 'consumable', { statModifiers: { heal: '2d4+2' }, craftingTags: ['healing'], value: 45, description: 'Restores 2d4+2 HP.' }),
    T('Detox Nanites', 'consumable', { craftingTags: ['antidote'], value: 40, description: 'Cures Poisoned.' }),
    T('Nutrient Bars', 'consumable', { craftingTags: ['ration'], value: 2, description: 'One day of food.' }),
    T('Targeting Implant', 'key', { statModifiers: { perception: 2 }, value: 160, description: '+2 Perception when equipped.' }),
    ...SHARED_MATERIALS.scifi,
  ],
  post_apoc: [
    T('Revolver', 'weapon', { damageDice: '1d8', craftingTags: ['ranged'], value: 30, description: 'Six rounds. Make them count.' }),
    T('Hunting Rifle', 'weapon', { damageDice: '1d10', craftingTags: ['ranged', 'heavy'], value: 45, description: 'Bolt-action, scoped, loud.' }),
    T('Machete', 'weapon', { damageDice: '1d8', craftingTags: ['melee'], value: 8, description: 'Quiet work for close threats.' }),
    T('Combat Knife', 'weapon', { damageDice: '1d4', craftingTags: ['melee', 'finesse'], value: 5, description: 'Always within reach.' }),
    T('Leather Jacket', 'armor', { statModifiers: { ac: 1 }, value: 8, description: '+1 AC.' }),
    T('Riot Gear', 'armor', { statModifiers: { ac: 3, stealth: -1 }, value: 60, description: '+3 AC, -1 Stealth.' }),
    T('First-Aid Kit', 'consumable', { statModifiers: { heal: '2d4+2' }, craftingTags: ['healing'], value: 30, description: 'Restores 2d4+2 HP.' }),
    T('Antibiotics', 'consumable', { craftingTags: ['antidote'], value: 35, description: 'Cures Poisoned.' }),
    T('Canned Food', 'consumable', { craftingTags: ['ration'], value: 2, description: 'One day of food.' }),
    T('Binoculars', 'key', { statModifiers: { perception: 2 }, value: 40, description: '+2 Perception when equipped.' }),
    ...SHARED_MATERIALS.post_apoc,
  ],
  wasteland: [
    T('Pipe Rifle', 'weapon', { damageDice: '1d8', craftingTags: ['ranged'], value: 18, description: 'Held together with hope.' }),
    T('Sawed-Off', 'weapon', { damageDice: '2d4', craftingTags: ['ranged'], value: 25, description: 'Close-range scattergun.' }),
    T('Rebar Club', 'weapon', { damageDice: '1d8', craftingTags: ['melee', 'heavy'], value: 4, description: 'Heavy and honest.' }),
    T('Shiv', 'weapon', { damageDice: '1d4', craftingTags: ['melee', 'finesse'], value: 2, description: 'Sharpened scrap.' }),
    T('Tire Armor', 'armor', { statModifiers: { ac: 1 }, value: 8, description: '+1 AC.' }),
    T('Riot Gear', 'armor', { statModifiers: { ac: 3, stealth: -1 }, value: 60, description: '+3 AC, -1 Stealth.' }),
    T('Stimpak', 'consumable', { statModifiers: { heal: '2d4+2' }, craftingTags: ['healing'], value: 30, description: 'Restores 2d4+2 HP.' }),
    T('Rad-Flush', 'consumable', { craftingTags: ['antidote'], value: 25, description: 'Cures Poisoned.' }),
    T('Canned Food', 'consumable', { craftingTags: ['ration'], value: 2, description: 'One day of food.' }),
    T('Geiger Counter', 'key', { statModifiers: { survival: 2 }, value: 45, description: '+2 Scavenging when equipped.' }),
    ...SHARED_MATERIALS.wasteland,
  ],
};
MERCHANT_TEMPLATES.custom = MERCHANT_TEMPLATES.fantasy;

/** Starter kits granted at character creation (by genre). */
export const STARTER_KIT_NAMES = {
  fantasy: ['Longsword', 'Leather Armor', 'Potion of Healing', 'Trail Rations', 'Trail Rations', 'Trail Rations'],
  frontier_noir: ['Six-Shooter', 'Duster Coat', 'Snake Oil Tonic', 'Hardtack & Jerky', 'Hardtack & Jerky', 'Hardtack & Jerky'],
  scifi: ['Pulse Pistol', 'Flex-Weave Suit', 'Med-Injector', 'Nutrient Bars', 'Nutrient Bars', 'Nutrient Bars'],
  post_apoc: ['Revolver', 'Leather Jacket', 'First-Aid Kit', 'Canned Food', 'Canned Food', 'Canned Food'],
  wasteland: ['Pipe Rifle', 'Tire Armor', 'Stimpak', 'Canned Food', 'Canned Food', 'Canned Food'],
  custom: ['Longsword', 'Leather Armor', 'Potion of Healing', 'Trail Rations', 'Trail Rations', 'Trail Rations'],
};

/**
 * Crafting recipes. `inputs` are tag requirements (one item consumed per entry).
 * kind 'create' produces a new item from the genre's template by tag;
 * kind 'upgrade' improves the target item in place.
 */
export const RECIPES = [
  {
    id: 'healing_draught',
    label: 'Brew Healing Draught',
    inputs: ['herb', 'herb'],
    kind: 'create',
    output: { pickTag: 'healing' },
    dc: 10,
    skill: 'medicine',
    description: 'Combine two herbal materials into a healing consumable.',
  },
  {
    id: 'field_dressing',
    label: 'Prepare Field Dressing',
    inputs: ['herb', 'cloth'],
    kind: 'create',
    output: {
      template: {
        name: 'Field Dressing',
        type: 'consumable',
        damageDice: null,
        statModifiers: { heal: '1d4+1' },
        craftingTags: ['healing'],
        description: 'Restores 1d4+1 HP.',
        value: 4,
      },
    },
    dc: 8,
    skill: 'medicine',
    description: 'A quick poultice-and-wrap.',
  },
  {
    id: 'weapon_upgrade',
    label: 'Upgrade Weapon (+1 Attack)',
    inputs: ['upgrade'],
    kind: 'upgrade',
    targetType: 'weapon',
    modifier: { key: 'attack', delta: 1, max: 3 },
    dc: 12,
    skill: 'sleight_of_hand',
    description: 'Tune a weapon for accuracy (max +3).',
  },
  {
    id: 'armor_upgrade',
    label: 'Reinforce Armor (+1 AC)',
    inputs: ['upgrade', 'upgrade'],
    kind: 'upgrade',
    targetType: 'armor',
    modifier: { key: 'ac', delta: 1, max: 2 },
    dc: 13,
    skill: 'athletics',
    description: 'Rivet extra plating onto armor (max +2 bonus).',
  },
];

/** Safehouse / Home Base upgrades with passive rest buffs. */
export const SAFEHOUSE_UPGRADES = [
  {
    id: 'alchemy_bench',
    label: 'Alchemy / Work Bench',
    cost: 120,
    description: 'Crafting checks at the safehouse gain +2.',
    effect: { craftBonus: 2 },
  },
  {
    id: 'reinforced_doors',
    label: 'Reinforced Doors',
    cost: 150,
    description: 'Long rests here are secure and need no rations.',
    effect: { noRationNeeded: true },
  },
  {
    id: 'lookout',
    label: 'Lookout Post',
    cost: 100,
    description: '+2 initiative for the first combat after resting here.',
    effect: { initiativeBuff: 2 },
  },
  {
    id: 'comfortable_beds',
    label: 'Comfortable Beds',
    cost: 80,
    description: 'Long rests here grant 5 temporary HP.',
    effect: { tempHp: 5 },
  },
  {
    id: 'stash',
    label: 'Fence Connections',
    cost: 60,
    description: 'Your safehouse fence network: merchants pay 10% more for items you sell.',
    effect: { sellBonusPct: 10 },
  },
];
