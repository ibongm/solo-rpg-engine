import { describe, it, expect } from 'vitest';
import { createCampaignFromSeed, connect, safeId } from './campaignFactory.js';
import { createCharacter } from './progression.js';
import { buildSkin } from '../config/genreSkins.js';
import { mockWorldSeed } from '../../api/_lib/mock.js';
import { validateSchema } from '../../api/_lib/validate.js';
import { WORLD_SEED_SCHEMA } from '../../api/_lib/schemas.js';

describe('campaignFactory', () => {
  it('mock seed satisfies the world seed schema', () => {
    expect(validateSchema(WORLD_SEED_SCHEMA, mockWorldSeed({ genre: 'fantasy' }))).toEqual([]);
  });

  it('builds a campaign with connected nodes, factions and the main quest', () => {
    const character = createCharacter({ name: 'M', stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } });
    const { campaign, openingTurn, codexEntries } = createCampaignFromSeed({
      seed: mockWorldSeed({}),
      character,
      characterId: 'c1',
      genre: 'frontier_noir',
      skin: buildSkin('frontier_noir'),
      seedKey: 'k',
    });
    expect(campaign.meta.activeCharId).toBe('c1');
    expect(campaign.mapNodes).toHaveLength(3);
    const start = campaign.mapNodes[0];
    expect(start.discovered).toBe(true);
    expect(start.connectedTo.map((c) => c.targetNodeId).sort()).toEqual(['mock_caves', 'mock_ferry']);
    expect(campaign.mapNodes[1].connectedTo[0].targetNodeId).toBe(start.id);
    expect(campaign.factions).toHaveLength(3);
    expect(campaign.quests[0].deadline).toEqual({ day: 6, hour: 8 });
    expect(campaign.worldState.clock.season).toBe('Autumn');
    expect(campaign.skin.currencyLabel).toBe('Dollars');
    expect(openingTurn.ai.narrative_text.length).toBeGreaterThan(20);
    expect(codexEntries.some((c) => c.type === 'faction')).toBe(true);
  });

  it('connect is idempotent and clamps travel time', () => {
    let nodes = [
      { id: 'a', connectedTo: [] },
      { id: 'b', connectedTo: [] },
    ];
    nodes = connect(nodes, 'a', 'b', 1);
    nodes = connect(nodes, 'a', 'b', 50);
    expect(nodes[0].connectedTo).toEqual([{ targetNodeId: 'b', travelMinutes: 5 }]);
  });

  it('safeId slugifies', () => {
    expect(safeId('The Old Mill!')).toBe('the_old_mill');
  });
});
