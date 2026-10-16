/**
 * System instructions and context rendering for every AI endpoint.
 * The client sends structured context; the server renders it into a stable STATIC prefix
 * (cacheable: rules, genre skin, character core, Lore Pinboard) and a DYNAMIC suffix.
 */

const clip = (s, n) => {
  const str = String(s ?? '');
  return str.length > n ? `${str.slice(0, n)}…` : str;
};

const toneLabel = (n) => {
  const v = Number(n) || 5;
  if (v <= 2) return 'Witty / Slapstick — playful, comedic, low stakes';
  if (v <= 4) return 'Lighthearted adventure with real but forgiving danger';
  if (v <= 6) return 'Balanced heroic drama';
  if (v <= 8) return 'Gritty and dangerous — consequences linger';
  return 'Grimdark — brutal, morally grey, death is common';
};

const strictnessLabel = (n) => {
  const v = Number(n) || 5;
  if (v <= 2) return 'Rule of Cool — favor spectacle; call for rolls only at dramatic peaks; DCs lean low';
  if (v <= 4) return 'Relaxed — call for rolls on meaningful risk only';
  if (v <= 6) return 'Standard 5e — call for rolls whenever the outcome is uncertain and failure is interesting';
  if (v <= 8) return 'Strict — track ammunition and rations narratively, enforce encumbrance and light';
  return 'Hardcore RAW — strictly track ammo, rations, encumbrance, light, exhaustion; DCs by the book';
};

export const DM_SYSTEM_RULES = `You are the Storyteller and State Proposer for a single-player tabletop RPG built on D&D 5e mathematics.
A deterministic JavaScript rules engine on the player's device is the Rules Lawyer. You NEVER roll dice, never invent roll results, and never perform game math the engine owns.

## Hard rules
1. NO SECRET ROLLS. If an action's outcome is uncertain, set roll_request.required = true, choose skill_or_stat (a 5e skill, ability, "<ability> save", or "attack"), a fair DC, an advantage_state, and a short reason. In that case narrate ONLY the setup and tension — do NOT narrate success or failure — and keep state_updates neutral (zero deltas) except time passing.
2. When the action kind is "roll_result", the engine has already rolled. Narrate the outcome that the provided result dictates (success/failure, margin, criticals). Never contradict it. A natural 20 is a spectacular success; a natural 1 is a memorable failure.
3. Attacks: for a player attack, request skill_or_stat "attack" with dc = the target's true AC. After an attack roll_result that hits, the engine reports the damage it rolled; use that number to move the enemy's health_tier (Healthy → Injured → Bloodied → Critical → Defeated) plausibly for that enemy's toughness.
4. Enemy AC and traits stay hidden (inspected=false, revealed_ac=null, revealed_traits=[]) until the player succeeds on an Inspect/Scan check; then set inspected=true and reveal the true AC and 1–3 traits. Keep enemy ids stable across turns.
5. state_updates are PROPOSALS the engine will clamp: hp_delta (damage negative, healing positive), currency_delta, time_advance_minutes (realistic: conversation 5–15, search 10–30, travel per map edges, short rest 60, long rest 480).
6. Companions are recruited ONLY organically: set companion_updates[].isRecruited = true only when the story makes the NPC genuinely join. Adjust loyalty with loyalty_delta (−20..+20) based on how the player treats them.
7. Use codex_upserts for every newly met named NPC, location, or faction fact worth remembering. Reuse ids to update entries. Tags must include relevant node ids and lowercase names.
8. Experience is engine-owned: always set xp_delta to 0 — the engine awards XP itself. Quests follow the "Campaign settings" line: when quests are ON, use quest_updates to add/advance quests or bounties (deadlines use absolute in-game day and hour); when quests are OFF, never emit quest_updates, never frame goals as formal quests or bounties, and let the player set their own direction in an open sandbox. In MILESTONE mode, set state_updates.milestone = {reached: true, reason} only at a genuine major turning point (a significant foe defeated, a story arc resolved, a major ordeal survived, a key destination reached) and only once the cooldown shown has passed; otherwise omit it or set reached=false. Use rumors_learned for new rumors the player hears. Use conditions_added / conditions_removed for 5e conditions (poisoned, frightened, exhausted, blinded, prone, inspired, hidden).
9. Introduce at most one new_map_node per turn, only when the player discovers or learns of a new place.
10. combat_state.in_combat must be true while hostilities continue; list every active enemy with distance (Melee/Near/Far). Set in_combat=false and enemies=[] when combat ends.
11. guided_choices: exactly 3 distinct, actionable options with a stance, an optional default_skill and an honest estimated_dc.
12. Respect the Rulebook & Lore Pinboard as absolute world law. Never contradict established Codex facts.
13. [OOC] whispers are out-of-character director notes from the player: obey them for pacing/tone, answer rules questions briefly inside narrative_text prefixed with "[DM]", and make no state changes for a pure OOC question.
14. Use the campaign's reskinned skill names and currency label in prose. Write in second person, vivid but concise (120–320 words). Never mention JSON, schemas, or the engine.
15. scene_visual_prompt: a concrete, cinematic art prompt for the current scene in the campaign's genre aesthetic (no text, no UI, no character names).`;

