/**
 * Combat Engine — initiative, enemy tracking, Inspect/Scan, companion attacks, death saves.
 * All rolls are deterministic given the RNG and always visible to the player.
 */
import { buildCheck, rollCheck, rollDice } from './diceEngine.js';
import { rollDie, getDefaultRng } from './rng.js';
import { abilityMod } from './progression.js';

export const HEALTH_TIERS = ['Healthy', 'Injured', 'Bloodied', 'Critical', 'Defeated'];
export const SCAN_DC = 12;
/** AC assumed (and shown) for companion attacks against enemies whose AC is not yet revealed. */
export const ASSUMED_ENEMY_AC = 13;

export const emptyCombat = () => ({ inCombat: false, round: 0, enemies: [], order: [], turnIndex: 0 });

/**
 * Rolls visible initiative for everyone. Ties: player, then companions, then enemies.
 */
export function rollInitiative({ character, enemies = [], companions = [], initiativeBonus = 0, rng = getDefaultRng() }) {
  const order = [];
  const pc = buildCheck({ character, skillOrStat: 'initiative', extraModifiers: initiativeBonus ? [{ label: 'Lookout buff', value: initiativeBonus }] : [] });
  const pcRoll = rollCheck(pc, rng);
  order.push({ id: 'player', name: character.name, kind: 'player', initiative: pcRoll.total, natural: pcRoll.natural, mod: pc.totalModifier, tiebreak: 3 });
  for (const c of companions.filter((x) => x.isRecruited && (x.hp ?? 1) > 0)) {
    const nat = rollDie(20, rng);
    const mod = Math.max(0, Math.floor((c.attackBonus || 0) / 2) - 1);
    order.push({ id: c.id, name: c.name, kind: 'companion', initiative: nat + mod, natural: nat, mod, tiebreak: 2 });
  }
  for (const e of enemies.filter((x) => x.health_tier !== 'Defeated')) {
    const nat = rollDie(20, rng);
    order.push({ id: e.id, name: e.name, kind: 'enemy', initiative: nat, natural: nat, mod: 0, tiebreak: 1 });
  }
  order.sort((a, b) => b.initiative - a.initiative || b.tiebreak - a.tiebreak);
  return order;
}

/** Merges AI enemy state with prior state so revealed info is never lost if the model omits it. */
export function mergeEnemies(prev = [], next = []) {
  return next.map((e) => {
    const old = prev.find((p) => p.id === e.id);
    const inspected = Boolean(e.inspected || old?.inspected);
    return {
      id: String(e.id),
      name: String(e.name || old?.name || 'Enemy'),
      distance: ['Melee', 'Near', 'Far'].includes(e.distance) ? e.distance : old?.distance || 'Near',
      health_tier: HEALTH_TIERS.includes(e.health_tier) ? e.health_tier : old?.health_tier || 'Healthy',
      inspected,
      revealed_ac: inspected ? e.revealed_ac ?? old?.revealed_ac ?? null : null,
      revealed_traits: inspected ? (e.revealed_traits?.length ? e.revealed_traits : old?.revealed_traits || []) : [],
    };
  });
}

/**
 * Applies the AI's combat_state proposal to engine combat state.
 * Rolls initiative when combat begins or new combatants join.
 * @returns {{ combat, events, initiativeRolled }}
 */
export function syncCombat(prev, aiCombat, { character, companions = [], initiativeBonus = 0, rng = getDefaultRng() }) {
  const previous = prev || emptyCombat();
  const events = [];
  if (!aiCombat) return { combat: previous, events, initiativeRolled: false };
  const enemies = mergeEnemies(previous.enemies, aiCombat.enemies || []);
  const active = enemies.filter((e) => e.health_tier !== 'Defeated');
  if (!aiCombat.in_combat || active.length === 0) {
    if (previous.inCombat) events.push({ type: 'combat_end', text: 'Combat has ended.', tone: 'success' });
    return { combat: emptyCombat(), events, initiativeRolled: false };
  }
  let order = previous.order || [];
  let initiativeRolled = false;
  const known = new Set(order.map((o) => o.id));
  const newcomers = active.filter((e) => !known.has(e.id));
  if (!previous.inCombat || order.length === 0) {
    order = rollInitiative({ character, enemies: active, companions, initiativeBonus, rng });
    initiativeRolled = true;
    events.push({
      type: 'initiative',
      text: `Initiative: ${order.map((o) => `${o.name} ${o.initiative}`).join(' · ')}`,
      tone: 'warning',
    });
  } else if (newcomers.length) {
    const added = newcomers.map((e) => {
      const nat = rollDie(20, rng);
      return { id: e.id, name: e.name, kind: 'enemy', initiative: nat, natural: nat, mod: 0, tiebreak: 1 };
    });
    order = [...order, ...added].sort((a, b) => b.initiative - a.initiative || b.tiebreak - a.tiebreak);
    events.push({ type: 'initiative', text: `Joining the fight: ${added.map((a) => `${a.name} (${a.initiative})`).join(', ')}`, tone: 'warning' });
  }
  const activeIds = new Set(active.map((e) => e.id));
  order = order.filter((o) => o.kind !== 'enemy' || activeIds.has(o.id));
  return {
    combat: {
      inCombat: true,
      round: Math.max(1, Number(aiCombat.round) || previous.round || 1),
      enemies,
      order,
      turnIndex: 0,
    },
    events,
    initiativeRolled,
  };
}

