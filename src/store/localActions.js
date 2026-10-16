/**
 * Engine-only player actions (no storyteller call) and actions that feed engine effects into
 * the turn pipeline. Every number here is computed by the deterministic engine.
 */
import { useGameStore } from './useGameStore.js';
import { submitAction, makeRollRecord } from './turnRunner.js';
import { commitLocalAction, commitCampaignSettings, toggleEquip, computeTurnState } from '../engine/stateMutator.js';
import { unlockPerk as unlockPerkPure } from '../engine/progression.js';
import { rollDice, buildCheck } from '../engine/diceEngine.js';
import { effectiveMaxHp } from '../engine/diceEngine.js';
import { skillLabel } from '../config/genreSkins.js';
import { canCast, resolveSaveSpell, resolveHealing, resolveAuto, resolveTempHp, spellAttackBonus, spellSaveDc, spellDamageDice, preparedLimit } from '../engine/spellEngine.js';
import {
  merchantState,
  buy as buyPure,
  sell as sellPure,
  haggleCheck,
  applyHaggle,
  craftCheck,
  applyCraft,
  planRest,
  claimSafehouse as claimPure,
  buyUpgrade as buyUpgradePure,
  safehouseBuffs,
  globalSafehouseBuffs,
} from '../engine/economyEngine.js';

const S = () => useGameStore.getState();

function guard() {
  const { campaign, character, busy, retryQueue } = S();
  if (!campaign || !character) throw new Error('Still loading.');
  if (campaign.meta.status !== 'active') throw new Error('This campaign is locked.');
  if (busy) throw new Error('Wait for the storyteller to finish.');
  if (retryQueue) throw new Error('Resolve the pending turn first.');
  return { campaign, character, uid: S().user.uid };
}

async function run(fn, successText) {
  try {
    const out = await fn();
    if (successText) S().toast(typeof successText === 'function' ? successText(out) : successText, 'success');
    return out;
  } catch (err) {
    S().toast(err.message, 'error');
    return null;
  }
}

// ── Inventory ────────────────────────────────────────────────────

export const equipItem = (itemId) =>
  run(async () => {
    const { campaign, character, uid } = guard();
    await commitLocalAction({ uid, campaign, character, characterNext: toggleEquip(character, itemId) });
  });

export const dropItem = (itemId) =>
  run(async () => {
    const { campaign, character, uid } = guard();
    const item = character.inventory.find((i) => i.id === itemId);
    await commitLocalAction({ uid, campaign, character, characterNext: { ...character, inventory: character.inventory.filter((i) => i.id !== itemId) } });
    return item;
  }, (item) => `Dropped ${item?.name || 'item'}.`);

/**
 * Uses a consumable. Healing dice are rolled visibly by the engine.
 * In combat this costs your action: the result is sent to the storyteller as a turn.
 */
export const consumeItem = (itemId) =>
  run(async () => {
    const { campaign, character, uid } = guard();
    const item = character.inventory.find((i) => i.id === itemId);
    if (!item || item.type !== 'consumable') throw new Error('That cannot be used.');
    const heal = item.statModifiers?.heal ? rollDice(item.statModifiers.heal) : null;
    const curesPoison = item.craftingTags?.includes('antidote');
    if (!heal && !curesPoison) throw new Error(`${item.name} has no immediate effect. (Rations are eaten during long rests.)`);
    const text = `Used ${item.name}${heal ? `: healed ${heal.total} (${heal.expr} → [${heal.rolls.join(', ')}]${heal.bonus ? ` ${heal.bonus > 0 ? '+' : ''}${heal.bonus}` : ''})` : ''}${curesPoison ? ' — poison cured' : ''}.`;
    const engine = {
      remove_item_ids: [item.id],
      hp_delta: heal ? heal.total : 0,
      conditions_removed: curesPoison ? ['poisoned'] : [],
    };
    if (campaign.combat?.inCombat || character.vitals.hp <= 0) {
      await submitAction({ kind: 'action', text, engine, engineNotes: [text] });
      return text;
    }
    const r = computeTurnState({ campaign, character, ai: null, engine });
    await commitLocalAction({ uid, campaign, character, characterNext: r.character });
    return text;
  }, (t) => t);

