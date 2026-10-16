/**
 * 3-Tier Memory assembly for /api/dm-turn and /api/archivist.
 *  Tier 1 — Active Context: the most recent raw turns + deterministic roll outcomes.
 *  Tier 2 — Campaign Diary: chapter summaries written by the Archivist.
 *  Tier 3 — World Codex: structured cards injected by tag relevance (location, NPC, recent text).
 * The STATIC block (rules-adjacent, rarely changing) is separated so the server can cache it.
 */
import { effectiveAc, effectiveMaxHp } from './diceEngine.js';

export const ACTIVE_TURNS_IN_CONTEXT = 14;
export const MAX_CODEX_CARDS = 8;
export const MAX_DIARY_CHAPTERS = 6;
export const ARCHIVE_TRIGGER = 20;
export const ARCHIVE_BATCH = 10;

const STOPWORDS = new Set(['the', 'and', 'with', 'that', 'this', 'from', 'your', 'you', 'into', 'have', 'they', 'them', 'their', 'there', 'what', 'when', 'where', 'which', 'while', 'will', 'would', 'about', 'some', 'then', 'than', 'just', 'over', 'under', 'like']);

export function tokenize(text) {
  return Array.from(
    new Set(
      String(text || '')
        .toLowerCase()
        .split(/[^a-z0-9_]+/)
        .filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
    ),
  );
}

/** Compact turn representation for prompts. */
export function compactTurn(t) {
  return {
    player: t.player ? { text: t.player.text, stance: t.player.stance || null, ooc: Boolean(t.player.ooc) } : null,
    roll: t.roll
      ? {
          label: t.roll.label,
          total: t.roll.total,
          natural: t.roll.natural,
          dc: t.roll.dc ?? null,
          success: t.roll.success ?? null,
          damage: t.roll.damage ? { total: t.roll.damage.total } : null,
        }
      : null,
    narrative: t.ai?.narrative_text || '',
  };
}

