/**
 * VERTEX_MOCK=1 — deterministic, schema-valid canned responses so the entire game loop
 * (rolls, combat, loot, recruitment, quests, archivist, images) can be exercised locally
 * before Google Cloud credentials exist. Development only.
 */

import { SKILL_KEYS, skillLabel } from '../../src/config/genreSkins.js';

const MOCK_USAGE = { inputTokens: 1800, outputTokens: 420, cachedTokens: 900, thoughtTokens: 0 };

const lc = (s) => String(s || '').toLowerCase();
const has = (text, words) => words.some((w) => lc(text).includes(w));

function choices(inCombat) {
  if (inCombat) {
    return [
      { label: 'Strike the nearest foe', stance: 'Aggressive', default_skill: 'attack', estimated_dc: 13 },
      { label: 'Study the enemy for weaknesses', stance: 'Investigative', default_skill: 'insight', estimated_dc: 12 },
      { label: 'Fall back to better ground', stance: 'Tactical', default_skill: 'acrobatics', estimated_dc: 11 },
    ];
  }
  return [
    { label: 'Search the area carefully', stance: 'Investigative', default_skill: 'perception', estimated_dc: 12 },
    { label: 'Strike up a conversation with the stranger', stance: 'Diplomatic', default_skill: 'persuasion', estimated_dc: 12 },
    { label: 'Press onward down the road', stance: 'Tactical', default_skill: null, estimated_dc: null },
  ];
}

function emptyUpdates(overrides = {}) {
  return {
    hp_delta: 0,
    currency_delta: 0,
    xp_delta: 0,
    time_advance_minutes: 10,
    weather_change: null,
    faction_deltas: [],
    loot_gained: [],
    loot_removed_ids: [],
    new_map_node: null,
    companion_updates: [],
    codex_upserts: [],
    quest_updates: [],
    rumors_learned: [],
    conditions_added: [],
    conditions_removed: [],
    ...overrides,
  };
}

const ENEMIES = [
  { id: 'mock_brigand_1', name: 'Scarred Brigand', distance: 'Melee', health_tier: 'Healthy', inspected: false, revealed_ac: null, revealed_traits: [] },
  { id: 'mock_brigand_2', name: 'Brigand Archer', distance: 'Far', health_tier: 'Healthy', inspected: false, revealed_ac: null, revealed_traits: [] },
];

const TIERS = ['Healthy', 'Injured', 'Bloodied', 'Critical', 'Defeated'];

