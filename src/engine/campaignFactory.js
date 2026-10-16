/**
 * Builds the initial Firestore campaign document + opening turn from a World Forge seed.
 * Pure and deterministic given its inputs.
 */
import { DEFAULT_MODEL } from '../config/models.js';
import { rollWeather } from './clockWeatherEngine.js';
import { uid } from './rng.js';
import { XP_MODES, XP_PACES, XP_FINE_TUNE } from './deeds.js';

const NODE_TYPES = ['town', 'dungeon', 'camp', 'safehouse', 'landmark'];

export function safeId(raw, prefix = 'id') {
  const s = String(raw || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);
  return s || uid(prefix);
}

/** Deterministic radial placement for a new node around an anchor. */
export function placeNodeNear(anchor, existingCount, radius = 230) {
  const angle = (existingCount * 137.508 * Math.PI) / 180; // golden-angle spiral avoids overlap
  const r = radius + (existingCount % 3) * 40;
  return {
    x: Math.round((anchor?.x ?? 0) + Math.cos(angle) * r),
    y: Math.round((anchor?.y ?? 0) + Math.sin(angle) * r),
  };
}

export function connect(nodes, aId, bId, travelMinutes) {
  const minutes = Math.max(5, Math.min(60 * 24 * 7, Math.round(Number(travelMinutes) || 60)));
  return nodes.map((n) => {
    if (n.id === aId && !n.connectedTo.some((c) => c.targetNodeId === bId)) {
      return { ...n, connectedTo: [...n.connectedTo, { targetNodeId: bId, travelMinutes: minutes }] };
    }
    if (n.id === bId && !n.connectedTo.some((c) => c.targetNodeId === aId)) {
      return { ...n, connectedTo: [...n.connectedTo, { targetNodeId: aId, travelMinutes: minutes }] };
    }
    return n;
  });
}

export function normalizeCodexEntry(e) {
  const type = ['npc', 'companion', 'location', 'faction', 'item', 'lore'].includes(e?.type) ? e.type : 'lore';
  const name = String(e?.name || 'Unknown').slice(0, 80);
  return {
    id: safeId(e?.id || name, 'codex'),
    type,
    name,
    summary: String(e?.summary || '').slice(0, 1500),
    tags: Array.from(new Set([...(Array.isArray(e?.tags) ? e.tags : []), name.toLowerCase()].map((t) => String(t).toLowerCase().slice(0, 48)).filter(Boolean))).slice(0, 16),
    attitude: e?.attitude ?? null,
  };
}

/**
 * @returns {{ campaign, openingTurn, codexEntries }}
 */
