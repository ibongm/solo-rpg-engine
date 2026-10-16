/**
 * Turn orchestration: Retry Queue → /api/dm-turn → stateMutator commit → side effects
 * (Auto-Archivist, Auto-Director images, permadeath). Lives outside React so any component
 * (Action Deck, Map, Dice Prompt, Campfire…) can trigger turns the same way.
 */
import { useGameStore } from './useGameStore.js';
import { callApi } from '../firebase/api.js';
import { buildDmContext, buildArchivistPayload, shouldArchive } from '../engine/contextBuilder.js';
import { commitTurn, revertLastTurn, commitDeath, commitArchive, commitSceneImage, commitLocalAction } from '../engine/stateMutator.js';
import { computeTextCost, computeImageCost } from '../config/models.js';
import { deathChronicleMarkdown } from '../engine/exporters.js';
import { buildCheck, rollDice, totalManualDice, damageExpression } from '../engine/diceEngine.js';
import { resolveDeathSave, isDying } from '../engine/combatEngine.js';
import { loadCampaignSubcollections } from '../firebase/db.js';
import { uid } from '../engine/rng.js';

const S = () => useGameStore.getState();

function nextTurnIndex(turns) {
  return turns.reduce((m, t) => Math.max(m, t.index ?? 0), -1) + 1;
}

function toastEvents(events) {
  const { toast } = S();
  const important = events.filter((e) => ['milestone', 'level_up', 'xp', 'recruited', 'departed', 'quest_new', 'quest_completed', 'quest_failed', 'quest_expired', 'downed', 'revived', 'loot', 'map', 'stable', 'death', 'massive_damage'].includes(e.type));
  for (const e of important.slice(0, 4)) toast(e.text, e.tone === 'danger' ? 'error' : e.tone === 'success' ? 'success' : e.tone === 'warning' ? 'warning' : 'info');
}

/** Serializes a resolved check into the persistent roll record stored on the turn. */
export function makeRollRecord(check, result, extra = {}) {
  return {
    label: check.label,
    kind: check.kind,
    key: check.key,
    faces: result.faces,
    natural: result.natural,
    total: result.total,
    dc: result.dc ?? null,
    success: result.success,
    margin: result.margin,
    critical: result.critical,
    fumble: result.fumble,
    totalModifier: check.totalModifier,
    advantage: check.advantage,
    breakdown: check.breakdown,
    reason: check.reason || '',
    ...extra,
  };
}

function canAct() {
  const { campaign, character, busy, retryQueue } = S();
  if (!campaign || !character) return 'The campaign is still loading.';
  if (campaign.meta?.status !== 'active') return 'This campaign is locked.';
  if (busy) return 'The storyteller is still working…';
  if (retryQueue) return 'Resolve the pending turn first (Retry or Discard).';
  return null;
}

/**
 * Submits a turn. Writes the Retry Queue to localStorage BEFORE calling /api/dm-turn and
 * clears it only after the Firestore batch commits.
 * @param {object} p
 * @param {'action'|'roll_result'|'travel'|'death_save'|'event'|'companion_talk'} [p.kind]
 */
export async function submitAction({ kind = 'action', text = '', stance = null, preferredSkill = null, ooc = false, roll = null, engine = {}, travel = null, companionActions = [], engineNotes = [], playerLabel = null }) {
  const blocked = canAct();
  if (blocked) {
    S().toast(blocked, 'warning');
    return false;
  }
  const { campaign, character, turns, diary, codex } = S();
  if (isDying(character) && kind !== 'death_save') {
    S().toast('You are dying — roll a death saving throw first.', 'warning');
    return false;
  }
  const turnId = uid('turn');
  const action = { kind, text: String(text || '').slice(0, 4000), stance, preferredSkill, ooc: Boolean(ooc), roll, travel, companionActions, engineNotes };
  const context = buildDmContext({ campaign, character, turns, diary, codex });
  const request = { model: campaign.meta.modelPref, context, action, cacheRef: campaign.cacheRef || null };
  const player = {
    kind,
    text: playerLabel || action.text,
    stance,
    ooc: Boolean(ooc),
  };
  const queue = {
    turnId,
    campaignId: campaign.id,
    request,
    engine: { ...engine, consumedEvents: context.dynamic.events },
    player,
    roll,
    response: null,
    status: 'pending',
    error: null,
    createdAt: Date.now(),
  };
  S().setRetryQueue(queue); // persisted synchronously by zustand/persist
  return runQueue();
}

