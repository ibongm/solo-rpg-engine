/**
 * Deterministic JS Dice Engine — the Rules Lawyer.
 * total = d20 + statMod + proficiency + weatherMod + itemMod (+ perkMod)
 * Every component is returned in a visible breakdown. The LLM never rolls.
 */
import { ABILITIES, ABILITY_LABELS, SKILLS, SKILL_KEYS, skillLabel } from '../config/genreSkins.js';
import { abilityMod, proficiencyBonus, perkModifier } from './progression.js';
import { rollDie, getDefaultRng } from './rng.js';
import { isSrdCharacter, isWeaponProficient, isArmorProficient } from './characterBuilder.js';
import { SPELLS_BY_ID } from '../config/spells.js';

// ── Dice expressions ─────────────────────────────────────────────

const DICE_RE = /^\s*(\d*)\s*d\s*(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i;

/** Parses "2d6+3", "d20", "1d8 - 1", or a flat number "4". Returns null if invalid. */
export function parseDice(expr) {
  if (expr === null || expr === undefined) return null;
  const str = String(expr).trim();
  if (/^-?\d+$/.test(str)) return { count: 0, sides: 0, bonus: parseInt(str, 10) };
  const m = DICE_RE.exec(str);
  if (!m) return null;
  const count = m[1] === '' ? 1 : parseInt(m[1], 10);
  const sides = parseInt(m[2], 10);
  if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null;
  const bonus = m[3] ? (m[3] === '-' ? -1 : 1) * parseInt(m[4], 10) : 0;
  return { count, sides, bonus };
}

/**
 * Rolls a dice expression. `critical` doubles the dice count (5e crit).
 * Returns { expr, rolls, bonus, total }.
 */
export function rollDice(expr, { critical = false, rng = getDefaultRng() } = {}) {
  const parsed = parseDice(expr);
  if (!parsed) throw new Error(`Invalid dice expression: ${expr}`);
  const count = critical ? parsed.count * 2 : parsed.count;
  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push(rollDie(parsed.sides, rng));
  const total = Math.max(0, rolls.reduce((a, b) => a + b, 0) + parsed.bonus);
  return { expr: String(expr), rolls, bonus: parsed.bonus, total, critical };
}

/**
 * Chance (0–1) that d20 + totalModifier meets a DC: a natural 20 always succeeds and a natural 1 always
 * fails; advantage keeps the better of two d20s, disadvantage the worse.
 */
export function successChance(totalModifier, dc, advantage = 'normal') {
  if (dc === null || dc === undefined || !Number.isFinite(Number(dc))) return null;
  let hits = 0;
  for (let r = 1; r <= 20; r++) if (r === 20 || (r !== 1 && r + (Number(totalModifier) || 0) >= Number(dc))) hits++;
  const p = hits / 20;
  if (advantage === 'advantage') return 1 - (1 - p) ** 2;
  if (advantage === 'disadvantage') return p ** 2;
  return p;
}

/** Totals manual physical dice for an expression: values are the faces the player rolled. */
export function totalManualDice(expr, faces, { critical = false } = {}) {
  const parsed = parseDice(expr);
  if (!parsed) throw new Error(`Invalid dice expression: ${expr}`);
  const count = critical ? parsed.count * 2 : parsed.count;
  if (faces.length !== count) throw new Error(`Expected ${count} dice for ${expr}${critical ? ' (critical)' : ''}.`);
  for (const f of faces) {
    if (!Number.isInteger(f) || f < 1 || f > parsed.sides) throw new Error(`Each die must be 1–${parsed.sides}.`);
  }
  const total = Math.max(0, faces.reduce((a, b) => a + b, 0) + parsed.bonus);
  return { expr: String(expr), rolls: faces.slice(), bonus: parsed.bonus, total, critical };
}

// ── Modifier sources ─────────────────────────────────────────────

export function equippedItems(character) {
  return (character?.inventory || []).filter((i) => i.equipped);
}

/** Sums a statModifier key across equipped items. */
export function itemModifier(character, key) {
  let total = 0;
  for (const item of equippedItems(character)) {
    const v = item.statModifiers?.[key];
    if (typeof v === 'number') total += v;
  }
  return total;
}

/** Effective ability score including equipped item and perk bonuses. */
export function effectiveAbility(character, ability) {
  return (character?.stats?.[ability] ?? 10) + itemModifier(character, ability) + perkModifier(character, ability);
}

/** Equipped body armor (SRD light/medium/heavy), if any. */
export function equippedBodyArmor(character) {
  return equippedItems(character).find((i) => i.type === 'armor' && i.armorCategory && i.armorCategory !== 'shield') || null;
}

export function equippedShield(character) {
  return equippedItems(character).find((i) => i.armorCategory === 'shield') || null;
}

/**
 * Armor Class.
 *  - SRD body armor: base AC + Dex (capped by the armor's category).
 *  - No body armor: SRD characters use 10 + Dex, or their class's Unarmored Defense;
 *    legacy characters keep their stored base AC.
 *  - Shield, item 'ac' bonuses (legacy armor, upgrades), perks and the Defense fighting style add on top.
 */
export function effectiveAc(character) {
  const dex = abilityMod(effectiveAbility(character, 'dex'));
  const body = equippedBodyArmor(character);
  const shield = equippedShield(character);
  let base;
  if (body) {
    const cap = body.dexCap;
    base = (Number(body.baseAc) || 10) + (cap === 0 ? 0 : cap === null || cap === undefined ? dex : Math.min(dex, cap));
  } else if (isSrdCharacter(character)) {
    const ud = character.unarmoredDefense;
    if (ud === 'con') base = 10 + dex + abilityMod(effectiveAbility(character, 'con'));
    else if (ud === 'wis' && !shield) base = 10 + dex + abilityMod(effectiveAbility(character, 'wis'));
    else if (ud === 'draconic') base = 13 + dex;
    else base = 10 + dex;
  } else {
    base = character?.vitals?.ac ?? 10;
  }
  if (!body && hasEffect(character, 'mage_armor')) base = Math.max(base, 13 + dex);
  const shieldAc = shield ? Number(shield.baseAc) || 2 : 0;
  const defense = character?.fightingStyle === 'defense' && body ? 1 : 0;
  const faith = hasEffect(character, 'shield_of_faith') ? 2 : 0;
  return base + shieldAc + defense + faith + itemModifier(character, 'ac') + perkModifier(character, 'ac');
}

/** Armor the character is not proficient with — imposes disadvantage on Str/Dex rolls and attacks. */
export function unproficientArmor(character) {
  return equippedItems(character).filter((i) => i.armorCategory && !isArmorProficient(character, i));
}

export function effectiveMaxHp(character) {
  return (character?.vitals?.maxHp ?? 1) + perkModifier(character, 'maxHp');
}

export function effectiveSpeed(character) {
  const body = equippedBodyArmor(character);
  const tooHeavy = body?.strReq && effectiveAbility(character, 'str') < body.strReq && !character?.ignoresHeavyArmorSpeed ? -10 : 0;
  const stride = hasEffect(character, 'longstrider') ? 10 : 0;
  return Math.max(0, (character?.vitals?.speed ?? 30) + perkModifier(character, 'speed') + tooHeavy + stride);
}

/** Engine-tracked spell effects (Mage Armor, Shield of Faith, Longstrider, Bless …). */
export function hasEffect(character, id) {
  return (character?.activeEffects || []).some((e) => e.id === id);
}

/** Which ability casts a spell for this character (species cantrips use their own ability). */
export function spellAbilityFor(character, spellId) {
  if (spellId && character?.speciesCantrip?.id === spellId) return character.speciesCantrip.ability;
  return character?.spellcasting?.ability || character?.speciesCantrip?.ability || null;
}

/** Cantrip damage grows at levels 5, 11 and 17: '1d10' → '2d10' → '3d10' → '4d10'. */
function castSlot(spell, slot) {
  return spell.level > 0 ? Math.max(spell.level, Math.min(9, Number(slot) || spell.level)) : 0;
}

/** Damage dice for a spell: cantrips scale with character level, leveled spells with the slot used. */
export function spellDamageAt(spell, characterLevel, slot = null) {
  if (!spell?.damage) return null;
  if (spell.scales) return scaleCantripDice(spell.damage, characterLevel);
  return upcastDice(spell.damage, spell.upcast, castSlot(spell, slot) - spell.level);
}

export function scaleCantripDice(expr, level) {
  const m = /^(\d+)d(\d+)(.*)$/.exec(String(expr || ''));
  if (!m) return expr;
  const mult = level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1;
  return `${Number(m[1]) * mult}d${m[2]}${m[3]}`;
}

/**
 * Adds upcast dice to the base die count: upcastDice('8d6', '1d6', 2) → '10d6'.
 * (SRD upcasts always add the spell's own die type.)
 */
export function upcastDice(expr, upcast, times) {
  const n = Math.max(0, Math.floor(Number(times) || 0));
  if (!expr || !upcast || !n) return expr;
  const base = /^(\d+)d(\d+)(.*)$/.exec(String(expr));
  const add = /^(\d+)d(\d+)$/.exec(String(upcast));
  if (!base || !add) return expr;
  return `${Number(base[1]) + Number(add[1]) * n}d${base[2]}${base[3]}`;
}

export function equippedWeapon(character) {
  return equippedItems(character).find((i) => i.type === 'weapon') || null;
}

const WEATHER_KEYWORDS = {
  ranged: ['ranged', 'missile', 'shooting', 'firearm', 'gun', 'archery'],
  melee: ['melee'],
  perception: ['perception', 'sight', 'visibility', 'spot'],
  stealth: ['stealth', 'sneak', 'hide'],
  survival: ['survival', 'tracking', 'navigation', 'scavenging'],
  athletics: ['athletics', 'climb', 'swim'],
  acrobatics: ['acrobatics', 'footing', 'balance'],
  all: ['all checks', 'all rolls', 'everything', 'all ability', 'all attack'],
};

/**
 * Determines which rolls the current weather affects.
 * Uses an explicit `affects` list if present, otherwise parses `mechanicalEffect` text.
 */
export function weatherAffects(weather) {
  if (!weather) return [];
  if (Array.isArray(weather.affects) && weather.affects.length) return weather.affects;
  const text = String(weather.mechanicalEffect || '').toLowerCase();
  const out = [];
  for (const [key, words] of Object.entries(WEATHER_KEYWORDS)) {
    if (words.some((w) => text.includes(w))) out.push(key);
  }
  return out;
}

/** Weather modifier applied to a specific roll. */
export function weatherModifierFor(weather, { skill = null, isAttack = false, isRanged = false } = {}) {
  const value = Number(weather?.modifierValue) || 0;
  if (!value) return 0;
  const affects = weatherAffects(weather);
  if (affects.includes('all')) return value;
  if (isAttack && isRanged && affects.includes('ranged')) return value;
  if (isAttack && !isRanged && affects.includes('melee')) return value;
  if (skill && affects.includes(skill)) return value;
  return 0;
}

// ── Conditions ───────────────────────────────────────────────────

export const CONDITION_EFFECTS = {
  poisoned: { checks: 'disadvantage', attacks: 'disadvantage', note: 'Disadvantage on attacks and ability checks.' },
  frightened: { checks: 'disadvantage', attacks: 'disadvantage', note: 'Disadvantage on attacks and ability checks.' },
  exhausted: { checks: 'disadvantage', attacks: null, note: 'Disadvantage on ability checks.' },
  blinded: { checks: null, attacks: 'disadvantage', note: 'Disadvantage on attacks.' },
  prone: { checks: null, attacks: 'disadvantage', note: 'Disadvantage on attacks.' },
  inspired: { checks: 'advantage', attacks: null, note: 'Advantage on ability checks.' },
  hidden: { checks: null, attacks: 'advantage', note: 'Advantage on attacks.' },
};

/** Combines advantage sources per 5e: any adv + any disadv = normal. */
export function combineAdvantage(states) {
  const hasAdv = states.includes('advantage');
  const hasDis = states.includes('disadvantage');
  if (hasAdv && hasDis) return 'normal';
  if (hasAdv) return 'advantage';
  if (hasDis) return 'disadvantage';
  return 'normal';
}

// ── Normalizing AI roll requests ─────────────────────────────────

const ABILITY_ALIASES = {
  str: 'str', strength: 'str',
  dex: 'dex', dexterity: 'dex',
  con: 'con', constitution: 'con',
  int: 'int', intelligence: 'int',
  wis: 'wis', wisdom: 'wis',
  cha: 'cha', charisma: 'cha',
};

const norm = (s) => String(s || '').trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z_:]/g, '');

