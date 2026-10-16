import { describe, it, expect } from 'vitest';
import { computeTurnState, normalizeLootItem, toggleEquip } from './stateMutator.js';
import { createCampaignFromSeed } from './campaignFactory.js';
import { createCharacter } from './progression.js';
import { buildSkin } from '../config/genreSkins.js';
import { mockWorldSeed, mockDmTurn } from '../../api/_lib/mock.js';
import { seededRng } from './rng.js';

const stats = { str: 14, dex: 14, con: 14, int: 10, wis: 12, cha: 10 };

function setup(strictness = 5) {
  const character = { ...createCharacter({ name: 'Mara', classOrArchetype: 'Fighter', stats }), id: 'c1' };
  const { campaign } = createCampaignFromSeed({ seed: mockWorldSeed({}), character, characterId: 'c1', genre: 'fantasy', skin: buildSkin('fantasy'), seedKey: 'k', rulesStrictness: strictness });
  return { character, campaign: { ...campaign, id: 'camp1' } };
}

const ai = (state_updates = {}, extra = {}) => ({
  narrative_text: 'x',
  scene_visual_prompt: 'y',
  dialogue_npc: null,
  roll_request: { required: false },
  combat_state: { in_combat: false, enemies: [] },
  state_updates,
  guided_choices: [],
  ...extra,
});

