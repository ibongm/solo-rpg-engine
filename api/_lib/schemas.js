/**
 * Vertex AI structured-output contracts (generationConfig.responseSchema).
 *
 * DM_TURN_SCHEMA is the blueprint Section 6 contract, verbatim, with two kinds of change:
 *  1. Previously untyped OBJECT slots (loot_gained items, new_map_node, companion_updates items,
 *     codex_upserts items) now declare properties mirroring the Firestore shapes, because Vertex
 *     rejects OBJECT schemas with empty `properties`.
 *  2. Additive, optional state_updates fields the feature manifest requires but Section 6 lacks:
 *     quest_updates (timed quests/bounties), rumors_learned (Rumor Mill),
 *     conditions_added / conditions_removed (conditions in the Vitals HUD).
 *  3. roll_request keys are all required (still nullable) so the DC is never silently omitted, and
 *     roll_request.skill_or_stat and guided_choices[].default_skill are constrained to the
 *     ROLL_TARGETS enum (live testing showed free-form strings and runaway output otherwise).
 */
import { SKILL_KEYS, ABILITIES } from '../../src/config/genreSkins.js';
import { MEDIA_SPECIES_IDS, MEDIA_CLASS_IDS, MEDIA_BACKGROUND_IDS, MEDIA_TERM_KEYS } from '../../src/engine/mediaSkin.js';

/** Canonical roll targets the engine understands. Constraining decoding to this enum keeps the
 * storyteller from inventing free-form skill strings (observed live with gemini-3.8-flash). */
export const ROLL_TARGETS = [...SKILL_KEYS, ...ABILITIES, ...ABILITIES.map((a) => `${a}_save`), 'attack', 'initiative'];

const S = (description) => ({ type: 'STRING', ...(description ? { description } : {}) });
const I = (description) => ({ type: 'INTEGER', ...(description ? { description } : {}) });
const B = () => ({ type: 'BOOLEAN' });
const arr = (items, description) => ({ type: 'ARRAY', items, ...(description ? { description } : {}) });

const STAT_MODIFIER_PROPS = {
  str: I(), dex: I(), con: I(), int: I(), wis: I(), cha: I(),
  ac: I('Armor class bonus'),
  attack: I('Attack roll bonus'),
  damage: I('Flat damage bonus'),
  checks: I('Bonus to all ability checks'),
  initiative: I(),
  heal: { type: 'STRING', nullable: true, description: 'Healing dice for consumables, e.g. "2d4+2"' },
  ...Object.fromEntries(SKILL_KEYS.map((k) => [k, I()])),
};

export const LOOT_ITEM_SCHEMA = {
  type: 'OBJECT',
  required: ['name', 'type'],
  properties: {
    id: S('Optional stable id'),
    name: S(),
    type: { type: 'STRING', enum: ['weapon', 'armor', 'consumable', 'material', 'key'] },
    damageDice: { type: 'STRING', nullable: true, description: 'e.g. "1d8" for weapons, null otherwise' },
    statModifiers: { type: 'OBJECT', properties: STAT_MODIFIER_PROPS },
    craftingTags: arr(S(), 'Mechanical tags: melee|ranged|finesse|heavy|healing|ration|antidote|herb|metal|parts|cloth|upgrade'),
    description: S(),
    value: I('Base price in campaign currency'),
  },
};

const CODEX_ENTRY_SCHEMA = {
  type: 'OBJECT',
  required: ['id', 'type', 'name', 'summary'],
  properties: {
    id: S('Stable snake_case id, reuse to update an existing entry'),
    type: { type: 'STRING', enum: ['npc', 'companion', 'location', 'faction', 'item', 'lore'] },
    name: S(),
    summary: S('1–3 sentences of durable facts'),
    tags: arr(S(), 'Search tags: node ids, names, places, topics (lowercase)'),
    attitude: { type: 'STRING', nullable: true },
  },
};