export const unlockPerk = (perkId) =>
  run(async () => {
    const { campaign, character, uid } = guard();
    const next = unlockPerkPure(character, perkId);
    const hpBonus = next.customPerkTree.find((p) => p.id === perkId)?.modifiers?.maxHp || 0;
    if (hpBonus) next.vitals = { ...next.vitals, hp: Math.min(effectiveMaxHp(next), next.vitals.hp + hpBonus) };
    await commitLocalAction({ uid, campaign, character, characterNext: next });
    return next.customPerkTree.find((p) => p.id === perkId);
  }, (p) => `Perk unlocked: ${p?.name}`);

// ── Instant skill checks (DC set visibly by the DM) ─────────────

export function requestSkillCheck(skillKey, intent) {
  const { campaign } = S();
  const label = skillLabel(skillKey, campaign?.skin);
  const what = String(intent || '').trim();
  return submitAction({
    text: what ? `[${label}] ${what}` : `I make a ${label} check.`,
    preferredSkill: skillKey,
    playerLabel: what ? `[${label}] ${what}` : `[${label}] I make a ${label} check.`,
    engineNotes: [`The player explicitly requests a ${label} (${skillKey}) check. You MUST set roll_request.required=true with skill_or_stat "${skillKey}" and a fair, visible DC, narrating only the attempt.`],
  });
}

// ── Travel ───────────────────────────────────────────────────────

export function travelTo(targetNodeId) {
  const { campaign } = S();
  const current = campaign.mapNodes.find((n) => n.id === campaign.worldState.currentNodeId);
  const edge = current?.connectedTo?.find((c) => c.targetNodeId === targetNodeId);
  const target = campaign.mapNodes.find((n) => n.id === targetNodeId);
  if (!edge || !target) {
    S().toast('You can only travel along known routes from your current location.', 'warning');
    return false;
  }
  if (campaign.combat?.inCombat) {
    S().toast('You cannot travel during combat.', 'warning');
    return false;
  }
  return submitAction({
    kind: 'travel',
    text: `Travel to ${target.label}`,
    travel: { toNodeId: target.id, toLabel: target.label, minutes: edge.travelMinutes },
    engine: { travelToNodeId: target.id, time_advance_minutes: edge.travelMinutes },
  });
}

// ── Merchant ─────────────────────────────────────────────────────

async function saveMerchant(state, characterNext = null) {
  const { campaign, character, uid } = guard();
  const nodeId = campaign.worldState.currentNodeId;
  const { fresh, banned, ...persist } = state;
  await commitLocalAction({
    uid,
    campaign,
    character,
    characterNext,
    campaignPatch: { merchantVisits: { ...(campaign.merchantVisits || {}), [nodeId]: persist } },
  });
}

export const merchantBuy = (stockId) =>
  run(async () => {
    const { campaign, character } = guard();
    const state = merchantState(campaign);
    const r = buyPure(character, state, stockId);
    await saveMerchant(r.state, r.character);
    return r;
  }, (r) => `Bought ${r.item.name} for ${r.price}.`);

export const merchantSell = (itemId) =>
  run(async () => {
    const { campaign, character } = guard();
    const state = merchantState(campaign);
    const r = sellPure(character, state, itemId, globalSafehouseBuffs(campaign).sellBonusPct || 0);
    await saveMerchant(state, r.character);
    return r;
  }, (r) => `Sold ${r.item.name} for ${r.price}.`);