/**
 * Maps a free-form skill_or_stat string (e.g. "Persuasion", "Card Sharping", "DEX save",
 * "attack", "Dexterity", "initiative") onto an engine roll descriptor.
 * Returns { kind: 'skill'|'ability'|'save'|'attack'|'initiative', key }.
 */
export function normalizeSkillOrStat(raw, skin) {
  const s = norm(raw);
  if (!s) return { kind: 'ability', key: 'wis' };
  // "spell_attack:fire_bolt" or "spell_attack:acid_arrow:3" (cast with a 3rd-level slot) — requested by the
  // storyteller for a cast the engine set up.
  if (s.startsWith('spell_attack') || s.startsWith('spellattack')) {
    const id = s.split(':')[1] || null;
    const slot = /:\s*([1-9])\s*$/.exec(String(raw))?.[1]; // read from raw: norm() drops digits
    const spellSlot = slot ? Number(slot) : null;
    return { kind: 'attack', key: 'spell', spellId: id && SPELLS_BY_ID[id] ? id : null, ...(spellSlot ? { spellSlot } : {}) };
  }
  if (s.startsWith('attack') || s.includes('attack_roll') || s === 'to_hit') {
    const ranged = s.includes('ranged');
    const melee = s.includes('melee');
    return { kind: 'attack', key: ranged ? 'ranged' : melee ? 'melee' : 'weapon' };
  }
  if (s.includes('initiative')) return { kind: 'initiative', key: 'dex' };
  const saveMatch = s.match(/^(str|dex|con|int|wis|cha|strength|dexterity|constitution|intelligence|wisdom|charisma)_?(saving_throw|save|st)$/) ||
    s.match(/^(saving_throw|save)_?(str|dex|con|int|wis|cha|strength|dexterity|constitution|intelligence|wisdom|charisma)$/);
  if (saveMatch) {
    const abilityWord = ABILITY_ALIASES[saveMatch[1]] ? saveMatch[1] : saveMatch[2];
    return { kind: 'save', key: ABILITY_ALIASES[abilityWord] };
  }
  if (SKILLS[s]) return { kind: 'skill', key: s };
  // Reskinned labels, e.g. "Card Sharping" → sleight_of_hand
  if (skin?.skillLabels) {
    for (const [key, label] of Object.entries(skin.skillLabels)) {
      if (norm(label) === s) return { kind: 'skill', key };
    }
  }
  // "Wisdom (Perception)" style
  for (const key of SKILL_KEYS) {
    if (s.includes(key)) return { kind: 'skill', key };
  }
  if (skin?.skillLabels) {
    for (const [key, label] of Object.entries(skin.skillLabels)) {
      if (s.includes(norm(label))) return { kind: 'skill', key };
    }
  }
  if (ABILITY_ALIASES[s]) return { kind: 'ability', key: ABILITY_ALIASES[s] };
  for (const [alias, key] of Object.entries(ABILITY_ALIASES)) {
    if (alias.length > 3 && s.includes(alias)) return { kind: 'ability', key };
  }
  return { kind: 'ability', key: 'wis' };
}