const GUIDED_CHOICES_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    required: ['label', 'stance'],
    properties: {
      label: { type: 'STRING' },
      stance: { type: 'STRING', enum: ['Diplomatic', 'Aggressive', 'Deceptive', 'Investigative', 'Tactical'] },
      default_skill: { type: 'STRING', enum: ROLL_TARGETS, nullable: true },
      estimated_dc: { type: 'INTEGER', nullable: true },
    },
  },
};

export const DM_TURN_SCHEMA = {
  type: 'OBJECT',
  required: ['narrative_text', 'scene_visual_prompt', 'roll_request', 'combat_state', 'state_updates', 'guided_choices'],
  properties: {
    narrative_text: {
      type: 'STRING',
      description: 'Rich second-person RPG narrative response describing the outcome and current scene.',
    },
    scene_visual_prompt: {
      type: 'STRING',
      description: 'Detailed art prompt matching the campaign genre aesthetic in case the user triggers Imagen 3.',
    },
    dialogue_npc: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        id: { type: 'STRING' },
        name: { type: 'STRING' },
        attitude: { type: 'STRING' },
      },
    },
    roll_request: {
      type: 'OBJECT',
      required: ['required', 'skill_or_stat', 'dc', 'advantage_state', 'reason'],
      propertyOrdering: ['required', 'skill_or_stat', 'dc', 'advantage_state', 'reason'],
      properties: {
        required: { type: 'BOOLEAN' },
        skill_or_stat: { type: 'STRING', enum: ROLL_TARGETS, nullable: true, description: 'Canonical key: a 5e skill, an ability, <ability>_save, attack, or initiative.' },
        dc: { type: 'INTEGER', nullable: true, description: "REQUIRED whenever required=true. For attacks, the target's true AC." },
        advantage_state: { type: 'STRING', enum: ['normal', 'advantage', 'disadvantage'], nullable: true },
        reason: { type: 'STRING', nullable: true },
      },
    },
    combat_state: {
      type: 'OBJECT',
      required: ['in_combat', 'enemies'],
      properties: {
        in_combat: { type: 'BOOLEAN' },
        round: { type: 'INTEGER' },
        enemies: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            required: ['id', 'name', 'distance', 'health_tier', 'inspected'],
            properties: {
              id: { type: 'STRING' },
              name: { type: 'STRING' },
              distance: { type: 'STRING', enum: ['Melee', 'Near', 'Far'] },
              health_tier: { type: 'STRING', enum: ['Healthy', 'Injured', 'Bloodied', 'Critical', 'Defeated'] },
              inspected: { type: 'BOOLEAN' },
              revealed_ac: { type: 'INTEGER', nullable: true },
              revealed_traits: { type: 'ARRAY', items: { type: 'STRING' } },
            },
          },
        },
      },
    },
    state_updates: {
      type: 'OBJECT',
      properties: {
        hp_delta: { type: 'INTEGER' },
        currency_delta: { type: 'INTEGER' },
        xp_delta: { type: 'INTEGER' },
        time_advance_minutes: { type: 'INTEGER' },
        weather_change: {
          type: 'OBJECT',
          nullable: true,
          properties: {
            type: { type: 'STRING' },
            mechanicalEffect: { type: 'STRING' },
            modifierValue: { type: 'INTEGER' },
          },
        },
        faction_deltas: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              faction_id: { type: 'STRING' },
              rep_delta: { type: 'INTEGER' },
              heat_delta: { type: 'INTEGER' },
            },
          },
        },
        loot_gained: { type: 'ARRAY', items: LOOT_ITEM_SCHEMA },
        loot_removed_ids: { type: 'ARRAY', items: { type: 'STRING' } },
        new_map_node: {
          type: 'OBJECT',
          nullable: true,
          required: ['id', 'label', 'type'],
          properties: {
            id: S('Stable snake_case id'),
            label: S(),
            type: { type: 'STRING', enum: ['town', 'dungeon', 'camp', 'safehouse', 'landmark'] },
            description: S(),
            travelMinutes: I('Travel time from the current node'),
            rumors: arr(S()),
          },
        },
        companion_updates: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            required: ['id', 'name'],
            properties: {
              id: S(),
              name: S(),
              archetype: S(),
              loyalty_delta: I(),
              isRecruited: { type: 'BOOLEAN', nullable: true, description: 'Set true ONLY when the story organically recruits them' },
              hp_delta: I(),
              maxHp: I(),
              ac: I(),
              attackBonus: I(),
              damageDice: S(),
              personalityNotes: S(),
            },
          },
        },
        codex_upserts: { type: 'ARRAY', items: CODEX_ENTRY_SCHEMA },
        quest_updates: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            required: ['id', 'title', 'status'],
            properties: {
              id: S(),
              title: S(),
              description: S(),
              type: { type: 'STRING', enum: ['main', 'bounty', 'rumor'] },
              status: { type: 'STRING', enum: ['active', 'completed', 'failed'] },
              deadline_day: { type: 'INTEGER', nullable: true },
              deadline_hour: { type: 'INTEGER', nullable: true },
              rewards: arr(S()),
            },
          },
        },
        milestone: {
          type: 'OBJECT',
          nullable: true,
          description: 'MILESTONE mode only: propose a level-up at a major story turning point. The engine enforces a cooldown.',
          properties: {
            reached: { type: 'BOOLEAN' },
            reason: S('One short sentence naming the turning point'),
          },
        },
        rumors_learned: arr(S()),
        conditions_added: arr(S()),
        conditions_removed: arr(S()),
      },
    },
    guided_choices: GUIDED_CHOICES_SCHEMA,
  },
};