/** Executes (or re-executes) the persisted pending turn. */
export async function runQueue() {
  const q = S().retryQueue;
  if (!q) return false;
  const { campaign, user } = S();
  if (!campaign || campaign.id !== q.campaignId) return false;
  S().setBusy(true, q.request.action.kind === 'roll_result' ? 'The dice have spoken…' : 'The storyteller weaves…');
  try {
    // Idempotency: if the turn already landed in Firestore, the queue is stale.
    if (S().turns.some((t) => t.id === q.turnId)) {
      S().clearRetryQueue();
      return true;
    }
    let response = q.response;
    if (!response) {
      try {
        response = await callApi('dm-turn', q.request);
      } catch (err) {
        S().setRetryQueue({ ...q, status: 'failed', error: err.message, retryable: err.retryable !== false });
        S().toast(err.message, 'error', 8000);
        return false;
      }
      S().setRetryQueue({ ...q, response, status: 'committing' });
    }
    const usage = response.usage || null;
    const costUSD = usage ? computeTextCost(response.model, usage) : 0;
    const { campaign: camp, character, codex, turns } = S();
    let result;
    try {
      result = await commitTurn({
        uid: user.uid,
        campaign: camp,
        character,
        codex,
        turn: {
          id: q.turnId,
          index: nextTurnIndex(turns),
          player: q.player,
          roll: q.roll,
          model: response.model,
          imageUrl: null,
          createdAt: q.createdAt,
        },
        ai: response.result,
        engine: q.engine,
        usage,
        costUSD,
        cacheRef: response.cacheRef ?? null,
      });
    } catch (err) {
      S().setRetryQueue({ ...S().retryQueue, status: 'failed', error: `Saving failed: ${err.message}`, retryable: true });
      S().toast(`Could not save the turn: ${err.message}`, 'error', 8000);
      return false;
    }
    S().clearRetryQueue();
    if (usage) S().addSessionTelemetry({ inputTokens: usage.inputTokens, outputTokens: (usage.outputTokens || 0) + (usage.thoughtTokens || 0), cachedTokens: usage.cachedTokens, costUSD });
    S().resetDraft();
    toastEvents(result.events);

    if (result.died) {
      await handleDeath(deathCause(result.events, response.result));
      return true;
    }
    afterTurn({ turnId: q.turnId, ai: response.result, turnCount: S().turns.length + 1 });
    return true;
  } finally {
    S().setBusy(false);
  }
}

function deathCause(events, ai) {
  const enemies = (ai?.combat_state?.enemies || []).filter((e) => e.health_tier !== 'Defeated').map((e) => e.name);
  const massive = events.find((e) => e.type === 'massive_damage');
  if (enemies.length) return `Slain by ${enemies.join(' and ')}${massive ? ' (massive damage)' : ''}.`;
  if (massive) return 'Killed outright by massive damage.';
  const text = String(ai?.narrative_text || '').split(/(?<=[.!?])\s+/)[0];
  return text ? text.slice(0, 200) : 'Succumbed to their wounds.';
}

/** Background side effects after a successful turn. */
function afterTurn({ turnId, ai, turnCount }) {
  const { campaign } = S();
  if (campaign?.meta?.imageMode === 'auto' && ai?.scene_visual_prompt) {
    // Auto-Director: paint scenes on combat starts, new places, and every 5th turn.
    const notable = ai.combat_state?.in_combat || ai.state_updates?.new_map_node || turnCount % 5 === 0;
    if (notable) paintScene(turnId, ai.scene_visual_prompt).catch(() => {});
  }
  setTimeout(() => {
    if (shouldArchive(S().turns)) runArchivist().catch(() => {});
  }, 1500);
}

export function discardQueue() {
  S().clearRetryQueue();
  S().toast('Pending action discarded — nothing was applied.', 'info');
}

/**
 * Edit Last Turn (anti-glitch): reverts the most recent turn's state changes and regenerates it.
 * A locked dice result is reused so rolls cannot be fished.
 */
