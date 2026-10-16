/**
 * Short help for tooltips: what a rule does (mechanics) and what it feels like (flavor).
 * Keys are `group.id`, e.g. 'ability.dex', 'skill.stealth', 'condition.prone', 'forge.xpPace'.
 * Rules text is paraphrased from the SRD 5.1 (CC BY 4.0, see docs/NOTICE.md).
 */

const ABILITY = {
  str: ['Strength', 'Athletics, melee attacks with most weapons, carrying and breaking things.', 'Raw physical power.'],
  dex: ['Dexterity', 'Acrobatics, Stealth, Sleight of Hand, ranged and finesse attacks, initiative and AC in light armor.', 'Agility, reflexes and balance.'],
  con: ['Constitution', 'Hit points per level and Constitution saves (poison, exhaustion, holding concentration).', 'Health, stamina and grit.'],
  int: ['Intelligence', 'Arcana, History, Investigation, Nature, Religion; wizards cast with it.', 'Memory, reasoning and learning.'],
  wis: ['Wisdom', 'Animal Handling, Insight, Medicine, Perception, Survival; clerics, druids and rangers cast with it.', 'Awareness, intuition and willpower.'],
  cha: ['Charisma', 'Deception, Intimidation, Performance, Persuasion; bards, paladins, sorcerers and warlocks cast with it.', 'Force of personality.'],
};

const SKILL = {
  acrobatics: ['dex', 'Keep your balance, tumble, flip or slip out of a grapple.'],
  animal_handling: ['wis', 'Calm, read or control an animal.'],
  arcana: ['int', 'Recall lore about magic, spells, planes and strange artifacts.'],
  athletics: ['str', 'Climb, jump, swim, shove and grapple.'],
  deception: ['cha', 'Lie convincingly, bluff or wear a disguise well.'],
  history: ['int', 'Recall events, people, wars and lost places.'],
  insight: ['wis', 'Tell whether someone is lying and read their intentions.'],
  intimidation: ['cha', 'Influence through threats, hostility or menace.'],
  investigation: ['int', 'Search for clues and deduce how things fit together.'],
  medicine: ['wis', 'Stabilize the dying and diagnose illness.'],
  nature: ['int', 'Recall lore about terrain, plants, animals and weather.'],
  perception: ['wis', 'Notice things: hidden foes, sounds, a trap, a detail out of place.'],
  performance: ['cha', 'Entertain with music, acting, storytelling or dance.'],
  persuasion: ['cha', 'Influence through tact, good nature and reason.'],
  religion: ['int', 'Recall lore about faiths, rites, gods and holy symbols.'],
  sleight_of_hand: ['dex', 'Pick a pocket, palm an object, plant something unseen.'],
  stealth: ['dex', 'Move unseen and unheard.'],
  survival: ['wis', 'Track, hunt, navigate the wild and predict the weather.'],
};

const STAT = {
  save: ['Saving throw', 'd20 + ability modifier (+ proficiency if your class grants it) to resist a spell, trap or poison. The DC is always shown.'],
  ac: ['Armor Class (AC)', 'How hard you are to hit. An attack hits if its total meets or beats your AC.'],
  speed: ['Speed', 'How far you move in a round, in feet.'],
  hitDie: ['Hit Die', 'Your class die. Sets HP per level, and you spend Hit Dice to heal on a short rest.'],
  proficiency: ['Proficiency bonus', '+2 at level 1, rising to +6 by level 17. Added to checks, saves and attacks you are proficient in.'],
  initiative: ['Initiative', 'd20 + Dexterity at the start of combat. Highest acts first.'],
  hp: ['Hit points', 'At 0 you fall unconscious and make death saves: three failures and you die (permanently).'],
};

const PROPERTY = {
  finesse: ['Finesse', 'Use Strength or Dexterity (your choice) for attack and damage.'],
  light: ['Light', 'Small and easy to handle; good for fighting with two weapons.'],
  heavy: ['Heavy', 'Small characters attack with disadvantage.'],
  versatile: ['Versatile', 'One or two hands; two hands use the larger damage die.'],
  reach: ['Reach', 'Attack targets 10 ft away instead of 5 ft.'],
  thrown: ['Thrown', 'Throw it for a ranged attack using the same ability as melee.'],
  loading: ['Loading', 'Only one shot per action, however many attacks you have.'],
  ammunition: ['Ammunition', 'Needs ammunition; each shot uses one (you can recover half after a fight).'],
  'two-handed': ['Two-handed', 'Needs both hands to attack.'],
};