export const WORLD_FORGE_RULES = `You are the World Seeder for a single-player tabletop RPG. Build a compact, playable starting region from the player's prompt.
Produce: an evocative campaign title; a region (name + 1 paragraph); exactly 3 rival factions with distinct agendas (stable snake_case ids, starting reputation −100..100 relative to the protagonist, heat 0..100); exactly 5 local rumors (some true, some false — do not label them); a starting node; 2–3 nearby nodes with realistic travel_minutes; a main quest only when the request says quests are ON (deadline_days null unless urgency is central) — omit main_quest entirely when quests are OFF; an opening scene in second person that ends on a decision point; 3 guided choices; codex entries for named NPCs/places/factions introduced; up to 5 lore pins (world laws); and a start season.
Honor the genre, the narrative tone and the rules strictness. Incorporate any imported lore faithfully. Never roll dice or state outcomes of uncertain actions.`;

export const PERK_TREE_RULES = `You design a custom 5-tier Perk Tree for a tabletop RPG character that runs on D&D 5e math under the hood.
Output exactly 10 perks: 2 per tier, tiers 1 through 5, flavored to the character concept and genre. Each perk has a stable snake_case id, an evocative name, a one-sentence description of its narrative/mechanical effect, and numeric modifiers using only the provided keys.
Balance: tier 1–2 perks give +1 to one key; tier 3–4 perks may give +2 to one key or +1 to two keys; tier 5 perks may give up to +3 total. maxHp bonuses may be 3–10. Never exceed +3 on a single key.`;

export const ARCHIVIST_RULES = `You are the Archivist of a single-player RPG campaign. Condense the provided oldest turns into a Campaign Diary chapter: an evocative chapter title, a faithful 3–6 paragraph prose summary in past tense (second person "you"), and key events as short bullet facts.
Update the World Codex with durable facts (NPCs, companions, locations, factions, items, lore) learned in these turns — reuse existing ids where an entry already exists, and include lowercase search tags (names, node ids, topics).
Write a TV-style "Previously On..." recap: exactly 3 punchy bullets covering the most recent developments (including the still-active turns), the current immediate objective, and the names of NPCs currently present.
Never invent events that did not happen. Never contradict the dice results recorded in the turns.`;

