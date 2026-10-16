/**
 * Genre reskins for SRD content. Mechanics never change — only names and flavor.
 * Fantasy and Custom use the SRD names unchanged. Any id missing from a genre map
 * falls back to its SRD name.
 */
import { ITEMS, SPECIES_BY_ID, CLASSES_BY_ID, BACKGROUNDS_BY_ID, LANGUAGES } from './srd.js';

export const RESKINS = {
  frontier_noir: {
    terms: { species: 'Origin', class: 'Calling', background: 'Past', spells: 'Hexes', cantrips: 'Tricks', spell: 'hex' },
    languages: {
      Common: 'English', Dwarvish: "Cornish Miner's Cant", Elvish: 'Gaelic', Giant: 'Navajo', Gnomish: 'German', Goblin: 'Yiddish',
      Halfling: 'Dutch', Orc: 'Lakota', Abyssal: 'Haitian Creole', Celestial: 'Church Latin', Draconic: 'Spanish', 'Deep Speech': 'Cantonese',
      Infernal: 'Grimoire Tongue', Primordial: 'Telegraph Morse', Sylvan: 'Plains Sign Talk', Undercommon: 'Outlaw Cant',
    },
    extraLanguages: ['French', 'Italian', 'Russian', 'Card-Sharp Signals'],
    species: {
      dwarf: { name: 'Hard-Rock Miner', blurb: 'Stocky folk from the mountain camps — tough as iron, steady underground.' },
      elf: { name: 'Ghost-Blooded', blurb: 'Pale, sharp-eyed drifters with a touch of something uncanny.' },
      halfling: { name: 'Small Folk', blurb: 'Short, lucky and quick — easy to underestimate in a crowd.' },
      human: { name: 'Frontier Folk', blurb: 'Settlers, drifters and city people of every stripe.' },
      dragonborn: { name: 'Thunder-Kin', blurb: 'Scaled giants of the badlands who breathe storm and fire.' },
      gnome: { name: 'Clockwork Tinkerer', blurb: 'Small, clever inventors with oil under their nails.' },
      half_elf: { name: 'Twice-Born', blurb: 'Caught between two bloodlines and at home in neither.' },
      half_orc: { name: 'Brute-Blooded', blurb: 'Big, scarred and hard to put down.' },
      tiefling: { name: 'Devil-Marked', blurb: 'Born with a brand of the infernal and a temper to match.' },
    },
    classes: {
      barbarian: 'Brawler', bard: 'Showman', cleric: 'Preacher', druid: 'Wild Hermit', fighter: 'Gunhand', monk: 'Drifter',
      paladin: 'Lawman', ranger: 'Tracker', rogue: 'Outlaw', sorcerer: 'Cursed Blood', warlock: "Devil's Bargainer", wizard: 'Occultist',
    },
    backgrounds: {
      acolyte: 'Mission Hand', veteran: 'Cavalry Veteran', urchin: 'Gutter Kid', scholar: 'Schoolteacher', wanderer: 'Drifter',
      swindler: 'Grifter', folk_hero: 'Homesteader', noble: 'Cattle-Baron Heir', performer: 'Medicine-Show Act', healer: 'Sawbones', custom: 'Your Own Past',
    },
    items: {
      club: 'Blackjack', dagger: 'Bowie Knife', greatclub: 'Axe Handle', handaxe: 'Hatchet', javelin: 'Throwing Spike', light_hammer: 'Claw Hammer',
      mace: 'Iron Cudgel', quarterstaff: 'Walking Staff', sickle: 'Hay Hook', spear: 'Pitchfork', light_crossbow: 'Single-Shot Carbine', dart: 'Throwing Knife',
      shortbow: 'Bird Gun', sling: 'Slingshot', battleaxe: 'Felling Axe', flail: 'Logging Chain', glaive: 'Scythe', greataxe: "Lumberjack's Axe",
      greatsword: 'Two-Handed Cleaver', halberd: 'Bill Hook', lance: 'Cavalry Lance', longsword: 'Cavalry Saber', maul: 'Spike Maul', morningstar: 'Studded Club',
      pike: 'Whaling Lance', rapier: 'Sword Cane', scimitar: 'Machete', shortsword: 'Arkansas Toothpick', trident: 'Gig Spear', war_pick: "Prospector's Pick",
      warhammer: 'Sledgehammer', whip: 'Bullwhip', blowgun: 'Blowgun', hand_crossbow: 'Six-Shooter', heavy_crossbow: 'Buffalo Rifle', longbow: 'Lever-Action Rifle', net: 'Lasso',
      padded: 'Quilted Coat', leather: 'Duster Coat', studded_leather: 'Studded Leathers', hide: 'Buffalo Hide', chain_shirt: 'Mail Vest', scale_mail: 'Plated Coat',
      breastplate: 'Steel Vest', half_plate: 'Iron Cuirass', ring_mail: 'Ringed Jacket', chain_mail: 'Chain Coat', splint: 'Splint Rig', plate: 'Iron-Plated Suit', shield: 'Steel Buckler',
      arrows: 'Rifle Cartridges (20)', bolts: 'Pistol Rounds (20)', sling_bullets: 'Pebbles (20)', needles: 'Blow Darts (50)',
      component_pouch: 'Hex Pouch', arcane_focus: 'Hex Charm', druidic_focus: 'Bone Fetish', holy_symbol: 'Brass Cross', spellbook: 'Grimoire',
      burglars_pack: "Second-Story Kit", diplomats_pack: "Dealmaker's Kit", dungeoneers_pack: "Miner's Kit", entertainers_pack: "Showman's Trunk",
      explorers_pack: 'Trail Kit', priests_pack: "Circuit-Rider's Kit", scholars_pack: "Schoolhouse Satchel", rations: 'Hardtack & Jerky', potion_healing: 'Snake Oil Tonic',
    },
  },
  scifi: {
    terms: { species: 'Species', class: 'Role', background: 'Background', spells: 'Psionics', cantrips: 'Basic Psi', spell: 'psionic power' },
    languages: {
      Common: 'Galactic Standard', Dwarvish: 'Heavy-Worlder Cant', Elvish: 'Sylphid High-Speech', Giant: 'Colossi Rumble', Gnomish: 'Gnomari Techcant',
      Goblin: 'Spacer Pidgin', Halfling: 'Station Patois', Orc: 'Gene-Brute Battle-Cant', Abyssal: 'Hive Chitter', Celestial: 'High Synod',
      Draconic: 'Draconid Battle-Sign', 'Deep Speech': 'Xeno-Signal', Infernal: 'Void-Touched Whisper', Primordial: 'Binary / Machine Code',
      Sylvan: 'Terraformer Bio-Song', Undercommon: 'Outer-Rim Creole',
    },
    extraLanguages: ['Encrypted Fleet Code', 'Old Earth English', 'Corporate Legal-Speak', 'Xenolinguistics'],
    species: {
      dwarf: { name: 'Heavy-Worlder', blurb: 'Dense-boned colonists from high-gravity mining worlds.' },
      elf: { name: 'Sylphid', blurb: 'Long-lived, graceful offworlders with keen senses and old minds.' },
      halfling: { name: 'Spacer', blurb: 'Compact folk born in cramped stations — nimble and lucky.' },
      human: { name: 'Human', blurb: 'Adaptable and everywhere.' },
      dragonborn: { name: 'Draconid', blurb: 'Towering reptilian warriors with an energy-breath organ.' },
      gnome: { name: 'Gnomari', blurb: 'Small, brilliant engineers from a tech-obsessed homeworld.' },
      half_elf: { name: 'Hybrid', blurb: 'Gene-blended between humans and Sylphids.' },
      half_orc: { name: 'Gene-Brute', blurb: 'Bred for war, built to keep standing.' },
      tiefling: { name: 'Void-Touched', blurb: 'Marked by exposure to something from beyond the stars.' },
    },
    classes: {
      barbarian: 'Berserker', bard: 'Face', cleric: 'Synod Medic', druid: 'Terraformer', fighter: 'Marine', monk: 'Kinetic Adept',
      paladin: 'Vanguard', ranger: 'Scout', rogue: 'Infiltrator', sorcerer: 'Psion', warlock: 'Construct-Bonded', wizard: 'Technomancer',
    },
    backgrounds: {
      acolyte: 'Synod Initiate', veteran: 'Ex-Military', urchin: 'Undercity Kid', scholar: 'Researcher', wanderer: 'Frontier Colonist',
      swindler: 'Con Artist', folk_hero: 'Colony Hero', noble: 'Corporate Heir', performer: 'Holo-Star', healer: 'Field Medic', custom: 'Your Own Background',
    },
    items: {
      club: 'Shock Stick', dagger: 'Vibro-Knife', greatclub: 'Riot Bar', handaxe: 'Hand Cutter', javelin: 'Throwing Lance', light_hammer: 'Light Gravhammer',
      mace: 'Stun Mace', quarterstaff: 'Shock Staff', sickle: 'Plasma Hook', spear: 'Pulse Spear', light_crossbow: 'Needle Rifle', dart: 'Flechette',
      shortbow: 'Pulse Carbine', sling: 'Coil Sling', battleaxe: 'Arc Axe', flail: 'Chain Flail', glaive: 'Ion Glaive', greataxe: 'Breacher Axe',
      greatsword: 'Plasma Greatblade', halberd: 'Power Halberd', lance: 'Jet Lance', longsword: 'Plasma Sword', maul: 'Grav-Maul', morningstar: 'Spiked Shocker',
      pike: 'Phase Pike', rapier: 'Mono-Blade', scimitar: 'Arc Saber', shortsword: 'Combat Blade', trident: 'Tri-Prong', war_pick: 'Breaching Pick',
      warhammer: 'Kinetic Hammer', whip: 'Neural Lash', blowgun: 'Dart Tube', hand_crossbow: 'Pulse Pistol', heavy_crossbow: 'Rail Cannon', longbow: 'Rail Rifle', net: 'Snare Net',
      padded: 'Padded Jumpsuit', leather: 'Flex-Weave Suit', studded_leather: 'Reinforced Flight Suit', hide: 'Thermal Hide', chain_shirt: 'Mesh Vest', scale_mail: 'Scale Armor',
      breastplate: 'Ceramic Plate', half_plate: 'Tactical Exo', ring_mail: 'Ringweave Suit', chain_mail: 'Ballistic Mesh', splint: 'Combat Exo-Shell', plate: 'Power Armor', shield: 'Energy Shield',
      arrows: 'Power Cells (20)', bolts: 'Needle Mags (20)', sling_bullets: 'Coil Slugs (20)', needles: 'Darts (50)',
      component_pouch: 'Psi-Reagent Kit', arcane_focus: 'Psi-Amp', druidic_focus: 'Bio-Link', holy_symbol: 'Synod Sigil', spellbook: 'Data Slate',
      burglars_pack: 'Infiltration Kit', diplomats_pack: 'Diplomatic Kit', dungeoneers_pack: 'Breach Kit', entertainers_pack: 'Performer Kit',
      explorers_pack: 'Expedition Kit', priests_pack: 'Chaplain Kit', scholars_pack: 'Research Kit', rations: 'Nutrient Bars', potion_healing: 'Med-Injector',
    },
  },
  post_apoc: {
    terms: { species: 'Upbringing', class: 'Role', background: 'Before the Fall', spells: 'Tactics & Grit', cantrips: 'Field Tricks', spell: 'tactic' },
    languages: {
      Common: 'English (Local)', Dwarvish: 'Morse & Ham Code', Elvish: 'Trail Sign', Giant: 'Russian', Gnomish: 'Technical Jargon', Goblin: 'Scavenger Cant',
      Halfling: 'Spanish', Orc: 'Prison Slang', Abyssal: 'Arabic', Celestial: 'Old-World Latin', Draconic: 'Military Radio Code', 'Deep Speech': 'Mandarin',
      Infernal: 'ASL / Hand Signals', Primordial: 'French', Sylvan: 'Medical Jargon', Undercommon: 'Black-Market Code',
    },
    extraLanguages: ['German', 'Vietnamese', 'Portuguese'],
    species: {
      dwarf: { name: 'Homesteader / Prepper', blurb: 'Stocky, resilient rural folk raised on well water, canned stores and hard labor.' },
      elf: { name: 'Backcountry Hunter', blurb: 'Sharp-eyed woodsfolk who move quietly and keep watch while resting.' },
      halfling: { name: 'Urban Scavenger', blurb: 'Nimble, cool-headed survivors who slip past hordes and patrols unseen.' },
      human: { name: 'Town Survivor', blurb: 'Everyday citizens who adapted fast when the grid went down.' },
      dragonborn: { name: 'Breacher / Pyro Tech', blurb: 'Broad-shouldered heavy-gear specialists carrying improvised incendiary and chemical charges.' },
      gnome: { name: 'Ham-Radio Tinker', blurb: 'Clever electronics and mechanical specialists who keep generators and radios alive.' },
      half_elf: { name: 'Drifter / Courier', blurb: 'Road-tested go-betweens who bridge isolated settlements.' },
      half_orc: { name: 'Enforcer / Brawler', blurb: 'Scarred, relentless fighters who refuse to stay down when hit.' },
      tiefling: { name: 'Night-Watch Outcast', blurb: 'Hardened survivors used to darkness, fire and distrust.' },
    },
    classes: {
      barbarian: 'Brawler', bard: 'Community Leader', cleric: 'Field Medic', druid: 'Forager', fighter: 'Marksman / Veteran', monk: 'Close-Quarters Survivor',
      paladin: 'Sheriff / Protector', ranger: 'Scout', rogue: 'Scavenger', sorcerer: 'Instinctual Tactician', warlock: 'Faction Operative', wizard: 'Engineer / Strategist',
    },
    backgrounds: {
      acolyte: 'First Responder', veteran: 'National Guard / Police', urchin: 'Runaway', scholar: 'Town Teacher / Doctor', wanderer: 'Long-Haul Trucker',
      swindler: 'Black-Market Broker', folk_hero: 'Small-Town Mayor / Farmer', noble: 'Politician / Executive', performer: 'Radio Host', healer: 'ER Nurse / Paramedic', custom: 'Your Own Past',
    },
    items: {
      club: 'Baseball Bat', dagger: 'Hunting Knife', greatclub: 'Crowbar', handaxe: 'Hatchet', javelin: 'Sharpened Pole', light_hammer: 'Claw Hammer',
      mace: 'Tire Iron', quarterstaff: 'Walking Stick', sickle: 'Garden Sickle', spear: 'Pipe Spear', light_crossbow: '.22 Rifle', dart: 'Throwing Knife',
      shortbow: 'Recurve Bow', sling: 'Slingshot', battleaxe: 'Camp Axe', flail: 'Bike Chain', glaive: 'Pole Machete', greataxe: 'Fire Axe',
      greatsword: 'Katana', halberd: 'Pole Axe', lance: 'Rebar Lance', longsword: 'Machete', maul: 'Sledgehammer', morningstar: 'Nail Bat',
      pike: 'Pike Pole', rapier: 'Bayonet', scimitar: 'Kukri', shortsword: 'Combat Knife', trident: 'Pitchfork', war_pick: 'Pickaxe',
      warhammer: 'Framing Hammer', whip: 'Bullwhip', blowgun: 'Blowgun', hand_crossbow: 'Pistol', heavy_crossbow: 'Shotgun', longbow: 'Hunting Rifle', net: 'Fishing Net',
      padded: 'Layered Hoodie', leather: 'Leather Jacket', studded_leather: 'Motorcycle Leathers', hide: 'Canvas Hunting Coat', chain_shirt: 'Kevlar Vest', scale_mail: 'Sports Pads & Duct Tape',
      breastplate: 'Police Vest', half_plate: 'SWAT Armor', ring_mail: 'Layered Riot Pads', chain_mail: 'Riot Armor', splint: 'Plate Carrier', plate: 'Bomb Suit', shield: 'Riot Shield',
      arrows: 'Rifle Rounds (20)', bolts: 'Ammo Box (20)', sling_bullets: 'Ball Bearings (20)', needles: 'Darts (50)',
      component_pouch: 'Tool Pouch', arcane_focus: 'Field Notebook', druidic_focus: "Forager's Satchel", holy_symbol: 'First-Responder Badge', spellbook: 'Tactics Notebook',
      burglars_pack: "Looter's Bag", diplomats_pack: "Negotiator's Kit", dungeoneers_pack: 'Flashlight & Rope Kit', entertainers_pack: "Radio Host's Kit",
      explorers_pack: 'Bug-Out Bag', priests_pack: "Medic's Bag", scholars_pack: "Teacher's Satchel", rations: 'Canned Food', potion_healing: 'First-Aid Kit',
    },
  },
  wasteland: {
    terms: { species: 'Strain', class: 'Path', background: 'Before', spells: 'Mutations', cantrips: 'Minor Mutations', spell: 'mutation' },
    languages: {
      Common: 'Wasteland Trade-Talk', Dwarvish: 'Vault Code', Elvish: 'Pure-Strain Speech', Giant: 'Behemoth Rumble', Gnomish: 'Junk-Tinker Cant',
      Goblin: 'Raider Cant', Halfling: 'Tunnel Whistle', Orc: 'Brute Grunt', Abyssal: 'Cult Glossolalia', Celestial: 'Old-World Scripture',
      Draconic: 'Scaled Hiss', 'Deep Speech': 'Machine Static', Infernal: 'Rad-Glow Whisper', Primordial: 'Pre-War English',
      Sylvan: 'Green-Sage Root-Talk', Undercommon: 'Sewer Sign',
    },
    extraLanguages: ['Caravan Pidgin', 'Radio Morse'],
    species: {
      dwarf: { name: 'Bunker-Born', blurb: 'Raised underground in the old vaults — squat, tough, radiation-hardy.' },
      elf: { name: 'Pure-Strain', blurb: 'Rare, unmutated folk with sharp senses and long lives.' },
      halfling: { name: 'Tunnel Runt', blurb: 'Small scavengers who slip through ruins and somehow survive.' },
      human: { name: 'Wastelander', blurb: 'Plain survivors, adaptable to anything.' },
      dragonborn: { name: 'Scaled Mutant', blurb: 'Hulking, lizard-skinned mutants who spit chemical fire.' },
      gnome: { name: 'Junk Gnome', blurb: 'Small, wiry gadgeteers who can fix anything with scrap.' },
      half_elf: { name: 'Half-Pure', blurb: 'Part pure-strain, part wastelander, welcome nowhere.' },
      half_orc: { name: 'Brute Mutant', blurb: 'Big, tusked and very hard to kill.' },
      tiefling: { name: 'Rad-Touched', blurb: 'Glowing eyes and strange gifts from the fallout.' },
    },
    classes: {
      barbarian: 'Raider', bard: 'Radio Jockey', cleric: 'Prophet', druid: 'Green-Sage', fighter: 'Road Warrior', monk: 'Fist of the Waste',
      paladin: 'Sentinel', ranger: 'Pathfinder', rogue: 'Scavenger', sorcerer: 'Mutant', warlock: 'AI-Bound', wizard: 'Tinker',
    },
    backgrounds: {
      acolyte: 'Cult Initiate', veteran: 'Militia Veteran', urchin: 'Ruin Rat', scholar: 'Archivist', wanderer: 'Road Nomad',
      swindler: 'Trader-Cheat', folk_hero: 'Settlement Hero', noble: 'Warlord’s Kin', performer: 'Caravan Entertainer', healer: 'Wasteland Doc', custom: 'Your Own Past',
    },
    items: {
      club: 'Lead Pipe', dagger: 'Shiv', greatclub: 'Spiked Bat', handaxe: 'Hatchet', javelin: 'Sharpened Rebar', light_hammer: 'Claw Hammer',
      mace: 'Tire Iron', quarterstaff: 'Signpost Staff', sickle: 'Scrap Sickle', spear: 'Pipe Spear', light_crossbow: 'Pipe Rifle', dart: 'Throwing Nail',
      shortbow: 'Scrap Bow', sling: 'Slingshot', battleaxe: 'Stop-Sign Axe', flail: 'Chain & Padlock', glaive: 'Mower-Blade Pole', greataxe: 'Fire Axe',
      greatsword: 'Car-Spring Blade', halberd: 'Street-Sign Halberd', lance: 'Jousting Pole', longsword: 'Rebar Sword', maul: 'Sledgehammer', morningstar: 'Nail Bat',
      pike: 'Scrap Pike', rapier: 'Sharpened Antenna', scimitar: 'Machete', shortsword: 'Scrap Blade', trident: 'Fishing Spear', war_pick: 'Pickaxe',
      warhammer: 'Engine-Block Hammer', whip: 'Cable Whip', blowgun: 'Blowpipe', hand_crossbow: 'Zip Gun', heavy_crossbow: 'Rivet Cannon', longbow: 'Hunting Rifle', net: 'Fishing Net',
      padded: 'Quilted Rags', leather: 'Biker Leathers', studded_leather: 'Spiked Leathers', hide: 'Mutant Hide', chain_shirt: 'Chain-Link Vest', scale_mail: 'Hubcap Scale',
      breastplate: 'Riot Vest', half_plate: 'Riot Gear', ring_mail: 'Washer Mail', chain_mail: 'Fence Mail', splint: 'Road-Sign Armor', plate: 'Car-Door Plate', shield: 'Riot Shield',
      arrows: 'Scrap Rounds (20)', bolts: 'Pipe Rounds (20)', sling_bullets: 'Ball Bearings (20)', needles: 'Darts (50)',
      component_pouch: 'Rad-Salt Pouch', arcane_focus: 'Rad Crystal', druidic_focus: 'Seed Totem', holy_symbol: 'Cult Icon', spellbook: 'Salvaged Manual',
      burglars_pack: "Looter's Kit", diplomats_pack: "Trader's Kit", dungeoneers_pack: "Ruin-Diver's Kit", entertainers_pack: "Busker's Kit",
      explorers_pack: "Roadie's Kit", priests_pack: "Prophet's Kit", scholars_pack: "Archivist's Kit", rations: 'Canned Food', potion_healing: 'Stimpak',
    },
  },
};

