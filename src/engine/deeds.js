/**
 * Experience engine — the storyteller never decides how much XP the player gets.
 *
 * Two modes, chosen per campaign (campaign.meta.xpMode):
 *  - 'deeds'     (default): XP is computed here from what actually happened in the turn —
 *                 checks rolled, enemies overcome, places found, lore learned, allies made,
 *                 days survived and (when quests are on) quests completed.
 *  - 'milestone': no XP trickle. The storyteller may PROPOSE a milestone at a major story beat;
 *                 the engine grants exactly one level, at most once per cooldown window.
 *
 * Every function here is pure and deterministic.
 */
import { XP_THRESHOLDS, MAX_LEVEL } from './progression.js';

export const XP_MODES = ['deeds', 'milestone'];

export const XP_MODE_INFO = {
  deeds: {
    label: 'Deeds',
    blurb: 'Earn XP for what you do: passing checks, overcoming enemies, exploring, learning lore, making allies and surviving.',
  },
  milestone: {
    label: 'Milestone',
    blurb: 'No XP points. You level up when the story reaches a major turning point.',
  },
};

/** Base XP values at level 1. They scale with level so each level takes a similar amount of play. */
export const DEED_XP = {
  checkEasy: 10, // passed, DC ≤ 10
  checkMedium: 20, // passed, DC 11–14
  checkHard: 35, // passed, DC 15–19
  checkHeroic: 50, // passed, DC 20+
  naturalTwenty: 10, // bonus on top of a passed check
  checkFailed: 5, // lessons learned from a failed check that had a DC
  enemyOvercome: 40, // each enemy defeated or driven off
  locationDiscovered: 30,
  locationVisited: 15, // first time setting foot somewhere
  loreLearned: 10, // each new Codex entry
  factionStanding: 40, // a faction's standing improves by a tier
  allyRecruited: 60,
  daySurvived: 20,
  questMain: 200,
  questBounty: 100,
  questRumor: 60,
};

export const DEED_CAPS = { enemyOvercome: 6, locationDiscovered: 2, loreLearned: 3, daySurvived: 3 };

/** Turns that must pass between milestone level-ups. */
export function milestoneCooldown(level) {
  return level <= 2 ? 6 : 10;
}

export function xpMode(campaign) {
  return XP_MODES.includes(campaign?.meta?.xpMode) ? campaign.meta.xpMode : 'deeds';
}

export function questsEnabled(campaign) {
  return campaign?.meta?.questsEnabled !== false;
}

/** Multiplier that keeps the pace roughly constant: the XP gap to the next level ÷ the level-1 gap (300). */
export function levelScale(level) {
  const lv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level) || 1)));
  const idx = Math.min(lv, XP_THRESHOLDS.length - 1);
  const gap = XP_THRESHOLDS[idx] - XP_THRESHOLDS[idx - 1];
  return Math.max(1, gap / 300);
}

const FACTION_TIERS = ['Hostile', 'Wary', 'Neutral', 'Friendly', 'Allied'];
const CHECK_KINDS = new Set(['skill', 'ability', 'save']);

function checkDeed(roll) {
  if (!roll || !CHECK_KINDS.has(roll.kind) || roll.deathSave) return null;
  if (roll.dc === null || roll.dc === undefined) return null;
  if (roll.success) {
    const dc = Number(roll.dc) || 0;
    const base = dc >= 20 ? DEED_XP.checkHeroic : dc >= 15 ? DEED_XP.checkHard : dc >= 11 ? DEED_XP.checkMedium : DEED_XP.checkEasy;
    return { key: 'check', base: base + (roll.critical ? DEED_XP.naturalTwenty : 0), text: `passed ${roll.label} (DC ${roll.dc})${roll.critical ? ', natural 20' : ''}` };
  }
  return { key: 'check', base: DEED_XP.checkFailed, text: `learned from a failed ${roll.label}` };
}

function activeEnemies(combat) {
  return (combat?.enemies || []).filter((e) => e.health_tier !== 'Defeated');
}

/**
 * Lists the deeds a turn produced by diffing the state before and after it.
 * @param {object} p
 * @param {object} p.before      { campaign, character } before the turn
 * @param {object} p.after       { campaign, character } after every other turn effect was applied
 * @param {object|null} p.roll   the resolved roll record for this turn, if any
 * @param {Array} p.codexUpserts normalized codex entries proposed this turn
 * @param {Array<string>} p.knownCodexIds ids already in the Codex
 * @returns {Array<{key, base, text}>}
 */