export function startHaggle(skill) {
  const { campaign, character } = S();
  const state = merchantState(campaign);
  if (state.haggle) {
    S().toast('Once per visit — you already haggled here.', 'warning');
    return;
  }
  const check = haggleCheck(character, skill, campaign);
  S().openRollPrompt({
    origin: 'haggle',
    title: `Haggle — ${check.label}`,
    subtitle: check.reason,
    check,
    onResolve: async ({ result }) => {
      const { campaign: camp } = S();
      const next = applyHaggle(merchantState(camp), skill, result, camp.worldState.clock.day);
      await saveMerchant(next);
      if (next.haggle.success) S().toast(`Deal! ${next.haggle.discountPct}% off for this visit.`, 'success');
      else if (next.banned) S().toast(`The merchant throws you out — banned for 3 days.`, 'error');
      else S().toast('The merchant won’t budge.', 'warning');
    },
  });
}

// ── Crafting ─────────────────────────────────────────────────────

export function startCraft(recipe, inputIds, targetId = null) {
  const { campaign, character } = S();
  const bonus = safehouseBuffs(campaign).craftBonus || 0;
  const check = craftCheck(character, recipe, campaign, bonus);
  S().openRollPrompt({
    origin: 'craft',
    title: recipe.label,
    subtitle: check.reason,
    check,
    onResolve: async ({ result }) =>
      run(async () => {
        const { campaign: camp, character: ch, uid } = guard();
        const r = applyCraft(ch, recipe, { inputIds, targetId, result, genre: camp.meta.genreTheme });
        // Crafting takes an hour of in-game time.
        const timed = computeTurnState({ campaign: camp, character: r.character, ai: null, engine: { time_advance_minutes: 60 } });
        await commitLocalAction({ uid, campaign: camp, character: ch, characterNext: timed.character, campaignPatch: { worldState: timed.campaign.worldState, quests: timed.campaign.quests, pendingEvents: timed.campaign.pendingEvents } });
        S().toast(r.text, r.outcome === 'created' || r.outcome === 'upgraded' ? 'success' : 'warning');
      }),
  });
}

// ── Rest & Campfire ──────────────────────────────────────────────

export function rest(kind) {
  const { campaign, character } = S();
  const plan = planRest(kind, character, campaign);
  if (plan.error) {
    S().toast(plan.error, 'warning');
    return false;
  }
  S().closeDrawer();
  return submitAction({
    kind: 'event',
    text: kind === 'long' ? 'I make camp for a long rest.' : 'I take a short rest.',
    engine: plan.engine,
    engineNotes: [plan.summary, 'The engine already applied the rest mechanics; narrate the rest and any interruptions organically.'],
  });
}

export function tendWounds() {
  const { campaign, character } = S();
  const conds = (character.vitals.conditions || []).filter((c) => ['poisoned', 'frightened', 'exhausted', 'blinded'].includes(c));
  if (!conds.length) {
    S().toast('You have no conditions to treat.', 'info');
    return;
  }
  const check = buildCheck({ character, skillOrStat: 'medicine', dc: 12, skin: campaign.skin, reason: `Tend wounds: success removes ${conds[0]}. Takes 30 minutes.` });
  S().openRollPrompt({
    origin: 'tend_wounds',
    title: 'Tend Wounds',
    subtitle: check.reason,
    check,
    onResolve: async ({ result }) =>
      run(async () => {
        const { campaign: camp, character: ch, uid } = guard();
        const r = computeTurnState({ campaign: camp, character: ch, ai: null, engine: { time_advance_minutes: 30, conditions_removed: result.success ? [conds[0]] : [] } });
        await commitLocalAction({ uid, campaign: camp, character: ch, characterNext: r.character, campaignPatch: { worldState: r.campaign.worldState, quests: r.campaign.quests, pendingEvents: r.campaign.pendingEvents } });
        S().toast(result.success ? `Treated: ${conds[0]} removed.` : 'Your treatment did not take.', result.success ? 'success' : 'warning');
      }),
  });
}