export function mockDmTurn(ctx, action) {
  const d = ctx?.dynamic || {};
  const combat = d.combat || {};
  const inCombat = Boolean(combat.inCombat);
  const enemies = (combat.enemies || []).map((e) => ({ ...e, revealed_traits: e.revealed_traits || [] }));
  const text = action?.text || '';
  const base = {
    scene_visual_prompt: 'A lantern-lit crossroads at dusk, wind-bent trees, a lone traveler with a weathered cloak, painterly, cinematic lighting',
    dialogue_npc: null,
    roll_request: { required: false, skill_or_stat: null, dc: null, advantage_state: null, reason: null },
    combat_state: { in_combat: inCombat, round: combat.round || 0, enemies },
    guided_choices: choices(inCombat),
  };

  if (action?.ooc) {
    return {
      ...base,
      narrative_text: `[DM] Noted — I'll adjust the pacing as you asked. (Mock mode: "${text.slice(0, 80)}")`,
      state_updates: emptyUpdates({ time_advance_minutes: 0 }),
    };
  }

  if (action?.kind === 'roll_result' && action.roll) {
    const r = action.roll;
    if (r.label?.startsWith('Attack') && inCombat) {
      const targetId = r.targetId || enemies.find((e) => e.health_tier !== 'Defeated')?.id;
      const next = enemies.map((e) => {
        if (e.id !== targetId || !r.success) return e;
        const steps = r.damage?.total >= 10 ? 2 : 1;
        const idx = Math.min(TIERS.length - 1, TIERS.indexOf(e.health_tier) + steps);
        return { ...e, health_tier: TIERS[idx] };
      });
      const alive = next.filter((e) => e.health_tier !== 'Defeated');
      if (!alive.length) {
        return {
          ...base,
          narrative_text: 'Your final blow lands true. The last brigand crumples, and the road falls silent but for the wind. Among their belongings you find a few coins and a battered blade.',
          combat_state: { in_combat: false, round: 0, enemies: [] },
          guided_choices: choices(false),
          state_updates: emptyUpdates({
            xp_delta: 0,
            milestone: { reached: true, reason: 'You cleared the brigands from the road.' },
            currency_delta: 12,
            time_advance_minutes: 5,
            loot_gained: [{ name: 'Brigand’s Notched Blade', type: 'weapon', damageDice: '1d6', statModifiers: { attack: 0 }, craftingTags: ['melee'], description: 'Crude but sharp.', value: 4 }],
            faction_deltas: [{ faction_id: 'mock_faction_road', rep_delta: 5, heat_delta: -5 }],
          }),
        };
      }
      return {
        ...base,
        narrative_text: r.success
          ? `Your strike connects${r.damage ? ` for ${r.damage.total} damage` : ''}! The brigand reels. The archer looses an arrow that grazes your shoulder.`
          : 'Your swing goes wide. The brigand grins and slashes back, catching you across the arm.',
        combat_state: { in_combat: true, round: (combat.round || 1) + 1, enemies: next },
        state_updates: emptyUpdates({ hp_delta: r.success ? -2 : -4, time_advance_minutes: 1 }),
      };
    }
    if (/insight|investigation|arcana|nature|history|lore|tech|detective|occult/i.test(r.label || '') && inCombat && r.success) {
      const target = enemies.find((e) => !e.inspected) || enemies[0];
      const next = enemies.map((e) => (e.id === target?.id ? { ...e, inspected: true, revealed_ac: e.id === 'mock_brigand_2' ? 12 : 14, revealed_traits: ['Fights dirty', 'Flees when Bloodied'] } : e));
      return {
        ...base,
        narrative_text: `You read ${target?.name}'s stance like an open book — the weak guard on the left side, the nervous footwork.`,
        combat_state: { in_combat: true, round: combat.round || 1, enemies: next },
        state_updates: emptyUpdates({ time_advance_minutes: 1 }),
      };
    }
    return {
      ...base,
      narrative_text: r.success
        ? 'Success! Beneath a loose flagstone you discover a cracked leather pouch and a scrap of map marking an old watchtower to the east.'
        : 'You find nothing of note, though you cannot shake the feeling you are being watched.',
      state_updates: r.success
        ? emptyUpdates({
            currency_delta: 8,
            xp_delta: 0,
            time_advance_minutes: 20,
            new_map_node: { id: 'mock_watchtower', label: 'Ruined Watchtower', type: 'landmark', description: 'A crumbling tower on a windswept hill.', travelMinutes: 90, rumors: ['They say a signal fire was lit there last week.'] },
            codex_upserts: [{ id: 'mock_watchtower', type: 'location', name: 'Ruined Watchtower', summary: 'An old watchtower east of the crossroads, marked on a scrap of map.', tags: ['mock_watchtower', 'watchtower', 'map'], attitude: null }],
          })
        : emptyUpdates({ time_advance_minutes: 20 }),
    };
  }

  if (has(text, ['attack', 'fight', 'strike', 'shoot', 'ambush']) || (inCombat && has(text, ['hit', 'slash', 'stab']))) {
    const startEnemies = inCombat ? enemies : ENEMIES.map((e) => ({ ...e }));
    const target = startEnemies.find((e) => e.health_tier !== 'Defeated');
    return {
      ...base,
      narrative_text: inCombat
        ? `You ready yourself to strike at ${target?.name}.`
        : 'Two brigands burst from the treeline — one charging with a notched blade, the other nocking an arrow from the ridge. Steel rings as you draw.',
      combat_state: { in_combat: true, round: combat.round || 1, enemies: startEnemies },
      roll_request: { required: true, skill_or_stat: 'attack', dc: target?.id === 'mock_brigand_2' ? 12 : 14, advantage_state: 'normal', reason: `Attack ${target?.name}` },
      guided_choices: choices(true),
      state_updates: emptyUpdates({ time_advance_minutes: 1 }),
    };
  }

  if (has(text, ['search', 'look', 'investigate', 'examine', 'perception'])) {
    return {
      ...base,
      narrative_text: 'You crouch and study the ground, the walls, the shadows between things. Something here does not sit right…',
      roll_request: { required: true, skill_or_stat: 'perception', dc: 12, advantage_state: 'normal', reason: 'Spot what is hidden' },
      state_updates: emptyUpdates({ time_advance_minutes: 0 }),
    };
  }

  if (has(text, ['join', 'recruit', 'come with'])) {
    return {
      ...base,
      narrative_text: 'Bryn studies you for a long moment, then shoulders her pack. "Fine. Someone has to keep you alive." She falls in beside you.',
      dialogue_npc: { id: 'mock_bryn', name: 'Bryn Ashvale', attitude: 'Friendly' },
      state_updates: emptyUpdates({
        companion_updates: [{ id: 'mock_bryn', name: 'Bryn Ashvale', archetype: 'Ranger', loyalty_delta: 10, isRecruited: true, hp_delta: 0, maxHp: 18, ac: 14, attackBonus: 5, damageDice: '1d8+3', personalityNotes: 'Dry humor, fiercely loyal once trust is earned.' }],
        codex_upserts: [{ id: 'mock_bryn', type: 'companion', name: 'Bryn Ashvale', summary: 'A sharp-eyed ranger who joined you at the crossroads.', tags: ['mock_bryn', 'bryn', 'ranger'], attitude: 'Friendly' }],
      }),
    };
  }

  if (has(text, ['talk', 'greet', 'ask', 'hello', 'persuade', 'convince'])) {
    return {
      ...base,
      narrative_text: 'The stranger lowers her hood — a ranger, weathered and wary. "Name\'s Bryn. Bandits have been hitting travelers on this road. If you\'re heading east, you\'ll want company." She posts a bounty notice on the waystone.',
      dialogue_npc: { id: 'mock_bryn', name: 'Bryn Ashvale', attitude: 'Cautious' },
      state_updates: emptyUpdates({
        time_advance_minutes: 10,
        companion_updates: [{ id: 'mock_bryn', name: 'Bryn Ashvale', archetype: 'Ranger', loyalty_delta: 5, isRecruited: false, hp_delta: 0, maxHp: 18, ac: 14, attackBonus: 5, damageDice: '1d8+3', personalityNotes: 'Wary of strangers; respects honesty.' }],
        codex_upserts: [{ id: 'mock_bryn', type: 'npc', name: 'Bryn Ashvale', summary: 'A wary ranger hunting the road bandits.', tags: ['mock_bryn', 'bryn', 'ranger'], attitude: 'Cautious' }],
        quest_updates: [{ id: 'mock_bounty_brigands', title: 'Bounty: Road Brigands', description: 'Clear out the brigands preying on the east road.', type: 'bounty', status: 'active', deadline_day: (d.clock?.day || 1) + 2, deadline_hour: 18, rewards: ['40 coin'] }],
        rumors_learned: ['Bryn claims the brigands answer to someone in town.'],
      }),
      guided_choices: [
        { label: 'Ask Bryn to join you', stance: 'Diplomatic', default_skill: 'persuasion', estimated_dc: 12 },
        { label: 'Question her about the bandits', stance: 'Investigative', default_skill: 'insight', estimated_dc: 11 },
        { label: 'Bluff that you are a bounty hunter', stance: 'Deceptive', default_skill: 'deception', estimated_dc: 14 },
      ],
    };
  }

  return {
    ...base,
    narrative_text: `You ${text ? `decide to ${text.replace(/^i\s+/i, '').slice(0, 120)}` : 'take in your surroundings'}. The road stretches on beneath a bruised sky; somewhere ahead a crow calls twice and falls silent. (Mock DM — set GCP credentials for real storytelling.)`,
    state_updates: emptyUpdates({ time_advance_minutes: 30 }),
  };
}

