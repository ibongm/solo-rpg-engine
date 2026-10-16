/**
 * SRD 5.1 character builder — pure and deterministic.
 * Turns the creator's choices (species, class, background, scores, equipment) into a
 * complete character document, and exposes the proficiency helpers the dice engine uses.
 */
import { ABILITIES, SKILL_KEYS } from '../config/genreSkins.js';
import { ITEMS, ITEM_FILTERS, SPECIES_BY_ID, CLASSES_BY_ID, BACKGROUNDS_BY_ID, FIGHTING_STYLES, DRAGON_ANCESTRIES } from '../config/srd.js';
import { speciesName, className, backgroundName, itemName, genreTerms } from '../config/srdReskins.js';
import { GENRES } from '../config/genreSkins.js';
import { abilityMod } from './progression.js';
import { uid, rollDie, getDefaultRng } from './rng.js';

export const RULES_ID = 'srd51';
export const MAX_RATIONS_PER_PACK = 5;
export const MAX_STACK_AS_SEPARATE = 2;

// ── Ability scores ───────────────────────────────────────────────

/** Base scores + species bonuses (+ Half-Elf style flexible +1s). Capped at 20. */
export function finalAbilityScores(baseStats, speciesId, flexibleChoices = []) {
  const sp = SPECIES_BY_ID[speciesId];
  const out = {};
  for (const ab of ABILITIES) out[ab] = Number(baseStats?.[ab]) || 8;
  if (!sp) return out;
  for (const [ab, v] of Object.entries(sp.abilityBonuses || {})) out[ab] = Math.min(20, out[ab] + v);
  if (sp.flexibleBonuses) {
    const picks = Array.from(new Set(flexibleChoices)).filter((ab) => ABILITIES.includes(ab) && !sp.flexibleBonuses.exclude.includes(ab)).slice(0, sp.flexibleBonuses.count);
    for (const ab of picks) out[ab] = Math.min(20, out[ab] + sp.flexibleBonuses.amount);
  }
  return out;
}

export function speciesBonusSummary(speciesId, flexibleChoices = []) {
  const sp = SPECIES_BY_ID[speciesId];
  if (!sp) return {};
  const out = { ...(sp.abilityBonuses || {}) };
  if (sp.flexibleBonuses) for (const ab of flexibleChoices.slice(0, sp.flexibleBonuses.count)) out[ab] = (out[ab] || 0) + sp.flexibleBonuses.amount;
  return out;
}

// ── Skills ───────────────────────────────────────────────────────

/** Skills fixed by species and background (before the player's class picks). */
export function grantedSkills({ speciesId, backgroundId, speciesSkillChoices = [], backgroundSkillChoices = [] }) {
  const sp = SPECIES_BY_ID[speciesId];
  const bg = BACKGROUNDS_BY_ID[backgroundId];
  const set = new Set();
  for (const s of sp?.skills || []) set.add(s);
  for (const s of speciesSkillChoices.slice(0, sp?.skillChoices || 0)) set.add(s);
  if (bg?.skills) for (const s of bg.skills) set.add(s);
  else for (const s of backgroundSkillChoices.slice(0, 2)) set.add(s);
  return Array.from(set).filter((s) => SKILL_KEYS.includes(s));
}

export function classSkillList(classId) {
  const cls = CLASSES_BY_ID[classId];
  if (!cls) return [];
  return cls.skillList === 'any' ? SKILL_KEYS.slice() : cls.skillList.slice();
}

// ── Proficiency helpers (also used by the dice engine) ───────────

export function isSrdCharacter(character) {
  return character?.rules === RULES_ID;
}

/** Legacy characters (no proficiency lists) stay proficient with every weapon, as before. */
export function isWeaponProficient(character, weapon) {
  if (!weapon) return true;
  const profs = character?.weaponProficiencies;
  if (!Array.isArray(profs)) return true;
  if (!weapon.srdId) return true;
  return profs.includes(weapon.category) || profs.includes(weapon.srdId);
}

export function isArmorProficient(character, armor) {
  if (!armor?.armorCategory) return true;
  const profs = character?.armorProficiencies;
  if (!Array.isArray(profs)) return true;
  return profs.includes(armor.armorCategory);
}

function hasProf(profs, key) {
  return profs.includes(key);
}