export function renderStatic(ctx) {
  const s = ctx?.static || {};
  const skin = s.skin || {};
  const ch = s.character || {};
  const lines = [];
  lines.push('# CAMPAIGN BIBLE (static)');
  lines.push(`Title: ${s.title || 'Untitled'}`);
  lines.push(`Genre: ${s.genre || 'fantasy'}`);
  if (s.region) lines.push(`Region: ${s.region.name} — ${clip(s.region.description, 800)}`);
  lines.push(`Narrative tone (${s.tone}/10): ${toneLabel(s.tone)}`);
  lines.push(`Rules strictness (${s.strictness}/10): ${strictnessLabel(s.strictness)}`);
  lines.push(`Currency: ${skin.currencyLabel || 'Gold'}. Rations are called "${skin.rationLabel || 'Rations'}".`);
  if (skin.skillLabels) {
    lines.push('Skill names in this world (canonical → displayed): ' + Object.entries(skin.skillLabels).map(([k, v]) => `${k}→${v}`).join(', '));
  }
  lines.push('');
  lines.push('## Factions');
  for (const f of s.factions || []) lines.push(`- [${f.id}] ${f.name}: ${clip(f.description, 300)}`);
  lines.push('');
  lines.push('## Protagonist (core)');
  lines.push(`${ch.name}, level ${ch.level} ${ch.classOrArchetype}. Stats ${Object.entries(ch.stats || {}).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(' ')}.`);
  if (ch.skillProficiencies?.length) lines.push(`Proficient: ${ch.skillProficiencies.join(', ')}.`);
  if (ch.perks?.length) lines.push(`Unlocked perks: ${ch.perks.map((p) => `${p.name} (${clip(p.description, 120)})`).join('; ')}.`);
  if (ch.backstory) lines.push(`Backstory: ${clip(ch.backstory, 1200)}`);
  lines.push('');
  lines.push('## Rulebook & Lore Pinboard (absolute law)');
  const pins = s.lorePinboard || [];
  if (!pins.length) lines.push('(none)');
  for (const p of pins) lines.push(`- ${clip(p, 600)}`);
  return lines.join('\n');
}

function renderTurn(t) {
  const out = [];
  if (t.player) {
    const tag = t.player.ooc ? '[OOC] ' : '';
    const stance = t.player.stance ? ` (${t.player.stance})` : '';
    out.push(`PLAYER${stance}: ${tag}${clip(t.player.text, 600)}`);
  }
  if (t.roll) {
    out.push(`ROLL: ${t.roll.label} = ${t.roll.total} (nat ${t.roll.natural}${t.roll.dc != null ? `, DC ${t.roll.dc}, ${t.roll.success ? 'SUCCESS' : 'FAILURE'}` : ''})${t.roll.damage ? `, damage ${t.roll.damage.total}` : ''}`);
  }
  if (t.narrative) out.push(`DM: ${clip(t.narrative, 1400)}`);
  return out.join('\n');
}