const PERK_MODIFIER_PROPS = {
  str: I(), dex: I(), con: I(), int: I(), wis: I(), cha: I(),
  ac: I(), attack: I(), damage: I(), checks: I(), initiative: I(), maxHp: I(), speed: I(),
  ...Object.fromEntries(SKILL_KEYS.map((k) => [k, I()])),
};

export const PERK_TREE_SCHEMA = {
  type: 'OBJECT',
  required: ['perks'],
  properties: {
    perks: {
      type: 'ARRAY',
      description: '10 perks: exactly 2 per tier, tiers 1–5.',
      items: {
        type: 'OBJECT',
        required: ['id', 'tier', 'name', 'description', 'modifiers'],
        properties: {
          id: S(),
          tier: I(),
          name: S(),
          description: S(),
          modifiers: { type: 'OBJECT', properties: PERK_MODIFIER_PROPS },
        },
      },
    },
  },
};

export const WORLD_SEED_SCHEMA = {
  type: 'OBJECT',
  required: ['campaign_title', 'region', 'factions', 'rumors', 'starting_node', 'nearby_nodes', 'main_quest', 'opening_narrative', 'scene_visual_prompt', 'guided_choices', 'start_season'],
  properties: {
    campaign_title: S(),
    region: {
      type: 'OBJECT',
      required: ['name', 'description'],
      properties: { name: S(), description: S() },
    },
    factions: {
      type: 'ARRAY',
      description: 'Exactly 3 rival factions.',
      items: {
        type: 'OBJECT',
        required: ['id', 'name', 'description'],
        properties: {
          id: S(),
          name: S(),
          description: S(),
          starting_reputation: I('-100..100'),
          starting_heat: I('0..100'),
          status: S('e.g. Neutral, Wary, Allied, Hostile'),
        },
      },
    },
    rumors: arr(S(), 'Exactly 5 local rumors.'),
    starting_node: {
      type: 'OBJECT',
      required: ['id', 'label', 'type', 'description'],
      properties: {
        id: S(),
        label: S(),
        type: { type: 'STRING', enum: ['town', 'dungeon', 'camp', 'safehouse', 'landmark'] },
        description: S(),
      },
    },
    nearby_nodes: {
      type: 'ARRAY',
      description: '2–3 known-but-undiscovered nodes connected to the start.',
      items: {
        type: 'OBJECT',
        required: ['id', 'label', 'type', 'travel_minutes'],
        properties: {
          id: S(),
          label: S(),
          type: { type: 'STRING', enum: ['town', 'dungeon', 'camp', 'safehouse', 'landmark'] },
          description: S(),
          travel_minutes: I(),
        },
      },
    },
    main_quest: {
      type: 'OBJECT',
      required: ['id', 'title', 'description'],
      properties: {
        id: S(),
        title: S(),
        description: S(),
        deadline_days: { type: 'INTEGER', nullable: true },
        rewards: arr(S()),
      },
    },
    opening_narrative: S('Second-person opening scene, 2–4 paragraphs.'),
    scene_visual_prompt: S(),
    guided_choices: GUIDED_CHOICES_SCHEMA,
    codex_entries: { type: 'ARRAY', items: CODEX_ENTRY_SCHEMA },
    lore_pins: arr(S(), 'Up to 5 world laws to pin to the Lore Pinboard.'),
    start_season: { type: 'STRING', enum: ['Spring', 'Summer', 'Autumn', 'Winter'] },
  },
};

