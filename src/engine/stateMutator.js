/**
 * State Mutator — applies AI `state_updates` proposals and engine effects SAFELY.
 *  - computeTurnState(): pure, deterministic, unit-tested. Clamps every number, validates
 *    every item, and is the ONLY path by which companions become recruited.
 *  - commit*(): the only functions that write game state to Firestore (atomic batches).
 */
import { applyXp } from './progression.js';
import { effectiveMaxHp, parseDice } from './diceEngine.js';
import { advanceWorld } from './clockWeatherEngine.js';
import { syncCombat, applyHpChange, emptyCombat } from './combatEngine.js';
import { placeNodeNear, connect, safeId, normalizeCodexEntry } from './campaignFactory.js';
import { uid, getDefaultRng } from './rng.js';
import { xpMode, questsEnabled, listDeeds, scoreDeeds, resolveMilestone } from './deeds.js';
import { ABILITIES, SKILL_KEYS } from '../config/genreSkins.js';

export const MAX_HP_DELTA_FACTOR = 2;
export const MAX_CURRENCY_GAIN = 100000;
export const MAX_XP_GAIN = 20000;
export const MAX_TIME_ADVANCE = 60 * 24 * 30;
export const MAX_LOOT_PER_TURN = 10;
export const MAX_RUMORS_PER_NODE = 12;

/** Campaign fields a turn may change — snapshotted for Edit Last Turn. */
export const MUTABLE_CAMPAIGN_FIELDS = [
  'worldState',
  'quests',
  'factions',
  'mapNodes',
  'combat',
  'activeNpc',
  'lastChoices',
  'lastScenePrompt',
  'pendingEvents',
  'pendingRoll',
  'merchantVisits',
  'buffs',
  'lastTurnId',
  'turnCount',
  'sessionRecap',
  'progress',
];

const ITEM_TYPES = ['weapon', 'armor', 'consumable', 'material', 'key'];
const MOD_KEYS = new Set([...ABILITIES, ...SKILL_KEYS, 'ac', 'attack', 'damage', 'checks', 'initiative']);
const CONDITIONS = new Set(['poisoned', 'frightened', 'exhausted', 'blinded', 'prone', 'inspired', 'hidden', 'unconscious', 'stable', 'stunned', 'restrained', 'charmed', 'deafened', 'grappled', 'paralyzed', 'petrified', 'incapacitated', 'invisible']);

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const int = (v, fallback = 0) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : fallback;
};
const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));

/** Validates and normalizes an AI-proposed loot item into the inventory schema. */
export function normalizeLootItem(raw) {
  if (!raw || typeof raw !== 'object' || !raw.name) return null;
  const type = ITEM_TYPES.includes(raw.type) ? raw.type : 'material';
  const statModifiers = {};
  for (const [k, v] of Object.entries(raw.statModifiers || {})) {
    if (k === 'heal' && typeof v === 'string' && parseDice(v)) statModifiers.heal = v;
    else if (MOD_KEYS.has(k) && Number.isFinite(Number(v)) && Number(v) !== 0) statModifiers[k] = clamp(int(v), -3, 3);
  }
  const damageDice = type === 'weapon' && raw.damageDice && parseDice(raw.damageDice) ? String(raw.damageDice).replace(/\s+/g, '') : null;
  return {
    id: uid('item'),
    name: String(raw.name).slice(0, 60),
    type,
    equipped: false,
    damageDice,
    statModifiers,
    craftingTags: (Array.isArray(raw.craftingTags) ? raw.craftingTags : []).map((t) => String(t).toLowerCase().slice(0, 24)).slice(0, 8),
    description: String(raw.description || '').slice(0, 400),
    value: clamp(int(raw.value, 1), 0, 100000),
  };
}

function upsertQuest(quests, q, events, clock) {
  const id = safeId(q.id || q.title, 'quest');
  const idx = quests.findIndex((x) => x.id === id);
  const deadline =
    Number.isInteger(q.deadline_day) && q.deadline_day > 0
      ? { day: q.deadline_day, hour: clamp(int(q.deadline_hour, 0), 0, 23) }
      : idx >= 0
        ? quests[idx].deadline
        : null;
  const status = ['active', 'completed', 'failed'].includes(q.status) ? q.status : 'active';
  const next = {
    id,
    title: String(q.title || quests[idx]?.title || 'Quest').slice(0, 100),
    description: String(q.description || quests[idx]?.description || '').slice(0, 800),
    type: ['main', 'bounty', 'rumor'].includes(q.type) ? q.type : quests[idx]?.type || 'rumor',
    status,
    deadline,
    rewards: Array.isArray(q.rewards) ? q.rewards.map((r) => String(r).slice(0, 120)) : quests[idx]?.rewards || [],
  };
  // Deadlines already in the past for a brand-new quest are treated as untimed.
  if (idx < 0 && next.deadline && (next.deadline.day < clock.day || (next.deadline.day === clock.day && next.deadline.hour <= clock.hour))) next.deadline = null;
  if (idx >= 0) {
    const prev = quests[idx];
    if (prev.status !== status) {
      events.push({ type: `quest_${status}`, text: `Quest ${status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : 'reopened'}: ${next.title}`, tone: status === 'completed' ? 'success' : status === 'failed' ? 'danger' : 'info' });
    }
    return quests.map((x, i) => (i === idx ? next : x));
  }
  events.push({ type: 'quest_new', text: `New ${next.type === 'bounty' ? 'bounty' : 'quest'}: ${next.title}`, tone: 'info' });
  return [...quests, next];
}