/** Inspect/Scan check: the better of Insight or the genre's lore skill, against a visible DC. */
export function scanOptions(character, skin) {
  const lore = skin?.loreSkill || 'arcana';
  const a = buildCheck({ character, skillOrStat: 'insight', dc: SCAN_DC, skin, reason: 'Inspect / Scan' });
  const b = buildCheck({ character, skillOrStat: lore, dc: SCAN_DC, skin, reason: 'Inspect / Scan' });
  return a.totalModifier >= b.totalModifier ? [a, b] : [b, a];
}

/** Companion attack resolved fully by the engine. */
export function companionAttack({ companion, enemy, rng = getDefaultRng() }) {
  const targetAc = enemy?.inspected && Number.isInteger(enemy.revealed_ac) ? enemy.revealed_ac : ASSUMED_ENEMY_AC;
  const natural = rollDie(20, rng);
  const total = natural + (companion.attackBonus || 0);
  const critical = natural === 20;
  const hit = critical || (natural !== 1 && total >= targetAc);
  let damage = null;
  if (hit) {
    try {
      damage = rollDice(companion.damageDice || '1d6', { critical, rng });
    } catch {
      damage = rollDice('1d6', { critical, rng });
    }
  }
  return {
    companionId: companion.id,
    companionName: companion.name,
    targetId: enemy?.id,
    targetName: enemy?.name,
    natural,
    total,
    targetAc,
    acAssumed: !(enemy?.inspected && Number.isInteger(enemy.revealed_ac)),
    hit,
    critical,
    damage,
    summary: `${companion.name} attacks ${enemy?.name}: d20 ${natural} + ${companion.attackBonus || 0} = ${total} vs AC ${targetAc}${!(enemy?.inspected && Number.isInteger(enemy?.revealed_ac)) ? ' (assumed)' : ''} → ${hit ? `HIT for ${damage.total}${critical ? ' (critical)' : ''}` : 'miss'}.`,
  };
}

// ── HP, damage at 0 HP and death saves ───────────────────────────

/**
 * Applies an HP change with 5e rules: temp HP absorbs damage first; dropping to 0 knocks the
 * character unconscious; damage at 0 HP adds death-save failures; healing at 0 HP revives.
 * Hardcore RAW (strictness ≥ 8) also applies massive-damage instant death.
 * @returns {{ vitals, events, downed, died, revived }}
 */
export function applyHpChange(vitals, delta, { maxHp, strictness = 5, critical = false } = {}) {
  const v = { ...vitals, deathSaves: { ...(vitals.deathSaves || { successes: 0, failures: 0 }) }, conditions: [...(vitals.conditions || [])] };
  const max = maxHp ?? v.maxHp;
  const events = [];
  let downed = false;
  let died = false;
  let revived = false;
  const amount = Math.round(Number(delta) || 0);
  if (amount < 0) {
    let dmg = -amount;
    if (v.tempHp > 0) {
      const absorbed = Math.min(v.tempHp, dmg);
      v.tempHp -= absorbed;
      dmg -= absorbed;
      if (absorbed) events.push({ type: 'temp_hp', text: `Temporary HP absorbed ${absorbed} damage.`, tone: 'info' });
    }
    if (dmg > 0) {
      if (v.hp <= 0) {
        if (strictness >= 8 && dmg >= max) {
          died = true;
          v.deathSaves.failures = 3;
          events.push({ type: 'massive_damage', text: `Massive damage (${dmg} ≥ max HP ${max}) while down — instant death (Hardcore RAW).`, tone: 'danger' });
        } else {
          const add = critical ? 2 : 1;
          v.deathSaves.failures = Math.min(3, v.deathSaves.failures + add);
          events.push({ type: 'death_save_failure', text: `Took damage at 0 HP: +${add} death save failure${add > 1 ? 's' : ''} (${v.deathSaves.failures}/3).`, tone: 'danger' });
          if (v.deathSaves.failures >= 3) died = true;
        }
      } else {
        const overflow = dmg - v.hp;
        v.hp = Math.max(0, v.hp - dmg);
        if (v.hp === 0) {
          if (strictness >= 8 && overflow >= max) {
            died = true;
            v.deathSaves.failures = 3;
            events.push({ type: 'massive_damage', text: `Massive damage (${overflow} overflow ≥ max HP ${max}) — instant death (Hardcore RAW).`, tone: 'danger' });
          } else {
            downed = true;
            v.deathSaves = { successes: 0, failures: 0 };
            if (!v.conditions.includes('unconscious')) v.conditions.push('unconscious');
            v.conditions = v.conditions.filter((c) => c !== 'stable');
            events.push({ type: 'downed', text: 'You drop to 0 HP and fall unconscious. Death saving throws begin.', tone: 'danger' });
          }
        }
      }
    }
  } else if (amount > 0) {
    const wasDown = v.hp <= 0;
    v.hp = Math.min(max, v.hp + amount);
    if (wasDown && v.hp > 0) {
      revived = true;
      v.deathSaves = { successes: 0, failures: 0 };
      v.conditions = v.conditions.filter((c) => c !== 'unconscious' && c !== 'stable');
      events.push({ type: 'revived', text: `Healed for ${amount} — you are conscious again!`, tone: 'success' });
    }
  }
  return { vitals: v, events, downed, died, revived };
}

