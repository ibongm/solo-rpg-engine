import { describe, it, expect } from 'vitest';
import { listDeeds, scoreDeeds, levelScale, resolveMilestone, milestoneCooldown, xpMode, DEED_XP } from './deeds.js';

const base = () => ({
  campaign: {
    meta: {},
    combat: { inCombat: false, enemies: [] },
    mapNodes: [
      { id: 'a', label: 'Town', discovered: true, visited: true },
      { id: 'b', label: 'Cave', discovered: false, visited: false },
    ],
    factions: [{ id: 'f', name: 'Wardens', status: 'Neutral' }],
    quests: [{ id: 'q', title: 'Find him', type: 'main', status: 'active' }],
    worldState: { clock: { day: 1, hour: 8 } },
  },
  character: { level: 1, xp: 0, vitals: { hp: 10 }, companionRoster: [{ id: 'n', name: 'Nell', isRecruited: false }] },
});
const clone = (o) => JSON.parse(JSON.stringify(o));

describe('deeds', () => {
  it('scales checks by DC and gives a little for failure', () => {
    const b = base();
    const deeds = (roll) => listDeeds({ before: b, after: b, roll });
    expect(scoreDeeds(deeds({ kind: 'skill', label: 'X', dc: 8, success: true }), 1)).toBe(DEED_XP.checkEasy);
    expect(scoreDeeds(deeds({ kind: 'save', label: 'X', dc: 16, success: true }), 1)).toBe(DEED_XP.checkHard);
    expect(scoreDeeds(deeds({ kind: 'skill', label: 'X', dc: 20, success: true, critical: true }), 1)).toBe(DEED_XP.checkHeroic + DEED_XP.naturalTwenty);
    expect(scoreDeeds(deeds({ kind: 'skill', label: 'X', dc: 12, success: false }), 1)).toBe(DEED_XP.checkFailed);
    expect(deeds({ kind: 'attack', label: 'X', dc: 12, success: true })).toEqual([]);
    expect(deeds({ kind: 'skill', label: 'X', dc: null, success: true })).toEqual([]);
  });

  it('rewards enemies, exploration, lore, factions, allies, survival and quests', () => {
    const before = base();
    before.campaign.combat = { inCombat: true, enemies: [{ id: 'e1', name: 'Wolf', health_tier: 'Bloodied' }, { id: 'e2', name: 'Wolf', health_tier: 'Healthy' }] };
    const after = clone(before);
    after.campaign.combat = { inCombat: false, enemies: [] };
    after.campaign.mapNodes[1].discovered = true;
    after.campaign.factions[0].status = 'Friendly';
    after.campaign.quests[0].status = 'completed';
    after.campaign.worldState.clock.day = 2;
    after.character.companionRoster[0].isRecruited = true;
    const deeds = listDeeds({ before, after, codexUpserts: [{ id: 'new', name: 'Nell' }, { id: 'old', name: 'Old' }], knownCodexIds: ['old'] });
    const keys = deeds.map((d) => d.key);
    expect(keys).toEqual(['enemy', 'discover', 'lore', 'faction', 'ally', 'survive', 'quest']);
    expect(scoreDeeds(deeds, 1)).toBe(2 * DEED_XP.enemyOvercome + DEED_XP.locationDiscovered + DEED_XP.loreLearned + DEED_XP.factionStanding + DEED_XP.allyRecruited + DEED_XP.daySurvived + DEED_XP.questMain);
  });

  it('gives no quest XP when quests are off', () => {
    const before = base();
    before.campaign.meta.questsEnabled = false;
    const after = clone(before);
    after.campaign.quests[0].status = 'completed';
    expect(listDeeds({ before, after })).toEqual([]);
  });

  it('scales with level so later levels are not trivial', () => {
    expect(levelScale(1)).toBe(1);
    expect(levelScale(2)).toBe(2);
    expect(levelScale(4)).toBeCloseTo(3800 / 300);
    expect(scoreDeeds([{ base: 10 }], 2)).toBe(20);
  });

  it('milestones respect the cooldown and land exactly on the next threshold', () => {
    const ch = { level: 1, xp: 120 };
    expect(resolveMilestone({ character: ch, proposal: { reached: true }, turnCount: 3, lastMilestoneTurn: 0 }).granted).toBe(false);
    const m = resolveMilestone({ character: ch, proposal: { reached: true, reason: 'Arc done' }, turnCount: milestoneCooldown(1), lastMilestoneTurn: 0 });
    expect(m).toMatchObject({ granted: true, xp: 180, reason: 'Arc done' });
    expect(resolveMilestone({ character: ch, proposal: { reached: false }, turnCount: 50, lastMilestoneTurn: 0 }).granted).toBe(false);
  });

  it('defaults to deeds', () => {
    expect(xpMode({ meta: {} })).toBe('deeds');
    expect(xpMode({ meta: { xpMode: 'milestone' } })).toBe('milestone');
  });
});
