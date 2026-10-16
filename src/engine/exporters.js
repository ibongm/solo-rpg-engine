/**
 * Universal Import / Export Engine (pure functions).
 *  - Native JSON bundles (character / full campaign)
 *  - Markdown StoryBook + permadeath chronicle
 *  - 5e VTT JSON (Foundry VTT dnd5e actor format) import & export
 *  - Markdown lore → Lore Pinboard entries
 */
import { ABILITIES, SKILL_KEYS, SKILLS, skillLabel } from '../config/genreSkins.js';
import { abilityMod, defaultHitDie, levelForXp, startingHp, hpGainPerLevel } from './progression.js';
import { formatClock } from './clockWeatherEngine.js';
import { uid } from './rng.js';

export const NATIVE_CHARACTER_FORMAT = 'solo-rpg-engine/character';
export const NATIVE_CAMPAIGN_FORMAT = 'solo-rpg-engine/campaign';
export const FORMAT_VERSION = 1;

// ── Native JSON ──────────────────────────────────────────────────

function stripIds(obj) {
  const { id, ...rest } = obj || {};
  return rest;
}

export function exportCharacterBundle(character) {
  return {
    format: NATIVE_CHARACTER_FORMAT,
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    character: stripIds(character),
  };
}

export function exportCampaignBundle({ campaign, character, turns = [], diary = [], codex = [] }) {
  return {
    format: NATIVE_CAMPAIGN_FORMAT,
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    campaign: stripIds(campaign),
    character: character ? stripIds(character) : null,
    turns,
    diary,
    codex,
  };
}

/**
 * Detects and parses any supported JSON import.
 * @returns {{ kind: 'character'|'campaign', data: object, source: 'native'|'foundry' }}
 */
export function parseImportJson(text, { genre = 'fantasy', currencyLabel = 'Gold' } = {}) {
  let json;
  try {
    json = typeof text === 'string' ? JSON.parse(text) : text;
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!json || typeof json !== 'object') throw new Error('Unrecognized file contents.');
  if (json.format === NATIVE_CHARACTER_FORMAT) {
    if (!json.character?.stats) throw new Error('Character bundle is missing stats.');
    return { kind: 'character', data: sanitizeImportedCharacter(json.character), source: 'native' };
  }
  if (json.format === NATIVE_CAMPAIGN_FORMAT) {
    if (!json.campaign?.meta) throw new Error('Campaign bundle is missing meta.');
    return {
      kind: 'campaign',
      data: {
        campaign: json.campaign,
        character: json.character ? sanitizeImportedCharacter(json.character) : null,
        turns: Array.isArray(json.turns) ? json.turns : [],
        diary: Array.isArray(json.diary) ? json.diary : [],
        codex: Array.isArray(json.codex) ? json.codex : [],
      },
      source: 'native',
    };
  }
  if (json.system?.abilities || (json.type === 'character' && json.system)) {
    return { kind: 'character', data: fromFoundryActor(json, { genre, currencyLabel }), source: 'foundry' };
  }
  throw new Error('Unsupported format. Expected a Solo RPG Engine bundle or a Foundry VTT dnd5e actor.');
}

function sanitizeImportedCharacter(c) {
  const out = JSON.parse(JSON.stringify(c));
  delete out.id;
  out.activeCampaignId = null;
  out.inventory = (out.inventory || []).map((it) => ({ ...it, id: it.id || uid('item') }));
  out.companionRoster = out.companionRoster || [];
  out.customPerkTree = out.customPerkTree || [];
  out.skillProficiencies = (out.skillProficiencies || []).filter((s) => SKILL_KEYS.includes(s));
  out.hitDie = out.hitDie || defaultHitDie(out.classOrArchetype);
  out.updatedAt = Date.now();
  out.createdAt = out.createdAt || Date.now();
  return out;
}

// ── Foundry VTT dnd5e actor ──────────────────────────────────────

export const FOUNDRY_SKILL_CODES = {
  acrobatics: 'acr',
  animal_handling: 'ani',
  arcana: 'arc',
  athletics: 'ath',
  deception: 'dec',
  history: 'his',
  insight: 'ins',
  intimidation: 'itm',
  investigation: 'inv',
  medicine: 'med',
  nature: 'nat',
  perception: 'prc',
  performance: 'prf',
  persuasion: 'per',
  religion: 'rel',
  sleight_of_hand: 'slt',
  stealth: 'ste',
  survival: 'sur',
};

