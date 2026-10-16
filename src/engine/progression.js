/**
 * Character creation & progression math (5e-derived, deterministic).
 */
import { ABILITIES, SKILL_KEYS } from '../config/genreSkins.js';
import { MERCHANT_TEMPLATES, STARTER_KIT_NAMES } from '../config/catalog.js';
import { syncSpellcasting } from './spellProgress.js';
import { rollDie, uid, getDefaultRng } from './rng.js';

export const XP_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000,
  195000, 225000, 265000, 305000, 355000,
];

export const MAX_LEVEL = 20;

export const POINT_BUY_COSTS = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const POINT_BUY_BUDGET = 27;
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
export const SKILL_PICKS = 4;

export const HIT_DIE_BY_ARCHETYPE = {
  barbarian: 12,
  fighter: 10,
  paladin: 10,
  ranger: 10,
  gunslinger: 10,
  'bounty hunter': 10,
  lawman: 10,
  marine: 10,
  'road warrior': 10,
  raider: 10,
  mutant: 12,
  rogue: 8,
  cleric: 8,
  bard: 8,
  druid: 8,
  warlock: 8,
  'private eye': 8,
  gambler: 8,
  outlaw: 8,
  preacher: 8,
  sawbones: 8,
  pilot: 8,
  medic: 8,
  smuggler: 8,
  engineer: 8,
  diplomat: 8,
  scavenger: 8,
  'wasteland medic': 8,
  tinker: 8,
  prophet: 8,
  adventurer: 8,
  wizard: 6,
  netrunner: 6,
  psion: 6,
};

export function defaultHitDie(archetype) {
  return HIT_DIE_BY_ARCHETYPE[String(archetype || '').trim().toLowerCase()] ?? 8;
}

export function abilityMod(score) {
  return Math.floor(((Number(score) || 10) - 10) / 2);
}

export function levelForXp(xp) {
  let level = 1;
  for (let i = 0; i < XP_THRESHOLDS.length; i++) {
    if (xp >= XP_THRESHOLDS[i]) level = i + 1;
  }
  return Math.min(level, MAX_LEVEL);
}

export function xpForNextLevel(level) {
  if (level >= MAX_LEVEL) return null;
  return XP_THRESHOLDS[level];
}

export function proficiencyBonus(level) {
  return Math.ceil(Math.max(1, Math.min(MAX_LEVEL, level)) / 4) + 1;
}

/** Fixed (average) HP gain per level — no hidden rolls. */
export function hpGainPerLevel(hitDie, conScore) {
  return Math.max(1, Math.floor(hitDie / 2) + 1 + abilityMod(conScore));
}

export function startingHp(hitDie, conScore) {
  return Math.max(1, hitDie + abilityMod(conScore));
}

export function pointBuyCost(stats) {
  let total = 0;
  for (const ab of ABILITIES) {
    const cost = POINT_BUY_COSTS[stats[ab]];
    if (cost === undefined) return Infinity;
    total += cost;
  }
  return total;
}

/** 4d6, drop lowest — visible, deterministic given the RNG. Returns { score, rolls, dropped }. */
export function roll4d6DropLowest(rng = getDefaultRng()) {
  const rolls = [rollDie(6, rng), rollDie(6, rng), rollDie(6, rng), rollDie(6, rng)];
  const sorted = rolls.slice().sort((a, b) => a - b);
  return { score: sorted[1] + sorted[2] + sorted[3], rolls, dropped: sorted[0] };
}

/**
 * Applies an XP delta. Levels up with fixed HP gains and grows spellcasting (slots, new casters).
 * Returns { character, levelsGained } without mutating the input.
 */
export function applyXp(character, delta) {
  const xp = Math.max(0, (character.xp || 0) + (delta || 0));
  const oldLevel = character.level || 1;
  const newLevel = Math.max(oldLevel, levelForXp(xp));
  const levelsGained = newLevel - oldLevel;
  let vitals = character.vitals;
  if (levelsGained > 0) {
    const gain = (hpGainPerLevel(character.hitDie || 8, character.stats?.con ?? 10) + (character.hpBonusPerLevel || 0)) * levelsGained;
    vitals = { ...vitals, maxHp: vitals.maxHp + gain, hp: vitals.hp + gain };
  }
  const next = { ...character, xp, level: newLevel, vitals };
  return { character: levelsGained > 0 ? syncSpellcasting(next) : next, levelsGained };
}

// ── Custom Perk Tree ─────────────────────────────────────────────

export const PERK_TIERS = 5;

/** Character level required to unlock perks in a tier (1, 4, 7, 10, 13). */
export function perkTierUnlockLevel(tier) {
  return 1 + (tier - 1) * 3;
}

export function perkPointsAvailable(character) {
  const unlocked = (character.customPerkTree || []).filter((p) => p.unlocked).length;
  return Math.max(0, (character.level || 1) - unlocked);
}

export function canUnlockPerk(character, perkId) {
  const tree = character.customPerkTree || [];
  const perk = tree.find((p) => p.id === perkId);
  if (!perk) return { ok: false, reason: 'Perk not found.' };
  if (perk.unlocked) return { ok: false, reason: 'Already unlocked.' };
  if (perkPointsAvailable(character) <= 0) return { ok: false, reason: 'No perk points available (1 per level).' };
  const reqLevel = perkTierUnlockLevel(perk.tier);
  if ((character.level || 1) < reqLevel) return { ok: false, reason: `Requires level ${reqLevel}.` };
  if (perk.tier > 1 && !tree.some((p) => p.tier === perk.tier - 1 && p.unlocked)) {
    return { ok: false, reason: `Unlock a Tier ${perk.tier - 1} perk first.` };
  }
  return { ok: true, reason: '' };
}

