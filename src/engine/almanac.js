/**
 * Almanac index: every reference entry (rules, origins, gear, powers, world codex) as flat, searchable
 * records in the selected genre's words. Pure — the Almanac window only renders what this returns.
 */
import { RULES } from '../config/rulesReference.js';
import { HELP } from '../config/helpTooltips.js';
import { SPECIES, CLASSES, BACKGROUNDS, WEAPONS, ARMOR, GEAR } from '../config/srd.js';
import { SPELLS } from '../config/spells.js';
import { GENRES } from '../config/genreSkins.js';
import { genreTerms, speciesName, speciesBlurb, className, backgroundName, itemName, languageName } from '../config/srdReskins.js';

export const ALMANAC_TABS = [
  { id: 'rules', label: 'Rules' },
  { id: 'origins', label: 'Origins & Roles' },
  { id: 'gear', label: 'Gear & Arsenal' },
  { id: 'powers', label: 'Powers' },
  { id: 'world', label: 'World Codex' },
];

const ORD = ['Cantrip', '1st level', '2nd level', '3rd level', '4th level', '5th level', '6th level', '7th level', '8th level', '9th level'];
const cap = (s) => String(s || '').replace(/\b\w/g, (c) => c.toUpperCase());

function rules() {
  const conditions = Object.entries(HELP)
    .filter(([k]) => k.startsWith('condition.'))
    .map(([k, h]) => ({ id: k, tab: 'rules', group: 'Conditions', title: h.title, body: h.details, tags: ['condition'] }));
  return [...RULES.map((r) => ({ id: `rule.${r.id}`, tab: 'rules', group: 'Rules', title: r.title, body: r.body, tags: r.tags })), ...conditions];
}

function origins(genre) {
  const terms = genreTerms(genre);
  const out = [];
  for (const sp of SPECIES) {
    const name = speciesName(sp.id, genre);
    const bonuses = Object.entries(sp.abilityBonuses || {}).map(([a, v]) => `${a.toUpperCase()} +${v}`).join(', ');
    out.push({
      id: `species.${sp.id}`,
      tab: 'origins',
      group: terms.species,
      title: name,
      subtitle: name !== sp.name ? sp.name : null,
      body: [speciesBlurb(sp.id, genre), `${bonuses}${bonuses ? '. ' : ''}Speed ${sp.speed} ft.`, (sp.languages || []).map((l) => languageName(l, genre)).join(', ')].filter(Boolean).join(' '),
      details: (sp.traits || []).map(([n, d]) => `${n}: ${d}`),
      tags: ['species', sp.id, sp.name.toLowerCase()],
    });
  }
  for (const c of CLASSES) {
    const name = className(c.id, genre);
    out.push({
      id: `class.${c.id}`,
      tab: 'origins',
      group: terms.class,
      title: name,
      subtitle: name !== c.name ? c.name : null,
      body: `Hit die d${c.hitDie}. Saves ${c.savingThrows.map((a) => a.toUpperCase()).join(' & ')}. ${c.spellcasting ? `${terms.spells} (${c.spellcasting.ability.toUpperCase()}).` : ['paladin', 'ranger'].includes(c.id) ? `${terms.spells} from level 2.` : 'No spellcasting.'}`,
      details: (c.features || []).map(([n, d]) => `${n}: ${d}`),
      tags: ['class', c.id, c.name.toLowerCase()],
    });
  }
  for (const b of BACKGROUNDS) {
    const name = backgroundName(b.id, genre);
    out.push({
      id: `background.${b.id}`,
      tab: 'origins',
      group: terms.background,
      title: name,
      subtitle: name !== b.name ? b.name : null,
      body: `Skills: ${(b.skills || []).map((s) => cap(s.replace(/_/g, ' '))).join(', ') || 'your choice'}.${b.extraLanguages ? ` ${b.extraLanguages} extra language${b.extraLanguages > 1 ? 's' : ''}.` : ''}`,
      details: b.feature ? [`${b.feature[0]}: ${b.feature[1]}`] : [],
      tags: ['background', b.id, b.name.toLowerCase()],
    });
  }
  return out;
}