/**
 * Resolves one death saving throw from a d20 face (5e): 10+ success, <10 failure,
 * natural 1 = two failures, natural 20 = regain 1 HP. 3 successes = stable (regain 1 HP
 * after 1d4 hours, rolled visibly). 3 failures = death.
 * @returns {{ vitals, outcome: 'success'|'failure'|'revived'|'stable'|'dead', events, stableHours }}
 */
export function resolveDeathSave(vitals, natural, { rng = getDefaultRng() } = {}) {
  if (!Number.isInteger(natural) || natural < 1 || natural > 20) throw new Error('A death save needs a d20 result from 1 to 20.');
  const v = { ...vitals, deathSaves: { ...(vitals.deathSaves || { successes: 0, failures: 0 }) }, conditions: [...(vitals.conditions || [])] };
  const events = [];
  let outcome;
  let stableHours = 0;
  if (natural === 20) {
    v.hp = 1;
    v.deathSaves = { successes: 0, failures: 0 };
    v.conditions = v.conditions.filter((c) => c !== 'unconscious' && c !== 'stable');
    outcome = 'revived';
    events.push({ type: 'death_save', text: 'Natural 20 on a death save — you surge back to consciousness with 1 HP!', tone: 'success' });
  } else if (natural >= 10) {
    v.deathSaves.successes += 1;
    outcome = 'success';
    events.push({ type: 'death_save', text: `Death save success (${natural}) — ${v.deathSaves.successes}/3.`, tone: 'success' });
    if (v.deathSaves.successes >= 3) {
      stableHours = rollDie(4, rng);
      v.hp = 1;
      v.deathSaves = { successes: 0, failures: 0 };
      v.conditions = v.conditions.filter((c) => c !== 'unconscious');
      outcome = 'stable';
      events.push({ type: 'stable', text: `Three successes — you stabilize, and after ${stableHours} hour(s) (1d4) you regain 1 HP.`, tone: 'success' });
    }
  } else {
    const add = natural === 1 ? 2 : 1;
    v.deathSaves.failures = Math.min(3, v.deathSaves.failures + add);
    outcome = 'failure';
    events.push({ type: 'death_save', text: `Death save failure (${natural}${natural === 1 ? ', natural 1 counts twice' : ''}) — ${v.deathSaves.failures}/3.`, tone: 'danger' });
    if (v.deathSaves.failures >= 3) {
      outcome = 'dead';
      events.push({ type: 'death', text: 'Three failed death saves. Your story ends here.', tone: 'danger' });
    }
  }
  return { vitals: v, outcome, events, stableHours };
}

export function isDying(character) {
  return (character?.vitals?.hp ?? 1) <= 0 && (character?.vitals?.deathSaves?.failures ?? 0) < 3 && character?.status !== 'fallen';
}

export function isDead(character) {
  return character?.status === 'fallen' || (character?.vitals?.deathSaves?.failures ?? 0) >= 3;
}

export function healthTierTone(tier) {
  return { Healthy: 'text-success', Injured: 'text-info', Bloodied: 'text-warning', Critical: 'text-danger', Defeated: 'text-muted' }[tier] || 'text-muted';
}

export function healthTierPct(tier) {
  return { Healthy: 100, Injured: 70, Bloodied: 45, Critical: 18, Defeated: 0 }[tier] ?? 100;
}

/** Hit-die healing for a short rest (fixed average — no hidden rolls). */
export function shortRestHealing(character) {
  return Math.max(1, Math.floor((character.hitDie || 8) / 2) + 1 + abilityMod(character.stats?.con ?? 10));
}