export function renderDynamic(ctx, action) {
  const d = ctx?.dynamic || {};
  const lines = [];
  lines.push('# CURRENT STATE (dynamic)');
  if (d.settings) {
    const st = d.settings;
    const xp = st.xpMode === 'milestone'
      ? `MILESTONE levelling (level ${st.level}; ${st.turnsSinceMilestone} turns since the last milestone, cooldown ${st.milestoneCooldown})`
      : 'DEEDS (engine awards XP automatically)';
    lines.push(`Campaign settings: quests ${st.questsEnabled ? 'ON' : 'OFF'}; experience ${xp}.`);
  }
  if (d.clock) lines.push(`Time: Day ${d.clock.day}, ${String(d.clock.hour).padStart(2, '0')}:${String(d.clock.minute).padStart(2, '0')}, ${d.clock.season}.`);
  if (d.weather) lines.push(`Weather: ${d.weather.type} — ${d.weather.mechanicalEffect}`);
  if (d.location) {
    lines.push(`Location: [${d.location.id}] ${d.location.label} (${d.location.type}). ${clip(d.location.description, 400)}`);
    if (d.location.connections?.length) {
      lines.push(`Connected: ${d.location.connections.map((c) => `[${c.id}] ${c.label} (${c.travelMinutes} min${c.discovered ? '' : ', undiscovered'})`).join('; ')}`);
    }
  }
  if (d.vitals) {
    const v = d.vitals;
    lines.push(`Protagonist vitals: HP ${v.hp}/${v.maxHp}${v.tempHp ? ` (+${v.tempHp} temp)` : ''}, AC ${v.ac}, conditions: ${v.conditions?.length ? v.conditions.join(', ') : 'none'}. ${d.currency?.label || 'Currency'}: ${d.currency?.amount ?? 0}.`);
    if (v.hp === 0) lines.push('The protagonist is at 0 HP and making death saving throws.');
  }
  if (d.equipment?.length) lines.push(`Equipped: ${d.equipment.join(', ')}.`);
  if (d.inventory?.length) lines.push(`Inventory (id: name): ${d.inventory.map((i) => `${i.id}: ${i.name}`).join('; ')}.`);
  if (d.factions?.length) lines.push(`Faction standing: ${d.factions.map((f) => `${f.name} rep ${f.reputation}, heat ${f.heat}`).join('; ')}.`);
  if (d.quests?.length) {
    lines.push('Active quests:');
    for (const q of d.quests) lines.push(`- [${q.id}] ${q.title} (${q.type})${q.deadline ? ` — deadline Day ${q.deadline.day} ${String(q.deadline.hour).padStart(2, '0')}:00` : ''}: ${clip(q.description, 240)}`);
  }
  if (d.companions?.length) {
    lines.push('Companions:');
    for (const c of d.companions) lines.push(`- [${c.id}] ${c.name}, ${c.archetype}, ${c.isRecruited ? 'RECRUITED' : 'not recruited'}, loyalty ${c.loyalty}/100, HP ${c.hp}/${c.maxHp}. ${clip(c.personalityNotes, 160)}`);
  }
  if (d.combat?.inCombat) {
    lines.push(`COMBAT round ${d.combat.round || 1}. Initiative: ${(d.combat.order || []).map((o) => `${o.name} ${o.initiative}`).join(', ')}.`);
    for (const e of d.combat.enemies || []) {
      lines.push(`- Enemy [${e.id}] ${e.name}: ${e.health_tier}, ${e.distance}${e.inspected ? `, AC ${e.revealed_ac}, traits: ${(e.revealed_traits || []).join('; ')}` : ', not inspected'}`);
    }
  }
  if (d.activeNpc) lines.push(`In conversation with: [${d.activeNpc.id}] ${d.activeNpc.name} (${d.activeNpc.attitude}).`);
  if (d.recap?.immediateObjective) lines.push(`Immediate objective: ${d.recap.immediateObjective}`);
  if (d.diary?.length) {
    lines.push('');
    lines.push('## Campaign Diary (earlier chapters)');
    for (const ch of d.diary) lines.push(`### ${ch.title}\n${clip(ch.summary, 1500)}`);
  }
  if (d.codex?.length) {
    lines.push('');
    lines.push('## Relevant Codex entries');
    for (const c of d.codex) lines.push(`- [${c.id}] ${c.name} (${c.type})${c.attitude ? `, ${c.attitude}` : ''}: ${clip(c.summary, 500)}`);
  }
  if (d.recentTurns?.length) {
    lines.push('');
    lines.push('## Recent turns (oldest first)');
    for (const t of d.recentTurns) lines.push(renderTurn(t), '');
  }
  if (d.events?.length) {
    lines.push('');
    lines.push('## World events the engine resolved since the last turn (narrate their consequences)');
    for (const e of d.events) lines.push(`- ${clip(e, 300)}`);
  }
  lines.push('');
  lines.push('# PLAYER ACTION');
  lines.push(renderAction(action));
  return lines.join('\n');
}