function upsertCompanion(roster, u, events) {
  const id = safeId(u.id || u.name, 'comp');
  const idx = roster.findIndex((c) => c.id === id || (u.name && c.name.toLowerCase() === String(u.name).toLowerCase()));
  const base =
    idx >= 0
      ? roster[idx]
      : {
          id,
          name: String(u.name || 'Stranger').slice(0, 60),
          archetype: String(u.archetype || 'Companion').slice(0, 60),
          loyalty: 50,
          hp: 10,
          maxHp: 10,
          ac: 12,
          attackBonus: 3,
          damageDice: '1d6',
          isRecruited: false,
          personalityNotes: '',
        };
  const next = { ...base };
  if (u.archetype) next.archetype = String(u.archetype).slice(0, 60);
  if (u.personalityNotes) next.personalityNotes = String(u.personalityNotes).slice(0, 400);
  if (Number.isInteger(u.maxHp) && u.maxHp > 0) next.maxHp = clamp(u.maxHp, 1, 500);
  if (Number.isInteger(u.ac) && u.ac > 0) next.ac = clamp(u.ac, 5, 30);
  if (Number.isInteger(u.attackBonus)) next.attackBonus = clamp(u.attackBonus, -2, 15);
  if (u.damageDice && parseDice(u.damageDice)) next.damageDice = String(u.damageDice).replace(/\s+/g, '');
  if (idx < 0) next.hp = next.maxHp;
  if (Number.isInteger(u.hp_delta) && u.hp_delta) next.hp = clamp(next.hp + u.hp_delta, 0, next.maxHp);
  next.hp = clamp(next.hp, 0, next.maxHp);
  if (Number.isInteger(u.loyalty_delta) && u.loyalty_delta) {
    const delta = clamp(u.loyalty_delta, -25, 25);
    next.loyalty = clamp(next.loyalty + delta, 0, 100);
    events.push({ type: 'loyalty', text: `${next.name} loyalty ${delta > 0 ? '+' : ''}${delta} (${next.loyalty}/100)`, tone: delta > 0 ? 'success' : 'warning' });
  }
  // Organic recruitment: the ONLY place isRecruited can change.
  if (u.isRecruited === true && !next.isRecruited) {
    next.isRecruited = true;
    events.push({ type: 'recruited', text: `${next.name} has joined your party!`, tone: 'success' });
  } else if (u.isRecruited === false && next.isRecruited) {
    next.isRecruited = false;
    events.push({ type: 'departed', text: `${next.name} has left your party.`, tone: 'warning' });
  }
  if (idx < 0) events.push({ type: 'companion_met', text: `Met ${next.name} (${next.archetype}).`, tone: 'info' });
  return idx >= 0 ? roster.map((c, i) => (i === idx ? next : c)) : [...roster, next];
}

/**
 * Pure state transition for one turn.
 * @param {object} p
 * @param {object} p.campaign   current campaign doc
 * @param {object} p.character  current character doc
 * @param {object|null} p.ai    validated dm-turn response (null for engine-only changes)
 * @param {object} [p.engine]   engine-originated effects applied first:
 *   { time_advance_minutes, hp_delta, currency_delta, xp_delta, conditions_added, conditions_removed,
 *     travelToNodeId, vitals (replacement vitals from a death save), consumePendingEvents }
 * @param {object|null} [p.roll]          the resolved roll record for this turn (feeds Deeds XP)
 * @param {Array<string>} [p.knownCodexIds] Codex ids that already exist (feeds Deeds XP)
 * @returns {{ campaign, character, codexUpserts, events, died, downed }}
 *
 * XP is engine-owned: the storyteller's xp_delta is ignored. In 'deeds' mode XP comes from
 * deeds.js; in 'milestone' mode only an accepted milestone proposal levels the character.
 */