export function createCampaignFromSeed({
  seed,
  character,
  characterId,
  genre,
  skin,
  tone = 5,
  rulesStrictness = 5,
  actionMode = 'hybrid',
  diceMode = 'digital',
  modelPref = DEFAULT_MODEL,
  imageMode = 'manual',
  importedLore = [],
  seedKey = uid('seed'),
  questsEnabled = true,
  xpMode = 'deeds',
  xpPace = 'standard',
  xpMultiplier = 1,
}) {
  const now = Date.now();
  const start = seed.starting_node || {};
  const startId = safeId(start.id || start.label, 'node');
  let mapNodes = [
    {
      id: startId,
      label: String(start.label || 'Starting Point').slice(0, 60),
      type: NODE_TYPES.includes(start.type) ? start.type : 'town',
      description: String(start.description || '').slice(0, 600),
      position: { x: 0, y: 0 },
      discovered: true,
      visited: true,
      connectedTo: [],
      shopStock: [],
      rumors: (seed.rumors || []).slice(0, 5).map((r) => String(r).slice(0, 300)),
    },
  ];
  (seed.nearby_nodes || []).slice(0, 4).forEach((n, i) => {
    const id = safeId(n.id || n.label, 'node');
    if (mapNodes.some((m) => m.id === id)) return;
    mapNodes.push({
      id,
      label: String(n.label || `Place ${i + 1}`).slice(0, 60),
      type: NODE_TYPES.includes(n.type) ? n.type : 'landmark',
      description: String(n.description || '').slice(0, 600),
      position: placeNodeNear({ x: 0, y: 0 }, i + 1),
      discovered: false,
      visited: false,
      connectedTo: [],
      shopStock: [],
      rumors: [],
    });
    mapNodes = connect(mapNodes, startId, id, n.travel_minutes);
  });

  const factions = (seed.factions || []).slice(0, 3).map((f) => ({
    id: safeId(f.id || f.name, 'faction'),
    name: String(f.name || 'Faction').slice(0, 60),
    description: String(f.description || '').slice(0, 600),
    reputation: Math.max(-100, Math.min(100, Math.round(Number(f.starting_reputation) || 0))),
    heat: Math.max(0, Math.min(100, Math.round(Number(f.starting_heat) || 0))),
    status: String(f.status || 'Neutral').slice(0, 30),
  }));

  const startSeason = ['Spring', 'Summer', 'Autumn', 'Winter'].includes(seed.start_season) ? seed.start_season : 'Spring';
  const clock = { day: 1, hour: 8, minute: 0, season: startSeason };

  const quests = [];
  if (questsEnabled && seed.main_quest) {
    const days = seed.main_quest.deadline_days;
    quests.push({
      id: safeId(seed.main_quest.id || seed.main_quest.title, 'quest'),
      title: String(seed.main_quest.title || 'Main Quest').slice(0, 100),
      description: String(seed.main_quest.description || '').slice(0, 800),
      type: 'main',
      status: 'active',
      deadline: Number.isInteger(days) && days > 0 ? { day: 1 + days, hour: 8 } : null,
      rewards: (seed.main_quest.rewards || []).map((r) => String(r).slice(0, 120)),
    });
  }

  const lorePinboard = [...importedLore, ...(seed.lore_pins || [])].map((l) => String(l).slice(0, 600)).slice(0, 50);

  const campaign = {
    meta: {
      title: String(seed.campaign_title || 'Untitled Campaign').slice(0, 100),
      genreTheme: genre,
      toneSlider: tone,
      rulesStrictness,
      activeCharId: characterId,
      modelPref,
      imageMode,
      actionMode,
      diceMode,
      status: 'active',
      lastPlayedAt: now,
      createdAt: now,
      themeOverride: null,
      questsEnabled: Boolean(questsEnabled),
      xpMode: XP_MODES.includes(xpMode) ? xpMode : 'deeds',
      xpPace: XP_PACES.includes(xpPace) ? xpPace : 'standard',
      xpMultiplier: XP_FINE_TUNE.includes(Number(xpMultiplier)) ? Number(xpMultiplier) : 1,
    },
    telemetry: { totalInputTokens: 0, totalOutputTokens: 0, cachedTokens: 0, totalCostUSD: 0 },
    worldState: {
      clock,
      startSeason,
      weather: rollWeather(seedKey, 1, startSeason),
      currentNodeId: startId,
      safehouse: { nodeId: null, name: '', upgrades: [] },
    },
    sessionRecap: {
      bullets: [],
      immediateObjective: quests[0]?.title || '',
      presentNPCs: [],
    },
    lorePinboard,
    factions,
    mapNodes,
    quests,
    // Engine-owned extensions (not AI-writable directly)
    seedKey,
    skin,
    region: { name: String(seed.region?.name || '').slice(0, 80), description: String(seed.region?.description || '').slice(0, 1200) },
    combat: { inCombat: false, round: 0, enemies: [], order: [], turnIndex: 0 },
    activeNpc: null,
    lastChoices: seed.guided_choices || [],
    lastScenePrompt: seed.scene_visual_prompt || '',
    pendingRoll: null,
    pendingEvents: [],
    merchantVisits: {},
    buffs: {},
    dying: false,
    turnCount: 1,
    archivedTurnCount: 0,
    chapterCount: 0,
    lastTurnId: null,
    lastTurnEditable: false,
    cacheRef: null,
    progress: { lastMilestoneTurn: 0, milestones: [] },
  };

  const openingTurn = {
    id: uid('turn'),
    index: 0,
    createdAt: now,
    player: null,
    roll: null,
    ai: {
      narrative_text: String(seed.opening_narrative || ''),
      scene_visual_prompt: String(seed.scene_visual_prompt || ''),
      guided_choices: seed.guided_choices || [],
    },
    imageUrl: null,
    model: modelPref,
    engineEvents: [],
    before: null,
  };

  const codexEntries = (seed.codex_entries || []).map(normalizeCodexEntry);
  for (const f of factions) {
    if (!codexEntries.some((c) => c.id === f.id)) {
      codexEntries.push(normalizeCodexEntry({ id: f.id, type: 'faction', name: f.name, summary: f.description, tags: [f.id] }));
    }
  }

  const characterPatch = {
    currency: { amount: character.currency?.amount ?? 0, label: skin.currencyLabel },
  };

  return { campaign, openingTurn, codexEntries, characterPatch };
}