/** Does an equipment option need a proficiency the build lacks? */
export function optionAllowed(option, { weaponProficiencies = [], armorProficiencies = [] }) {
  for (const ref of option) {
    if (!ref.requires) continue;
    if (['light', 'medium', 'heavy', 'shield'].includes(ref.requires)) {
      if (!hasProf(armorProficiencies, ref.requires)) return false;
    } else {
      const w = ITEMS[ref.requires];
      if (!hasProf(weaponProficiencies, ref.requires) && !(w && hasProf(weaponProficiencies, w.category))) return false;
    }
  }
  return true;
}

export function itemsForFilter(filterKey) {
  const f = ITEM_FILTERS[filterKey];
  return f ? Object.values(ITEMS).filter(f) : [];
}

// ── Equipment ────────────────────────────────────────────────────

/**
 * Resolves kit choices into a flat list of { id, qty }.
 * @param {object} p
 * @param {string} p.classId
 * @param {Object<number, number>} p.choices     groupIndex → optionIndex
 * @param {Object<string, string>} p.anyPicks    `${group}:${option}:${ref}:${n}` → item id
 */
export function resolveKit({ classId, choices = {}, anyPicks = {} }) {
  const cls = CLASSES_BY_ID[classId];
  if (!cls) return [];
  const out = [];
  cls.equipment.forEach((group, g) => {
    const opt = group.items ? -1 : Number.isInteger(choices[g]) ? choices[g] : 0;
    const refs = group.items || group.choose[opt] || [];
    refs.forEach((ref, r) => {
      const qty = ref.qty || 1;
      if (ref.id) out.push({ id: ref.id, qty });
      else if (ref.any) {
        // "two martial weapons" may be two different picks.
        for (let n = 0; n < qty; n++) {
          const id = anyPicks[`${g}:${opt}:${r}:${n}`];
          if (id && ITEMS[id] && ITEM_FILTERS[ref.any]?.(ITEMS[id])) out.push({ id, qty: 1 });
        }
      }
    });
  });
  return out;
}

/** Every "any …" slot in the currently chosen options, so the UI can render a picker for each. */
export function kitPickSlots({ classId, choices = {} }) {
  const cls = CLASSES_BY_ID[classId];
  if (!cls) return [];
  const slots = [];
  cls.equipment.forEach((group, g) => {
    const opt = group.items ? -1 : Number.isInteger(choices[g]) ? choices[g] : 0;
    const refs = group.items || group.choose[opt] || [];
    refs.forEach((ref, r) => {
      if (!ref.any) return;
      for (let n = 0; n < (ref.qty || 1); n++) slots.push({ key: `${g}:${opt}:${r}:${n}`, filter: ref.any });
    });
  });
  return slots;
}

/** Visible starting-wealth roll for the "buy your own gear" option (SRD table by class). */
export function rollStartingWealth(classId, rng = getDefaultRng()) {
  const w = CLASSES_BY_ID[classId]?.startingWealth || { dice: '4d4', multiplier: 10 };
  const [count, sides] = w.dice.split('d').map(Number);
  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push(rollDie(sides, rng));
  return { rolls, multiplier: w.multiplier, total: rolls.reduce((a, b) => a + b, 0) * w.multiplier, dice: w.dice };
}

export function averageStartingWealth(classId) {
  const w = CLASSES_BY_ID[classId]?.startingWealth || { dice: '4d4', multiplier: 10 };
  const [count, sides] = w.dice.split('d').map(Number);
  return Math.floor((count * (sides + 1)) / 2) * w.multiplier;
}

export function itemPrice(id) {
  const it = ITEMS[id];
  return it ? Math.max(1, Math.ceil(it.cost)) : 0;
}

function weaponDescription(w) {
  const props = w.properties.filter((p) => p !== 'ammunition').map((p) => (p === 'versatile' ? `versatile (${w.versatileDice})` : p === 'thrown' && w.throwRange ? `thrown (${w.throwRange})` : p));
  const dmg = w.damageDice ? `${w.damageDice} ${w.damageType}` : 'no damage';
  return [`${dmg}`, `${w.category} ${w.range}`, w.rangeFt ? `range ${w.rangeFt}` : null, ...props].filter(Boolean).join(' · ');
}

function armorDescription(a) {
  if (a.armorCategory === 'shield') return '+2 AC (shield)';
  const dex = a.dexCap === null ? ' + Dex' : a.dexCap === 0 ? '' : ` + Dex (max ${a.dexCap})`;
  return [`AC ${a.baseAc}${dex}`, `${a.armorCategory} armor`, a.strReq ? `Str ${a.strReq} or −10 ft speed` : null, a.stealthDisadvantage ? 'disadvantage on Stealth' : null].filter(Boolean).join(' · ');
}