export function unlockPerk(character, perkId) {
  const check = canUnlockPerk(character, perkId);
  if (!check.ok) throw new Error(check.reason);
  return {
    ...character,
    customPerkTree: character.customPerkTree.map((p) => (p.id === perkId ? { ...p, unlocked: true } : p)),
  };
}

/** Sums a modifier key across unlocked perks. */
export function perkModifier(character, key) {
  let total = 0;
  for (const perk of character.customPerkTree || []) {
    if (perk.unlocked && perk.modifiers && typeof perk.modifiers[key] === 'number') total += perk.modifiers[key];
  }
  return total;
}

/** Normalizes AI-generated perk trees into the Firestore shape. */
export function normalizePerkTree(perks) {
  const allowedKeys = new Set([...ABILITIES, ...SKILL_KEYS, 'ac', 'attack', 'damage', 'checks', 'initiative', 'maxHp', 'speed']);
  return (Array.isArray(perks) ? perks : [])
    .map((p, i) => {
      const modifiers = {};
      for (const [k, v] of Object.entries(p.modifiers || {})) {
        const n = Math.round(Number(v));
        if (allowedKeys.has(k) && Number.isFinite(n) && n !== 0) modifiers[k] = Math.max(-2, Math.min(3, n));
      }
      return {
        id: p.id ? String(p.id) : `perk_${i}`,
        tier: Math.max(1, Math.min(PERK_TIERS, Math.round(Number(p.tier) || 1))),
        name: String(p.name || `Perk ${i + 1}`).slice(0, 60),
        description: String(p.description || '').slice(0, 280),
        unlocked: false,
        modifiers,
      };
    })
    .sort((a, b) => a.tier - b.tier);
}

// ── Character factory ───────────────────────────────────────────

export function itemFromTemplate(template) {
  return {
    id: uid('item'),
    name: template.name,
    type: template.type,
    equipped: false,
    damageDice: template.damageDice ?? null,
    statModifiers: { ...(template.statModifiers || {}) },
    craftingTags: [...(template.craftingTags || [])],
    description: template.description || '',
    value: template.value ?? 1,
  };
}

export function starterKit(genre) {
  const templates = MERCHANT_TEMPLATES[genre] || MERCHANT_TEMPLATES.fantasy;
  const names = STARTER_KIT_NAMES[genre] || STARTER_KIT_NAMES.fantasy;
  const items = [];
  let weaponEquipped = false;
  let armorEquipped = false;
  for (const name of names) {
    const tpl = templates.find((t) => t.name === name);
    if (!tpl) continue;
    const item = itemFromTemplate(tpl);
    if (item.type === 'weapon' && !weaponEquipped) {
      item.equipped = true;
      weaponEquipped = true;
    }
    if (item.type === 'armor' && !armorEquipped) {
      item.equipped = true;
      armorEquipped = true;
    }
    items.push(item);
  }
  return items;
}

/**
 * Builds a full Firestore character document.
 * Base AC = 10 + DEX mod; armor/perk AC bonuses are applied at read time (see diceEngine.effectiveAc).
 */
export function createCharacter({
  name,
  genre = 'fantasy',
  classOrArchetype = 'Adventurer',
  stats,
  skillProficiencies = [],
  hitDie,
  currencyLabel = 'Gold',
  startingCurrency = 50,
  customPerkTree = [],
  backstory = '',
}) {
  const die = hitDie || defaultHitDie(classOrArchetype);
  const maxHp = startingHp(die, stats.con);
  const now = Date.now();
  return {
    name: String(name || 'Nameless').trim().slice(0, 60),
    genre,
    classOrArchetype: String(classOrArchetype || 'Adventurer').slice(0, 60),
    level: 1,
    xp: 0,
    status: 'alive',
    portraitUrl: null,
    hitDie: die,
    backstory: String(backstory || '').slice(0, 2000),
    stats: { ...stats },
    skillProficiencies: skillProficiencies.filter((s) => SKILL_KEYS.includes(s)),
    vitals: {
      hp: maxHp,
      maxHp,
      tempHp: 0,
      ac: 10 + abilityMod(stats.dex),
      speed: 30,
      deathSaves: { successes: 0, failures: 0 },
      conditions: [],
    },
    currency: { amount: startingCurrency, label: currencyLabel },
    customPerkTree,
    inventory: starterKit(genre),
    companionRoster: [],
    activeCampaignId: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Deep clone a character as a fresh level-1-state copy for the vault ("Clone"). */
export function cloneCharacter(character) {
  const copy = JSON.parse(JSON.stringify(character));
  copy.name = `${character.name} (Copy)`;
  copy.activeCampaignId = null;
  copy.status = 'alive';
  copy.vitals = { ...copy.vitals, hp: copy.vitals.maxHp, deathSaves: { successes: 0, failures: 0 }, conditions: [] };
  copy.inventory = (copy.inventory || []).map((it) => ({ ...it, id: uid('item') }));
  copy.companionRoster = [];
  copy.createdAt = Date.now();
  copy.updatedAt = Date.now();
  delete copy.id;
  return copy;
}