export function mockWorldSeed(body) {
  const genre = body.genre || 'fantasy';
  return {
    campaign_title: 'The Ashen Crossroads',
    region: { name: 'The Greywater Marches', description: 'A rain-soaked borderland of crumbling waystones, drowned villages and roads nobody patrols anymore.' },
    factions: [
      { id: 'mock_faction_road', name: 'The Waystone Wardens', description: 'Underfunded road guards trying to keep the trade routes open.', starting_reputation: 10, starting_heat: 0, status: 'Neutral' },
      { id: 'mock_faction_ash', name: 'The Ash Ledger', description: 'A smuggling syndicate that owns half the town’s debts.', starting_reputation: -10, starting_heat: 10, status: 'Wary' },
      { id: 'mock_faction_choir', name: 'The Drowned Choir', description: 'A cult that sings to the flooded valley at night.', starting_reputation: 0, starting_heat: 0, status: 'Unknown' },
    ],
    rumors: [
      'The ferryman has not been seen in three days.',
      'The Ash Ledger is paying double for anyone who can read old maps.',
      'Bells ring under the floodwater at midnight.',
      'A ranger has been hunting the road brigands alone.',
      'The watchtower to the east was lit last week — by whom, nobody knows.',
    ],
    starting_node: { id: 'mock_crossroads', label: 'Ashen Crossroads', type: 'town', description: 'A muddy waystation town where four roads meet beneath a lightning-split oak.' },
    nearby_nodes: [
      { id: 'mock_ferry', label: 'Greywater Ferry', type: 'landmark', description: 'An abandoned river crossing.', travel_minutes: 120 },
      { id: 'mock_caves', label: 'Weeping Caves', type: 'dungeon', description: 'Limestone caves that drip constantly.', travel_minutes: 240 },
    ],
    main_quest: body.questsEnabled === false ? undefined : { id: 'mock_main', title: 'The Missing Ferryman', description: 'Find out what happened to the Greywater ferryman before the trade caravan arrives.', deadline_days: 5, rewards: ['Waystone Warden favor'] },
    opening_narrative: `Rain hammers the shingles of the Lightning Oak inn as you shake the road from your ${genre === 'scifi' ? 'environment suit' : 'cloak'}. The common room falls quiet when you enter — a hooded stranger watches from the corner, and a notice nailed to the bar offers a reward for news of the missing ferryman.\n\nThe innkeeper slides a mug toward you. "Caravan arrives in five days," he mutters. "Without the ferry, it's ruin for all of us."`,
    scene_visual_prompt: 'A rain-lashed frontier inn interior lit by a roaring hearth, a hooded stranger in the corner, a wanted notice on the bar, moody painterly lighting',
    guided_choices: choices(false),
    codex_entries: [
      { id: 'mock_crossroads', type: 'location', name: 'Ashen Crossroads', summary: 'Muddy waystation town under a lightning-split oak; home of the Lightning Oak inn.', tags: ['mock_crossroads', 'crossroads', 'inn'], attitude: null },
      { id: 'mock_innkeeper', type: 'npc', name: 'Oswin the Innkeeper', summary: 'Gruff keeper of the Lightning Oak; worried about the caravan.', tags: ['mock_crossroads', 'oswin', 'innkeeper'], attitude: 'Friendly' },
    ],
    lore_pins: ['The floodwaters never recede on nights of the new moon.', 'The Waystone Wardens may not enter the Ash Ledger’s warehouses without a writ.'],
    start_season: 'Autumn',
  };
}

