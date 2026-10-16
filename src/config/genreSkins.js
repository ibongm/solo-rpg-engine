/**
 * Genre presets: keeps the 5e core stats (STR, DEX, CON, INT, WIS, CHA) and the 18 core
 * skills under the hood, but reskins their labels, the currency, and the theme per genre.
 */

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export const ABILITY_LABELS = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

/** Canonical 5e skills → governing ability. Keys are stable identifiers used everywhere. */
export const SKILLS = {
  acrobatics: 'dex',
  animal_handling: 'wis',
  arcana: 'int',
  athletics: 'str',
  deception: 'cha',
  history: 'int',
  insight: 'wis',
  intimidation: 'cha',
  investigation: 'int',
  medicine: 'wis',
  nature: 'int',
  perception: 'wis',
  performance: 'cha',
  persuasion: 'cha',
  religion: 'int',
  sleight_of_hand: 'dex',
  stealth: 'dex',
  survival: 'wis',
};

export const SKILL_KEYS = Object.keys(SKILLS);

const BASE_SKILL_LABELS = {
  acrobatics: 'Acrobatics',
  animal_handling: 'Animal Handling',
  arcana: 'Arcana',
  athletics: 'Athletics',
  deception: 'Deception',
  history: 'History',
  insight: 'Insight',
  intimidation: 'Intimidation',
  investigation: 'Investigation',
  medicine: 'Medicine',
  nature: 'Nature',
  perception: 'Perception',
  performance: 'Performance',
  persuasion: 'Persuasion',
  religion: 'Religion',
  sleight_of_hand: 'Sleight of Hand',
  stealth: 'Stealth',
  survival: 'Survival',
};

export const GENRES = {
  fantasy: {
    id: 'fantasy',
    label: 'High Fantasy',
    theme: 'fantasy',
    currencyLabel: 'Gold',
    skillLabels: { ...BASE_SKILL_LABELS },
    loreSkill: 'arcana',
    archetypes: ['Fighter', 'Rogue', 'Wizard', 'Cleric', 'Ranger', 'Paladin', 'Bard', 'Barbarian', 'Warlock', 'Druid'],
    rationLabel: 'Trail Rations',
    blurb: 'Swords, sorcery, ancient ruins and dragon-haunted peaks.',
  },
  frontier_noir: {
    id: 'frontier_noir',
    label: 'Gritty Frontier / Comic Noir',
    theme: 'frontier_noir',
    currencyLabel: 'Dollars',
    skillLabels: {
      ...BASE_SKILL_LABELS,
      animal_handling: 'Horsemanship',
      arcana: 'Occult Lore',
      history: 'Local History',
      investigation: 'Detective Work',
      nature: 'Wilderness Lore',
      religion: 'Scripture',
      performance: 'Showmanship',
      sleight_of_hand: 'Card Sharping',
      survival: 'Tracking',
    },
    loreSkill: 'investigation',
    archetypes: ['Gunslinger', 'Bounty Hunter', 'Private Eye', 'Gambler', 'Preacher', 'Outlaw', 'Sawbones', 'Lawman'],
    rationLabel: 'Hardtack & Jerky',
    blurb: 'Dust, smoke, six-guns and secrets in rain-slick alleys.',
  },
  scifi: {
    id: 'scifi',
    label: 'Sci-Fi',
    theme: 'scifi',
    currencyLabel: 'Credits',
    skillLabels: {
      ...BASE_SKILL_LABELS,
      animal_handling: 'Xenobiology',
      arcana: 'Tech / Science',
      history: 'Galactic History',
      medicine: 'Biomedicine',
      nature: 'Planetology',
      religion: 'Cultures',
      sleight_of_hand: 'Hacking',
      survival: 'Void Survival',
      performance: 'Broadcast',
    },
    loreSkill: 'arcana',
    archetypes: ['Pilot', 'Marine', 'Netrunner', 'Medic', 'Smuggler', 'Engineer', 'Psion', 'Diplomat'],
    rationLabel: 'Nutrient Bars',
    blurb: 'Starships, neon arcologies and the cold silence between stars.',
  },
  post_apoc: {
    id: 'post_apoc',
    label: 'Post-Apocalyptic',
    theme: 'frontier_noir',
    currencyLabel: 'Caps',
    skillLabels: {
      ...BASE_SKILL_LABELS,
      animal_handling: 'Beast Taming',
      arcana: 'Old-World Tech',
      history: 'Before-Times Lore',
      nature: 'Wasteland Lore',
      religion: 'Cult Lore',
      sleight_of_hand: 'Tinkering',
      survival: 'Scavenging',
    },
    loreSkill: 'nature',
    archetypes: ['Scavenger', 'Road Warrior', 'Wasteland Medic', 'Mutant', 'Raider', 'Tinker', 'Prophet'],
    rationLabel: 'Canned Food',
    blurb: 'Rust, radiation and the long road through what remains.',
  },
  custom: {
    id: 'custom',
    label: 'Custom',
    theme: 'fantasy',
    currencyLabel: 'Coin',
    skillLabels: { ...BASE_SKILL_LABELS },
    loreSkill: 'arcana',
    archetypes: ['Adventurer'],
    rationLabel: 'Rations',
    blurb: 'Your world, your rules.',
  },
};

export const GENRE_IDS = Object.keys(GENRES);

export const THEMES = {
  fantasy: 'Fantasy Parchment',
  frontier_noir: 'Frontier Comic-Noir',
  scifi: 'Sci-Fi Neon',
};

export const THEME_IDS = Object.keys(THEMES);

/** Builds the campaign-level skin (skill labels + currency) from a genre and optional overrides. */
export function buildSkin(genreId, overrides = {}) {
  const genre = GENRES[genreId] ?? GENRES.fantasy;
  return {
    genre: genre.id,
    currencyLabel: overrides.currencyLabel || genre.currencyLabel,
    rationLabel: overrides.rationLabel || genre.rationLabel,
    loreSkill: overrides.loreSkill || genre.loreSkill,
    skillLabels: { ...genre.skillLabels, ...(overrides.skillLabels || {}) },
  };
}

export function skillLabel(skillKey, skin) {
  if (!skillKey) return '';
  if (skin?.skillLabels?.[skillKey]) return skin.skillLabels[skillKey];
  if (BASE_SKILL_LABELS[skillKey]) return BASE_SKILL_LABELS[skillKey];
  if (ABILITY_LABELS[skillKey]) return ABILITY_LABELS[skillKey];
  return skillKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function themeForGenre(genreId) {
  return GENRES[genreId]?.theme ?? 'fantasy';
}

/** Dialogue Tone & Stance selector → pre-selected 5e skill. */
export const STANCES = {
  Diplomatic: 'persuasion',
  Aggressive: 'intimidation',
  Deceptive: 'deception',
  Investigative: 'insight',
  Tactical: null,
};

export const STANCE_KEYS = Object.keys(STANCES);