/** Converts one SRD item into inventory item(s) in the campaign's genre skin. */
export function srdInventoryItems(id, qty = 1, genre = 'fantasy') {
  const t = ITEMS[id];
  if (!t) return [];
  const name = itemName(id, genre);
  const value = itemPrice(id);
  const base = { srdId: id, equipped: false, statModifiers: {}, craftingTags: [], value };
  const genreDef = GENRES[genre] || GENRES.fantasy;

  if (t.kind === 'weapon') {
    const make = (label) => ({
      ...base,
      id: uid('item'),
      name: label,
      type: 'weapon',
      damageDice: t.damageDice,
      damageType: t.damageType,
      category: t.category,
      properties: t.properties.slice(),
      versatileDice: t.versatileDice || null,
      rangeFt: t.rangeFt || t.throwRange || null,
      craftingTags: [t.range === 'ranged' ? 'ranged' : 'melee', ...(t.properties.includes('finesse') ? ['finesse'] : []), ...(t.properties.includes('heavy') ? ['heavy'] : [])],
      description: weaponDescription(t),
    });
    if (qty <= MAX_STACK_AS_SEPARATE) return Array.from({ length: qty }, () => make(name));
    return [make(`${name} ×${qty}`)];
  }

  if (t.kind === 'armor') {
    return Array.from({ length: qty }, () => ({
      ...base,
      id: uid('item'),
      name,
      type: 'armor',
      armorCategory: t.armorCategory,
      baseAc: t.baseAc,
      dexCap: t.dexCap,
      strReq: t.strReq || 0,
      stealthDisadvantage: Boolean(t.stealthDisadvantage),
      damageDice: null,
      description: armorDescription(t),
    }));
  }

  // Gear
  if (t.ration) {
    return Array.from({ length: qty }, () => ({ ...base, id: uid('item'), name: genreDef.rationLabel || name, type: 'consumable', damageDice: null, craftingTags: ['ration'], description: 'One day of food.' }));
  }
  if (t.heal) {
    return Array.from({ length: qty }, () => ({ ...base, id: uid('item'), name, type: 'consumable', damageDice: null, statModifiers: { heal: t.heal }, craftingTags: ['healing'], description: `Restores ${t.heal} HP.` }));
  }
  if (t.antidote) {
    return Array.from({ length: qty }, () => ({ ...base, id: uid('item'), name, type: 'consumable', damageDice: null, craftingTags: ['antidote'], description: 'Cures the Poisoned condition.' }));
  }
  const items = [{ ...base, id: uid('item'), name: qty > 1 ? `${name} ×${qty}` : name, type: 'key', damageDice: null, description: t.contents || (t.focus ? 'Spellcasting focus.' : t.tool ? 'Tool kit.' : t.ammo ? 'Ammunition.' : '') }];
  if (t.pack && t.rations) items.push(...srdInventoryItems('rations', Math.min(MAX_RATIONS_PER_PACK, t.rations), genre));
  return items;
}

/** Equips a sensible starting loadout: body armor, a shield if the main weapon allows it, one weapon. */
export function autoEquip(inventory, character) {
  const inv = inventory.map((i) => ({ ...i, equipped: false }));
  const body = inv.find((i) => i.type === 'armor' && i.armorCategory && i.armorCategory !== 'shield' && isArmorProficient(character, i));
  const shield = inv.find((i) => i.armorCategory === 'shield' && isArmorProficient(character, i));
  const weapons = inv.filter((i) => i.type === 'weapon' && isWeaponProficient(character, i));
  const preferRanged = character?.fightingStyle === 'archery';
  const score = (w) => (w.damageDice ? 1 : 0) + (w.craftingTags.includes(preferRanged ? 'ranged' : 'melee') ? 0.5 : 0) + (parseInt(String(w.damageDice || '').split('d')[1], 10) || 0) / 100;
  const ranked = weapons.slice().sort((a, b) => score(b) - score(a));
  if (body) body.equipped = true;
  let weapon = ranked[0] || null;
  if (shield) {
    const oneHanded = ranked.find((w) => !(w.properties || []).includes('two-handed'));
    if (oneHanded) weapon = oneHanded;
    if (!weapon || !(weapon.properties || []).includes('two-handed')) shield.equipped = true;
  }
  if (weapon) weapon.equipped = true;
  return inv;
}