const CONDITION = {
  blinded: ['Blinded', 'You fail checks that need sight. Your attacks have disadvantage; attacks against you have advantage.'],
  charmed: ['Charmed', 'You cannot attack the charmer, and it has advantage on social checks with you.'],
  frightened: ['Frightened', 'Disadvantage on checks and attacks while you can see the source; you cannot move closer to it.'],
  grappled: ['Grappled', 'Your speed is 0 until you escape.'],
  incapacitated: ['Incapacitated', 'You cannot take actions or reactions.'],
  invisible: ['Invisible', 'You cannot be seen. Your attacks have advantage; attacks against you have disadvantage.'],
  paralyzed: ['Paralyzed', 'Incapacitated, cannot move or speak; fail Str and Dex saves. Hits from within 5 ft are critical.'],
  poisoned: ['Poisoned', 'Disadvantage on attack rolls and ability checks.'],
  prone: ['Prone', 'You can only crawl. Your attacks have disadvantage; melee attacks against you have advantage, ranged ones disadvantage.'],
  restrained: ['Restrained', 'Speed 0; your attacks and Dex saves have disadvantage; attacks against you have advantage.'],
  stunned: ['Stunned', 'Incapacitated, cannot move; fail Str and Dex saves; attacks against you have advantage.'],
  unconscious: ['Unconscious', 'Incapacitated and prone, drop what you hold, fail Str and Dex saves. Hits from within 5 ft are critical.'],
};

const FORGE = {
  tone: ['Narrative tone', 'From light-hearted to grim. Changes how the storyteller writes, never the dice.'],
  strictness: ['Rules strictness', 'How often the storyteller asks for rolls and how hard it holds you to costs. Every DC is still shown before you roll.'],
  quests: ['Quests', 'On: a main quest, bounties and rumors with rewards. Off: a sandbox where you set your own goals.'],
  xpMode: ['Experience mode', 'Deeds: XP for what you do, computed by the engine. Milestone: a level at major story beats, with a cooldown.'],
  xpPace: ['Leveling pace', 'How many turns a level takes. Story is fast; Standard, Slow and Gritty make later levels take longer.'],
  xpFineTune: ['XP fine-tune', 'Multiplies deed XP on top of the pace, from 0.5× to 2×.'],
  actionMode: ['Action input', 'Guided: three suggested actions. Freeform: type anything. Hybrid: both.'],
  diceMode: ['Dice', 'Digital: the engine rolls for you. Physical: roll real dice and enter the faces. The math is the engine’s either way.'],
  imageMode: ['Scene images', 'Off, on request, or automatic paintings of important scenes (costs image generation).'],
};

const STANCE = {
  Diplomatic: ['Diplomatic', 'Talk it out. Primes Persuasion.'],
  Aggressive: ['Aggressive', 'Force and threat. Primes Intimidation.'],
  Deceptive: ['Deceptive', 'Lies and misdirection. Primes Deception.'],
  Investigative: ['Investigative', 'Read people and clues. Primes Insight.'],
  Tactical: ['Tactical', 'Positioning and planning. No skill is primed; the storyteller asks for whatever fits.'],
};

const ABILITY_SHORT = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };

export const HELP = {
  ...Object.fromEntries(Object.entries(ABILITY).map(([k, [title, details, flavor]]) => [`ability.${k}`, { title, details, flavor, badge: ABILITY_SHORT[k] }])),
  ...Object.fromEntries(Object.entries(SKILL).map(([k, [ab, details]]) => [`skill.${k}`, { title: null, details, badge: ABILITY_SHORT[ab] }])),
  ...Object.fromEntries(Object.entries(STAT).map(([k, [title, details]]) => [`stat.${k}`, { title, details }])),
  ...Object.fromEntries(Object.entries(PROPERTY).map(([k, [title, details]]) => [`property.${k}`, { title, details }])),
  ...Object.fromEntries(Object.entries(CONDITION).map(([k, [title, details]]) => [`condition.${k}`, { title, details }])),
  ...Object.fromEntries(Object.entries(FORGE).map(([k, [title, details]]) => [`forge.${k}`, { title, details }])),
  ...Object.fromEntries(Object.entries(STANCE).map(([k, [title, details]]) => [`stance.${k}`, { title, details }])),
};

/** Help entry for a key, or null. Skill titles are filled in by the caller (they are genre-reskinned). */
export function help(key) {
  return HELP[key] || null;
}
