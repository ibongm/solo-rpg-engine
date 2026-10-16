import { describe, it, expect } from 'vitest';
import { buildDmContext, selectRelevantCodex, shouldArchive, archiveSplit, buildArchivistPayload } from './contextBuilder.js';
import { createCampaignFromSeed } from './campaignFactory.js';
import { createCharacter } from './progression.js';
import { buildSkin } from '../config/genreSkins.js';
import { mockWorldSeed, mockDmTurn, mockArchivist } from '../../api/_lib/mock.js';
import { validateSchema } from '../../api/_lib/validate.js';
import { DM_TURN_SCHEMA, ARCHIVIST_SCHEMA, PERK_TREE_SCHEMA } from '../../api/_lib/schemas.js';
import { mockPerkTree } from '../../api/_lib/mock.js';
import { renderStatic, renderDynamic } from '../../api/_lib/prompts.js';

const character = { ...createCharacter({ name: 'Mara', stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } }), id: 'c1' };
const { campaign } = createCampaignFromSeed({ seed: mockWorldSeed({}), character, characterId: 'c1', genre: 'fantasy', skin: buildSkin('fantasy'), seedKey: 'k' });

const turns = Array.from({ length: 22 }, (_, i) => ({ id: `t${i}`, index: i, player: { text: `action ${i}` }, ai: { narrative_text: `narr ${i}` } }));

describe('contextBuilder', () => {
  it('builds static and dynamic tiers with a capped recent buffer', () => {
    const ctx = buildDmContext({ campaign, character, turns, diary: [{ index: 0, title: 'One', summary: 's' }], codex: [] });
    expect(ctx.static.character.name).toBe('Mara');
    expect(ctx.static.lorePinboard.length).toBeGreaterThan(0);
    expect(ctx.dynamic.recentTurns).toHaveLength(14);
    expect(ctx.dynamic.recentTurns[13].narrative).toBe('narr 21');
    expect(ctx.dynamic.location.connections).toHaveLength(2);
    expect(ctx.dynamic.diary[0].title).toBe('One');
  });

  it('selects codex cards by location, NPC and recent text', () => {
    const codex = [
      { id: 'mock_crossroads', name: 'Ashen Crossroads', type: 'location', tags: ['mock_crossroads'], summary: 'here' },
      { id: 'far', name: 'Distant Spire', type: 'location', tags: ['spire'], summary: 'far' },
      { id: 'oswin', name: 'Oswin', type: 'npc', tags: ['innkeeper'], summary: 'inn' },
    ];
    const picked = selectRelevantCodex({ codex, campaign: { ...campaign, activeNpc: null }, character, turns: [{ player: { text: 'I ask the innkeeper about rooms' } }] });
    expect(picked.map((p) => p.id)).toEqual(['mock_crossroads', 'oswin']);
  });

  it('archives at 20 turns, condensing the oldest 10', () => {
    expect(shouldArchive(turns.slice(0, 19))).toBe(false);
    expect(shouldArchive(turns)).toBe(true);
    const { toCondense, remaining } = archiveSplit(turns);
    expect(toCondense.map((t) => t.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(remaining).toHaveLength(12);
    const { payload } = buildArchivistPayload({ campaign, character, turns, diary: [], codex: [] });
    expect(payload.turnsToCondense).toHaveLength(10);
  });

  it('renders prompts without throwing', () => {
    const ctx = buildDmContext({ campaign, character, turns, diary: [], codex: [] });
    expect(renderStatic(ctx)).toContain('Rulebook & Lore Pinboard');
    expect(renderDynamic(ctx, { kind: 'action', text: 'hello' })).toContain('PLAYER ACTION');
  });
});

describe('mock responses satisfy the Vertex schemas', () => {
  const ctx = { dynamic: { combat: { inCombat: true, round: 1, enemies: [{ id: 'mock_brigand_1', name: 'B', distance: 'Melee', health_tier: 'Healthy', inspected: false, revealed_ac: null, revealed_traits: [] }] }, clock: { day: 1 } } };
  const cases = [
    [{ dynamic: {} }, { kind: 'action', text: 'I attack' }],
    [{ dynamic: {} }, { kind: 'action', text: 'search the room' }],
    [{ dynamic: {} }, { kind: 'action', text: 'talk to her' }],
    [{ dynamic: {} }, { kind: 'action', text: 'ask her to join' }],
    [{ dynamic: {} }, { kind: 'action', text: 'how do rests work?', ooc: true }],
    [ctx, { kind: 'roll_result', roll: { label: 'Attack — Longsword', success: true, damage: { total: 12 } } }],
    [ctx, { kind: 'roll_result', roll: { label: 'Insight', success: true } }],
    [{ dynamic: {} }, { kind: 'roll_result', roll: { label: 'Perception', success: false } }],
  ];
  for (const [c, a] of cases) {
    it(`dm-turn: ${a.kind} ${a.text || a.roll?.label}`, () => {
      expect(validateSchema(DM_TURN_SCHEMA, mockDmTurn(c, a))).toEqual([]);
    });
  }
  it('archivist + perk tree', () => {
    expect(validateSchema(ARCHIVIST_SCHEMA, mockArchivist({ turnsToCondense: [{ narrative: 'x' }] }))).toEqual([]);
    expect(validateSchema(PERK_TREE_SCHEMA, mockPerkTree({}))).toEqual([]);
  });
});