// ── Building a check ─────────────────────────────────────────────

/**
 * Builds a fully visible check before any dice are rolled.
 * @param {object} p
 * @param {object} p.character
 * @param {string|object} p.skillOrStat  raw string or a normalized descriptor
 * @param {number|null} p.dc             target number (AC for attacks)
 * @param {'normal'|'advantage'|'disadvantage'} [p.advantage]
 * @param {object} [p.weather]
 * @param {object} [p.skin]
 * @param {object} [p.weapon]            explicit weapon for attacks (defaults to equipped)
 * @param {Array<{label:string,value:number}>} [p.extraModifiers]
 */
export function buildCheck({ character, skillOrStat, dc = null, advantage = 'normal', weather = null, skin = null, weapon = null, spell = null, spellSlot = null, extraModifiers = [], reason = '' }) {
  const desc = typeof skillOrStat === 'object' && skillOrStat ? skillOrStat : normalizeSkillOrStat(skillOrStat, skin);
  const spellDef = spell || (desc.key === 'spell' && desc.spellId ? SPELLS_BY_ID[desc.spellId] : null);
  const level = character?.level || 1;
  const prof = proficiencyBonus(level);
  const breakdown = [];
  let ability;
  let proficient = false;
  let label;
  let isAttack = false;
  let isRanged = false;
  let usedWeapon = null;

  const srd = isSrdCharacter(character);
  let expert = false;
  const advNotes = [];
  if (desc.kind === 'attack' && (desc.key === 'spell' || spellDef)) {
    // Spell attack: spellcasting ability + proficiency, no weapon.
    isAttack = true;
    ability = spellAbilityFor(character, spellDef?.id) || 'int';
    proficient = true;
    isRanged = spellDef ? spellDef.attackType !== 'melee' : true;
    label = spellDef ? `Spell Attack — ${spellDef.name}` : 'Spell Attack';
  } else if (desc.kind === 'attack') {
    isAttack = true;
    usedWeapon = weapon || equippedWeapon(character);
    const tags = usedWeapon?.craftingTags || [];
    const props = usedWeapon?.properties || [];
    isRanged = desc.key === 'ranged' || tags.includes('ranged');
    const finesse = tags.includes('finesse') || props.includes('finesse') || (character?.martialArts && isMonkWeapon(usedWeapon));
    const strMod = abilityMod(effectiveAbility(character, 'str'));
    const dexMod = abilityMod(effectiveAbility(character, 'dex'));
    ability = isRanged ? 'dex' : finesse ? (dexMod >= strMod ? 'dex' : 'str') : 'str';
    // Legacy characters are proficient with any equipped weapon; SRD characters follow their proficiency list
    // and, as in 5e, are always proficient with unarmed strikes.
    proficient = usedWeapon ? isWeaponProficient(character, usedWeapon) : srd;
    label = usedWeapon ? `Attack — ${usedWeapon.name}` : 'Attack — Unarmed';
    if (usedWeapon && props.includes('heavy') && character?.size === 'small') advNotes.push(['heavy weapon (Small)', 'disadvantage']);
  } else if (desc.kind === 'skill') {
    ability = SKILLS[desc.key];
    proficient = (character?.skillProficiencies || []).includes(desc.key);
    expert = proficient && (character?.expertise || []).includes(desc.key);
    label = skillLabel(desc.key, skin);
    if (desc.key === 'stealth' && equippedItems(character).some((i) => i.stealthDisadvantage)) advNotes.push(['armor (Stealth)', 'disadvantage']);
  } else if (desc.kind === 'save') {
    ability = desc.key;
    proficient = (character?.savingThrows || []).includes(desc.key);
    label = `${ABILITY_LABELS[desc.key]} Save`;
  } else if (desc.kind === 'initiative') {
    ability = 'dex';
    label = 'Initiative';
  } else {
    ability = ABILITIES.includes(desc.key) ? desc.key : 'wis';
    label = ABILITY_LABELS[ability];
  }

  const statMod = abilityMod(effectiveAbility(character, ability));
  breakdown.push({ label: `${ability.toUpperCase()} modifier`, value: statMod });

  const profValue = proficient ? (expert ? prof * 2 : prof) : 0;
  if (proficient) breakdown.push({ label: expert ? 'Proficiency (Expertise ×2)' : 'Proficiency', value: profValue });

  if (isAttack && isRanged && character?.fightingStyle === 'archery') extraModifiers = [...extraModifiers, { label: 'Archery style', value: 2 }];
  if (unproficientArmor(character).length && (isAttack || ((desc.kind === 'skill' || desc.kind === 'ability' || desc.kind === 'save') && (ability === 'str' || ability === 'dex')))) {
    advNotes.push(['armor without proficiency', 'disadvantage']);
  }

  const weatherMod = weatherModifierFor(weather, { skill: desc.kind === 'skill' ? desc.key : null, isAttack, isRanged });
  if (weatherMod) breakdown.push({ label: `Weather (${weather.type})`, value: weatherMod });

  let itemMod = 0;
  if (isAttack && (desc.key === 'spell' || spellDef)) {
    // Spell attacks ignore weapon bonuses.
  } else if (isAttack) {
    itemMod += usedWeapon?.statModifiers?.attack || 0;
    // Non-weapon equipped gear with a generic attack bonus
    for (const it of equippedItems(character)) {
      if (it !== usedWeapon && it.type !== 'weapon' && typeof it.statModifiers?.attack === 'number') itemMod += it.statModifiers.attack;
    }
  } else {
    if (desc.kind === 'skill') itemMod += itemModifier(character, desc.key);
    if (desc.kind === 'initiative') itemMod += itemModifier(character, 'initiative');
    if (desc.kind === 'skill' || desc.kind === 'ability') itemMod += itemModifier(character, 'checks');
  }
  if (itemMod) breakdown.push({ label: 'Items', value: itemMod });

  let perkMod = 0;
  if (isAttack && !spellDef && desc.key !== 'spell') perkMod += perkModifier(character, 'attack');
  else {
    if (desc.kind === 'skill') perkMod += perkModifier(character, desc.key);
    if (desc.kind === 'initiative') perkMod += perkModifier(character, 'initiative');
    if (desc.kind === 'skill' || desc.kind === 'ability') perkMod += perkModifier(character, 'checks');
  }
  if (perkMod) breakdown.push({ label: 'Perks', value: perkMod });

  let extra = 0;
  for (const m of extraModifiers) {
    if (m && Number(m.value)) {
      breakdown.push({ label: m.label, value: Number(m.value) });
      extra += Number(m.value);
    }
  }

  // Conditions modify advantage, visibly
  const advSources = [advantage || 'normal'];
  const conditionNotes = [];
  for (const [why, state] of advNotes) {
    advSources.push(state);
    conditionNotes.push(`${why}: ${state}`);
  }
  for (const cond of character?.vitals?.conditions || []) {
    const eff = CONDITION_EFFECTS[String(cond).toLowerCase()];
    if (!eff) continue;
    const applies = isAttack ? eff.attacks : desc.kind === 'skill' || desc.kind === 'ability' ? eff.checks : null;
    if (applies) {
      advSources.push(applies);
      conditionNotes.push(`${cond}: ${applies}`);
    }
  }
  const finalAdvantage = combineAdvantage(advSources);

  const totalModifier = statMod + profValue + weatherMod + itemMod + perkMod + extra;

  return {
    kind: desc.kind,
    key: desc.key,
    label,
    ability,
    proficient,
    dc: dc === null || dc === undefined ? null : Number(dc),
    requestedAdvantage: advantage || 'normal',
    advantage: finalAdvantage,
    conditionNotes,
    statMod,
    proficiency: profValue,
    weatherMod,
    itemMod,
    perkMod,
    extraMod: extra,
    totalModifier,
    breakdown,
    isAttack,
    isRanged,
    weapon: usedWeapon
      ? {
          id: usedWeapon.id,
          name: usedWeapon.name,
          damageDice: usedWeapon.damageDice,
          damageBonus: usedWeapon.statModifiers?.damage || 0,
          properties: usedWeapon.properties || [],
          versatileDice: usedWeapon.versatileDice || null,
          ranged: isRanged,
        }
      : null,
    spell: spellDef ? { id: spellDef.id, name: spellDef.name, slot: castSlot(spellDef, spellSlot || desc.spellSlot), damageDice: spellDamageAt(spellDef, level, spellSlot || desc.spellSlot), damageType: spellDef.damageType || null } : null,
    reason,
  };
}