function gear(genre) {
  const currency = (GENRES[genre] || GENRES.fantasy).currencyLabel;
  const price = (cost) => (cost ? `${cost} ${currency}` : 'free');
  const named = (it) => {
    const name = itemName(it.id, genre);
    return { title: name, subtitle: name !== it.name ? it.name : null };
  };
  const weapons = WEAPONS.map((w) => ({
    id: `weapon.${w.id}`,
    tab: 'gear',
    group: 'Weapons',
    ...named(w),
    body: `${cap(w.category)} ${w.range} weapon. ${w.damageDice} ${w.damageType}.${w.properties?.length ? ` ${w.properties.join(', ')}.` : ''} ${price(w.cost)}.`,
    tags: ['weapon', w.category, w.range, ...(w.properties || [])],
  }));
  const armor = ARMOR.map((a) => ({
    id: `armor.${a.id}`,
    tab: 'gear',
    group: 'Armor',
    ...named(a),
    body: `${cap(a.armorCategory)}. ${a.armorCategory === 'shield' ? '+2 AC' : `AC ${a.baseAc}${a.dexCap === null ? ' + Dex' : a.dexCap ? ` + Dex (max ${a.dexCap})` : ''}`}.${a.strReq ? ` Needs Str ${a.strReq}.` : ''}${a.stealthDisadvantage ? ' Stealth disadvantage.' : ''} ${price(a.cost)}.`,
    tags: ['armor', a.armorCategory],
  }));
  const kit = GEAR.map((g) => ({
    id: `gear.${g.id}`,
    tab: 'gear',
    group: 'Gear',
    ...named(g),
    body: `${g.contents ? `${g.contents}. ` : ''}${price(g.cost)}.`,
    tags: ['gear', g.pack ? 'pack' : 'item'],
  }));
  return [...weapons, ...armor, ...kit];
}

function powers(genre) {
  const terms = genreTerms(genre);
  return SPELLS.map((s) => {
    const mech = [
      s.kind === 'attack' && `${s.attackType} spell attack, ${s.damage} ${s.damageType}`,
      s.kind === 'save' && `${s.save.toUpperCase()} save${s.damage ? `, ${s.damage} ${s.damageType}${s.onSave === 'half' ? ' (half on save)' : ''}` : ''}`,
      s.kind === 'auto' && `${s.damage} ${s.damageType}, no roll to hit`,
      s.kind === 'heal' && `heals ${s.heal}${s.healMod === false ? '' : ' + modifier'}`,
      s.kind === 'temp_hp' && `${s.tempHp} temporary HP`,
      s.upcast && `+${s.upcast} per higher slot`,
      s.area && 'area',
      s.concentration && 'concentration',
      s.ritual && 'ritual',
    ].filter(Boolean);
    return {
      id: `spell.${s.id}`,
      tab: 'powers',
      group: s.level === 0 ? terms.cantrips : `${ORD[s.level]} ${terms.spells.toLowerCase()}`,
      level: s.level,
      title: s.name,
      subtitle: `${ORD[s.level]} ${s.school} · ${s.castingTime} · ${s.range}`,
      body: `${s.desc}${mech.length ? ` (${mech.join('; ')})` : ''}`,
      tags: ['spell', s.school, s.kind, s.level === 0 ? 'cantrip' : `level ${s.level}`],
    };
  });
}

/**
 * World entries from a campaign snapshot: { codex: [], mapNodes: [], factions: [], lorePinboard: [] }.
 */
function world(snapshot) {
  if (!snapshot) return [];
  const TYPE_GROUP = { npc: 'People', companion: 'People', location: 'Places', faction: 'Factions', item: 'Items', lore: 'Lore' };
  const out = [];
  for (const e of snapshot.codex || []) out.push({ id: `codex.${e.id}`, tab: 'world', group: TYPE_GROUP[e.type] || 'Lore', title: e.name, body: e.summary || '', tags: e.tags || [] });
  for (const n of snapshot.mapNodes || []) {
    if (!n.discovered) continue;
    out.push({
      id: `node.${n.id}`,
      tab: 'world',
      group: 'Places',
      title: n.label,
      subtitle: cap(n.type),
      body: n.description || '',
      details: (n.rumors || []).map((r) => `Rumor: ${r}`),
      tags: ['place', n.type],
    });
  }
  for (const f of snapshot.factions || []) out.push({ id: `faction.${f.id}`, tab: 'world', group: 'Factions', title: f.name, subtitle: f.status || null, body: f.description || f.agenda || '', tags: ['faction'] });
  (snapshot.lorePinboard || []).forEach((l, i) => out.push({ id: `pin.${i}`, tab: 'world', group: 'Lore Pinboard', title: String(l).split(/[.:\n]/)[0].slice(0, 60) || 'Lore', body: String(l), tags: ['lore'] }));
  return out;
}

/** Every Almanac entry for a genre, plus the active campaign's world (if any). */
export function buildAlmanacIndex({ genre = 'fantasy', world: snapshot = null } = {}) {
  return [...rules(), ...origins(genre), ...gear(genre), ...powers(genre), ...world(snapshot)];
}

/**
 * Case-insensitive search over title, subtitle, body, details and tags. Every word must match.
 * @param {Array} index  from buildAlmanacIndex
 * @param {string} query
 * @param {string|null} tab  limit to one tab (null = all tabs)
 */
export function searchAlmanac(index, query = '', tab = null) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  return index.filter((e) => {
    if (tab && e.tab !== tab) return false;
    if (!words.length) return true;
    const hay = [e.title, e.subtitle, e.group, e.body, ...(e.details || []), ...(e.tags || [])].join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