const FANTASY_TERMS = { species: 'Species', class: 'Class', background: 'Background', spells: 'Spells', cantrips: 'Cantrips', spell: 'spell' };

export function genreTerms(genre) {
  return RESKINS[genre]?.terms || FANTASY_TERMS;
}

export function speciesName(id, genre) {
  return RESKINS[genre]?.species?.[id]?.name || SPECIES_BY_ID[id]?.name || id;
}

export function speciesBlurb(id, genre) {
  return RESKINS[genre]?.species?.[id]?.blurb || '';
}

export function className(id, genre) {
  return RESKINS[genre]?.classes?.[id] || CLASSES_BY_ID[id]?.name || id;
}

export function backgroundName(id, genre) {
  return RESKINS[genre]?.backgrounds?.[id] || BACKGROUNDS_BY_ID[id]?.name || id;
}

export function itemName(id, genre) {
  return RESKINS[genre]?.items?.[id] || ITEMS[id]?.name || id;
}

/** "Six-Shooter (Hand Crossbow)" in reskinned genres so the rules name stays discoverable. */
export function itemLabel(id, genre) {
  const name = itemName(id, genre);
  const base = ITEMS[id]?.name;
  return base && name !== base ? `${name} (${base})` : name;
}

/**
 * Genre name for an SRD language ("Dwarvish" → "Morse & Ham Code" in post_apoc).
 * Names that are already genre names (or unknown) pass through, so it is safe to apply twice.
 */
export function languageName(lang, genre) {
  return RESKINS[genre]?.languages?.[lang] || lang;
}

/** Languages a character of this genre can pick: the SRD list in fantasy/custom, otherwise the genre's own tongues. */
export function availableLanguages(genre) {
  const r = RESKINS[genre];
  if (!r?.languages) return LANGUAGES.slice();
  return Array.from(new Set([...LANGUAGES.map((l) => r.languages[l] || l), ...(r.extraLanguages || [])]));
}
