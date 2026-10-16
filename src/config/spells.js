/**
 * Cantrips and 1st-level spells (SRD 5.1) — enough for level-1 characters.
 *
 * This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by
 * Wizards of the Coast LLC, licensed under CC BY 4.0 (see NOTICE.md). Descriptions are
 * condensed paraphrases.
 *
 * kind:
 *   'attack'  — spell attack roll (attackType 'ranged' | 'melee'), damage on hit
 *   'save'    — target saves (save ability) vs your spell DC; onSave 'half' | 'none'
 *   'auto'    — always hits (Magic Missile)
 *   'heal'    — restores HP (+ spellcasting modifier)
 *   'temp_hp' — grants temporary HP
 *   'utility' — narrative effect; some set an engine-tracked effect (see `effect`)
 * scales: cantrip damage dice grow at character levels 5, 11 and 17.
 */

const S = (id, name, level, school, kind, fields = {}) => ({ id, name, level, school, kind, castingTime: '1 action', range: '60 ft', concentration: false, ritual: false, ...fields });

export const SPELLS = [
  // ── Cantrips ──
  S('acid_splash', 'Acid Splash', 0, 'conjuration', 'save', { save: 'dex', damage: '1d6', damageType: 'acid', onSave: 'none', scales: true, desc: 'Hurl a bubble of acid at one or two adjacent creatures.' }),
  S('chill_touch', 'Chill Touch', 0, 'necromancy', 'attack', { attackType: 'ranged', range: '120 ft', damage: '1d8', damageType: 'necrotic', scales: true, desc: 'A ghostly hand chills the target; it cannot regain HP until your next turn.' }),
  S('dancing_lights', 'Dancing Lights', 0, 'evocation', 'utility', { range: '120 ft', concentration: true, desc: 'Create up to four floating lights you can move around.' }),
  S('druidcraft', 'Druidcraft', 0, 'transmutation', 'utility', { range: '30 ft', desc: 'Minor nature tricks: predict weather, bloom a flower, light or snuff a small flame.' }),
  S('eldritch_blast', 'Eldritch Blast', 0, 'evocation', 'attack', { attackType: 'ranged', range: '120 ft', damage: '1d10', damageType: 'force', scales: true, desc: 'A beam of crackling energy (more beams at higher levels).' }),
  S('fire_bolt', 'Fire Bolt', 0, 'evocation', 'attack', { attackType: 'ranged', range: '120 ft', damage: '1d10', damageType: 'fire', scales: true, desc: 'A mote of fire that ignites flammable objects it hits.' }),
  S('guidance', 'Guidance', 0, 'divination', 'utility', { range: 'Touch', concentration: true, desc: 'A willing creature adds 1d4 to one ability check of its choice.' }),
  S('light', 'Light', 0, 'evocation', 'utility', { range: 'Touch', desc: 'An object sheds bright light in a 20 ft radius for an hour.' }),
  S('mage_hand', 'Mage Hand', 0, 'conjuration', 'utility', { range: '30 ft', desc: 'A spectral hand manipulates objects up to 10 lb.' }),
  S('mending', 'Mending', 0, 'transmutation', 'utility', { castingTime: '1 minute', range: 'Touch', desc: 'Repair a single break or tear in an object.' }),
  S('message', 'Message', 0, 'transmutation', 'utility', { range: '120 ft', desc: 'Whisper a message to a creature only it can hear; it can reply.' }),
  S('minor_illusion', 'Minor Illusion', 0, 'illusion', 'utility', { range: '30 ft', desc: 'Create a sound or a small still image for a minute.' }),
  S('poison_spray', 'Poison Spray', 0, 'conjuration', 'save', { range: '10 ft', save: 'con', damage: '1d12', damageType: 'poison', onSave: 'none', scales: true, desc: 'A puff of noxious gas.' }),
  S('prestidigitation', 'Prestidigitation', 0, 'transmutation', 'utility', { range: '10 ft', desc: 'Harmless magical tricks: clean, warm, flavor, spark, mark.' }),
  S('produce_flame', 'Produce Flame', 0, 'conjuration', 'attack', { attackType: 'ranged', range: '30 ft', damage: '1d8', damageType: 'fire', scales: true, desc: 'A flame in your palm lights the area; hurl it as an attack.' }),
  S('ray_of_frost', 'Ray of Frost', 0, 'evocation', 'attack', { attackType: 'ranged', damage: '1d8', damageType: 'cold', scales: true, desc: 'A frigid beam; the target’s speed drops by 10 ft.' }),
  S('resistance', 'Resistance', 0, 'abjuration', 'utility', { range: 'Touch', concentration: true, desc: 'A willing creature adds 1d4 to one saving throw.' }),
  S('sacred_flame', 'Sacred Flame', 0, 'evocation', 'save', { save: 'dex', damage: '1d8', damageType: 'radiant', onSave: 'none', scales: true, desc: 'Radiance descends on a creature; cover does not help it.' }),
  S('shillelagh', 'Shillelagh', 0, 'transmutation', 'utility', { castingTime: '1 bonus action', range: 'Touch', desc: 'Your club or staff uses your spellcasting ability and deals 1d8 for a minute.' }),
  S('shocking_grasp', 'Shocking Grasp', 0, 'evocation', 'attack', { attackType: 'melee', range: 'Touch', damage: '1d8', damageType: 'lightning', scales: true, desc: 'Lightning from your hand; the target cannot take reactions.' }),
  S('spare_the_dying', 'Spare the Dying', 0, 'necromancy', 'utility', { range: 'Touch', desc: 'Stabilize a creature at 0 HP.' }),
  S('thaumaturgy', 'Thaumaturgy', 0, 'transmutation', 'utility', { range: '30 ft', desc: 'Minor wonders: booming voice, flickering flames, tremors, glowing eyes.' }),
  S('true_strike', 'True Strike', 0, 'divination', 'utility', { range: '30 ft', concentration: true, desc: 'Gain advantage on your next attack against the target.' }),
  S('vicious_mockery', 'Vicious Mockery', 0, 'enchantment', 'save', { save: 'wis', damage: '1d4', damageType: 'psychic', onSave: 'none', scales: true, desc: 'Cutting insults; the target has disadvantage on its next attack.' }),

  // ── 1st level ──
  S('alarm', 'Alarm', 1, 'abjuration', 'utility', { castingTime: '1 minute', range: '30 ft', ritual: true, desc: 'Ward an area; you are alerted when a creature enters it.' }),
  S('animal_friendship', 'Animal Friendship', 1, 'enchantment', 'utility', { range: '30 ft', desc: 'Convince a beast you mean no harm (Wisdom save).' }),
  S('bane', 'Bane', 1, 'enchantment', 'utility', { range: '30 ft', concentration: true, desc: 'Up to three creatures subtract 1d4 from attacks and saves (Charisma save).' }),
  S('bless', 'Bless', 1, 'enchantment', 'utility', { range: '30 ft', concentration: true, effect: 'bless', desc: 'Up to three creatures add 1d4 to attack rolls and saving throws.' }),
  S('burning_hands', 'Burning Hands', 1, 'evocation', 'save', { range: 'Self (15 ft cone)', save: 'dex', damage: '3d6', damageType: 'fire', onSave: 'half', desc: 'A thin sheet of flame shoots from your fingertips.' }),
  S('charm_person', 'Charm Person', 1, 'enchantment', 'utility', { range: '30 ft', desc: 'A humanoid regards you as a friendly acquaintance (Wisdom save).' }),
  S('color_spray', 'Color Spray', 1, 'illusion', 'utility', { range: 'Self (15 ft cone)', desc: 'Blind creatures totalling 6d10 HP, weakest first, until your next turn.' }),
  S('command', 'Command', 1, 'enchantment', 'utility', { range: '60 ft', desc: 'Speak a one-word command a creature must obey (Wisdom save).' }),
  S('comprehend_languages', 'Comprehend Languages', 1, 'divination', 'utility', { range: 'Self', ritual: true, desc: 'Understand any spoken or written language for an hour.' }),
  S('create_destroy_water', 'Create or Destroy Water', 1, 'transmutation', 'utility', { range: '30 ft', desc: 'Create or destroy up to 10 gallons of water.' }),
  S('cure_wounds', 'Cure Wounds', 1, 'evocation', 'heal', { range: 'Touch', heal: '1d8', desc: 'A touch restores 1d8 + your spellcasting modifier HP.' }),
  S('detect_evil_good', 'Detect Evil and Good', 1, 'divination', 'utility', { range: 'Self', concentration: true, desc: 'Sense aberrations, celestials, fiends and undead within 30 ft.' }),
  S('detect_magic', 'Detect Magic', 1, 'divination', 'utility', { range: 'Self', concentration: true, ritual: true, desc: 'Sense magic within 30 ft.' }),
  S('detect_poison', 'Detect Poison and Disease', 1, 'divination', 'utility', { range: 'Self', concentration: true, ritual: true, desc: 'Sense poisons and diseases within 30 ft.' }),
  S('disguise_self', 'Disguise Self', 1, 'illusion', 'utility', { range: 'Self', desc: 'Change your appearance for an hour.' }),
  S('entangle', 'Entangle', 1, 'conjuration', 'utility', { range: '90 ft', concentration: true, desc: 'Grasping plants restrain creatures in a 20 ft square (Strength save).' }),
  S('expeditious_retreat', 'Expeditious Retreat', 1, 'transmutation', 'utility', { castingTime: '1 bonus action', range: 'Self', concentration: true, desc: 'Dash as a bonus action each turn.' }),
  S('faerie_fire', 'Faerie Fire', 1, 'evocation', 'utility', { concentration: true, desc: 'Outline creatures in light; attacks against them have advantage (Dexterity save).' }),
  S('false_life', 'False Life', 1, 'necromancy', 'temp_hp', { range: 'Self', tempHp: '1d4+4', desc: 'Gain 1d4 + 4 temporary HP for an hour.' }),
  S('feather_fall', 'Feather Fall', 1, 'transmutation', 'utility', { castingTime: '1 reaction', desc: 'Up to five falling creatures descend slowly and take no falling damage.' }),
  S('find_familiar', 'Find Familiar', 1, 'conjuration', 'utility', { castingTime: '1 hour', range: '10 ft', ritual: true, desc: 'Summon a spirit familiar in animal form.' }),
  S('floating_disk', 'Floating Disk', 1, 'conjuration', 'utility', { range: '30 ft', ritual: true, desc: 'A floating disk carries up to 500 lb behind you.' }),
  S('fog_cloud', 'Fog Cloud', 1, 'conjuration', 'utility', { range: '120 ft', concentration: true, desc: 'A 20 ft sphere of fog heavily obscures the area.' }),
  S('goodberry', 'Goodberry', 1, 'transmutation', 'utility', { range: 'Touch', desc: 'Ten berries each restore 1 HP and feed a creature for a day.' }),
  S('grease', 'Grease', 1, 'conjuration', 'utility', { desc: 'Slick grease covers a 10 ft square; creatures may fall prone (Dexterity save).' }),
  S('guiding_bolt', 'Guiding Bolt', 1, 'evocation', 'attack', { attackType: 'ranged', range: '120 ft', damage: '4d6', damageType: 'radiant', desc: 'A flash of light; the next attack against the target has advantage.' }),
  S('healing_word', 'Healing Word', 1, 'evocation', 'heal', { castingTime: '1 bonus action', heal: '1d4', desc: 'A spoken word restores 1d4 + your spellcasting modifier HP.' }),
  S('hellish_rebuke', 'Hellish Rebuke', 1, 'evocation', 'save', { castingTime: '1 reaction', save: 'dex', damage: '2d10', damageType: 'fire', onSave: 'half', desc: 'Engulf a creature that damaged you in flames.' }),
  S('heroism', 'Heroism', 1, 'enchantment', 'utility', { range: 'Touch', concentration: true, desc: 'A creature is immune to fear and gains temporary HP each turn.' }),
  S('hideous_laughter', 'Hideous Laughter', 1, 'enchantment', 'utility', { range: '30 ft', concentration: true, desc: 'A creature falls prone, helpless with laughter (Wisdom save).' }),
  S('identify', 'Identify', 1, 'divination', 'utility', { castingTime: '1 minute', range: 'Touch', ritual: true, desc: 'Learn the properties of a magic item.' }),
  S('illusory_script', 'Illusory Script', 1, 'illusion', 'utility', { castingTime: '1 minute', range: 'Touch', ritual: true, desc: 'Write a message only chosen readers can understand.' }),
  S('inflict_wounds', 'Inflict Wounds', 1, 'necromancy', 'attack', { attackType: 'melee', range: 'Touch', damage: '3d10', damageType: 'necrotic', desc: 'A necrotic touch.' }),
  S('jump', 'Jump', 1, 'transmutation', 'utility', { range: 'Touch', desc: 'A creature’s jump distance triples for a minute.' }),
  S('longstrider', 'Longstrider', 1, 'transmutation', 'utility', { range: 'Touch', effect: 'longstrider', desc: 'A creature’s speed increases by 10 ft for an hour.' }),
  S('mage_armor', 'Mage Armor', 1, 'abjuration', 'utility', { range: 'Touch', effect: 'mage_armor', desc: 'Without armor, your AC becomes 13 + Dex for 8 hours.' }),
  S('magic_missile', 'Magic Missile', 1, 'evocation', 'auto', { range: '120 ft', damage: '3d4+3', damageType: 'force', desc: 'Three darts of force that always hit.' }),
  S('protection_evil_good', 'Protection from Evil and Good', 1, 'abjuration', 'utility', { range: 'Touch', concentration: true, desc: 'Ward a creature against aberrations, celestials, elementals, fey, fiends and undead.' }),
  S('purify_food', 'Purify Food and Drink', 1, 'transmutation', 'utility', { range: '10 ft', ritual: true, desc: 'Remove poison and rot from food and drink.' }),
  S('sanctuary', 'Sanctuary', 1, 'abjuration', 'utility', { castingTime: '1 bonus action', range: '30 ft', desc: 'Attackers must make a Wisdom save or choose another target.' }),
  S('shield', 'Shield', 1, 'abjuration', 'utility', { castingTime: '1 reaction', range: 'Self', desc: '+5 AC until the start of your next turn; Magic Missile cannot hit you.' }),
  S('shield_of_faith', 'Shield of Faith', 1, 'abjuration', 'utility', { castingTime: '1 bonus action', concentration: true, effect: 'shield_of_faith', desc: '+2 AC for up to 10 minutes.' }),
  S('silent_image', 'Silent Image', 1, 'illusion', 'utility', { concentration: true, desc: 'A visual illusion up to a 15 ft cube that you can move.' }),
  S('sleep', 'Sleep', 1, 'enchantment', 'utility', { range: '90 ft', desc: 'Creatures totalling 5d8 HP fall asleep, weakest first.' }),
  S('speak_with_animals', 'Speak with Animals', 1, 'divination', 'utility', { range: 'Self', ritual: true, desc: 'Understand and talk with beasts for 10 minutes.' }),
  S('thunderwave', 'Thunderwave', 1, 'evocation', 'save', { range: 'Self (15 ft cube)', save: 'con', damage: '2d8', damageType: 'thunder', onSave: 'half', desc: 'A wave of thunder that pushes creatures 10 ft away.' }),
  S('unseen_servant', 'Unseen Servant', 1, 'conjuration', 'utility', { range: '60 ft', ritual: true, desc: 'An invisible force performs simple tasks for an hour.' }),
];