export function mockPerkTree(body) {
  const concept = String(body.classOrArchetype || 'Adventurer');
  const perks = [];
  const plan = [
    [1, 'keen_eye', 'Keen Eye', '+1 Perception.', { perception: 1 }],
    [1, 'quick_hands', 'Quick Hands', '+1 Sleight of Hand.', { sleight_of_hand: 1 }],
    [2, 'iron_hide', 'Iron Hide', '+1 AC.', { ac: 1 }],
    [2, 'silver_tongue', 'Silver Tongue', '+1 Persuasion.', { persuasion: 1 }],
    [3, 'battle_focus', 'Battle Focus', '+1 attack and +1 initiative.', { attack: 1, initiative: 1 }],
    [3, 'tough_as_nails', 'Tough as Nails', '+6 max HP.', { maxHp: 6 }],
    [4, 'deadly_precision', 'Deadly Precision', '+2 damage.', { damage: 2 }],
    [4, 'veteran_instincts', 'Veteran Instincts', '+1 to all checks, +1 Insight.', { checks: 1, insight: 1 }],
    [5, 'legend', `Legend of the ${concept}`, '+1 attack, +1 AC, +1 damage.', { attack: 1, ac: 1, damage: 1 }],
    [5, 'unbreakable', 'Unbreakable', '+10 max HP.', { maxHp: 10 }],
  ];
  for (const [tier, id, name, description, modifiers] of plan) perks.push({ id, tier, name, description, modifiers });
  return { perks };
}