// ── Building the character ───────────────────────────────────────

/**
 * Validates a build. Returns a list of human-readable problems (empty = valid).
 */
export function validateBuild(b) {
  const errors = [];
  const sp = SPECIES_BY_ID[b.speciesId];
  const cls = CLASSES_BY_ID[b.classId];
  const bg = BACKGROUNDS_BY_ID[b.backgroundId];
  if (!String(b.name || '').trim()) errors.push('Name is required.');
  if (!sp) errors.push('Choose a species.');
  if (!cls) errors.push('Choose a class.');
  if (!bg) errors.push('Choose a background.');
  if (sp?.flexibleBonuses && new Set((b.flexibleBonuses || []).filter((a) => !sp.flexibleBonuses.exclude.includes(a))).size !== sp.flexibleBonuses.count) errors.push(`Choose ${sp.flexibleBonuses.count} different abilities for your +1 bonuses.`);
  if (sp?.skillChoices && new Set(b.speciesSkills || []).size !== sp.skillChoices) errors.push(`Choose ${sp.skillChoices} species skills.`);
  if (sp?.ancestryChoice && !DRAGON_ANCESTRIES.some((d) => d.id === b.dragonAncestry)) errors.push('Choose a draconic ancestry.');
  if (bg && !bg.skills && new Set(b.backgroundSkills || []).size !== 2) errors.push('Choose 2 background skills.');
  if (cls) {
    const granted = grantedSkills({ speciesId: b.speciesId, backgroundId: b.backgroundId, speciesSkillChoices: b.speciesSkills, backgroundSkillChoices: b.backgroundSkills });
    const picks = (b.classSkills || []).filter((s) => !granted.includes(s));
    if (new Set(picks).size !== cls.skillCount) errors.push(`Choose ${cls.skillCount} class skills.`);
    if (picks.some((s) => !classSkillList(cls.id).includes(s))) errors.push('A class skill is not on your class list.');
    if (cls.fightingStyle && !FIGHTING_STYLES.some((f) => f.id === b.fightingStyle)) errors.push('Choose a fighting style.');
    if (cls.expertise) {
      const prof = new Set([...granted, ...picks]);
      if (new Set(b.expertise || []).size !== cls.expertise || (b.expertise || []).some((s) => !prof.has(s))) errors.push(`Choose ${cls.expertise} proficient skills for Expertise.`);
    }
  }
  return errors;
}

function proficiencySets(sp, cls) {
  const weaponProficiencies = Array.from(new Set([...(cls?.weapons || []), ...(sp?.weaponProficiencies || [])]));
  const armorProficiencies = Array.from(new Set(cls?.armor || []));
  return { weaponProficiencies, armorProficiencies };
}

export function buildProficiencies(speciesId, classId) {
  return proficiencySets(SPECIES_BY_ID[speciesId], CLASSES_BY_ID[classId]);
}

function toolLabel(t, genre) {
  return ITEMS[t] ? itemName(t, genre) : t;
}

/**
 * Builds a complete character document from a validated build.
 * build: { name, genre, speciesId, classId, backgroundId, baseStats, flexibleBonuses, speciesSkills,
 *   backgroundSkills, classSkills, expertise, fightingStyle, dragonAncestry, toolChoice, languages,
 *   equipment: [{id, qty}], currency, backstory, portraitUrl, customPerkTree, spells }
 */