export function computeTurnState({ campaign, character, ai = null, engine = {}, roll = null, knownCodexIds = [], rng = getDefaultRng() }) {
  const camp = clone(campaign);
  let ch = clone(character);
  const events = [];
  const su = ai?.state_updates || {};
  const strictness = camp.meta?.rulesStrictness ?? 5;
  let died = false;
  let downed = false;

  // ── Death-save vitals replacement (engine) ──
  if (engine.vitals) ch.vitals = clone(engine.vitals);

  // ── Downtime effects (engine) ──
  if (Array.isArray(engine.remove_item_ids) && engine.remove_item_ids.length) {
    const ids = new Set(engine.remove_item_ids);
    const used = ch.inventory.filter((i) => ids.has(i.id)).map((i) => i.name);
    ch.inventory = ch.inventory.filter((i) => !ids.has(i.id));
    if (used.length) events.push({ type: 'item_used', text: `Used: ${used.join(', ')}`, tone: 'info' });
  }
  if (Number.isInteger(engine.set_temp_hp) && engine.set_temp_hp > (ch.vitals.tempHp || 0)) {
    ch.vitals.tempHp = engine.set_temp_hp;
    events.push({ type: 'temp_hp', text: `+${engine.set_temp_hp} temporary HP`, tone: 'success' });
  }
  if (engine.heal_companions_full) {
    ch.companionRoster = (ch.companionRoster || []).map((c) => (c.isRecruited ? { ...c, hp: c.maxHp } : c));
  }
  if (engine.buffs && typeof engine.buffs === 'object') camp.buffs = { ...(camp.buffs || {}), ...engine.buffs };

  // ── Spellcasting (engine) ──
  if (ch.spellcasting?.slots) {
    const slots = ch.spellcasting.slots;
    const lvl = int(engine.spell_slot_used);
    if (lvl >= 1 && lvl <= (slots.max || []).length) {
      slots.used = (slots.max || []).map((m, i) => clamp((slots.used?.[i] || 0) + (i === lvl - 1 ? 1 : 0), 0, m));
    }
    if (engine.restore_spell_slots === 'all' || (engine.restore_spell_slots === 'pact' && ch.spellcasting.pact)) {
      const had = (slots.used || []).some((u) => u > 0);
      slots.used = (slots.max || []).map(() => 0);
      if (had) events.push({ type: 'slots', text: 'Spell slots recovered.', tone: 'success' });
    }
  }
  if (engine.clear_active_effects) ch.activeEffects = [];
  if (engine.active_effect && engine.active_effect.id) {
    const eff = { id: String(engine.active_effect.id).slice(0, 40), name: String(engine.active_effect.name || engine.active_effect.id).slice(0, 60), concentration: Boolean(engine.active_effect.concentration) };
    const kept = (ch.activeEffects || []).filter((e) => e.id !== eff.id && !(eff.concentration && e.concentration));
    ch.activeEffects = [...kept, eff];
  }
  if (engine.campaignPatch && typeof engine.campaignPatch === 'object') {
    for (const [k, v] of Object.entries(engine.campaignPatch)) if (MUTABLE_CAMPAIGN_FIELDS.includes(k)) camp[k] = clone(v);
  }

  // ── Travel (engine) ──
  if (engine.travelToNodeId) {
    const target = camp.mapNodes.find((n) => n.id === engine.travelToNodeId);
    if (target) {
      camp.worldState.currentNodeId = target.id;
      camp.worldState.visitId = uid('visit');
      camp.mapNodes = camp.mapNodes.map((n) => (n.id === target.id ? { ...n, discovered: true, visited: true } : n));
      events.push({ type: 'travel', text: `Arrived at ${target.label}.`, tone: 'info' });
    }
  }

  // ── Time ──
  const minutes = clamp(int(engine.time_advance_minutes) + Math.max(0, int(su.time_advance_minutes)), 0, MAX_TIME_ADVANCE);
  if (minutes > 0) {
    const world = advanceWorld(camp.worldState, camp.quests, minutes, camp.seedKey || 'seed');
    camp.worldState = world.worldState;
    camp.quests = world.quests;
    if (world.weatherChanged) events.push({ type: 'weather', text: `Weather: ${world.worldState.weather.type} — ${world.worldState.weather.mechanicalEffect}`, tone: 'info' });
    for (const q of world.expired) {
      events.push({ type: 'quest_expired', text: `Deadline passed: “${q.title}” has failed without you.`, tone: 'danger' });
      camp.pendingEvents = [...(camp.pendingEvents || []), `The deadline for the quest "${q.title}" passed; it resolved without the player (failed).`];
    }
  }

  // ── Weather override (AI) ──
  if (su.weather_change && su.weather_change.type) {
    camp.worldState.weather = {
      type: String(su.weather_change.type).slice(0, 40),
      mechanicalEffect: String(su.weather_change.mechanicalEffect || 'No effect.').slice(0, 160),
      modifierValue: clamp(int(su.weather_change.modifierValue), -5, 5),
    };
    events.push({ type: 'weather', text: `Weather shifts: ${camp.worldState.weather.type}`, tone: 'info' });
  }

  // ── HP ──
  const maxHp = effectiveMaxHp(ch);
  const hpDelta = clamp(int(engine.hp_delta) + int(su.hp_delta), -maxHp * MAX_HP_DELTA_FACTOR, maxHp * MAX_HP_DELTA_FACTOR);
  if (hpDelta) {
    const r = applyHpChange(ch.vitals, hpDelta, { maxHp, strictness });
    ch.vitals = r.vitals;
    events.push(...r.events);
    if (r.died) died = true;
    if (r.downed) downed = true;
  }
  ch.vitals.hp = clamp(ch.vitals.hp, 0, maxHp);
  if ((ch.vitals.deathSaves?.failures ?? 0) >= 3) died = true;
  // Dropping to 0 HP breaks concentration.
  if (ch.vitals.hp <= 0 && (ch.activeEffects || []).some((e) => e.concentration)) {
    ch.activeEffects = ch.activeEffects.filter((e) => !e.concentration);
    events.push({ type: 'concentration', text: 'Concentration broken.', tone: 'warning' });
  }

  // ── Conditions ──
  const addConds = [...(engine.conditions_added || []), ...(su.conditions_added || [])].map((c) => String(c).toLowerCase().trim()).filter((c) => CONDITIONS.has(c));
  const remConds = [...(engine.conditions_removed || []), ...(su.conditions_removed || [])].map((c) => String(c).toLowerCase().trim());
  if (addConds.length || remConds.length) {
    let conds = (ch.vitals.conditions || []).filter((c) => !remConds.includes(c));
    for (const c of addConds) if (!conds.includes(c)) conds.push(c);
    // Unconscious is engine-owned: it tracks HP 0 only.
    if (ch.vitals.hp > 0) conds = conds.filter((c) => c !== 'unconscious');
    else if (!conds.includes('unconscious')) conds.push('unconscious');
    for (const c of addConds) if (!(character.vitals.conditions || []).includes(c)) events.push({ type: 'condition', text: `Condition gained: ${c}`, tone: 'warning' });
    for (const c of remConds) if ((character.vitals.conditions || []).includes(c)) events.push({ type: 'condition', text: `Condition removed: ${c}`, tone: 'success' });
    ch.vitals.conditions = conds;
  }

  // ── Currency ──
  const curDelta = int(engine.currency_delta) + int(su.currency_delta);
  if (curDelta) {
    const before = ch.currency.amount;
    const applied = clamp(curDelta, -before, MAX_CURRENCY_GAIN);
    ch.currency = { ...ch.currency, amount: before + applied };
    if (applied !== curDelta) events.push({ type: 'insufficient_funds', text: `Not enough ${ch.currency.label}: only ${-applied} could be paid.`, tone: 'warning' });
    else events.push({ type: 'currency', text: `${applied > 0 ? '+' : ''}${applied} ${ch.currency.label}`, tone: applied > 0 ? 'success' : 'info' });
  }

  // ── Factions ──
  for (const fd of su.faction_deltas || []) {
    const idx = camp.factions.findIndex((f) => f.id === fd.faction_id || f.name.toLowerCase() === String(fd.faction_id || '').toLowerCase());
    if (idx < 0) continue;
    const f = camp.factions[idx];
    const rep = clamp(f.reputation + clamp(int(fd.rep_delta), -50, 50), -100, 100);
    const heat = clamp(f.heat + clamp(int(fd.heat_delta), -50, 50), 0, 100);
    if (rep !== f.reputation || heat !== f.heat) {
      events.push({ type: 'faction', text: `${f.name}: rep ${rep - f.reputation >= 0 ? '+' : ''}${rep - f.reputation}, heat ${heat - f.heat >= 0 ? '+' : ''}${heat - f.heat}`, tone: rep >= f.reputation ? 'info' : 'warning' });
    }
    camp.factions[idx] = { ...f, reputation: rep, heat, status: rep >= 50 ? 'Allied' : rep >= 15 ? 'Friendly' : rep > -15 ? 'Neutral' : rep > -50 ? 'Wary' : 'Hostile' };
  }

  // ── Loot ──
  const removeIds = new Set((su.loot_removed_ids || []).map(String));
  if (removeIds.size) {
    const removed = [];
    ch.inventory = ch.inventory.filter((it) => {
      if (removeIds.has(it.id)) {
        removed.push(it.name);
        return false;
      }
      return true;
    });
    // Fallback: the model sometimes references items by name.
    for (const ref of removeIds) {
      if (removed.length >= removeIds.size) break;
      const i = ch.inventory.findIndex((it) => it.name.toLowerCase() === ref.toLowerCase());
      if (i >= 0) {
        removed.push(ch.inventory[i].name);
        ch.inventory.splice(i, 1);
      }
    }
    if (removed.length) events.push({ type: 'loot_lost', text: `Lost: ${removed.join(', ')}`, tone: 'warning' });
  }
  const gained = (su.loot_gained || []).slice(0, MAX_LOOT_PER_TURN).map(normalizeLootItem).filter(Boolean);
  if (gained.length) {
    ch.inventory = [...ch.inventory, ...gained];
    events.push({ type: 'loot', text: `Gained: ${gained.map((g) => g.name).join(', ')}`, tone: 'success' });
  }

  // ── Map ──
  if (su.new_map_node && su.new_map_node.label) {
    const n = su.new_map_node;
    const id = safeId(n.id || n.label, 'node');
    const current = camp.mapNodes.find((m) => m.id === camp.worldState.currentNodeId);
    const existing = camp.mapNodes.find((m) => m.id === id);
    if (existing) {
      camp.mapNodes = camp.mapNodes.map((m) => (m.id === id ? { ...m, discovered: true } : m));
      if (!existing.discovered) events.push({ type: 'map', text: `Discovered: ${existing.label}`, tone: 'info' });
    } else {
      camp.mapNodes = [
        ...camp.mapNodes,
        {
          id,
          label: String(n.label).slice(0, 60),
          type: ['town', 'dungeon', 'camp', 'safehouse', 'landmark'].includes(n.type) ? n.type : 'landmark',
          description: String(n.description || '').slice(0, 600),
          position: placeNodeNear(current?.position, camp.mapNodes.length),
          discovered: true,
          visited: false,
          connectedTo: [],
          shopStock: [],
          rumors: (n.rumors || []).map((r) => String(r).slice(0, 300)).slice(0, MAX_RUMORS_PER_NODE),
        },
      ];
      events.push({ type: 'map', text: `New location discovered: ${n.label}`, tone: 'info' });
    }
    if (current && current.id !== id) camp.mapNodes = connect(camp.mapNodes, current.id, id, n.travelMinutes || 60);
  }

  // ── Rumors ──
  const rumors = (su.rumors_learned || []).map((r) => String(r).slice(0, 300)).filter(Boolean);
  if (rumors.length) {
    camp.mapNodes = camp.mapNodes.map((m) => (m.id === camp.worldState.currentNodeId ? { ...m, rumors: Array.from(new Set([...(m.rumors || []), ...rumors])).slice(-MAX_RUMORS_PER_NODE) } : m));
    events.push({ type: 'rumor', text: `Rumor heard: ${rumors[0]}${rumors.length > 1 ? ` (+${rumors.length - 1} more)` : ''}`, tone: 'info' });
  }

  // ── Quests (ignored entirely when the campaign has quests switched off) ──
  if (questsEnabled(camp)) {
    for (const q of su.quest_updates || []) camp.quests = upsertQuest(camp.quests, q, events, camp.worldState.clock);
  }

  // ── Companions (organic recruitment only) ──
  for (const u of su.companion_updates || []) {
    if (!u || !u.name) continue;
    ch.companionRoster = upsertCompanion(ch.companionRoster || [], u, events);
  }

  // ── Codex ──
  const codexUpserts = (su.codex_upserts || []).filter((e) => e && e.name).map(normalizeCodexEntry);

  // ── Combat ──
  if (ai?.combat_state) {
    const r = syncCombat(camp.combat, ai.combat_state, {
      character: ch,
      companions: ch.companionRoster || [],
      initiativeBonus: camp.buffs?.initiativeBuff || 0,
      rng,
    });
    camp.combat = r.combat;
    events.push(...r.events);
    if (r.initiativeRolled && camp.buffs?.initiativeBuff) camp.buffs = { ...camp.buffs, initiativeBuff: 0 };
  }

  // ── Experience (engine-owned) ──
  const mode = xpMode(camp);
  let xpGain = 0;
  let xpWhy = '';
  if (mode === 'deeds') {
    xpGain = clamp(int(engine.xp_delta), 0, MAX_XP_GAIN);
    const deeds = listDeeds({ before: { campaign, character }, after: { campaign: camp, character: ch }, roll, codexUpserts, knownCodexIds });
    const earned = scoreDeeds(deeds, ch.level);
    if (earned) {
      xpGain = clamp(xpGain + earned, 0, MAX_XP_GAIN);
      xpWhy = deeds.map((d) => d.text).join(', ');
    }
  } else if (mode === 'milestone' && ai) {
    const turnNo = (campaign.turnCount || 0) + 1;
    const m = resolveMilestone({ character: ch, proposal: su.milestone, turnCount: turnNo, lastMilestoneTurn: camp.progress?.lastMilestoneTurn || 0 });
    if (m.granted) {
      xpGain = m.xp;
      xpWhy = m.reason;
      camp.progress = {
        ...(camp.progress || {}),
        lastMilestoneTurn: turnNo,
        milestones: [...(camp.progress?.milestones || []), { turn: turnNo, level: (ch.level || 1) + 1, reason: m.reason }].slice(-30),
      };
      events.push({ type: 'milestone', text: `Milestone reached: ${m.reason}`, tone: 'success' });
    }
  }
  if (xpGain) {
    const r = applyXp(ch, xpGain);
    ch = r.character;
    if (mode === 'deeds') events.push({ type: 'xp', text: `+${xpGain} XP${xpWhy ? ` — ${xpWhy}` : ''}`, tone: 'success' });
    if (r.levelsGained > 0) events.push({ type: 'level_up', text: `Level up! You are now level ${ch.level}. (+1 perk point)`, tone: 'success' });
  }

  // ── Narrative bookkeeping ──
  if (ai) {
    camp.activeNpc = ai.dialogue_npc && ai.dialogue_npc.name ? { id: safeId(ai.dialogue_npc.id || ai.dialogue_npc.name, 'npc'), name: String(ai.dialogue_npc.name).slice(0, 60), attitude: String(ai.dialogue_npc.attitude || 'Neutral').slice(0, 30) } : null;
    camp.lastChoices = (ai.guided_choices || []).slice(0, 3);
    camp.lastScenePrompt = String(ai.scene_visual_prompt || '').slice(0, 1200);
    const rr = ai.roll_request;
    camp.pendingRoll = rr?.required && rr.skill_or_stat
      ? {
          skill_or_stat: String(rr.skill_or_stat).slice(0, 60),
          dc: Number.isInteger(rr.dc) ? clamp(rr.dc, 1, 40) : null,
          advantage_state: ['normal', 'advantage', 'disadvantage'].includes(rr.advantage_state) ? rr.advantage_state : 'normal',
          reason: String(rr.reason || '').slice(0, 200),
        }
      : null;
    if (engine.consumePendingEvents !== false) camp.pendingEvents = (camp.pendingEvents || []).filter((e) => !(engine.consumedEvents || []).includes(e));
  }

  if (died) {
    ch.vitals.deathSaves = { ...(ch.vitals.deathSaves || {}), failures: 3 };
  }
  ch.updatedAt = Date.now();
  return { campaign: camp, character: ch, codexUpserts, events, died, downed };
}