const FOUNDRY_CODE_TO_SKILL = Object.fromEntries(Object.entries(FOUNDRY_SKILL_CODES).map(([k, v]) => [v, k]));

const FOUNDRY_ITEM_TYPE = { weapon: 'weapon', armor: 'equipment', consumable: 'consumable', material: 'loot', key: 'loot' };

function htmlToText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function toFoundryActor(character) {
  const abilities = {};
  for (const ab of ABILITIES) abilities[ab] = { value: character.stats?.[ab] ?? 10, proficient: 0 };
  const skills = {};
  for (const key of SKILL_KEYS) {
    skills[FOUNDRY_SKILL_CODES[key]] = {
      value: (character.skillProficiencies || []).includes(key) ? 1 : 0,
      ability: SKILLS[key],
    };
  }
  const items = [
    {
      name: character.classOrArchetype || 'Adventurer',
      type: 'class',
      system: { levels: character.level || 1, hitDice: `d${character.hitDie || 8}` },
    },
    ...(character.inventory || []).map((it) => {
      const sys = {
        description: { value: `<p>${escapeHtml(it.description)}</p>` },
        quantity: 1,
        equipped: Boolean(it.equipped),
        price: { value: it.value ?? 0, denomination: 'gp' },
      };
      if (it.type === 'weapon' && it.damageDice) {
        const m = /^(\d*)d(\d+)/i.exec(it.damageDice);
        if (m) sys.damage = { base: { number: parseInt(m[1] || '1', 10), denomination: parseInt(m[2], 10), types: [] }, parts: [[`${it.damageDice} + @mod`, '']] };
        sys.attackBonus = String(it.statModifiers?.attack || '');
      }
      if (it.type === 'armor') sys.armor = { value: it.statModifiers?.ac || 0 };
      return {
        name: it.name,
        type: FOUNDRY_ITEM_TYPE[it.type] || 'loot',
        system: sys,
        flags: { 'solo-rpg-engine': { item: it } },
      };
    }),
  ];
  return {
    name: character.name,
    type: 'character',
    img: character.portraitUrl || 'icons/svg/mystery-man.svg',
    system: {
      abilities,
      attributes: {
        hp: { value: character.vitals?.hp ?? 1, max: character.vitals?.maxHp ?? 1, temp: character.vitals?.tempHp ?? 0 },
        ac: { calc: 'flat', flat: character.vitals?.ac ?? 10 },
        movement: { walk: character.vitals?.speed ?? 30, units: 'ft' },
        death: { success: character.vitals?.deathSaves?.successes ?? 0, failure: character.vitals?.deathSaves?.failures ?? 0 },
      },
      details: {
        xp: { value: character.xp ?? 0 },
        biography: { value: `<p>${escapeHtml(character.backstory || '')}</p>` },
      },
      skills,
      currency: { pp: 0, gp: character.currency?.amount ?? 0, ep: 0, sp: 0, cp: 0 },
    },
    items,
    flags: {
      'solo-rpg-engine': {
        genre: character.genre,
        currencyLabel: character.currency?.label,
        customPerkTree: character.customPerkTree || [],
        companionRoster: character.companionRoster || [],
        conditions: character.vitals?.conditions || [],
      },
    },
  };
}

