/**
 * Rules reference for the Almanac — how this engine plays the SRD 5.1 rules.
 * Paraphrased from the SRD 5.1 (CC BY 4.0, see docs/NOTICE.md); engine-specific notes are marked.
 */
export const RULES = [
  {
    id: 'checks',
    title: 'Ability checks',
    body: 'Roll d20 + ability modifier (+ proficiency if you are proficient in the skill). Meet or beat the DC to succeed. Typical DCs: 5 very easy, 10 easy, 15 medium, 20 hard, 25 very hard, 30 nearly impossible. In this engine every DC and modifier is shown before you roll.',
    tags: ['dc', 'skill', 'proficiency', 'roll'],
  },
  {
    id: 'advantage',
    title: 'Advantage and disadvantage',
    body: 'Advantage: roll two d20s and keep the higher. Disadvantage: keep the lower. Having both cancels out. Several sources of advantage do not stack.',
    tags: ['roll', 'd20'],
  },
  {
    id: 'saves',
    title: 'Saving throws',
    body: 'Resist a spell, trap, poison or effect with d20 + ability modifier (+ proficiency in your class saves) against the effect’s DC. Enemies here save with a visible flat +2 against your spell DC.',
    tags: ['save', 'dc', 'spell'],
  },
  {
    id: 'attacks',
    title: 'Attack rolls and Armor Class',
    body: 'Attack: d20 + ability modifier + proficiency (if proficient with the weapon). Hit if the total meets or beats the target’s AC. A natural 20 always hits and is a critical hit: roll the damage dice twice. A natural 1 always misses.',
    tags: ['combat', 'ac', 'critical', 'damage'],
  },
  {
    id: 'actions',
    title: 'Actions in combat',
    body: 'On your turn you can move and take one action: Attack, Cast a Spell, Dash (double move), Disengage (no opportunity attacks), Dodge (attacks against you have disadvantage), Help (give an ally advantage), Hide, Ready (prepare a trigger) or Use an Object. Some features and spells use a bonus action or reaction.',
    tags: ['combat', 'dash', 'dodge', 'disengage', 'help', 'hide', 'ready', 'bonus action', 'reaction'],
  },
  {
    id: 'initiative',
    title: 'Initiative',
    body: 'At the start of a fight everyone rolls d20 + Dexterity modifier. Turns go from highest to lowest.',
    tags: ['combat', 'dex', 'turn order'],
  },
  {
    id: 'death',
    title: 'Dropping to 0 HP and death saves',
    body: 'At 0 HP you fall unconscious. Each turn roll a d20 death save: 10 or higher is a success, below 10 a failure; a 1 counts as two failures and a 20 brings you back with 1 HP. Three successes stabilize you; three failures and you die. In this engine death is permanent: no rewinds.',
    tags: ['hp', 'unconscious', 'death', 'permadeath'],
  },
  {
    id: 'short-rest',
    title: 'Short rest',
    body: 'About an hour of downtime. Spend Hit Dice to heal (roll each die + Constitution modifier). Warlock pact slots return.',
    tags: ['rest', 'heal', 'hit dice', 'warlock'],
  },
  {
    id: 'long-rest',
    title: 'Long rest',
    body: 'Eight hours of sleep and light activity. Regain all HP, half your spent Hit Dice and all spell slots (and Mystic Arcanum). Only one long rest per day.',
    tags: ['rest', 'heal', 'slots'],
  },
  {
    id: 'spellcasting',
    title: 'Spell slots and upcasting',
    body: 'Leveled spells use a spell slot of their level or higher. A higher slot often adds dice (Fireball +1d6 per level above 3rd). Cantrips are free and grow stronger at character levels 5, 11 and 17. Slots come back on a long rest.',
    tags: ['spell', 'slot', 'upcast', 'cantrip'],
  },
  {
    id: 'concentration',
    title: 'Concentration',
    body: 'Some spells last only while you concentrate. Casting another concentration spell ends the first, and dropping to 0 HP ends it.',
    tags: ['spell', 'concentration'],
  },
  {
    id: 'spell-save-dc',
    title: 'Spell attack and save DC',
    body: 'Spell attack bonus = proficiency + spellcasting modifier. Spell save DC = 8 + proficiency + spellcasting modifier.',
    tags: ['spell', 'dc', 'attack'],
  },
  {
    id: 'proficiency',
    title: 'Proficiency bonus',
    body: '+2 at levels 1–4, +3 at 5–8, +4 at 9–12, +5 at 13–16, +6 at 17–20.',
    tags: ['level', 'proficiency'],
  },
  {
    id: 'xp',
    title: 'Experience and leveling pace (engine)',
    body: 'The engine, never the storyteller, awards XP. Deeds mode: XP for passed checks, foes overcome, places found, lore, allies, days survived and quests. Milestone mode: a level at major story beats with a cooldown. The leveling pace (Story, Standard, Slow, Gritty) and an XP fine-tune set how long levels take.',
    tags: ['xp', 'level', 'pace', 'milestone', 'deeds'],
  },
];