export function companionTalk(companionId, topic) {
  const { character } = S();
  const c = character.companionRoster.find((x) => x.id === companionId);
  if (!c) return false;
  S().closeDrawer();
  return submitAction({
    kind: 'companion_talk',
    text: `By the campfire, I talk one-on-one with ${c.name}${topic ? ` about ${topic}` : ''}.`,
    stance: 'Diplomatic',
    engine: { time_advance_minutes: 30 },
    engineNotes: [`This is a private campfire conversation with companion [${c.id}] ${c.name} (loyalty ${c.loyalty}/100). Reflect their personality; adjust loyalty_delta via companion_updates based on how the player treats them.`],
  });
}

export const claimSafehouse = (name) =>
  run(async () => {
    const { campaign, character, uid } = guard();
    const patch = claimPure(campaign, name);
    await commitLocalAction({ uid, campaign, character, campaignPatch: patch });
    return patch.worldState.safehouse.name;
  }, (n) => `${n} is now your Home Base.`);

export const buySafehouseUpgrade = (upgradeId) =>
  run(async () => {
    const { campaign, character, uid } = guard();
    const r = buyUpgradePure(campaign, character, upgradeId);
    await commitLocalAction({ uid, campaign, character, characterNext: r.character, campaignPatch: { worldState: r.worldState } });
    return r.upgrade;
  }, (u) => `Built: ${u.label}`);

// ── Minigame payouts ─────────────────────────────────────────────

/**
 * Applies a tavern minigame currency result (engine-only). A win loosens tongues: the next
 * storyteller turn is asked to deliver a fresh rumor via rumors_learned.
 */
export const settleMinigame = ({ currencyDelta, game, minutes = 30 }) =>
  run(async () => {
    const { campaign, character, uid } = guard();
    const r = computeTurnState({ campaign, character, ai: null, engine: { currency_delta: currencyDelta, time_advance_minutes: minutes } });
    const pendingEvents = [...(r.campaign.pendingEvents || [])];
    if (currencyDelta > 0) {
      pendingEvents.push(`The player just won ${currencyDelta} ${character.currency.label} at ${game}; a loose-lipped loser owes them a secret — deliver one new local rumor via rumors_learned.`);
    }
    await commitLocalAction({ uid, campaign, character, characterNext: r.character, campaignPatch: { worldState: r.campaign.worldState, quests: r.campaign.quests, pendingEvents } });
    return currencyDelta;
  });

/** A failed cheat starts a bar fight — handed to the storyteller as a turn. */
export function barFight(stakeLost, cheatRoll) {
  S().closeDrawer();
  return submitAction({
    kind: 'event',
    text: 'I am caught cheating at the gambling table!',
    roll: cheatRoll ? makeRollRecord(cheatRoll.check, cheatRoll.result) : null,
    engine: { currency_delta: -stakeLost },
    engineNotes: [`The player was caught cheating (failed Sleight of Hand) and lost a ${stakeLost} stake. A bar fight erupts — start combat with angry patrons (in_combat=true).`],
  });
}

// ── Settings & Pinboard ──────────────────────────────────────────

export const updateSettings = (patch) =>
  run(async () => {
    const { campaign, user } = S();
    await commitCampaignSettings({ uid: user.uid, campaign, patch });
  });

export const addPin = (text) =>
  run(async () => {
    const { campaign, user } = S();
    const t = String(text || '').trim().slice(0, 600);
    if (!t) throw new Error('Empty pin.');
    await commitCampaignSettings({ uid: user.uid, campaign, patch: { lorePinboard: [...(campaign.lorePinboard || []), t].slice(0, 50) } });
  }, 'Pinned to the Rulebook.');

export const removePin = (index) =>
  run(async () => {
    const { campaign, user } = S();
    await commitCampaignSettings({ uid: user.uid, campaign, patch: { lorePinboard: (campaign.lorePinboard || []).filter((_, i) => i !== index) } });
  });

// ── Spellcasting ─────────────────────────────────────────────────