describe('computeTurnState', () => {
  it('clamps HP to max and currency to zero', () => {
    const { character, campaign } = setup();
    const r = computeTurnState({ campaign, character, ai: ai({ hp_delta: 999, currency_delta: -999 }) });
    expect(r.character.vitals.hp).toBe(character.vitals.maxHp);
    expect(r.character.currency.amount).toBe(0);
    expect(r.events.some((e) => e.type === 'insufficient_funds')).toBe(true);
  });

  it('drops to 0 HP, goes unconscious and starts death saves', () => {
    const { character, campaign } = setup();
    const r = computeTurnState({ campaign, character, ai: ai({ hp_delta: -(character.vitals.hp + 3) }) });
    expect(r.character.vitals.hp).toBe(0);
    expect(r.downed).toBe(true);
    expect(r.died).toBe(false);
    expect(r.character.vitals.conditions).toContain('unconscious');
  });

  it('applies massive-damage instant death only under Hardcore RAW', () => {
    const hard = setup(9);
    const r = computeTurnState({ campaign: hard.campaign, character: hard.character, ai: ai({ hp_delta: -(hard.character.vitals.hp + hard.character.vitals.maxHp) }) });
    expect(r.died).toBe(true);
    const soft = setup(5);
    const s = computeTurnState({ campaign: soft.campaign, character: soft.character, ai: ai({ hp_delta: -(soft.character.vitals.hp + soft.character.vitals.maxHp) }) });
    expect(s.died).toBe(false);
  });

  it('never lowers XP and levels up', () => {
    const { character, campaign } = setup();
    expect(computeTurnState({ campaign, character, ai: ai({ xp_delta: -50 }) }).character.xp).toBe(0);
    const r = computeTurnState({ campaign, character, ai: ai({ xp_delta: 300 }) });
    expect(r.character.level).toBe(2);
    expect(r.events.some((e) => e.type === 'level_up')).toBe(true);
  });

  it('advances the clock and expires timed quests into pending events', () => {
    const { character, campaign } = setup();
    const r = computeTurnState({ campaign, character, ai: ai({ time_advance_minutes: 6 * 24 * 60 }) });
    expect(r.campaign.worldState.clock.day).toBe(7);
    expect(r.campaign.quests[0].status).toBe('failed');
    expect(r.campaign.pendingEvents.length).toBe(1);
    expect(r.events.some((e) => e.type === 'quest_expired')).toBe(true);
  });

  it('clamps faction reputation and heat', () => {
    const { character, campaign } = setup();
    const r = computeTurnState({ campaign, character, ai: ai({ faction_deltas: [{ faction_id: 'mock_faction_road', rep_delta: 500, heat_delta: -500 }] }) });
    const f = r.campaign.factions.find((x) => x.id === 'mock_faction_road');
    expect(f.reputation).toBe(60);
    expect(f.heat).toBe(0);
  });

  it('normalizes loot and removes items by id or name', () => {
    const { character, campaign } = setup();
    const potion = character.inventory.find((i) => i.type === 'consumable');
    const r = computeTurnState({
      campaign,
      character,
      ai: ai({ loot_gained: [{ name: 'Blade', type: 'weapon', damageDice: '1d6', statModifiers: { attack: 9, junk: 3 } }, { type: 'weapon' }], loot_removed_ids: [potion.id, 'Longsword'] }),
    });
    const blade = r.character.inventory.find((i) => i.name === 'Blade');
    expect(blade.statModifiers).toEqual({ attack: 3 });
    expect(r.character.inventory.some((i) => i.id === potion.id)).toBe(false);
    expect(r.character.inventory.some((i) => i.name === 'Longsword')).toBe(false);
    expect(normalizeLootItem({ name: 'X', type: 'weapon', damageDice: 'banana' }).damageDice).toBeNull();
  });

  it('recruits companions ONLY through companion_updates.isRecruited', () => {
    const { character, campaign } = setup();
    const met = computeTurnState({ campaign, character, ai: ai({ companion_updates: [{ id: 'bryn', name: 'Bryn', loyalty_delta: 5 }] }) });
    expect(met.character.companionRoster[0].isRecruited).toBe(false);
    expect(met.character.companionRoster[0].loyalty).toBe(55);
    const joined = computeTurnState({ campaign, character: met.character, ai: ai({ companion_updates: [{ id: 'bryn', name: 'Bryn', isRecruited: true }] }) });
    expect(joined.character.companionRoster).toHaveLength(1);
    expect(joined.character.companionRoster[0].isRecruited).toBe(true);
    expect(joined.events.some((e) => e.type === 'recruited')).toBe(true);
  });

  it('adds and connects a new map node, and records rumors at the current node', () => {
    const { character, campaign } = setup();
    const r = computeTurnState({ campaign, character, ai: ai({ new_map_node: { id: 'tower', label: 'Tower', type: 'landmark', travelMinutes: 90 }, rumors_learned: ['A ghost walks.'] }) });
    const tower = r.campaign.mapNodes.find((n) => n.id === 'tower');
    expect(tower.discovered).toBe(true);
    expect(tower.connectedTo[0]).toEqual({ targetNodeId: 'mock_crossroads', travelMinutes: 90 });
    expect(r.campaign.mapNodes[0].rumors).toContain('A ghost walks.');
  });

  it('upserts quests and ignores deadlines already in the past', () => {
    const { character, campaign } = setup();
    const r = computeTurnState({ campaign, character, ai: ai({ quest_updates: [{ id: 'b1', title: 'Bounty', status: 'active', type: 'bounty', deadline_day: 3, deadline_hour: 12 }, { id: 'old', title: 'Old', status: 'active', deadline_day: 1, deadline_hour: 0 }] }) });
    expect(r.campaign.quests.find((q) => q.id === 'b1').deadline).toEqual({ day: 3, hour: 12 });
    expect(r.campaign.quests.find((q) => q.id === 'old').deadline).toBeNull();
    const done = computeTurnState({ campaign: r.campaign, character, ai: ai({ quest_updates: [{ id: 'b1', title: 'Bounty', status: 'completed' }] }) });
    expect(done.campaign.quests.find((q) => q.id === 'b1').status).toBe('completed');
  });

  it('rolls visible initiative when combat starts and keeps revealed enemy info', () => {
    const { character, campaign } = setup();
    const start = mockDmTurn({ dynamic: {} }, { kind: 'action', text: 'I attack' });
    const r = computeTurnState({ campaign, character, ai: start, rng: seededRng('init') });
    expect(r.campaign.combat.inCombat).toBe(true);
    expect(r.campaign.combat.order.some((o) => o.kind === 'player')).toBe(true);
    expect(r.campaign.combat.order).toHaveLength(3);
    expect(r.campaign.pendingRoll).toMatchObject({ skill_or_stat: 'attack', dc: 14 });
    const scanned = { ...r.campaign, combat: { ...r.campaign.combat, enemies: r.campaign.combat.enemies.map((e, i) => (i === 0 ? { ...e, inspected: true, revealed_ac: 14, revealed_traits: ['x'] } : e)) } };
    const forgetful = ai({}, { combat_state: { in_combat: true, round: 2, enemies: r.campaign.combat.enemies.map((e) => ({ ...e, inspected: false, revealed_ac: null })) } });
    const next = computeTurnState({ campaign: scanned, character: r.character, ai: forgetful });
    expect(next.campaign.combat.enemies[0].inspected).toBe(true);
    expect(next.campaign.combat.enemies[0].revealed_ac).toBe(14);
    expect(next.campaign.combat.order).toEqual(r.campaign.combat.order);
  });

  it('ends combat when all enemies are defeated', () => {
    const { character, campaign } = setup();
    const c = { ...campaign, combat: { inCombat: true, round: 2, enemies: [{ id: 'e', name: 'E', distance: 'Melee', health_tier: 'Bloodied', inspected: false }], order: [], turnIndex: 0 } };
    const r = computeTurnState({ campaign: c, character, ai: ai({}, { combat_state: { in_combat: true, enemies: [{ id: 'e', name: 'E', distance: 'Melee', health_tier: 'Defeated', inspected: false }] } }) });
    expect(r.campaign.combat.inCombat).toBe(false);
  });

  it('consumes only the pending events that were sent to the storyteller', () => {
    const { character, campaign } = setup();
    const c = { ...campaign, pendingEvents: ['old event', 'unsent'] };
    const r = computeTurnState({ campaign: c, character, ai: ai({}), engine: { consumedEvents: ['old event'] } });
    expect(r.campaign.pendingEvents).toEqual(['unsent']);
  });

  it('travel moves the party and marks the node visited', () => {
    const { character, campaign } = setup();
    const r = computeTurnState({ campaign, character, ai: ai({}), engine: { travelToNodeId: 'mock_ferry', time_advance_minutes: 120 } });
    expect(r.campaign.worldState.currentNodeId).toBe('mock_ferry');
    expect(r.campaign.mapNodes.find((n) => n.id === 'mock_ferry')).toMatchObject({ discovered: true, visited: true });
    expect(r.campaign.worldState.clock.hour).toBe(10);
  });

  it('only allows one equipped weapon', () => {
    const { character } = setup();
    const c = { ...character, inventory: [...character.inventory, { id: 'w2', name: 'Axe', type: 'weapon', equipped: false, statModifiers: {}, craftingTags: [] }] };
    const next = toggleEquip(c, 'w2');
    expect(next.inventory.filter((i) => i.type === 'weapon' && i.equipped).map((i) => i.id)).toEqual(['w2']);
  });
});
