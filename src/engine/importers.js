/**
 * Multi-format importers (pure). Every character format is reduced to the same "parts"
 * (name, level, class, species, ability scores, skills, inventory names, backstory, coin) and rebuilt
 * by characterFromParts(): the engine recomputes HP, AC, proficiency and XP from the rules, so a file
 * (or an AI conversion) can never smuggle in its own numbers beyond the six ability scores and level.
 *
 * Characters: native bundle, Foundry VTT dnd5e actor (also what Plutonium / 5e.tools export),
 * D&D Beyond character JSON, Roll20 5e OGL character JSON, generic flat JSON, Markdown / text sheet.
 * Campaigns: native bundle, Foundry VTT journal / adventure export, Markdown (Obsidian-style) document.
 */
import { ABILITIES, SKILL_KEYS, GENRES, skillLabel } from '../config/genreSkins.js';
import { SPECIES, CLASSES, CLASSES_BY_ID, SPECIES_BY_ID, ITEMS } from '../config/srd.js';
import { RESKINS, className, speciesName } from '../config/srdReskins.js';
import { startingHp, hpGainPerLevel, defaultHitDie, abilityMod, XP_THRESHOLDS } from './progression.js';
import { srdInventoryItems } from './characterBuilder.js';
import { parseImportJson, markdownToLoreEntries, NATIVE_CHARACTER_FORMAT, NATIVE_CAMPAIGN_FORMAT } from './exporters.js';
import { uid } from './rng.js';

/** Thrown when no deterministic parser recognizes the file — the UI then offers the AI converter. */
export class UnrecognizedImportError extends Error {
  constructor(message = 'This file is not a format the engine can read on its own.') {
    super(message);
    this.name = 'UnrecognizedImportError';
  }
}

export const IMPORT_SOURCE_LABELS = {
  native: 'Solo RPG Engine',
  foundry: 'Foundry VTT',
  ddb: 'D&D Beyond',
  roll20: 'Roll20',
  generic: 'Generic JSON',
  markdown: 'Markdown sheet',
  foundry_journal: 'Foundry VTT journal',
  markdown_campaign: 'Markdown campaign',
  ai: 'AI conversion',
};