export function fromFoundryActor(actor, { genre = 'fantasy', currencyLabel = 'Gold' } = {}) {
  const sys = actor.system || actor.data || {};
  const flags = actor.flags?.['solo-rpg-engine'] || {};
  const stats = {};
  for (const ab of ABILITIES) {
    const v = Number(sys.abilities?.[ab]?.value);
    stats[ab] = Number.isFinite(v) && v > 0 ? Math.min(30, Math.round(v)) : 10;
  }
  const skillProficiencies = [];
  for (const [code, data] of Object.entries(sys.skills || {})) {
    const key = FOUNDRY_CODE_TO_SKILL[code];
    if (key && Number(data?.value) >= 1) skillProficiencies.push(key);
  }
  const items = Array.isArray(actor.items) ? actor.items : [];
  const classItem = items.find((i) => i.type === 'class');
  const xp = Number(sys.details?.xp?.value) || 0;
  const level = Math.max(1, Number(classItem?.system?.levels) || Number(sys.details?.level) || levelForXp(xp));
  const hitDieMatch = /d(\d+)/.exec(String(classItem?.system?.hitDice || classItem?.system?.hd?.denomination || ''));
  const archetype = classItem?.name || 'Adventurer';
  const hitDie = hitDieMatch ? parseInt(hitDieMatch[1], 10) : defaultHitDie(archetype);
  const computedMax = startingHp(hitDie, stats.con) + (level - 1) * hpGainPerLevel(hitDie, stats.con);
  const maxHp = Number(sys.attributes?.hp?.max) || computedMax;
  const hp = Math.min(maxHp, Number(sys.attributes?.hp?.value) || maxHp);
  const flatAc = Number(sys.attributes?.ac?.flat) || Number(sys.attributes?.ac?.value);
  const ac = Number.isFinite(flatAc) && flatAc > 0 ? flatAc : 10 + abilityMod(stats.dex);

  const inventory = [];
  for (const it of items) {
    if (it.type === 'class' || it.type === 'spell' || it.type === 'feat' || it.type === 'background' || it.type === 'race' || it.type === 'subclass') continue;
    const native = it.flags?.['solo-rpg-engine']?.item;
    if (native) {
      inventory.push({ ...native, id: uid('item') });
      continue;
    }
    const s = it.system || {};
    let type = 'material';
    if (it.type === 'weapon') type = 'weapon';
    else if (it.type === 'equipment' && (s.armor?.value || s.type?.value === 'light' || s.type?.value === 'medium' || s.type?.value === 'heavy')) type = 'armor';
    else if (it.type === 'consumable') type = 'consumable';
    else if (it.type === 'equipment') type = 'key';
    let damageDice = null;
    if (type === 'weapon') {
      if (s.damage?.base?.denomination) damageDice = `${s.damage.base.number || 1}d${s.damage.base.denomination}`;
      else if (Array.isArray(s.damage?.parts) && s.damage.parts[0]) {
        const m = /(\d*d\d+)/i.exec(String(s.damage.parts[0][0]));
        if (m) damageDice = m[1].startsWith('d') ? `1${m[1]}` : m[1];
      }
    }
    const statModifiers = {};
    if (type === 'armor') {
      const armorVal = Number(s.armor?.value) || 0;
      // Foundry armor value is total AC; convert to a bonus over unarmored 10.
      if (armorVal > 10) statModifiers.ac = armorVal - 10;
      else if (armorVal > 0) statModifiers.ac = armorVal;
    }
    const atk = parseInt(s.attackBonus, 10);
    if (type === 'weapon' && Number.isFinite(atk) && atk) statModifiers.attack = atk;
    const qty = Math.max(1, Math.min(20, Number(s.quantity) || 1));
    const props = s.properties ? (Array.isArray(s.properties) ? s.properties : Object.keys(s.properties).filter((k) => s.properties[k])) : [];
    const craftingTags = [];
    if (type === 'weapon') {
      const ranged = String(s.actionType || '').startsWith('r') || String(s.type?.value || '').includes('R') || props.includes('amm');
      craftingTags.push(ranged ? 'ranged' : 'melee');
      if (props.includes('fin')) craftingTags.push('finesse');
      if (props.includes('hvy')) craftingTags.push('heavy');
    }
    for (let i = 0; i < (type === 'weapon' || type === 'armor' ? 1 : qty); i++) {
      inventory.push({
        id: uid('item'),
        name: String(it.name || 'Item'),
        type,
        equipped: Boolean(s.equipped) && i === 0,
        damageDice,
        statModifiers,
        craftingTags,
        description: htmlToText(s.description?.value).slice(0, 400),
        value: Number(s.price?.value ?? s.price) || 0,
      });
    }
  }

  const cur = sys.currency || {};
  const gpTotal = Math.round((Number(cur.pp) || 0) * 10 + (Number(cur.gp) || 0) + (Number(cur.ep) || 0) / 2 + (Number(cur.sp) || 0) / 10 + (Number(cur.cp) || 0) / 100);

  return {
    name: String(actor.name || 'Imported Hero').slice(0, 60),
    genre: flags.genre || genre,
    classOrArchetype: archetype,
    level,
    xp,
    status: 'alive',
    portraitUrl: actor.img && /^https?:/.test(actor.img) ? actor.img : null,
    hitDie,
    backstory: htmlToText(sys.details?.biography?.value).slice(0, 2000),
    stats,
    skillProficiencies,
    vitals: {
      hp,
      maxHp,
      tempHp: Number(sys.attributes?.hp?.temp) || 0,
      ac,
      speed: Number(sys.attributes?.movement?.walk) || 30,
      deathSaves: { successes: 0, failures: 0 },
      conditions: Array.isArray(flags.conditions) ? flags.conditions : [],
    },
    currency: { amount: gpTotal, label: flags.currencyLabel || currencyLabel },
    customPerkTree: Array.isArray(flags.customPerkTree) ? flags.customPerkTree : [],
    inventory,
    companionRoster: Array.isArray(flags.companionRoster) ? flags.companionRoster : [],
    activeCampaignId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ── Markdown ─────────────────────────────────────────────────────

function mdEscape(s) {
  return String(s ?? '').replace(/\r/g, '');
}

export function characterSheetMarkdown(character, skin) {
  const lines = [];
  lines.push(`## ${mdEscape(character.name)} — Level ${character.level} ${mdEscape(character.classOrArchetype)}`);
  lines.push('');
  lines.push(`**HP** ${character.vitals?.hp}/${character.vitals?.maxHp} · **AC** ${character.vitals?.ac} · **Speed** ${character.vitals?.speed} ft · **XP** ${character.xp}`);
  lines.push('');
  lines.push('| ' + ABILITIES.map((a) => a.toUpperCase()).join(' | ') + ' |');
  lines.push('|' + ABILITIES.map(() => '---').join('|') + '|');
  lines.push('| ' + ABILITIES.map((a) => `${character.stats?.[a]} (${abilityMod(character.stats?.[a]) >= 0 ? '+' : ''}${abilityMod(character.stats?.[a])})`).join(' | ') + ' |');
  lines.push('');
  if (character.skillProficiencies?.length) {
    lines.push(`**Proficient Skills:** ${character.skillProficiencies.map((s) => skillLabel(s, skin)).join(', ')}`);
    lines.push('');
  }
  const perks = (character.customPerkTree || []).filter((p) => p.unlocked);
  if (perks.length) {
    lines.push('**Perks:**');
    for (const p of perks) lines.push(`- *${mdEscape(p.name)}* (Tier ${p.tier}) — ${mdEscape(p.description)}`);
    lines.push('');
  }
  if (character.inventory?.length) {
    lines.push('**Inventory:**');
    for (const it of character.inventory) {
      lines.push(`- ${mdEscape(it.name)}${it.equipped ? ' *(equipped)*' : ''}${it.damageDice ? ` — ${it.damageDice}` : ''}`);
    }
    lines.push('');
  }
  lines.push(`**${mdEscape(character.currency?.label || 'Currency')}:** ${character.currency?.amount ?? 0}`);
  return lines.join('\n');
}

/**
 * Formats the campaign as a readable novel/chronicle: diary chapters, unarchived turns,
 * quest log, and codex.
 */
export function campaignToMarkdown({ campaign, character, diary = [], turns = [], codex = [] }) {
  const meta = campaign?.meta || {};
  const skin = campaign?.skin;
  const out = [];
  out.push(`# ${mdEscape(meta.title || 'Untitled Campaign')}`);
  out.push('');
  out.push(`*A ${mdEscape(meta.genreTheme || 'fantasy')} chronicle${character ? ` of ${mdEscape(character.name)}` : ''}.*`);
  if (campaign?.worldState?.clock) out.push(`*Last recorded: ${formatClock(campaign.worldState.clock)}.*`);
  out.push('');
  if (campaign?.region?.name) {
    out.push(`## The Region: ${mdEscape(campaign.region.name)}`);
    out.push('');
    out.push(mdEscape(campaign.region.description || ''));
    out.push('');
  }
  if (character) {
    out.push('## Dramatis Persona');
    out.push('');
    out.push(characterSheetMarkdown(character, skin));
    out.push('');
  }
  const chapters = diary.slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  chapters.forEach((ch, i) => {
    out.push(`## Chapter ${i + 1}: ${mdEscape(ch.title || 'Untitled')}`);
    out.push('');
    out.push(mdEscape(ch.summary || ''));
    if (Array.isArray(ch.keyEvents) && ch.keyEvents.length) {
      out.push('');
      for (const e of ch.keyEvents) out.push(`- ${mdEscape(e)}`);
    }
    out.push('');
  });
  const live = turns.slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  if (live.length) {
    out.push(`## Chapter ${chapters.length + 1}: The Story Continues`);
    out.push('');
    for (const t of live) {
      if (t.player?.text && !t.player?.ooc) out.push(`> **${mdEscape(character?.name || 'You')}:** ${mdEscape(t.player.text)}`);
      if (t.roll) {
        out.push('');
        out.push(`*🎲 ${mdEscape(t.roll.label)}: ${t.roll.total}${t.roll.dc !== null && t.roll.dc !== undefined ? ` vs DC ${t.roll.dc} — ${t.roll.success ? 'Success' : 'Failure'}` : ''}*`);
      }
      if (t.ai?.narrative_text) {
        out.push('');
        out.push(mdEscape(t.ai.narrative_text));
      }
      out.push('');
    }
  }
  const quests = campaign?.quests || [];
  if (quests.length) {
    out.push('## Quest Log');
    out.push('');
    for (const q of quests) {
      const mark = q.status === 'completed' ? '✔' : q.status === 'failed' ? '✘' : '•';
      out.push(`- ${mark} **${mdEscape(q.title)}** (${q.type}, ${q.status}) — ${mdEscape(q.description)}`);
    }
    out.push('');
  }
  if (codex.length) {
    out.push('## Codex');
    out.push('');
    for (const c of codex.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)))) {
      out.push(`### ${mdEscape(c.name)} *(${mdEscape(c.type || 'entry')})*`);
      out.push('');
      out.push(mdEscape(c.summary || c.description || ''));
      out.push('');
    }
  }
  const pins = campaign?.lorePinboard || [];
  if (pins.length) {
    out.push('## Rulebook & Lore Pinboard');
    out.push('');
    for (const p of pins) out.push(`- ${mdEscape(p)}`);
    out.push('');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

/** Final chronicle for the Permadeath Graveyard. */
export function deathChronicleMarkdown({ campaign, character, diary = [], turns = [], codex = [], causeOfDeath, turnsSurvived }) {
  const head = [
    `# In Memoriam: ${mdEscape(character?.name || 'Unknown')}`,
    '',
    `*${mdEscape(character?.classOrArchetype || '')}, Level ${character?.level ?? 1}. Fell during “${mdEscape(campaign?.meta?.title || 'an untold tale')}”.*`,
    '',
    `**Cause of Death:** ${mdEscape(causeOfDeath)}`,
    `**Turns Survived:** ${turnsSurvived}`,
    campaign?.worldState?.clock ? `**Died:** ${formatClock(campaign.worldState.clock)}` : '',
    '',
    '---',
    '',
  ].filter((l) => l !== null);
  return head.join('\n') + campaignToMarkdown({ campaign, character, diary, turns, codex });
}

/**
 * Splits a Markdown lore document into Lore Pinboard entries.
 * Headings become prefixes for their bullet/paragraph children.
 */
export function markdownToLoreEntries(md, { maxEntries = 40, maxLength = 500 } = {}) {
  const entries = [];
  let heading = '';
  let paragraph = [];
  const flush = () => {
    if (paragraph.length) {
      const text = paragraph.join(' ').trim();
      if (text) entries.push((heading ? `${heading}: ` : '') + text);
      paragraph = [];
    }
  };
  for (const rawLine of String(md || '').replace(/\r/g, '').split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    if (h) {
      flush();
      heading = h[1].trim();
      continue;
    }
    const b = /^(?:[-*+]|\d+\.)\s+(.*)$/.exec(line);
    if (b) {
      flush();
      entries.push((heading ? `${heading}: ` : '') + b[1].trim());
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return entries
    .map((e) => e.replace(/\*\*|__|`/g, '').slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxEntries);
}

/** Triggers a browser download of text content. */
export function downloadText(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slugify(s) {
  return String(s || 'export').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'export';
}