export function listDeeds({ before, after, roll = null, codexUpserts = [], knownCodexIds = [] }) {
  const deeds = [];
  const bc = before.campaign;
  const ac = after.campaign;

  const check = checkDeed(roll);
  if (check) deeds.push(check);

  // Enemies overcome: active before, now Defeated — or gone because the fight ended in the player's favour.
  const prevActive = activeEnemies(bc.combat);
  if (prevActive.length) {
    const nowById = new Map((ac.combat?.enemies || []).map((e) => [e.id, e]));
    const playerStanding = (after.character?.vitals?.hp ?? 1) > 0;
    const overcome = prevActive.filter((e) => {
      const now = nowById.get(e.id);
      if (now) return now.health_tier === 'Defeated';
      return !ac.combat?.inCombat && playerStanding;
    });
    const n = Math.min(overcome.length, DEED_CAPS.enemyOvercome);
    if (n) deeds.push({ key: 'enemy', base: DEED_XP.enemyOvercome * n, text: n === 1 ? `overcame ${overcome[0].name}` : `overcame ${n} foes` });
  }

  // Exploration
  const prevNodes = new Map((bc.mapNodes || []).map((n) => [n.id, n]));
  const discovered = (ac.mapNodes || []).filter((n) => n.discovered && !prevNodes.get(n.id)?.discovered);
  const nd = Math.min(discovered.length, DEED_CAPS.locationDiscovered);
  if (nd) deeds.push({ key: 'discover', base: DEED_XP.locationDiscovered * nd, text: `discovered ${discovered.slice(0, nd).map((n) => n.label).join(', ')}` });
  const visited = (ac.mapNodes || []).filter((n) => n.visited && prevNodes.has(n.id) && !prevNodes.get(n.id).visited);
  if (visited.length) deeds.push({ key: 'visit', base: DEED_XP.locationVisited * visited.length, text: `first visit to ${visited.map((n) => n.label).join(', ')}` });

  // Lore
  const known = new Set(knownCodexIds);
  const fresh = [];
  for (const e of codexUpserts) {
    if (e?.id && !known.has(e.id)) {
      known.add(e.id);
      fresh.push(e);
    }
  }
  const nl = Math.min(fresh.length, DEED_CAPS.loreLearned);
  if (nl) deeds.push({ key: 'lore', base: DEED_XP.loreLearned * nl, text: nl === 1 ? `learned about ${fresh[0].name}` : `learned ${nl} new codex entries` });

  // Faction standing improved by a tier
  const prevFactions = new Map((bc.factions || []).map((f) => [f.id, f]));
  for (const f of ac.factions || []) {
    const p = prevFactions.get(f.id);
    if (!p) continue;
    if (FACTION_TIERS.indexOf(f.status) > FACTION_TIERS.indexOf(p.status) && FACTION_TIERS.indexOf(p.status) >= 0) {
      deeds.push({ key: 'faction', base: DEED_XP.factionStanding, text: `${f.name} now ${f.status}` });
    }
  }

  // Allies
  const prevRecruited = new Set((before.character?.companionRoster || []).filter((c) => c.isRecruited).map((c) => c.id));
  for (const c of after.character?.companionRoster || []) {
    if (c.isRecruited && !prevRecruited.has(c.id)) deeds.push({ key: 'ally', base: DEED_XP.allyRecruited, text: `${c.name} joined you` });
  }

  // Survival
  const days = Math.min(Math.max(0, (ac.worldState?.clock?.day || 0) - (bc.worldState?.clock?.day || 0)), DEED_CAPS.daySurvived);
  if (days && (after.character?.vitals?.hp ?? 0) > 0) deeds.push({ key: 'survive', base: DEED_XP.daySurvived * days, text: days === 1 ? 'survived another day' : `survived ${days} days` });

  // Quests (only when the campaign uses them)
  if (questsEnabled(ac)) {
    const prevQuests = new Map((bc.quests || []).map((q) => [q.id, q]));
    for (const q of ac.quests || []) {
      if (q.status === 'completed' && prevQuests.get(q.id)?.status !== 'completed') {
        const base = q.type === 'main' ? DEED_XP.questMain : q.type === 'bounty' ? DEED_XP.questBounty : DEED_XP.questRumor;
        deeds.push({ key: 'quest', base, text: `completed “${q.title}”` });
      }
    }
  }
  return deeds;
}

/** Total XP for a set of deeds at the character's current level. */
export function scoreDeeds(deeds, level) {
  const base = deeds.reduce((sum, d) => sum + d.base, 0);
  return Math.round(base * levelScale(level));
}

/**
 * Milestone check: grants XP that lands exactly on the next level threshold, if the
 * storyteller proposed a milestone and the cooldown has passed.
 * @returns {{ granted: boolean, xp: number, reason: string, turnsToWait: number }}
 */
export function resolveMilestone({ character, proposal, turnCount, lastMilestoneTurn }) {
  const none = { granted: false, xp: 0, reason: '', turnsToWait: 0 };
  if (!proposal || proposal.reached !== true) return none;
  const level = character.level || 1;
  if (level >= MAX_LEVEL) return none;
  const since = (turnCount || 0) - (lastMilestoneTurn || 0);
  const cooldown = milestoneCooldown(level);
  if (since < cooldown) return { ...none, turnsToWait: cooldown - since };
  const target = XP_THRESHOLDS[level];
  return { granted: true, xp: Math.max(0, target - (character.xp || 0)), reason: String(proposal.reason || 'A turning point in your story').slice(0, 160), turnsToWait: 0 };
}
