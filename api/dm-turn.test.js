import { describe, it, expect } from 'vitest';
import { repairRollRequest, DEFAULT_DC } from './dm-turn.js';
import { DM_TURN_SCHEMA, ROLL_TARGETS } from './_lib/schemas.js';
import { normalizeSkillOrStat } from '../src/engine/diceEngine.js';

describe('dm-turn roll request guarantees', () => {
  it('fills a missing DC and skill with visible defaults', () => {
    const fixed = repairRollRequest({ roll_request: { required: true, skill_or_stat: null, dc: null, reason: 'Pick the lock' } }, { preferredSkill: 'sleight_of_hand' });
    expect(fixed.roll_request).toMatchObject({ skill_or_stat: 'sleight_of_hand', dc: DEFAULT_DC, advantage_state: 'normal' });
    expect(fixed.roll_request.reason).toContain(`default DC ${DEFAULT_DC}`);
  });

  it('leaves complete or non-required requests untouched', () => {
    const ok = { roll_request: { required: true, skill_or_stat: 'stealth', dc: 14, advantage_state: 'normal', reason: 'x' } };
    expect(repairRollRequest(ok, {})).toBe(ok);
    const none = { roll_request: { required: false, skill_or_stat: null, dc: null } };
    expect(repairRollRequest(none, {})).toBe(none);
  });

  it('every canonical roll target maps onto an engine check', () => {
    for (const t of ROLL_TARGETS) {
      const d = normalizeSkillOrStat(t);
      if (t === 'attack') expect(d.kind).toBe('attack');
      else if (t === 'initiative') expect(d.kind).toBe('initiative');
      else if (t.endsWith('_save')) expect(d).toEqual({ kind: 'save', key: t.slice(0, 3) });
      else expect(['skill', 'ability']).toContain(d.kind);
    }
    expect(DM_TURN_SCHEMA.properties.roll_request.properties.skill_or_stat.enum).toBe(ROLL_TARGETS);
  });
});
