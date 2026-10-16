import { describe, it, expect } from 'vitest';
import { advanceClock, expireQuests, rollWeather, advanceWorld, minutesUntilDeadline, seasonForDay, formatDuration } from './clockWeatherEngine.js';

describe('clock', () => {
  it('rolls minutes into hours and days', () => {
    const { clock, daysPassed } = advanceClock({ day: 1, hour: 23, minute: 30, season: 'Spring' }, 45);
    expect(clock).toEqual({ day: 2, hour: 0, minute: 15, season: 'Spring' });
    expect(daysPassed).toBe(1);
  });

  it('never rewinds', () => {
    const c = { day: 3, hour: 10, minute: 0, season: 'Spring' };
    expect(advanceClock(c, -500).clock).toEqual(c);
  });

  it('changes season every 30 days', () => {
    expect(seasonForDay(30, 'Spring')).toBe('Spring');
    expect(seasonForDay(31, 'Spring')).toBe('Summer');
    expect(seasonForDay(121, 'Autumn')).toBe('Autumn');
  });

  it('formats durations', () => {
    expect(formatDuration(1500)).toBe('1d 1h');
    expect(formatDuration(0)).toBe('0m');
  });
});

describe('timed quests', () => {
  const quests = [
    { id: 'a', status: 'active', deadline: { day: 2, hour: 12 } },
    { id: 'b', status: 'active', deadline: null },
    { id: 'c', status: 'completed', deadline: { day: 1, hour: 0 } },
  ];

  it('fails overdue active quests only', () => {
    const { quests: next, expired } = expireQuests(quests, { day: 2, hour: 12, minute: 0 });
    expect(expired.map((q) => q.id)).toEqual(['a']);
    expect(next[0].status).toBe('failed');
    expect(next[1].status).toBe('active');
    expect(next[2].status).toBe('completed');
  });

  it('computes countdowns', () => {
    expect(minutesUntilDeadline({ day: 2, hour: 12 }, { day: 2, hour: 10, minute: 30 })).toBe(90);
    expect(minutesUntilDeadline(null, { day: 1, hour: 0, minute: 0 })).toBeNull();
  });
});

describe('weather', () => {
  it('is deterministic per seed and day', () => {
    expect(rollWeather('s', 4, 'Winter')).toEqual(rollWeather('s', 4, 'Winter'));
  });

  it('re-rolls weather only when a day passes', () => {
    const ws = { clock: { day: 1, hour: 8, minute: 0, season: 'Spring' }, weather: { type: 'Clear', modifierValue: 0, mechanicalEffect: '' }, startSeason: 'Spring' };
    const same = advanceWorld(ws, [], 60, 'seed');
    expect(same.weatherChanged).toBe(false);
    expect(same.worldState.weather).toBe(ws.weather);
    const next = advanceWorld(ws, [], 24 * 60, 'seed');
    expect(next.weatherChanged).toBe(true);
    expect(next.worldState.weather).toEqual(rollWeather('seed', 2, 'Spring'));
  });
});
