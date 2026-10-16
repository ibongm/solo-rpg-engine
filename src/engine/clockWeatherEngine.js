/**
 * Living World Clock, Dynamic Weather & Timed Quest expiry — fully deterministic.
 * Weather is seeded by (campaign seed, day, season) so the same day always has the same sky.
 */
import { seededRng } from './rng.js';

export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;
export const MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY;
export const DAYS_PER_SEASON = 30;
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

export function seasonForDay(day, startSeason = 'Spring') {
  const startIdx = Math.max(0, SEASONS.indexOf(startSeason));
  const idx = (startIdx + Math.floor((Math.max(1, day) - 1) / DAYS_PER_SEASON)) % SEASONS.length;
  return SEASONS[idx];
}

export function clockToMinutes(clock) {
  return ((clock.day || 1) - 1) * MINUTES_PER_DAY + (clock.hour || 0) * MINUTES_PER_HOUR + (clock.minute || 0);
}

export function minutesToClock(total, startSeason = 'Spring') {
  const t = Math.max(0, Math.floor(total));
  const day = Math.floor(t / MINUTES_PER_DAY) + 1;
  const rem = t % MINUTES_PER_DAY;
  return {
    day,
    hour: Math.floor(rem / MINUTES_PER_HOUR),
    minute: rem % MINUTES_PER_HOUR,
    season: seasonForDay(day, startSeason),
  };
}

/** Advances a clock by N minutes (negative values are ignored — time never rewinds). */
export function advanceClock(clock, minutes, startSeason = 'Spring') {
  const delta = Math.max(0, Math.floor(Number(minutes) || 0));
  const next = minutesToClock(clockToMinutes(clock) + delta, startSeason);
  return { clock: next, daysPassed: next.day - (clock.day || 1) };
}

export function formatClock(clock) {
  if (!clock) return '';
  const hh = String(clock.hour ?? 0).padStart(2, '0');
  const mm = String(clock.minute ?? 0).padStart(2, '0');
  return `Day ${clock.day}, ${hh}:${mm} · ${clock.season}`;
}

export function timeOfDay(clock) {
  const h = clock?.hour ?? 12;
  if (h < 5) return 'Night';
  if (h < 8) return 'Dawn';
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  if (h < 20) return 'Dusk';
  return 'Night';
}

export function formatDuration(minutes) {
  const m = Math.max(0, Math.round(minutes));
  const d = Math.floor(m / MINUTES_PER_DAY);
  const h = Math.floor((m % MINUTES_PER_DAY) / 60);
  const mm = m % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (mm || !parts.length) parts.push(`${mm}m`);
  return parts.join(' ');
}

// ── Timed quests ─────────────────────────────────────────────────

export function deadlineToMinutes(deadline) {
  if (!deadline) return null;
  return ((deadline.day || 1) - 1) * MINUTES_PER_DAY + (deadline.hour || 0) * MINUTES_PER_HOUR;
}

/** Minutes remaining until a quest deadline (negative = overdue, null = untimed). */
export function minutesUntilDeadline(deadline, clock) {
  const d = deadlineToMinutes(deadline);
  if (d === null) return null;
  return d - clockToMinutes(clock);
}

/**
 * Fails every active quest whose deadline has passed. Returns { quests, expired }.
 * Quests resolve without the player — the world moves on.
 */
export function expireQuests(quests, clock) {
  const now = clockToMinutes(clock);
  const expired = [];
  const next = (quests || []).map((q) => {
    if (q.status !== 'active' || !q.deadline) return q;
    const d = deadlineToMinutes(q.deadline);
    if (d !== null && now >= d) {
      expired.push(q);
      return { ...q, status: 'failed', failedReason: 'deadline_passed' };
    }
    return q;
  });
  return { quests: next, expired };
}

// ── Weather ──────────────────────────────────────────────────────

const W = (type, weight, modifierValue, affects, mechanicalEffect) => ({ type, weight, modifierValue, affects, mechanicalEffect });

export const WEATHER_TABLES = {
  Spring: [
    W('Clear', 40, 0, [], 'No effect.'),
    W('Overcast', 20, 0, [], 'No effect.'),
    W('Light Rain', 20, -1, ['perception'], '-1 to Perception.'),
    W('Heavy Rain', 12, -2, ['ranged', 'perception'], '-2 to Ranged Attacks & Perception.'),
    W('Fog', 8, -2, ['perception', 'ranged'], '-2 to Perception & Ranged Attacks; easier to hide.'),
  ],
  Summer: [
    W('Clear', 45, 0, [], 'No effect.'),
    W('Scorching Heat', 20, -1, ['athletics', 'survival'], '-1 to Athletics & Survival.'),
    W('Thunderstorm', 15, -2, ['ranged', 'perception'], '-2 to Ranged Attacks & Perception.'),
    W('Dust Wind', 10, -1, ['ranged', 'perception'], '-1 to Ranged Attacks & Perception.'),
    W('Humid Haze', 10, 0, [], 'No effect.'),
  ],
  Autumn: [
    W('Clear', 30, 0, [], 'No effect.'),
    W('Overcast', 25, 0, [], 'No effect.'),
    W('Gale Winds', 15, -2, ['ranged'], '-2 to Ranged Attacks.'),
    W('Heavy Rain', 15, -2, ['ranged', 'perception'], '-2 to Ranged Attacks & Perception.'),
    W('Fog', 15, -2, ['perception', 'ranged'], '-2 to Perception & Ranged Attacks.'),
  ],
  Winter: [
    W('Clear & Cold', 30, 0, [], 'No effect.'),
    W('Snowfall', 25, -1, ['perception', 'survival'], '-1 to Perception & Survival.'),
    W('Blizzard', 15, -3, ['ranged', 'perception', 'survival'], '-3 to Ranged Attacks, Perception & Survival.'),
    W('Icy Ground', 15, -2, ['acrobatics', 'athletics'], '-2 to Acrobatics & Athletics.'),
    W('Overcast', 15, 0, [], 'No effect.'),
  ],
};

/** Deterministic weather for a given day. */
export function rollWeather(seed, day, season) {
  const table = WEATHER_TABLES[season] || WEATHER_TABLES.Spring;
  const rng = seededRng(`${seed}:weather:${day}`);
  const totalWeight = table.reduce((a, w) => a + w.weight, 0);
  let roll = rng() * totalWeight;
  for (const w of table) {
    roll -= w.weight;
    if (roll < 0) return { type: w.type, mechanicalEffect: w.mechanicalEffect, modifierValue: w.modifierValue, affects: [...w.affects] };
  }
  const last = table[table.length - 1];
  return { type: last.type, mechanicalEffect: last.mechanicalEffect, modifierValue: last.modifierValue, affects: [...last.affects] };
}

/**
 * Advances the whole world: clock, weather (re-rolled on each new day), and quest expiry.
 * @returns {{ worldState, quests, expired, weatherChanged, daysPassed }}
 */
export function advanceWorld(worldState, quests, minutes, seed) {
  const startSeason = worldState.startSeason || 'Spring';
  const { clock, daysPassed } = advanceClock(worldState.clock, minutes, startSeason);
  let weather = worldState.weather;
  let weatherChanged = false;
  if (daysPassed > 0) {
    weather = rollWeather(seed, clock.day, clock.season);
    weatherChanged = true;
  }
  const { quests: nextQuests, expired } = expireQuests(quests, clock);
  return {
    worldState: { ...worldState, clock, weather },
    quests: nextQuests,
    expired,
    weatherChanged,
    daysPassed,
  };
}