export async function editLastTurn(newText) {
  const { campaign, turns, user, busy, retryQueue } = S();
  if (busy || retryQueue) return false;
  const last = turns.slice().sort((a, b) => (b.index ?? 0) - (a.index ?? 0))[0];
  if (!last || last.id !== campaign.lastTurnId || !campaign.lastTurnEditable || !last.player) {
    S().toast('Only the most recent turn can be edited, before any other action.', 'warning');
    return false;
  }
  S().setBusy(true, 'Rewriting the last turn…');
  try {
    await revertLastTurn({ uid: user.uid, campaign, turn: last });
  } catch (err) {
    S().toast(err.message, 'error');
    S().setBusy(false);
    return false;
  }
  // Wait for snapshots to reflect the reverted state before rebuilding the context.
  await waitFor(() => !S().turns.some((t) => t.id === last.id) && S().campaign?.lastTurnId !== last.id, 6000);
  S().setBusy(false);
  return submitAction({
    kind: last.player.kind || 'action',
    text: newText ?? last.player.text,
    stance: last.player.stance,
    ooc: last.player.ooc,
    roll: last.roll || null,
    playerLabel: null,
  });
}

function waitFor(predicate, timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (predicate() || Date.now() - start > timeoutMs) resolve();
      else setTimeout(tick, 100);
    };
    tick();
  });
}

// ── Dice prompts ─────────────────────────────────────────────────

/**
 * Opens the visible dice prompt for the AI's pending roll_request.
 */
export function promptPendingRoll() {
  const { campaign, character } = S();
  const req = campaign?.pendingRoll;
  if (!req) return;
  const check = buildCheck({
    character,
    skillOrStat: req.skill_or_stat,
    dc: req.dc,
    advantage: req.advantage_state || 'normal',
    weather: campaign.worldState?.weather,
    skin: campaign.skin,
    reason: req.reason,
  });
  const target = check.isAttack ? (campaign.combat?.enemies || []).find((e) => e.health_tier !== 'Defeated' && req.reason?.toLowerCase().includes(e.name.toLowerCase())) || (campaign.combat?.enemies || []).find((e) => e.health_tier !== 'Defeated') : null;
  S().openRollPrompt({
    origin: 'ai',
    title: check.label,
    subtitle: req.reason,
    check,
    withDamage: check.isAttack,
    onResolve: ({ result, damage }) => {
      const roll = makeRollRecord(check, result, damage ? { damage, targetId: target?.id, targetName: target?.name } : target ? { targetId: target.id, targetName: target.name } : {});
      return submitAction({
        kind: 'roll_result',
        text: `${check.label}: ${result.total}${result.dc != null ? ` vs DC ${result.dc} — ${result.success ? 'success' : 'failure'}` : ''}${damage ? `, ${damage.total} damage` : ''}`,
        roll,
      });
    },
  });
}

/** Rolls weapon damage for a hit (digital) or totals manually entered dice. */
export function resolveDamage(check, character, { critical, manualFaces = null }) {
  const { expr } = damageExpression(check, character);
  return manualFaces ? totalManualDice(expr, manualFaces, { critical }) : rollDice(expr, { critical });
}

/** Death saving throw — engine-only resolution, then the storyteller narrates (unless final). */
export function promptDeathSave() {
  const { character } = S();
  const check = {
    kind: 'death_save',
    key: 'death_save',
    label: 'Death Saving Throw',
    ability: null,
    proficient: false,
    dc: 10,
    advantage: 'normal',
    requestedAdvantage: 'normal',
    conditionNotes: [],
    statMod: 0,
    proficiency: 0,
    weatherMod: 0,
    itemMod: 0,
    perkMod: 0,
    extraMod: 0,
    totalModifier: 0,
    breakdown: [{ label: 'No modifiers (5e)', value: 0 }],
    isAttack: false,
    isRanged: false,
    weapon: null,
    reason: `Successes ${character.vitals.deathSaves?.successes || 0}/3 · Failures ${character.vitals.deathSaves?.failures || 0}/3. Natural 20: regain 1 HP. Natural 1: two failures.`,
  };
  S().openRollPrompt({
    origin: 'death_save',
    title: 'Death Saving Throw',
    subtitle: check.reason,
    check,
    onResolve: async ({ result }) => {
      const { character: ch, campaign, user } = S();
      const r = resolveDeathSave(ch.vitals, result.natural);
      toastEvents(r.events);
      const roll = makeRollRecord(check, { ...result, success: r.outcome !== 'failure' && r.outcome !== 'dead' }, { deathSave: r.outcome });
      if (r.outcome === 'dead') {
        await commitLocalAction({ uid: user.uid, campaign, character: ch, characterNext: { ...ch, vitals: r.vitals } });
        await handleDeath(campaign.combat?.inCombat ? `Bled out in battle against ${(campaign.combat.enemies || []).filter((e) => e.health_tier !== 'Defeated').map((e) => e.name).join(' and ') || 'their foes'}.` : 'Succumbed to their wounds after failing three death saves.');
        return true;
      }
      return submitAction({
        kind: 'death_save',
        text: r.events.map((e) => e.text).join(' '),
        roll,
        engine: { vitals: r.vitals, time_advance_minutes: r.stableHours * 60 },
      });
    },
  });
}