/** Number of d20s needed for a check. */
export function d20Count(check) {
  return check.advantage === 'advantage' || check.advantage === 'disadvantage' ? 2 : 1;
}

/**
 * Resolves a check from d20 faces (digital or manually entered physical dice).
 * @param {object} check  from buildCheck
 * @param {number[]} faces  1 or 2 d20 results
 */
export function resolveCheck(check, faces) {
  const need = d20Count(check);
  if (!Array.isArray(faces) || faces.length !== need) throw new Error(`Expected ${need} d20 result(s).`);
  for (const f of faces) {
    if (!Number.isInteger(f) || f < 1 || f > 20) throw new Error('A d20 result must be a whole number from 1 to 20.');
  }
  let natural;
  if (check.advantage === 'advantage') natural = Math.max(...faces);
  else if (check.advantage === 'disadvantage') natural = Math.min(...faces);
  else natural = faces[0];
  const total = natural + check.totalModifier;
  const critical = natural === 20;
  const fumble = natural === 1;
  let success = null;
  if (check.dc !== null) {
    if (check.isAttack) success = critical ? true : fumble ? false : total >= check.dc;
    else success = total >= check.dc;
  }
  return {
    faces: faces.slice(),
    natural,
    total,
    dc: check.dc,
    success,
    margin: check.dc === null ? null : total - check.dc,
    critical,
    fumble,
  };
}