export function mockArchivist(body) {
  const turns = body.turnsToCondense || [];
  const first = turns[0]?.narrative || '';
  return {
    chapter_title: `Chapter of ${turns.length} Turns`,
    chapter_summary: `Across these ${turns.length} turns you pressed deeper into the story. ${first.slice(0, 300)}\n\n(Mock Archivist — set GCP credentials for real summaries.)`,
    key_events: turns.slice(0, 5).map((t, i) => `Turn ${i + 1}: ${(t.player?.text || 'The story moved on').slice(0, 80)}`),
    codex_upserts: [],
    session_recap: {
      bullets: ['You arrived at the crossroads in a storm.', 'A wary ranger warned you of brigands.', 'The missing ferryman remains unfound.'],
      immediate_objective: 'Find out what happened to the ferryman.',
      present_npcs: [],
    },
  };
}

export function mockImage(prompt) {
  const safe = String(prompt || '').replace(/[<>&"]/g, '').slice(0, 90);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="576" viewBox="0 0 1024 576"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b1d14"/><stop offset="1" stop-color="#961c24"/></linearGradient></defs><rect width="1024" height="576" fill="url(#g)"/><circle cx="780" cy="140" r="70" fill="#f1e6cf" opacity="0.8"/><path d="M0 460 L220 330 L400 430 L620 280 L1024 470 L1024 576 L0 576Z" fill="#1a120c" opacity="0.85"/><text x="40" y="540" font-family="Georgia" font-size="22" fill="#f1e6cf">${safe}</text><text x="40" y="60" font-family="Georgia" font-size="18" fill="#f1e6cf" opacity="0.7">Mock scene (VERTEX_MOCK)</text></svg>`;
  return { base64: Buffer.from(svg).toString('base64'), mimeType: 'image/svg+xml', usage: { inputTokens: 60, outputTokens: 0, images: 1 } };
}

/** Deterministic TV/movie skin for VERTEX_MOCK runs. */
export function mockMediaSkin(body) {
  const title = String(body.mediaTitle || 'Unknown Series').slice(0, 120);
  return {
    title,
    theme: 'frontier_noir',
    currencyLabel: 'Fuel & Salt',
    rationLabel: 'Canned Goods',
    terms: { species: 'Hometown', class: 'Role', background: 'Before', spells: 'Know-How', cantrips: 'Tricks', spell: 'technique' },
    skillLabels: { ...Object.fromEntries(SKILL_KEYS.map((k) => [k, skillLabel(k)])), arcana: 'Engineering', religion: 'Town Lore', survival: 'Scavenging' },
    species: {
      human: { name: 'Townsfolk', blurb: `Ordinary people of ${title}.` },
      dwarf: { name: 'Farmer', blurb: 'Tough, practical and stubborn.' },
      elf: { name: 'Outsider', blurb: 'Watchful newcomers with sharp senses.' },
      halfling: { name: 'Kid', blurb: 'Small, quick and overlooked.' },
      dragonborn: { name: 'Soldier', blurb: 'Trained, armed and imposing.' },
      gnome: { name: 'Tinkerer', blurb: 'Keeps the machines running.' },
      half_elf: { name: 'Drifter', blurb: 'Belongs everywhere and nowhere.' },
      half_orc: { name: 'Bruiser', blurb: 'Hard to put down.' },
      tiefling: { name: 'Exile', blurb: 'Distrusted, but useful.' },
    },
    classes: {
      barbarian: 'Bruiser', bard: 'Mayor', cleric: 'Doctor', druid: 'Rancher', fighter: 'Deputy', monk: 'Brawler',
      paladin: 'Sheriff', ranger: 'Hunter', rogue: 'Smuggler', sorcerer: 'Natural', warlock: 'Agent', wizard: 'Engineer',
    },
    backgrounds: {
      acolyte: 'Pastor', veteran: 'Veteran', urchin: 'Runaway', scholar: 'Teacher', wanderer: 'Trucker',
      swindler: 'Con Artist', folk_hero: 'Local Hero', noble: 'Old Money', performer: 'Radio Host', healer: 'Nurse',
    },
    languages: ['English', 'Spanish', 'Morse Code', 'Sign Language', 'Military Radio', 'German', 'French', 'Mandarin', 'Hobo Signs', 'Legal Jargon'],
    worldPromptSuggestion: `A small town in the world of ${title}, cut off after a disaster. Supplies are short and trust is shorter.

You arrive as strangers start showing up at the edge of town.`,
  };
}

export { MOCK_USAGE };