const isShield = (i) => i?.armorCategory === 'shield';
const isTwoHanded = (i) => i?.type === 'weapon' && (i.properties || []).includes('two-handed');

/**
 * Pure: equip/unequip with slots — one weapon, one body armor, one shield.
 * A two-handed weapon and a shield cannot be equipped together (equipping one unequips the other).
 */
export function toggleEquip(character, itemId) {
  const ch = clone(character);
  const item = ch.inventory.find((i) => i.id === itemId);
  if (!item) return ch;
  if (item.equipped) {
    item.equipped = false;
    return ch;
  }
  if (item.type === 'consumable' || item.type === 'material') return ch;
  for (const other of ch.inventory) {
    if (other.id === item.id || !other.equipped) continue;
    if (item.type === 'weapon' && other.type === 'weapon') other.equipped = false;
    else if (isShield(item) && isShield(other)) other.equipped = false;
    else if (item.type === 'armor' && !isShield(item) && other.type === 'armor' && !isShield(other)) other.equipped = false;
    else if (isShield(item) && isTwoHanded(other)) other.equipped = false;
    else if (isTwoHanded(item) && isShield(other)) other.equipped = false;
  }
  item.equipped = true;
  return ch;
}

// ══ Firestore commits ═══════════════════════════════════════════

async function fs() {
  const firestore = await import('firebase/firestore');
  const db = await import('../firebase/db.js');
  return { ...firestore, ...db };
}