export const ARCHIVIST_SCHEMA = {
  type: 'OBJECT',
  required: ['chapter_title', 'chapter_summary', 'key_events', 'codex_upserts', 'session_recap'],
  properties: {
    chapter_title: S(),
    chapter_summary: S('3–6 paragraph prose summary of the condensed turns.'),
    key_events: arr(S()),
    codex_upserts: { type: 'ARRAY', items: CODEX_ENTRY_SCHEMA },
    session_recap: {
      type: 'OBJECT',
      required: ['bullets', 'immediate_objective', 'present_npcs'],
      properties: {
        bullets: arr(S(), 'Exactly 3 TV-style "Previously On..." bullets.'),
        immediate_objective: S(),
        present_npcs: arr(S()),
      },
    },
  },
};

/** World seed schema for a campaign; main_quest is dropped entirely when quests are switched off. */
export function worldSeedSchema({ questsEnabled = true } = {}) {
  if (questsEnabled) return WORLD_SEED_SCHEMA;
  const properties = { ...WORLD_SEED_SCHEMA.properties };
  delete properties.main_quest;
  return { ...WORLD_SEED_SCHEMA, properties, required: WORLD_SEED_SCHEMA.required.filter((k) => k !== 'main_quest') };
}

/** TV series / movie skin: names and flavor only (sanitized again by src/engine/mediaSkin.js). */
const objOf = (keys, item) => ({ type: 'OBJECT', required: keys, properties: Object.fromEntries(keys.map((k) => [k, item])) });
export const MEDIA_SKIN_SCHEMA = {
  type: 'OBJECT',
  required: ['title', 'theme', 'currencyLabel', 'rationLabel', 'terms', 'skillLabels', 'species', 'classes', 'backgrounds', 'languages', 'worldPromptSuggestion'],
  properties: {
    title: S('Canonical title of the series, film or book.'),
    theme: { type: 'STRING', enum: ['fantasy', 'frontier_noir', 'scifi'], description: 'Closest visual theme.' },
    currencyLabel: S('What people trade with in this universe.'),
    rationLabel: S('What a day of food is called.'),
    terms: objOf(MEDIA_TERM_KEYS, S()),
    skillLabels: objOf(SKILL_KEYS, S()),
    species: objOf(MEDIA_SPECIES_IDS, { type: 'OBJECT', required: ['name', 'blurb'], properties: { name: S(), blurb: S('One sentence.') } }),
    classes: objOf(MEDIA_CLASS_IDS, S()),
    backgrounds: objOf(MEDIA_BACKGROUND_IDS, S()),
    languages: { type: 'ARRAY', items: S(), description: '10 languages, dialects or codes; the first is the common tongue.' },
    worldPromptSuggestion: S('Two paragraphs: a ready-to-use world prompt for a solo campaign in this universe.'),
  },
};