/** Rolls d20(s) for a check with the given RNG and resolves it. */
export function rollCheck(check, rng = getDefaultRng()) {
  const faces = [];
  for (let i = 0; i < d20Count(check); i++) faces.push(rollDie(20, rng));
  return resolveCheck(check, faces);
}

/** Damage expression for an attack check's weapon (unarmed = 1 + STR mod). */
export function damageExpression(check, character) {
  if (check.spell) return { expr: check.spell.damageDice || '0', flatBonus: 0 };
  const abilityModValue = abilityMod(effectiveAbility(character, check.ability));
  const perkDmg = perkModifier(character, 'damage');
  if (!check.weapon) {
    // Monks' Martial Arts: unarmed strikes deal 1d4 + ability modifier.
    if (character?.martialArts) {
      const bonus = abilityModValue + perkDmg;
      return { expr: bonus === 0 ? '1d4' : `1d4${bonus > 0 ? '+' : '-'}${Math.abs(bonus)}`, flatBonus: bonus };
    }
    return { expr: String(Math.max(1, 1 + abilityModValue + perkDmg)), flatBonus: 0 };
  }
  if (!check.weapon.damageDice) return { expr: '0', flatBonus: 0 };
  const props = check.weapon.properties || [];
  const twoHanding = props.includes('versatile') && check.weapon.versatileDice && !equippedShield(character);
  const dueling = character?.fightingStyle === 'dueling' && !check.weapon.ranged && !props.includes('two-handed') && !twoHanding ? 2 : 0;
  const parsed = parseDice(twoHanding ? check.weapon.versatileDice : check.weapon.damageDice);
  if (!parsed || parsed.count === 0) {
    const flat = (parsed?.bonus || 1) + abilityModValue + (check.weapon.damageBonus || 0) + perkDmg;
    return { expr: String(Math.max(1, flat)), flatBonus: 0 };
  }
  const bonus = parsed.bonus + abilityModValue + (check.weapon.damageBonus || 0) + perkDmg + dueling;
  const base = `${parsed.count}d${parsed.sides}`;
  return { expr: bonus === 0 ? base : `${base}${bonus > 0 ? '+' : '-'}${Math.abs(bonus)}`, flatBonus: bonus };
}

/** Monk weapons: shortswords and simple melee weapons that are not two-handed or heavy. */
export function isMonkWeapon(weapon) {
  if (!weapon) return true;
  const props = weapon.properties || [];
  if (weapon.srdId === 'shortsword') return true;
  return weapon.category === 'simple' && !(weapon.craftingTags || []).includes('ranged') && !props.includes('two-handed') && !props.includes('heavy');
}

/** Human-readable modifier: +3 / −1 / +0 */
export function fmtMod(n) {
  const v = Number(n) || 0;
  return v >= 0 ? `+${v}` : `−${Math.abs(v)}`;
}