function pickMutable(campaign) {
  const out = {};
  for (const k of MUTABLE_CAMPAIGN_FIELDS) out[k] = campaign[k] === undefined ? null : clone(campaign[k]);
  return out;
}

function stripId(doc) {
  const { id, ...rest } = doc;
  return rest;
}

/**
 * Commits one AI turn atomically: turn doc (with Edit-Last-Turn snapshot), character,
 * campaign state, codex upserts and telemetry. Idempotent per turn id.
 */
export async function commitTurn({ uid: userId, campaign, character, codex = [], turn, ai, engine = {}, usage = null, costUSD = 0, cacheRef, rng }) {
  const { writeBatch, increment, campaignRef, characterRef, turnRef, codexRef, clean } = await fs();
  const { db } = await import('../firebase/config.js');
  const result = computeTurnState({ campaign, character, ai, engine, roll: turn?.roll || null, knownCodexIds: codex.map((c) => c.id), rng });

  const priorCodex = {};
  for (const e of result.codexUpserts) {
    const prev = codex.find((c) => c.id === e.id);
    priorCodex[e.id] = prev ? stripId(prev) : null;
  }

  const turnDoc = {
    ...turn,
    ai,
    engineEvents: result.events,
    before: {
      character: stripId(character),
      campaign: pickMutable(campaign),
      codex: priorCodex,
    },
    usage,
    costUSD,
    createdAt: turn.createdAt || Date.now(),
  };

  const batch = writeBatch(db);
  batch.set(turnRef(userId, campaign.id, turn.id), clean(turnDoc));
  batch.set(characterRef(userId, character.id), clean(stripId(result.character)));
  const mutable = pickMutable(result.campaign);
  const update = {};
  for (const [k, v] of Object.entries(mutable)) update[k] = clean(v);
  update.turnCount = (campaign.turnCount || 0) + 1;
  update.lastTurnId = turn.id;
  update.lastTurnEditable = true;
  update['meta.lastPlayedAt'] = Date.now();
  if (cacheRef !== undefined) update.cacheRef = clean(cacheRef);
  if (usage) {
    update['telemetry.totalInputTokens'] = increment(usage.inputTokens || 0);
    update['telemetry.totalOutputTokens'] = increment((usage.outputTokens || 0) + (usage.thoughtTokens || 0));
    update['telemetry.cachedTokens'] = increment(usage.cachedTokens || 0);
    update['telemetry.totalCostUSD'] = increment(costUSD || 0);
  }
  batch.update(campaignRef(userId, campaign.id), update);
  for (const e of result.codexUpserts) {
    const prev = codex.find((c) => c.id === e.id);
    const merged = prev
      ? { ...stripId(prev), ...e, tags: Array.from(new Set([...(prev.tags || []), ...e.tags])).slice(0, 20), summary: e.summary || prev.summary }
      : e;
    batch.set(codexRef(userId, campaign.id, e.id), clean({ ...merged, updatedAt: Date.now() }));
  }
  await batch.commit();
  return result;
}