// ── Permadeath ───────────────────────────────────────────────────

export async function handleDeath(causeOfDeath) {
  const { campaign, character, user } = S();
  if (!campaign || !character) return;
  try {
    const subs = await loadCampaignSubcollections(user.uid, campaign.id);
    const turnsSurvived = (campaign.archivedTurnCount || 0) + subs.turns.length;
    const finalCharacter = { ...character, status: 'fallen', vitals: { ...character.vitals, hp: 0, deathSaves: { successes: 0, failures: 3 } } };
    const markdownChronicle = deathChronicleMarkdown({ campaign, character: finalCharacter, ...subs, causeOfDeath, turnsSurvived });
    await commitDeath({ uid: user.uid, campaign, character: finalCharacter, causeOfDeath, markdownChronicle, turnsSurvived });
    S().openModal('death', { causeOfDeath, name: character.name, turnsSurvived });
  } catch (err) {
    S().toast(`Failed to record the death: ${err.message}`, 'error', 10000);
  }
}

// ── Auto-Archivist ───────────────────────────────────────────────

export async function runArchivist() {
  const st = S();
  if (st.archivistRunning || !st.campaign || !shouldArchive(st.turns)) return;
  st.setArchivistRunning(true);
  try {
    const { campaign, character, turns, diary, codex, user } = S();
    const { toCondense, payload } = buildArchivistPayload({ campaign, character, turns, diary, codex });
    // Never condense the editable last turn.
    const ids = toCondense.map((t) => t.id).filter((id) => id !== campaign.lastTurnId);
    if (!ids.length) return;
    const res = await callApi('archivist', { ...payload, model: campaign.meta.modelPref }, { timeoutMs: 180_000 });
    const costUSD = computeTextCost(res.model, res.usage || {});
    const r = res.result;
    await commitArchive({
      uid: user.uid,
      campaign: S().campaign,
      chapter: {
        index: (campaign.chapterCount || 0) + 1,
        title: r.chapter_title,
        summary: r.chapter_summary,
        keyEvents: r.key_events || [],
        turnRange: [toCondense[0]?.index ?? 0, toCondense[toCondense.length - 1]?.index ?? 0],
      },
      condensedTurnIds: ids,
      codexUpserts: r.codex_upserts || [],
      codex: S().codex,
      sessionRecap: {
        bullets: (r.session_recap?.bullets || []).slice(0, 3),
        immediateObjective: r.session_recap?.immediate_objective || '',
        presentNPCs: r.session_recap?.present_npcs || [],
      },
      usage: res.usage,
      costUSD,
    });
    S().addSessionTelemetry({ inputTokens: res.usage?.inputTokens, outputTokens: res.usage?.outputTokens, cachedTokens: res.usage?.cachedTokens, costUSD });
    S().toast(`The Archivist recorded a new diary chapter: “${r.chapter_title}”.`, 'success');
  } catch (err) {
    S().toast(`Archivist will retry later: ${err.message}`, 'warning');
  } finally {
    S().setArchivistRunning(false);
  }
}

// ── Scene paintings ──────────────────────────────────────────────

export async function paintScene(turnId, prompt) {
  const { campaign, user, paintingTurnIds } = S();
  if (!campaign || paintingTurnIds[turnId] || campaign.meta?.imageMode === 'off') return;
  S().setPainting(turnId, true);
  try {
    const res = await callApi('paint-scene', { campaignId: campaign.id, turnId, prompt, genre: campaign.meta.genreTheme }, { timeoutMs: 120_000 });
    const costUSD = computeImageCost(res.usage || {});
    await commitSceneImage({ uid: user.uid, campaign, turnId, imageUrl: res.imageUrl, usage: res.usage, costUSD });
    S().addSessionTelemetry({ inputTokens: res.usage?.inputTokens, outputTokens: res.usage?.outputTokens, costUSD });
  } catch (err) {
    S().toast(`Scene painting failed: ${err.message}`, 'warning');
  } finally {
    S().setPainting(turnId, false);
  }
}