export function renderAction(action) {
  const a = action || {};
  const parts = [];
  parts.push(`Kind: ${a.kind || 'action'}`);
  if (a.stance) parts.push(`Stance: ${a.stance}${a.preferredSkill ? ` (pre-selected skill: ${a.preferredSkill})` : ''}`);
  if (a.ooc) parts.push('This is an [OOC] whisper to the DM.');
  if (a.text) parts.push(`Text: ${clip(a.text, 2000)}`);
  if (a.kind === 'roll_result' && a.roll) {
    const r = a.roll;
    parts.push(`Roll for "${r.reason || r.label}": ${r.label} total ${r.total} (natural ${r.natural}, modifier ${r.totalModifier >= 0 ? '+' : ''}${r.totalModifier}, ${r.advantage})${r.dc != null ? ` vs DC ${r.dc} → ${r.success ? 'SUCCESS' : 'FAILURE'} by ${Math.abs(r.margin)}` : ''}${r.critical ? ' — NATURAL 20' : ''}${r.fumble ? ' — NATURAL 1' : ''}.`);
    if (r.damage) parts.push(`Damage rolled by the engine: ${r.damage.total} (${r.damage.expr}${r.damage.critical ? ', critical' : ''}) against ${r.targetName || 'the target'}.`);
  }
  if (a.travel) parts.push(`Travel: the party traveled to [${a.travel.toNodeId}] ${a.travel.toLabel} (${a.travel.minutes} minutes; the engine already advanced the clock). Describe arrival.`);
  if (a.companionActions?.length) parts.push(`Companion actions resolved by the engine: ${a.companionActions.join(' ')}`);
  if (a.engineNotes?.length) parts.push(`Engine notes: ${a.engineNotes.join(' ')}`);
  return parts.join('\n');
}

export function renderWorldForgeRequest(body) {
  const lines = [];
  lines.push(`Genre: ${body.genreLabel || body.genre}`);
  lines.push(`Narrative tone ${body.tone}/10: ${toneLabel(body.tone)}`);
  lines.push(`Rules strictness ${body.strictness}/10: ${strictnessLabel(body.strictness)}`);
  lines.push(`Currency: ${body.currencyLabel}`);
  if (body.character) {
    lines.push(`Protagonist: ${body.character.name}, level ${body.character.level} ${body.character.classOrArchetype}. ${clip(body.character.backstory, 800)}`);
  }
  lines.push(
    body.questsEnabled === false
      ? 'Quests: OFF. Do NOT create a main quest, bounty or imposed objective. Make the opening an open sandbox: hooks, tensions and places to explore, with the player choosing their own direction.'
      : 'Quests: ON. Include a main quest.',
  );
  lines.push(`Player's prompt: ${clip(body.prompt, 3000)}`);
  if (body.importedLore?.length) {
    lines.push('Imported lore (must be honored):');
    for (const l of body.importedLore.slice(0, 40)) lines.push(`- ${clip(l, 500)}`);
  }
  return lines.join('\n');
}

export function renderPerkTreeRequest(body) {
  return [
    `Genre: ${body.genreLabel || body.genre}`,
    `Character concept: ${clip(body.concept, 1500)}`,
    `Archetype: ${body.classOrArchetype}`,
    `Primary abilities (highest first): ${body.primaryAbilities?.join(', ') || 'unspecified'}`,
    `Allowed modifier keys: str, dex, con, int, wis, cha, ac, attack, damage, checks, initiative, maxHp, speed, and skills: ${body.skillKeys?.join(', ')}`,
  ].join('\n');
}

export function renderArchivistRequest(body) {
  const lines = [];
  lines.push(`Campaign: ${body.title} (${body.genre})`);
  if (body.existingCodex?.length) {
    lines.push('Existing Codex (id: name — summary):');
    for (const c of body.existingCodex) lines.push(`- ${c.id}: ${c.name} — ${clip(c.summary, 300)}`);
  }
  if (body.previousChapters?.length) {
    lines.push('Previous chapter titles: ' + body.previousChapters.join(' | '));
  }
  lines.push('');
  lines.push('## Turns to condense into this chapter (oldest first)');
  for (const t of body.turnsToCondense || []) lines.push(renderTurn(t), '');
  lines.push('');
  lines.push('## Still-active recent turns (for the recap only — do not summarize into the chapter)');
  for (const t of body.recentTurns || []) lines.push(renderTurn(t), '');
  if (body.currentState) lines.push(`Current state: ${clip(body.currentState, 1200)}`);
  return lines.join('\n');
}