/**
 * Edit Last Turn: restores the pre-turn snapshot and deletes the turn.
 * Only valid for the most recent turn while lastTurnEditable is true (no rewinds beyond that).
 */
export async function revertLastTurn({ uid: userId, campaign, turn }) {
  if (!turn?.before) throw new Error('This turn cannot be edited.');
  if (campaign.lastTurnId !== turn.id || !campaign.lastTurnEditable) throw new Error('Only the most recent turn can be edited, and only before any other action.');
  if (campaign.meta?.status !== 'active') throw new Error('This campaign is locked.');
  const { writeBatch, campaignRef, characterRef, turnRef, codexRef, clean } = await fs();
  const { db } = await import('../firebase/config.js');
  const batch = writeBatch(db);
  batch.set(characterRef(userId, campaign.meta.activeCharId), clean(turn.before.character));
  const update = {};
  for (const k of MUTABLE_CAMPAIGN_FIELDS) {
    if (k in turn.before.campaign) update[k] = clean(turn.before.campaign[k]);
  }
  update.lastTurnEditable = false;
  update['meta.lastPlayedAt'] = Date.now();
  batch.update(campaignRef(userId, campaign.id), update);
  for (const [id, prev] of Object.entries(turn.before.codex || {})) {
    if (prev) batch.set(codexRef(userId, campaign.id, id), clean(prev));
    else batch.delete(codexRef(userId, campaign.id, id));
  }
  batch.delete(turnRef(userId, campaign.id, turn.id));
  await batch.commit();
}