export function buildSrdCharacter(build) {
  const genre = build.genre || 'fantasy';
  const genreDef = GENRES[genre] || GENRES.fantasy;
  const sp = SPECIES_BY_ID[build.speciesId];
  const cls = CLASSES_BY_ID[build.classId];
  const bg = BACKGROUNDS_BY_ID[build.backgroundId];
  if (!sp || !cls || !bg) throw new Error('Incomplete character build.');
  const terms = genreTerms(genre);

  const stats = finalAbilityScores(build.baseStats, sp.id, build.flexibleBonuses);
  const granted = grantedSkills({ speciesId: sp.id, backgroundId: bg.id, speciesSkillChoices: build.speciesSkills, backgroundSkillChoices: build.backgroundSkills });
  const classPicks = (build.classSkills || []).filter((s) => !granted.includes(s)).slice(0, cls.skillCount);
  const skillProficiencies = Array.from(new Set([...granted, ...classPicks]));
  const expertise = cls.expertise ? (build.expertise || []).filter((s) => skillProficiencies.includes(s)).slice(0, cls.expertise) : [];
  const { weaponProficiencies, armorProficiencies } = proficiencySets(sp, cls);

  const hpBonusPerLevel = (sp.hpBonusPerLevel || 0) + (cls.hpBonusPerLevel || 0);
  const maxHp = Math.max(1, cls.hitDie + abilityMod(stats.con) + hpBonusPerLevel);

  const tools = [
    ...(cls.tools || []),
    ...(sp.tools || []),
    ...(sp.toolChoice ? [build.toolChoice && sp.toolChoice.includes(build.toolChoice) ? build.toolChoice : sp.toolChoice[0]] : []),
    ...(bg.tools || []),
  ].map((t) => toolLabel(t, genre));

  const languages = Array.from(new Set([...(sp.languages || []), ...(cls.extraLanguages || []), ...(build.languages || [])])).slice(0, 8);

  const ancestry = sp.ancestryChoice ? DRAGON_ANCESTRIES.find((d) => d.id === build.dragonAncestry) : null;
  const style = cls.fightingStyle ? FIGHTING_STYLES.find((f) => f.id === build.fightingStyle) : null;
  const features = [
    ...sp.traits.map(([name, description]) => ({ name, description, source: speciesName(sp.id, genre) })),
    ...(ancestry ? [{ name: `${ancestry.name} Ancestry`, description: `Breath weapon and resistance: ${ancestry.damage}.`, source: speciesName(sp.id, genre) }] : []),
    ...cls.features.map(([name, description]) => ({ name, description, source: className(cls.id, genre) })),
    ...(style ? [{ name: `Fighting Style: ${style.name}`, description: style.text, source: className(cls.id, genre) }] : []),
    { name: bg.feature[0], description: bg.feature[1], source: backgroundName(bg.id, genre) },
  ];

  const now = Date.now();
  const character = {
    rules: RULES_ID,
    name: String(build.name || 'Nameless').trim().slice(0, 60),
    genre,
    classOrArchetype: className(cls.id, genre),
    speciesId: sp.id,
    speciesName: speciesName(sp.id, genre),
    classId: cls.id,
    subclass: cls.subclass || null,
    backgroundId: bg.id,
    backgroundName: backgroundName(bg.id, genre),
    terms,
    level: 1,
    xp: 0,
    status: 'alive',
    portraitUrl: String(build.portraitUrl || '').trim() || null,
    hitDie: cls.hitDie,
    hpBonusPerLevel,
    backstory: String(build.backstory || '').slice(0, 2000),
    stats,
    baseStats: { ...build.baseStats },
    savingThrows: cls.savingThrows.slice(),
    skillProficiencies,
    expertise,
    weaponProficiencies,
    armorProficiencies,
    toolProficiencies: tools,
    languages,
    size: sp.size,
    darkvision: sp.darkvision || 0,
    ignoresHeavyArmorSpeed: Boolean(sp.ignoresHeavyArmorSpeed),
    unarmoredDefense: cls.unarmoredDefense || null,
    martialArts: Boolean(cls.martialArts),
    fightingStyle: style?.id || null,
    dragonAncestry: ancestry?.id || null,
    features,
    spellcasting: build.spellcasting || null,
    vitals: {
      hp: maxHp,
      maxHp,
      tempHp: 0,
      ac: 10 + abilityMod(stats.dex),
      speed: sp.speed,
      deathSaves: { successes: 0, failures: 0 },
      conditions: [],
    },
    currency: { amount: Math.max(0, Math.floor(Number(build.currency) || 0)), label: genreDef.currencyLabel },
    customPerkTree: build.customPerkTree || [],
    inventory: [],
    companionRoster: [],
    activeCampaignId: null,
    createdAt: now,
    updatedAt: now,
  };
  const inventory = (build.equipment || []).flatMap((e) => srdInventoryItems(e.id, e.qty || 1, genre));
  character.inventory = autoEquip(inventory, character);
  return character;
}

/** Background equipment refs as {id, qty}. */
export function backgroundKit(backgroundId) {
  return (BACKGROUNDS_BY_ID[backgroundId]?.equipment || []).map((e) => ({ id: e.id, qty: e.qty || 1 }));
}

export function backgroundGold(backgroundId) {
  return BACKGROUNDS_BY_ID[backgroundId]?.gold || 0;
}