function spellTarget(campaign, targetId) {
  const enemies = (campaign.combat?.enemies || []).filter((e) => e.health_tier !== 'Defeated');
  return enemies.find((e) => e.id === targetId) || enemies[0] || null;
}

/**
 * Casts a spell. All math is the engine's and visible:
 *  - attack spells roll a spell attack (immediately vs a revealed AC, otherwise the storyteller calls it with the true AC);
 *  - save spells roll the target's save openly against your DC;
 *  - healing, Magic Missile and temporary HP are rolled here;
 *  - a leveled spell spends a slot.
 */
export function castSpell(spellId, { targetId = null } = {}) {
  const { campaign, character, busy, retryQueue } = S();
  if (!campaign || !character || busy || retryQueue || campaign.meta.status !== 'active') {
    S().toast('You cannot cast right now.', 'warning');
    return false;
  }
  const v = canCast(character, spellId);
  if (!v.ok) {
    S().toast(v.error, 'warning');
    return false;
  }
  const spell = v.spell;
  const slot = v.slotLevel ? { spell_slot_used: v.slotLevel } : {};
  const target = spellTarget(campaign, targetId);
  const term = character.terms?.spell || 'spell';
  const cast = `I cast ${spell.name}`;
  S().setMobileSheet?.(null);

  if (spell.kind === 'attack') {
    if (target?.inspected && Number.isInteger(target.revealed_ac)) {
      const check = buildCheck({ character, skillOrStat: { kind: 'attack', key: 'spell', spellId: spell.id }, spell, dc: target.revealed_ac, weather: campaign.worldState?.weather, skin: campaign.skin, reason: `${spell.name} at ${target.name} (revealed AC ${target.revealed_ac})` });
      S().openRollPrompt({
        origin: 'ai',
        title: check.label,
        subtitle: check.reason,
        check,
        withDamage: true,
        onResolve: ({ result, damage }) =>
          submitAction({
            kind: 'roll_result',
            text: `${cast} at ${target.name}: ${result.total} vs AC ${target.revealed_ac} — ${result.success ? `hit for ${damage?.total ?? 0} ${spell.damageType}` : 'miss'}.`,
            roll: makeRollRecord(check, result, { damage: damage || null, targetId: target.id, targetName: target.name }),
            engine: slot,
          }),
      });
      return true;
    }
    return submitAction({
      text: `${cast}${target ? ` at ${target.name}` : ''}.`,
      stance: 'Aggressive',
      engine: slot,
      engineNotes: [
        `The player casts the ${term} ${spell.name} (${spell.attackType} spell attack +${spellAttackBonus(character, spell.id)}, ${spellDamageDice(character, spell)} ${spell.damageType} on a hit)${target ? ` at [${target.id}] ${target.name}` : ''}. ${spell.desc} Request roll_request skill_or_stat "spell_attack:${spell.id}" with dc = the target's true AC; narrate only the casting.`,
      ],
    });
  }

  if (spell.kind === 'save' && target) {
    const r = resolveSaveSpell(character, spell);
    const outcome = `${target.name} rolls a ${spell.save.toUpperCase()} save: d20 ${r.save.natural} + ${r.save.bonus} = ${r.save.total} vs DC ${r.save.dc} — ${r.save.saved ? 'saved' : 'failed'}.${r.damage ? ` Damage ${r.damage.expr} → [${r.damage.rolls.join(', ')}] = ${r.damage.total}; ${r.dealt} ${spell.damageType} damage dealt.` : ''}`;
    S().toast(outcome, r.save.saved ? 'info' : 'success', 7000);
    return submitAction({
      kind: 'roll_result',
      text: `${cast} at ${target.name}: ${r.save.saved ? 'they resist' : 'it lands'}${r.damage ? ` — ${r.dealt} ${spell.damageType} damage` : ''}.`,
      engine: slot,
      roll: {
        label: `${spell.name} — ${target.name}'s ${spell.save.toUpperCase()} save`,
        kind: 'spell_save',
        key: spell.id,
        faces: [r.save.natural],
        natural: r.save.natural,
        total: r.save.total,
        dc: r.save.dc,
        success: !r.save.saved,
        margin: r.save.dc - r.save.total,
        critical: false,
        fumble: false,
        totalModifier: r.save.bonus,
        advantage: 'normal',
        breakdown: [{ label: 'Enemy save bonus', value: r.save.bonus }],
        reason: spell.desc,
        damage: r.damage ? { total: r.dealt, expr: r.damage.expr, rolls: r.damage.rolls } : null,
        targetId: target.id,
        targetName: target.name,
      },
      engineNotes: [`Engine resolved ${spell.name}: ${outcome} Narrate exactly this result and move the target's health_tier for ${r.dealt} damage.`],
    });
  }

  if (spell.kind === 'auto' && target) {
    const dmg = resolveAuto(character, spell);
    return submitAction({
      kind: 'roll_result',
      text: `${cast} at ${target.name}: ${dmg.total} ${spell.damageType} damage.`,
      engine: slot,
      engineNotes: [`Engine resolved ${spell.name} (always hits): ${dmg.expr} → [${dmg.rolls.join(', ')}]${dmg.bonus ? ` +${dmg.bonus}` : ''} = ${dmg.total} ${spell.damageType} damage to [${target.id}] ${target.name}. Narrate it and move the health_tier accordingly.`],
    });
  }

  if (spell.kind === 'heal') {
    const h = resolveHealing(character, spell);
    const text = `${cast} on myself: healed ${h.total} (${h.roll.expr} → [${h.roll.rolls.join(', ')}] + ${h.mod}${h.life ? ` + ${h.life} Disciple of Life` : ''}).`;
    return submitAction({ text, engine: { ...slot, hp_delta: h.total }, engineNotes: [`${text} The engine already applied the healing; narrate it.`] });
  }

  if (spell.kind === 'temp_hp') {
    const t = resolveTempHp(spell);
    const text = `${cast}: ${t.total} temporary HP (${t.expr} → [${t.rolls.join(', ')}]${t.bonus ? ` +${t.bonus}` : ''}).`;
    return submitAction({ text, engine: { ...slot, set_temp_hp: t.total }, engineNotes: [`${text} The engine already applied it; narrate it.`] });
  }

  // Utility spells (and damage spells cast with no enemy in view) are narrated by the storyteller.
  const effect = spell.effect ? { active_effect: { id: spell.effect, name: spell.name, concentration: spell.concentration } } : {};
  const dc = spell.kind === 'save' || /save\)/i.test(spell.desc) ? ` Save DC ${spellSaveDc(character, spell.id)} (the target's save must be requested as a visible roll or resolved openly; never decide it secretly).` : '';
  return submitAction({
    text: `${cast}.`,
    engine: { ...slot, ...effect },
    engineNotes: [`The player casts the ${term} ${spell.name}: ${spell.desc}${spell.concentration ? ' (concentration)' : ''}.${dc}${spell.effect ? ' The engine is tracking its mechanical effect.' : ''} Narrate the effect.`],
  });
}

/** Re-prepare spells (Cleric, Druid, Wizard) outside of combat. */
export const prepareSpells = (ids) =>
  run(async () => {
    const { campaign, character, uid } = guard();
    if (campaign.combat?.inCombat) throw new Error('You cannot change prepared spells during combat.');
    const sc = character.spellcasting;
    if (!sc) throw new Error('No spellcasting.');
    const pool = sc.spellbook?.length ? sc.spellbook : null;
    const limit = preparedLimit(character);
    const clean = Array.from(new Set(ids)).filter((id) => (!pool || pool.includes(id)) && !(sc.alwaysPrepared || []).includes(id)).slice(0, limit);
    if (!clean.length) throw new Error('Prepare at least one spell.');
    await commitLocalAction({ uid, campaign, character, characterNext: { ...character, spellcasting: { ...sc, prepared: clean } } });
  }, 'Prepared spells updated.');