/** Scores codex entries by tag/name overlap with the current situation. */
export function selectRelevantCodex({ codex = [], campaign, character, turns = [], limit = MAX_CODEX_CARDS }) {
  const currentNode = campaign.mapNodes?.find((n) => n.id === campaign.worldState?.currentNodeId);
  const needles = new Set([
    campaign.worldState?.currentNodeId,
    ...(currentNode ? tokenize(currentNode.label) : []),
    campaign.activeNpc?.id,
    ...(campaign.activeNpc ? tokenize(campaign.activeNpc.name) : []),
    ...turns.slice(-3).flatMap((t) => tokenize(`${t.player?.text || ''} ${t.ai?.narrative_text || ''}`)),
  ].filter(Boolean).map((s) => String(s).toLowerCase()));
  const recruitedNames = new Set((character.companionRoster || []).filter((c) => c.isRecruited).map((c) => c.name.toLowerCase()));

  const scored = codex.map((entry) => {
    let score = 0;
    const tags = (entry.tags || []).map((t) => String(t).toLowerCase());
    for (const tag of tags) {
      if (needles.has(tag)) score += 3;
      else if (tokenize(tag).some((w) => needles.has(w))) score += 1;
    }
    for (const w of tokenize(entry.name)) if (needles.has(w)) score += 2;
    if (entry.id === campaign.worldState?.currentNodeId) score += 5;
    if (entry.id === campaign.activeNpc?.id) score += 5;
    if (recruitedNames.has(String(entry.name).toLowerCase())) score += 4;
    return { entry, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || (b.entry.updatedAt || 0) - (a.entry.updatedAt || 0))
    .slice(0, limit)
    .map(({ entry }) => ({ id: entry.id, name: entry.name, type: entry.type, summary: entry.summary, attitude: entry.attitude ?? null }));
}

/**
 * Builds the structured context bundle sent to /api/dm-turn.
 * @param {object} p
 * @param {string[]} [p.events]  pending world events to narrate
 */
export function buildDmContext({ campaign, character, turns = [], diary = [], codex = [] }) {
  const currentNode = campaign.mapNodes?.find((n) => n.id === campaign.worldState?.currentNodeId) || null;
  const connections = (currentNode?.connectedTo || []).map((c) => {
    const target = campaign.mapNodes.find((n) => n.id === c.targetNodeId);
    return { id: c.targetNodeId, label: target?.label || c.targetNodeId, travelMinutes: c.travelMinutes, discovered: Boolean(target?.discovered) };
  });
  const orderedTurns = turns.slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return {
    static: {
      title: campaign.meta?.title,
      genre: campaign.meta?.genreTheme,
      tone: campaign.meta?.toneSlider,
      strictness: campaign.meta?.rulesStrictness,
      skin: campaign.skin,
      region: campaign.region,
      factions: (campaign.factions || []).map((f) => ({ id: f.id, name: f.name, description: f.description })),
      lorePinboard: campaign.lorePinboard || [],
      character: {
        name: character.name,
        level: character.level,
        classOrArchetype: character.classOrArchetype,
        stats: character.stats,
        skillProficiencies: character.skillProficiencies,
        perks: (character.customPerkTree || []).filter((p) => p.unlocked).map((p) => ({ name: p.name, description: p.description })),
        backstory: character.backstory || '',
      },
    },
    dynamic: {
      clock: campaign.worldState?.clock,
      weather: campaign.worldState?.weather,
      location: currentNode ? { id: currentNode.id, label: currentNode.label, type: currentNode.type, description: currentNode.description || '', connections } : null,
      vitals: {
        hp: character.vitals.hp,
        maxHp: effectiveMaxHp(character),
        tempHp: character.vitals.tempHp || 0,
        ac: effectiveAc(character),
        conditions: character.vitals.conditions || [],
      },
      currency: character.currency,
      equipment: (character.inventory || []).filter((i) => i.equipped).map((i) => i.name),
      inventory: (character.inventory || []).slice(0, 40).map((i) => ({ id: i.id, name: i.name })),
      factions: (campaign.factions || []).map((f) => ({ id: f.id, name: f.name, reputation: f.reputation, heat: f.heat })),
      quests: (campaign.quests || []).filter((q) => q.status === 'active').map((q) => ({ id: q.id, title: q.title, type: q.type, description: q.description, deadline: q.deadline })),
      companions: (character.companionRoster || []).map((c) => ({ id: c.id, name: c.name, archetype: c.archetype, isRecruited: c.isRecruited, loyalty: c.loyalty, hp: c.hp, maxHp: c.maxHp, personalityNotes: c.personalityNotes })),
      combat: campaign.combat?.inCombat ? campaign.combat : null,
      activeNpc: campaign.activeNpc || null,
      recap: campaign.sessionRecap ? { immediateObjective: campaign.sessionRecap.immediateObjective } : null,
      diary: diary
        .slice()
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .slice(-MAX_DIARY_CHAPTERS)
        .map((d) => ({ title: d.title, summary: d.summary })),
      codex: selectRelevantCodex({ codex, campaign, character, turns: orderedTurns }),
      recentTurns: orderedTurns.slice(-ACTIVE_TURNS_IN_CONTEXT).map(compactTurn),
      events: campaign.pendingEvents || [],
    },
  };
}

/** True when the Auto-Archivist should run (active buffer reached the trigger size). */
export function shouldArchive(turns) {
  return turns.length >= ARCHIVE_TRIGGER;
}

/** Splits the buffer into the oldest batch to condense and the rest. */
export function archiveSplit(turns) {
  const ordered = turns.slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return { toCondense: ordered.slice(0, ARCHIVE_BATCH), remaining: ordered.slice(ARCHIVE_BATCH) };
}

export function buildArchivistPayload({ campaign, character, turns, diary, codex }) {
  const { toCondense, remaining } = archiveSplit(turns);
  const node = campaign.mapNodes?.find((n) => n.id === campaign.worldState?.currentNodeId);
  return {
    toCondense,
    payload: {
      title: campaign.meta?.title,
      genre: campaign.meta?.genreTheme,
      chapterIndex: (campaign.chapterCount || 0) + 1,
      previousChapters: diary.map((d) => d.title),
      existingCodex: codex.slice(0, 60).map((c) => ({ id: c.id, name: c.name, summary: c.summary })),
      turnsToCondense: toCondense.map(compactTurn),
      recentTurns: remaining.slice(-6).map(compactTurn),
      currentState: `${character.name} is at ${node?.label || 'an unknown place'} with ${character.vitals.hp}/${character.vitals.maxHp} HP. Active quests: ${(campaign.quests || [])
        .filter((q) => q.status === 'active')
        .map((q) => q.title)
        .join('; ') || 'none'}. Companions: ${(character.companionRoster || [])
        .filter((c) => c.isRecruited)
        .map((c) => c.name)
        .join(', ') || 'none'}.`,
    },
  };
}