/**
 * Engine-only actions (equip, buy/sell, craft, rest, minigames, perk unlocks, travel prep).
 * They disable Edit Last Turn, since the last turn is no longer the latest state change.
 */
export async function commitLocalAction({ uid: userId, campaign, character, campaignPatch = {}, characterNext = null }) {
  const { writeBatch, campaignRef, characterRef, clean } = await fs();
  const { db } = await import('../firebase/config.js');
  const batch = writeBatch(db);
  if (characterNext) batch.set(characterRef(userId, character.id), clean({ ...stripId(characterNext), updatedAt: Date.now() }));
  const update = { lastTurnEditable: false, 'meta.lastPlayedAt': Date.now() };
  for (const [k, v] of Object.entries(campaignPatch)) update[k] = clean(v);
  batch.update(campaignRef(userId, campaign.id), update);
  await batch.commit();
}

/** Simple campaign-only patch (settings such as model, theme, image mode, pinboard). */
export async function commitCampaignSettings({ uid: userId, campaign, patch }) {
  const { updateDoc, campaignRef, clean } = await fs();
  const update = {};
  for (const [k, v] of Object.entries(patch)) update[k] = clean(v);
  await updateDoc(campaignRef(userId, campaign.id), update);
}

/**
 * Permadeath: enshrines the character in the Graveyard and locks the campaign. Final.
 */