const ABILITY_NAMES = { str: 'strength', dex: 'dexterity', con: 'constitution', int: 'intelligence', wis: 'wisdom', cha: 'charisma' };
const norm = (s) => String(s ?? '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const clip = (s, n) => String(s ?? '').trim().slice(0, n);
const clampInt = (v, min, max, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};

// ── Name matching ────────────────────────────────────────────────

function candidates(entries) {
  // Longest names first so "Half-Elf" wins over "Elf" and "Hand Crossbow" over "Crossbow".
  return entries.filter(([n]) => n).sort((a, b) => b[0].length - a[0].length);
}

const CLASS_NAMES = candidates(
  CLASSES.flatMap((c) => [[norm(c.name), c.id], [norm(c.id), c.id], ...Object.values(RESKINS).map((r) => [norm(r.classes?.[c.id]), c.id])]),
);
const SPECIES_NAMES = candidates(
  SPECIES.flatMap((s) => [
    [norm(s.name), s.id],
    [norm(s.id.replace(/_/g, ' ')), s.id],
    ...Object.values(RESKINS).map((r) => [norm(r.species?.[s.id]?.name), s.id]),
  ]),
);
const SKILL_NAMES = candidates(
  SKILL_KEYS.flatMap((k) => [[norm(k.replace(/_/g, ' ')), k], [norm(skillLabel(k)), k], ...Object.values(GENRES).map((g) => [norm(g.skillLabels?.[k]), k])]),
);
const ITEM_NAMES = new Map(
  Object.values(ITEMS).flatMap((it) => [[norm(it.name), it.id], [norm(it.id.replace(/_/g, ' ')), it.id], ...Object.values(RESKINS).map((r) => [norm(r.items?.[it.id]), it.id])]).filter(([n]) => n),
);

/** Class id for a free-form class name ("Wizard 5", "Fighter (Champion)", "Gunhand"), or null. */
export function matchClass(name) {
  const n = ` ${norm(name)} `;
  if (!n.trim()) return null;
  return CLASS_NAMES.find(([c]) => n.includes(` ${c} `))?.[1] || null;
}

export function matchSpecies(name) {
  const n = ` ${norm(name)} `;
  if (!n.trim()) return null;
  return SPECIES_NAMES.find(([c]) => n.includes(` ${c} `))?.[1] || null;
}

export function matchSkill(name) {
  const n = norm(name);
  if (!n) return null;
  return SKILL_NAMES.find(([c]) => n === c || n.startsWith(`${c} `))?.[1] || null;
}

export function matchItem(name) {
  const n = norm(String(name || '').replace(/\(.*?\)/g, ''));
  if (!n) return null;
  return ITEM_NAMES.get(n) || ITEM_NAMES.get(n.replace(/s$/, '')) || null;
}

// ── Shared character builder ─────────────────────────────────────

/**
 * Builds an engine character from loose parts. Derived numbers are always recomputed here.
 * @param {object} p { name, level, className, speciesName, stats{str..cha}, skills[], inventory[{name, qty, equipped}], backstory, currency }
 */
export function characterFromParts(p, { genre = 'fantasy', currencyLabel = null } = {}) {
  const stats = {};
  for (const ab of ABILITIES) stats[ab] = clampInt(p.stats?.[ab], 1, 30, 10);
  const level = clampInt(p.level, 1, 20, 1);
  const classId = matchClass(p.className);
  const speciesId = matchSpecies(p.speciesName);
  const hitDie = classId ? CLASSES_BY_ID[classId].hitDie : defaultHitDie(p.className || 'Adventurer');
  const maxHp = Math.max(1, startingHp(hitDie, stats.con) + (level - 1) * hpGainPerLevel(hitDie, stats.con));
  const skillProficiencies = Array.from(new Set((p.skills || []).map(matchSkill).filter(Boolean)));
  const inventory = [];
  for (const it of (p.inventory || []).slice(0, 60)) {
    const name = clip(typeof it === 'string' ? it : it?.name, 80);
    if (!name) continue;
    const qty = clampInt(typeof it === 'object' ? it.qty ?? it.quantity : 1, 1, 50, 1);
    const id = matchItem(name);
    if (id) {
      const items = srdInventoryItems(id, qty, genre);
      if (items[0] && typeof it === 'object' && it.equipped && ['weapon', 'armor'].includes(items[0].type)) items[0] = { ...items[0], equipped: true };
      inventory.push(...items);
    } else {
      // Unknown items are kept as plain gear with no mechanics (the storyteller can still use them).
      inventory.push({ id: uid('item'), name, type: 'key', equipped: false, damageDice: null, statModifiers: {}, craftingTags: [], description: qty > 1 ? `Imported item (×${qty}).` : 'Imported item.', value: 0 });
    }
  }
  const now = Date.now();
  const genreDef = GENRES[genre] || GENRES.fantasy;
  return {
    name: clip(p.name, 60) || 'Imported Hero',
    genre,
    ...(classId ? { classId } : {}),
    ...(speciesId ? { speciesId } : {}),
    classOrArchetype: classId ? className(classId, genre) : clip(p.className, 60) || 'Adventurer',
    speciesName: speciesId ? speciesName(speciesId, genre) : clip(p.speciesName, 60) || null,
    level,
    xp: XP_THRESHOLDS[level - 1] || 0,
    status: 'alive',
    portraitUrl: null,
    hitDie,
    backstory: clip(p.backstory, 2000),
    stats,
    skillProficiencies,
    vitals: {
      hp: maxHp,
      maxHp,
      tempHp: 0,
      ac: 10 + abilityMod(stats.dex),
      speed: speciesId ? SPECIES_BY_ID[speciesId].speed : 30,
      deathSaves: { successes: 0, failures: 0 },
      conditions: [],
    },
    currency: { amount: clampInt(p.currency, 0, 1_000_000, 0), label: currencyLabel || genreDef.currencyLabel },
    customPerkTree: [],
    inventory,
    companionRoster: [],
    activeCampaignId: null,
    createdAt: now,
    updatedAt: now,
  };
}

// ── D&D Beyond ───────────────────────────────────────────────────

const DDB_STAT_IDS = { 1: 'str', 2: 'dex', 3: 'con', 4: 'int', 5: 'wis', 6: 'cha' };

export function isDdbCharacter(json) {
  const d = json?.data && typeof json.data === 'object' ? json.data : json;
  return Array.isArray(d?.stats) && d.stats.some((s) => s && DDB_STAT_IDS[s.id]) && (d.race || d.classes);
}

export function fromDdbCharacter(json, opts) {
  const d = json?.data && typeof json.data === 'object' ? json.data : json;
  const byId = (arr) => Object.fromEntries((arr || []).filter((s) => s && DDB_STAT_IDS[s.id]).map((s) => [DDB_STAT_IDS[s.id], s.value]));
  const base = byId(d.stats);
  const bonus = byId(d.bonusStats);
  const override = byId(d.overrideStats);
  const mods = Object.values(d.modifiers || {}).flat().filter(Boolean);
  const stats = {};
  for (const ab of ABILITIES) {
    const racial = mods.filter((m) => m.type === 'bonus' && m.subType === `${ABILITY_NAMES[ab]}-score`).reduce((s, m) => s + (Number(m.value) || 0), 0);
    stats[ab] = Number.isFinite(Number(override[ab])) && override[ab] !== null ? Number(override[ab]) : (Number(base[ab]) || 10) + (Number(bonus[ab]) || 0) + racial;
  }
  const skills = mods.filter((m) => (m.type === 'proficiency' || m.type === 'expertise') && m.subType).map((m) => String(m.subType).replace(/-/g, ' '));
  const classes = (d.classes || []).slice().sort((a, b) => (b.level || 0) - (a.level || 0));
  const level = classes.reduce((s, c) => s + (Number(c.level) || 0), 0) || 1;
  const cur = d.currencies || {};
  return characterFromParts(
    {
      name: d.name,
      level,
      className: classes[0]?.definition?.name || classes[0]?.name,
      speciesName: d.race?.fullName || d.race?.baseName || d.race?.name,
      stats,
      skills,
      inventory: (d.inventory || []).map((i) => ({ name: i.definition?.name || i.name, qty: i.quantity, equipped: i.equipped })),
      backstory: d.notes?.backstory || '',
      currency: Math.floor((Number(cur.pp) || 0) * 10 + (Number(cur.gp) || 0) + (Number(cur.ep) || 0) / 2 + (Number(cur.sp) || 0) / 10),
    },
    opts,
  );
}

// ── Roll20 5e OGL ────────────────────────────────────────────────

export function isRoll20Character(json) {
  const attribs = json?.character?.attribs || json?.attribs;
  return Array.isArray(attribs) && attribs.some((a) => a?.name === 'strength' || a?.name === 'dexterity');
}

export function fromRoll20Character(json, opts) {
  const ch = json.character || json;
  const attribs = ch.attribs || [];
  const get = (name) => attribs.find((a) => a?.name === name)?.current;
  const stats = Object.fromEntries(ABILITIES.map((ab) => [ab, get(ABILITY_NAMES[ab])]));
  const skills = SKILL_KEYS.filter((k) => {
    const v = String(get(`${k}_prof`) ?? '').trim();
    return v && v !== '0';
  });
  const rows = {};
  for (const a of attribs) {
    const m = /^repeating_inventory_([^_]+)_(itemname|itemcount|equipped)$/.exec(String(a?.name || ''));
    if (m) (rows[m[1]] ??= {})[m[2]] = a.current;
  }
  return characterFromParts(
    {
      name: ch.name || json.name,
      level: get('base_level') || get('level'),
      className: get('class') || get('class_display'),
      speciesName: get('race') || get('race_display'),
      stats,
      skills,
      inventory: Object.values(rows).map((r) => ({ name: r.itemname, qty: r.itemcount, equipped: String(r.equipped) === '1' })),
      backstory: ch.bio || get('backstory') || '',
      currency: get('gp'),
    },
    opts,
  );
}

// ── Generic flat JSON (hand-written, ChatGPT, other tools) ───────

function scoreOf(v) {
  if (v && typeof v === 'object') return v.score ?? v.value ?? v.total;
  return v;
}

function readAbilities(o) {
  const pools = [o, o?.abilities, o?.stats, o?.ability_scores, o?.abilityScores, o?.attributes].filter((x) => x && typeof x === 'object');
  const out = {};
  for (const ab of ABILITIES) {
    for (const pool of pools) {
      const raw = scoreOf(pool[ab] ?? pool[ab.toUpperCase()] ?? pool[ABILITY_NAMES[ab]] ?? pool[ABILITY_NAMES[ab][0].toUpperCase() + ABILITY_NAMES[ab].slice(1)]);
      if (Number.isFinite(Number(raw)) && raw !== null && raw !== '') {
        out[ab] = Number(raw);
        break;
      }
    }
  }
  return out;
}

export function isGenericCharacter(json) {
  return Boolean(json && typeof json === 'object' && json.name && Object.keys(readAbilities(json)).length >= 4);
}

export function fromGenericCharacter(json, opts) {
  const skills = Array.isArray(json.skills) ? json.skills.map((s) => (typeof s === 'string' ? s : s?.name)) : json.skills && typeof json.skills === 'object' ? Object.keys(json.skills).filter((k) => json.skills[k]) : [];
  const inv = json.inventory || json.equipment || json.items || [];
  return characterFromParts(
    {
      name: json.name,
      level: json.level,
      className: json.class || json.className || json.class_name || json.archetype,
      speciesName: json.race || json.species || json.ancestry || json.lineage,
      stats: readAbilities(json),
      skills,
      inventory: Array.isArray(inv) ? inv.map((i) => (typeof i === 'string' ? i : { name: i?.name, qty: i?.quantity ?? i?.qty, equipped: i?.equipped })) : [],
      backstory: json.backstory || json.bio || json.description || '',
      currency: json.gold ?? json.gp ?? json.currency?.gp ?? json.currency,
    },
    opts,
  );
}

// ── Markdown / text character sheet ──────────────────────────────

const ABBR = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };

