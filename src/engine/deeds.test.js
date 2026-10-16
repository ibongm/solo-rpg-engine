import { describe, it, expect } from 'vitest';
import { listDeeds, scoreDeeds, levelScale, resolveMilestone, milestoneCooldown, xpMode, xpPace, xpFineTune, estimatedTurnsPerLevel, DEED_XP, XP_PACES, XP_PACE_INFO } from './deeds.js';

/** Raw deed value before pace/level scaling. */
const raw = (deeds) => deeds.reduce((sum, d) => sum + d.base, 0);

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
    expect(raw(deeds({ kind: 'skill', label: 'X', dc: 8, success: true }))).toBe(DEED_XP.checkEasy);
    expect(raw(deeds({ kind: 'save', label: 'X', dc: 16, success: true }))).toBe(DEED_XP.checkHard);
    expect(raw(deeds({ kind: 'skill', label: 'X', dc: 20, success: true, critical: true }))).toBe(DEED_XP.checkHeroic + DEED_XP.naturalTwenty);
    expect(raw(deeds({ kind: 'skill', label: 'X', dc: 12, success: false }))).toBe(DEED_XP.checkFailed);
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
    expect(raw(deeds)).toBe(2 * DEED_XP.enemyOvercome + DEED_XP.locationDiscovered + DEED_XP.loreLearned + DEED_XP.factionStanding + DEED_XP.allyRecruited + DEED_XP.daySurvived + DEED_XP.questMain);
  });

  it('gives no quest XP when quests are off', () => {
    const before = base();
    before.campaign.meta.questsEnabled = false;
    const after = clone(before);
    after.campaign.quests[0].status = 'completed';
    expect(listDeeds({ before, after })).toEqual([]);
  });

  it('scales with level so later levels are not trivial', () => {
    // Story pace keeps up with the full 5e gap (every level equally long)…
    expect(levelScale(1, 'story')).toBe(1);
    expect(levelScale(2, 'story')).toBe(2);
    expect(levelScale(4, 'story')).toBeCloseTo(3800 / 300);
    // …slower paces keep up with less of it, so higher levels take longer.
    expect(levelScale(4, 'standard')).toBeCloseTo((3800 / 300) ** 0.73);
    expect(levelScale(4, 'gritty')).toBeLessThan(levelScale(4, 'slow'));
    expect(scoreDeeds([{ base: 10 }], 2, 'story')).toBe(25);
    expect(scoreDeeds([{ base: 10 }], 1)).toBe(6);
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

describe('xp pace', () => {
  const deeds = [{ key: 'check', base: DEED_XP.checkMedium, text: 'x' }, { key: 'lore', base: DEED_XP.loreLearned, text: 'y' }];

  it('defaults to standard pace and 1× fine-tune, rejecting unknown values', () => {
    expect(xpPace({ meta: {} })).toBe('standard');
    expect(xpPace(undefined)).toBe('standard');
    expect(xpPace({ meta: { xpPace: 'gritty' } })).toBe('gritty');
    expect(xpPace({ meta: { xpPace: 'warp' } })).toBe('standard');
    expect(xpFineTune({ meta: {} })).toBe(1);
    expect(xpFineTune({ meta: { xpMultiplier: 1.5 } })).toBe(1.5);
    expect(xpFineTune({ meta: { xpMultiplier: 9 } })).toBe(1);
  });

  it('scores every pace, fastest to slowest, at low and high levels', () => {
    for (const level of [1, 4, 10]) {
      const scores = XP_PACES.map((p) => scoreDeeds(deeds, level, p));
      for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeLessThan(scores[i - 1]);
    }
    expect(scoreDeeds(deeds, 1, 'story')).toBe(Math.round(30 * 1.25));
    expect(scoreDeeds(deeds, 1, 'standard')).toBe(Math.round(30 * 0.625));
    expect(scoreDeeds(deeds, 1, 'slow')).toBe(Math.round(30 * 0.42));
    expect(scoreDeeds(deeds, 1, 'gritty')).toBe(Math.round(30 * 0.25));
  });

  it('applies the fine-tune multiplier on top of the pace', () => {
    expect(scoreDeeds(deeds, 1, 'standard', 2)).toBe(Math.round(30 * 0.625 * 2));
    expect(scoreDeeds(deeds, 1, 'standard', 0.5)).toBe(Math.round(30 * 0.625 * 0.5));
  });

  it('never rounds a real deed down to zero, and nothing earns nothing', () => {
    expect(scoreDeeds([{ base: 1 }], 1, 'gritty', 0.5)).toBe(1);
    expect(scoreDeeds([], 5, 'story')).toBe(0);
  });

  it('keeps later levels longer but playable (turn estimates)', () => {
    const est = (level, pace) => estimatedTurnsPerLevel(level, pace);
    expect(est(1, 'story')).toBe(est(10, 'story'));
    expect(est(1, 'standard')).toBeGreaterThanOrEqual(7);
    expect(est(1, 'standard')).toBeLessThanOrEqual(9);
    expect(est(10, 'standard')).toBeLessThanOrEqual(30);
    expect(est(10, 'gritty')).toBeLessThanOrEqual(110);
    expect(est(20, 'standard')).toBeNull();
    expect(estimatedTurnsPerLevel(1, 'standard', 2)).toBeLessThan(est(1, 'standard'));
  });

  it('spaces milestones by pace', () => {
    expect(milestoneCooldown(1, 'story')).toBe(Math.round(6 * XP_PACE_INFO.story.cooldownMult));
    expect(milestoneCooldown(5, 'gritty')).toBe(30);
    expect(milestoneCooldown(1)).toBe(9);
    const ch = { level: 1, xp: 0 };
    for (const pace of XP_PACES) {
      const cd = milestoneCooldown(1, pace);
      expect(resolveMilestone({ character: ch, proposal: { reached: true }, turnCount: cd - 1, lastMilestoneTurn: 0, pace })).toMatchObject({ granted: false, turnsToWait: 1 });
      expect(resolveMilestone({ character: ch, proposal: { reached: true }, turnCount: cd, lastMilestoneTurn: 0, pace })).toMatchObject({ granted: true, xp: 300 });
    }
  });
});