export async function commitDeath({ uid: userId, campaign, character, causeOfDeath, markdownChronicle, turnsSurvived }) {
  const { writeBatch, campaignRef, characterRef, memorialRef, clean } = await fs();
  const { db } = await import('../firebase/config.js');
  const batch = writeBatch(db);
  const memorialId = uid('grave');
  const snapshot = stripId(character);
  snapshot.status = 'fallen';
  batch.set(
    memorialRef(userId, memorialId),
    clean({
      charSnapshot: snapshot,
      campaignTitle: campaign.meta?.title || 'Untitled',
      campaignId: campaign.id,
      causeOfDeath: String(causeOfDeath || 'Unknown').slice(0, 300),
      finalLevel: character.level,
      turnsSurvived,
      diedAt: Date.now(),
      markdownChronicle,
    }),
  );
  batch.set(characterRef(userId, character.id), clean({ ...snapshot, activeCampaignId: null, updatedAt: Date.now() }));
  batch.update(campaignRef(userId, campaign.id), {
    'meta.status': 'fallen',
    'meta.lastPlayedAt': Date.now(),
    lastTurnEditable: false,
    pendingRoll: null,
    combat: clean(emptyCombat()),
  });
  await batch.commit();
  return memorialId;
}

/**
 * Archivist commit: writes the new diary chapter, codex upserts and recap, deletes the
 * condensed turns, and adds telemetry — atomically.
 */
export async function commitArchive({ uid: userId, campaign, chapter, condensedTurnIds, codexUpserts = [], codex = [], sessionRecap, usage, costUSD }) {
  const { writeBatch, increment, campaignRef, diaryRef, turnRef, codexRef, clean } = await fs();
  const { db } = await import('../firebase/config.js');
  const batch = writeBatch(db);
  const chapterId = uid('chapter');
  batch.set(diaryRef(userId, campaign.id, chapterId), clean({ ...chapter, id: chapterId, createdAt: Date.now() }));
  for (const tid of condensedTurnIds) batch.delete(turnRef(userId, campaign.id, tid));
  for (const raw of codexUpserts) {
    const e = normalizeCodexEntry(raw);
    const prev = codex.find((c) => c.id === e.id);
    const merged = prev ? { ...stripId(prev), ...e, tags: Array.from(new Set([...(prev.tags || []), ...e.tags])).slice(0, 20) } : e;
    batch.set(codexRef(userId, campaign.id, e.id), clean({ ...merged, updatedAt: Date.now() }));
  }
  const update = {
    sessionRecap: clean(sessionRecap),
    chapterCount: (campaign.chapterCount || 0) + 1,
    archivedTurnCount: (campaign.archivedTurnCount || 0) + condensedTurnIds.length,
  };
  if (usage) {
    update['telemetry.totalInputTokens'] = increment(usage.inputTokens || 0);
    update['telemetry.totalOutputTokens'] = increment((usage.outputTokens || 0) + (usage.thoughtTokens || 0));
    update['telemetry.cachedTokens'] = increment(usage.cachedTokens || 0);
    update['telemetry.totalCostUSD'] = increment(costUSD || 0);
  }
  batch.update(campaignRef(userId, campaign.id), update);
  await batch.commit();
  return chapterId;
}

/** Adds telemetry for out-of-turn calls (scene paintings) and sets a turn's image URL. */
export async function commitSceneImage({ uid: userId, campaign, turnId, imageUrl, usage, costUSD }) {
  const { writeBatch, increment, campaignRef, turnRef } = await fs();
  const { db } = await import('../firebase/config.js');
  const batch = writeBatch(db);
  batch.update(turnRef(userId, campaign.id, turnId), { imageUrl });
  batch.update(campaignRef(userId, campaign.id), {
    'telemetry.totalInputTokens': increment(usage?.inputTokens || 0),
    'telemetry.totalOutputTokens': increment(usage?.outputTokens || 0),
    'telemetry.totalCostUSD': increment(costUSD || 0),
  });
  await batch.commit();
}