function mdAbilities(text) {
  const out = {};
  // "STR 15", "STR: 15 (+2)", "Strength 15"
  for (const ab of ABILITIES) {
    const re = new RegExp(`\\b(?:${ABBR[ab]}|${ABILITY_NAMES[ab]})\\b\\s*[:=|]?\\s*(\\d{1,2})\\b`, 'i');
    const m = re.exec(text);
    if (m) out[ab] = Number(m[1]);
  }
  if (Object.keys(out).length >= 4) return out;
  // Table: | STR | DEX | CON | INT | WIS | CHA |  then a row of numbers
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length - 1; i++) {
    const head = lines[i].split('|').map((c) => c.trim().toUpperCase()).filter(Boolean);
    if (head.filter((h) => Object.values(ABBR).includes(h.slice(0, 3))).length >= 4) {
      for (let j = i + 1; j < Math.min(lines.length, i + 3); j++) {
        const cells = lines[j].split('|').map((c) => c.trim()).filter(Boolean);
        if (!cells.length || /^:?-+:?$/.test(cells[0])) continue;
        head.forEach((h, k) => {
          const ab = Object.keys(ABBR).find((a) => ABBR[a] === h.slice(0, 3));
          const n = parseInt(cells[k], 10);
          if (ab && Number.isFinite(n)) out[ab] = n;
        });
        break;
      }
    }
  }
  return out;
}