export const SPELLS_BY_ID = Object.fromEntries(SPELLS.map((s) => [s.id, s]));

const SORC_WIZ_CANTRIPS = ['acid_splash', 'chill_touch', 'dancing_lights', 'fire_bolt', 'light', 'mage_hand', 'mending', 'message', 'minor_illusion', 'poison_spray', 'prestidigitation', 'ray_of_frost', 'shocking_grasp', 'true_strike'];

export const CLASS_SPELL_LISTS = {
  bard: {
    cantrips: ['dancing_lights', 'light', 'mage_hand', 'mending', 'message', 'minor_illusion', 'prestidigitation', 'true_strike', 'vicious_mockery'],
    level1: ['animal_friendship', 'bane', 'charm_person', 'comprehend_languages', 'cure_wounds', 'detect_magic', 'disguise_self', 'faerie_fire', 'feather_fall', 'healing_word', 'heroism', 'hideous_laughter', 'identify', 'illusory_script', 'longstrider', 'silent_image', 'sleep', 'speak_with_animals', 'thunderwave', 'unseen_servant'],
  },
  cleric: {
    cantrips: ['guidance', 'light', 'mending', 'resistance', 'sacred_flame', 'spare_the_dying', 'thaumaturgy'],
    level1: ['bane', 'bless', 'command', 'create_destroy_water', 'cure_wounds', 'detect_evil_good', 'detect_magic', 'detect_poison', 'guiding_bolt', 'healing_word', 'inflict_wounds', 'protection_evil_good', 'purify_food', 'sanctuary', 'shield_of_faith'],
  },
  druid: {
    cantrips: ['druidcraft', 'guidance', 'mending', 'poison_spray', 'produce_flame', 'resistance', 'shillelagh'],
    level1: ['animal_friendship', 'charm_person', 'create_destroy_water', 'cure_wounds', 'detect_magic', 'detect_poison', 'entangle', 'faerie_fire', 'fog_cloud', 'goodberry', 'healing_word', 'jump', 'longstrider', 'purify_food', 'speak_with_animals', 'thunderwave'],
  },
  sorcerer: {
    cantrips: SORC_WIZ_CANTRIPS,
    level1: ['burning_hands', 'charm_person', 'color_spray', 'comprehend_languages', 'detect_magic', 'disguise_self', 'expeditious_retreat', 'false_life', 'feather_fall', 'fog_cloud', 'jump', 'mage_armor', 'magic_missile', 'shield', 'silent_image', 'sleep', 'thunderwave'],
  },
  warlock: {
    cantrips: ['chill_touch', 'eldritch_blast', 'mage_hand', 'minor_illusion', 'poison_spray', 'prestidigitation', 'true_strike'],
    // The Fiend's expanded list adds Burning Hands and Command.
    level1: ['burning_hands', 'charm_person', 'command', 'comprehend_languages', 'expeditious_retreat', 'hellish_rebuke', 'illusory_script', 'protection_evil_good', 'unseen_servant'],
  },
  wizard: {
    cantrips: SORC_WIZ_CANTRIPS,
    level1: ['alarm', 'burning_hands', 'charm_person', 'color_spray', 'comprehend_languages', 'detect_magic', 'disguise_self', 'expeditious_retreat', 'false_life', 'feather_fall', 'find_familiar', 'floating_disk', 'fog_cloud', 'grease', 'hideous_laughter', 'identify', 'illusory_script', 'jump', 'longstrider', 'mage_armor', 'magic_missile', 'protection_evil_good', 'shield', 'silent_image', 'sleep', 'thunderwave', 'unseen_servant'],
  },
};