export function isMarkdownCharacter(text) {
  return Object.keys(mdAbilities(String(text || ''))).length >= 4;
}

export function fromMarkdownCharacter(text, opts) {
  const t = String(text || '');
  const field = (label) => new RegExp(`^\\s*(?:[-*]\\s*)?(?:\\*\\*)?${label}(?:\\*\\*)?\\s*[:\\-–]\\s*(.+)$`, 'im').exec(t)?.[1]?.replace(/\*\*/g, '').trim();
  const heading = /^#{1,2}\s+(.+)$/m.exec(t)?.[1]?.trim();
  const levelLine = /\blevel\s*[:\-]?\s*(\d{1,2})\b/i.exec(t) || /\b(\d{1,2})(?:st|nd|rd|th)[- ]level\b/i.exec(t);
  const skillsLine = field('Skills') || field('Skill Proficiencies') || '';
  const inventory = [];
  const sec = /^#{1,4}\s*(?:inventory|equipment|gear)\b.*$/im.exec(t);
  const invLine = field('Inventory') || field('Equipment');
  if (sec) {
    for (const line of t.slice(sec.index + sec[0].length).split(/\r?\n/).slice(1)) {
      if (/^#{1,4}\s/.test(line)) break;
      const m = /^\s*[-*]\s+(?:(\d+)\s*[x×]\s*)?(.+?)(?:\s*[x×]\s*(\d+))?\s*$/.exec(line);
      if (m) inventory.push({ name: m[2].replace(/\*\*/g, ''), qty: Number(m[1] || m[3] || 1) });
    }
  } else if (invLine) {
    for (const part of invLine.split(/[,;]/)) {
      const m = /^\s*(?:(\d+)\s*[x×]\s*)?(.+?)\s*$/.exec(part);
      if (m && m[2]) inventory.push({ name: m[2], qty: Number(m[1] || 1) });
    }
  }
  const classLine = field('Class') || field('Class & Level') || '';
  return characterFromParts(
    {
      name: field('Name') || heading?.replace(/\s*[—–-].*$/, ''),
      level: levelLine ? levelLine[1] : 1,
      className: classLine || heading || '',
      speciesName: field('Race') || field('Species') || field('Ancestry') || heading || '',
      stats: mdAbilities(t),
      skills: skillsLine.split(/[,;]/).map((s) => s.replace(/[(+].*$/, '').trim()),
      inventory,
      backstory: field('Backstory') || '',
      currency: (/\b(\d+)\s*gp\b/i.exec(t) || /\bgold\s*[:\-]?\s*(\d+)/i.exec(t))?.[1],
    },
    opts,
  );
}

// ── Campaigns → World Forge seed ─────────────────────────────────

/** A seed the World Forge can open with: a world prompt plus Lore Pinboard entries. */
function worldSeed(title, promptParts, lore) {
  const prompt = promptParts.filter(Boolean).join('\n\n').slice(0, 3500);
  return { title: clip(title, 80) || 'Imported World', prompt, lore: lore.filter(Boolean).map((l) => clip(l, 600)).slice(0, 40) };
}

const stripHtml = (h) => String(h || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|h\d|li)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim();

export function isFoundryJournal(json) {
  return Boolean(json && typeof json === 'object' && (Array.isArray(json.pages) || Array.isArray(json.journal) || (Array.isArray(json.folders) && Array.isArray(json.actors))));
}

export function fromFoundryJournal(json) {
  const entries = Array.isArray(json.journal) ? json.journal : [json];
  const lore = [];
  for (const e of entries) {
    const pages = Array.isArray(e.pages) ? e.pages : [{ name: e.name, text: { content: e.content } }];
    for (const pg of pages) {
      const body = stripHtml(pg.text?.content ?? pg.content);
      if (body) lore.push(`${pg.name || e.name}: ${body}`);
    }
  }
  const npcs = (json.actors || []).map((a) => a?.name).filter(Boolean).slice(0, 20);
  const title = json.name || entries[0]?.name;
  return worldSeed(title, [`Adapted from the Foundry VTT adventure “${title || 'Imported'}”.`, npcs.length ? `Notable characters: ${npcs.join(', ')}.` : '', lore.slice(0, 3).join('\n')], lore);
}

export function isMarkdownCampaign(text) {
  return /^#{1,2}\s+\S/m.test(String(text || ''));
}

export function fromMarkdownCampaign(text) {
  const t = String(text || '');
  const title = /^#\s+(.+)$/m.exec(t)?.[1]?.trim() || /^##\s+(.+)$/m.exec(t)?.[1]?.trim();
  const section = (names) => {
    const m = new RegExp(`^##\\s*(?:${names})\\b.*$`, 'im').exec(t);
    if (!m) return '';
    const rest = t.slice(m.index + m[0].length);
    const end = rest.search(/^##\s/m);
    return (end < 0 ? rest : rest.slice(0, end)).trim();
  };
  const region = section('region|setting|world|overview');
  const factions = section('factions');
  const locations = section('locations|places');
  const quests = section('quests|hooks|plot');
  const npcs = section('npcs|characters|people');
  const parts = [
    region,
    factions && `Factions:\n${factions}`,
    locations && `Locations:\n${locations}`,
    quests && `Quests and hooks:\n${quests}`,
    npcs && `Notable characters:\n${npcs}`,
  ];
  return worldSeed(title, parts.some(Boolean) ? parts : [t.slice(0, 3000)], markdownToLoreEntries(t));
}

// ── Detection ────────────────────────────────────────────────────

/**
 * Detects the format of an uploaded or pasted file and converts it.
 * @returns {{ kind: 'character'|'campaign'|'worldSeed', data: object, source: string, sourceLabel: string }}
 * @throws {UnrecognizedImportError} when no parser recognizes it (the UI then offers AI conversion)
 */
export function parseImportFile(text, filename = '', opts = {}) {
  const raw = String(text ?? '');
  if (!raw.trim()) throw new UnrecognizedImportError('The file is empty.');
  let json = null;
  if (/^\s*[[{]/.test(raw)) {
    try {
      json = JSON.parse(raw);
    } catch {
      json = null;
    }
  }
  const out = (kind, data, source) => ({ kind, data, source, sourceLabel: IMPORT_SOURCE_LABELS[source] || source });
  if (json && typeof json === 'object') {
    if (json.format === NATIVE_CHARACTER_FORMAT || json.format === NATIVE_CAMPAIGN_FORMAT || json.system?.abilities || (json.type === 'character' && json.system)) {
      const p = parseImportJson(json, opts);
      return out(p.kind, p.data, p.source);
    }
    if (isDdbCharacter(json)) return out('character', fromDdbCharacter(json, opts), 'ddb');
    if (isRoll20Character(json)) return out('character', fromRoll20Character(json, opts), 'roll20');
    if (isFoundryJournal(json)) return out('worldSeed', fromFoundryJournal(json), 'foundry_journal');
    if (isGenericCharacter(json)) return out('character', fromGenericCharacter(json, opts), 'generic');
    throw new UnrecognizedImportError('This JSON is not a character or campaign format the engine knows.');
  }
  if (/\.json$/i.test(filename)) throw new UnrecognizedImportError('That file is not valid JSON.');
  if (isMarkdownCharacter(raw)) return out('character', fromMarkdownCharacter(raw, opts), 'markdown');
  if (isMarkdownCampaign(raw)) return out('worldSeed', fromMarkdownCampaign(raw), 'markdown_campaign');
  throw new UnrecognizedImportError();
}

/**
 * Turns an AI conversion (raw extracted fields, see CONVERT_IMPORT_SCHEMA) into the same shapes.
 * The AI never sets HP, AC or XP: characterFromParts recomputes them.
 */
export function fromAiConversion(result, opts = {}) {
  if (result?.kind === 'campaign' && result.campaign) {
    const c = result.campaign;
    const list = (title, arr) => (Array.isArray(arr) && arr.length ? `${title}:\n${arr.map((x) => `- ${clip(x, 300)}`).join('\n')}` : '');
    return {
      kind: 'worldSeed',
      source: 'ai',
      sourceLabel: IMPORT_SOURCE_LABELS.ai,
      data: worldSeed(c.title, [clip(c.summary, 1500), list('Factions', c.factions), list('Locations', c.locations), list('Quests and hooks', c.quests), list('Notable characters', c.npcs)], [...(c.lore || [])]),
    };
  }
  const ch = result?.character;
  if (!ch) throw new Error('The converter found no character or campaign in that text.');
  return {
    kind: 'character',
    source: 'ai',
    sourceLabel: IMPORT_SOURCE_LABELS.ai,
    data: characterFromParts(
      {
        name: ch.name,
        level: ch.level,
        className: ch.className,
        speciesName: ch.speciesName,
        stats: ch.stats,
        skills: ch.skills,
        inventory: (ch.inventory || []).map((i) => ({ name: i?.name ?? i, qty: i?.quantity })),
        backstory: ch.backstory,
        currency: ch.currency,
      },
      opts,
    ),
  };
}
