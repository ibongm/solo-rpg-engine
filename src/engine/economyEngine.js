/**
 * Economy & Downtime Engine — merchant stock, prices, haggling, crafting, rests, safehouse.
 * Pure and deterministic; every check it needs is built with diceEngine and shown to the player.
 */
import { MERCHANT_TEMPLATES, RECIPES, SAFEHOUSE_UPGRADES } from '../config/catalog.js';
import { itemFromTemplate } from './progression.js';
import { buildCheck } from './diceEngine.js';
import { shortRestHealing } from './combatEngine.js';
import { effectiveMaxHp } from './diceEngine.js';
import { seededRng, shuffle } from './rng.js';

export const HAGGLE_DC = 13;
export const HAGGLE_DISCOUNT = { persuasion: 20, intimidation: 25 };
export const BAN_DAYS = 3;
export const SELL_RATE = 0.5;
export const SHOP_SIZE = 9;
export const STRICT_RATIONS = 6;

const clone = (o) => JSON.parse(JSON.stringify(o));

// ── Merchant ─────────────────────────────────────────────────────

/** Deterministic stock for a node visit. Rations are always available. */
export function generateShopStock({ genre, nodeId, visitId, seedKey }) {
  const templates = MERCHANT_TEMPLATES[genre] || MERCHANT_TEMPLATES.fantasy;
  const rng = seededRng(`${seedKey}:shop:${nodeId}:${visitId}`);
  const ration = templates.find((t) => t.craftingTags?.includes('ration'));
  const others = shuffle(templates.filter((t) => t !== ration), rng).slice(0, SHOP_SIZE - 1);
  const stock = [ration, ...others].filter(Boolean).map((tpl, i) => ({ ...itemFromTemplate(tpl), id: `stock_${nodeId}_${i}` }));
  return stock;
}

/** Merchant state for the current visit (fresh stock each visit; bans persist by day). */
export function merchantState(campaign) {
  const nodeId = campaign.worldState.currentNodeId;
  const visitId = campaign.worldState.visitId || 'initial';
  const saved = campaign.merchantVisits?.[nodeId];
  const day = campaign.worldState.clock.day;
  const bannedUntilDay = saved?.bannedUntilDay ?? 0;
  if (saved && saved.visitId === visitId) return { ...saved, banned: day < bannedUntilDay };
  return {
    visitId,
    stock: generateShopStock({ genre: campaign.meta.genreTheme, nodeId, visitId, seedKey: campaign.seedKey || 'seed' }),
    haggle: null,
    bannedUntilDay,
    banned: day < bannedUntilDay,
    fresh: true,
  };
}

export function buyPrice(item, discountPct = 0) {
  return Math.max(1, Math.ceil(((item.value || 1) * (100 - discountPct)) / 100));
}

export function sellPrice(item, sellBonusPct = 0) {
  const v = Math.floor((item.value || 0) * SELL_RATE * (1 + sellBonusPct / 100));
  return item.value > 0 ? Math.max(1, v) : 0;
}

/** Applies a purchase. Returns { character, state } or throws. */
export function buy(character, state, stockId) {
  if (state.banned) throw new Error('The merchant refuses to deal with you.');
  const item = state.stock.find((s) => s.id === stockId);
  if (!item) throw new Error('That item is no longer in stock.');
  const price = buyPrice(item, state.haggle?.discountPct || 0);
  if (character.currency.amount < price) throw new Error(`You need ${price} ${character.currency.label}.`);
  const ch = clone(character);
  ch.currency.amount -= price;
  const bought = itemFromTemplate(item);
  ch.inventory.push(bought);
  const keepRation = item.craftingTags?.includes('ration');
  const nextState = { ...state, stock: keepRation ? state.stock : state.stock.filter((s) => s.id !== stockId) };
  return { character: ch, state: nextState, price, item: bought };
}

export function sell(character, state, itemId, sellBonusPct = 0) {
  if (state.banned) throw new Error('The merchant refuses to deal with you.');
  const item = character.inventory.find((i) => i.id === itemId);
  if (!item) throw new Error('Item not found.');
  if (item.type === 'key' && item.value === 0) throw new Error('That item cannot be sold.');
  const price = sellPrice(item, sellBonusPct);
  const ch = clone(character);
  ch.inventory = ch.inventory.filter((i) => i.id !== itemId);
  ch.currency.amount += price;
  return { character: ch, state, price, item };
}

export function haggleCheck(character, skill, campaign) {
  return buildCheck({
    character,
    skillOrStat: skill,
    dc: HAGGLE_DC,
    weather: null,
    skin: campaign.skin,
    reason: `Haggle (${skill === 'intimidation' ? 'strong-arm' : 'sweet-talk'}): success = ${HAGGLE_DISCOUNT[skill]}% off this visit; fail by 5+ = banned for ${BAN_DAYS} days.`,
  });
}

/** Resolves the once-per-visit haggle roll. */
export function applyHaggle(state, skill, result, day) {
  if (state.haggle) throw new Error('You already haggled this visit.');
  if (result.success) return { ...state, haggle: { skill, success: true, discountPct: HAGGLE_DISCOUNT[skill], total: result.total } };
  if (result.margin <= -5) return { ...state, haggle: { skill, success: false, discountPct: 0, total: result.total }, bannedUntilDay: day + BAN_DAYS, banned: true };
  return { ...state, haggle: { skill, success: false, discountPct: 0, total: result.total } };
}

// ── Crafting ─────────────────────────────────────────────────────

/** For each recipe, lists the item choices per input slot (and upgrade targets). */
export function craftingOptions(character) {
  const inv = character.inventory || [];
  return RECIPES.map((r) => {
    const slots = r.inputs.map((tag) => inv.filter((i) => i.craftingTags?.includes(tag)));
    const targets =
      r.kind === 'upgrade'
        ? inv.filter((i) => i.type === r.targetType && (i.statModifiers?.[r.modifier.key] || 0) < r.modifier.max)
        : [];
    const tagCounts = {};
    for (const t of r.inputs) tagCounts[t] = (tagCounts[t] || 0) + 1;
    const enough = Object.entries(tagCounts).every(([tag, n]) => inv.filter((i) => i.craftingTags?.includes(tag)).length >= n);
    return { recipe: r, slots, targets, available: enough && (r.kind !== 'upgrade' || targets.length > 0) };
  });
}

/** Auto-selects distinct input items for a recipe. */
export function pickInputs(character, recipe, excludeIds = []) {
  const used = new Set(excludeIds);
  const picks = [];
  for (const tag of recipe.inputs) {
    const it = character.inventory.find((i) => !used.has(i.id) && i.craftingTags?.includes(tag) && i.type === 'material') || character.inventory.find((i) => !used.has(i.id) && i.craftingTags?.includes(tag));
    if (!it) return null;
    used.add(it.id);
    picks.push(it.id);
  }
  return picks;
}

export function craftCheck(character, recipe, campaign, bonus = 0) {
  return buildCheck({
    character,
    skillOrStat: recipe.skill,
    dc: recipe.dc,
    skin: campaign.skin,
    extraModifiers: bonus ? [{ label: 'Work bench', value: bonus }] : [],
    reason: `${recipe.label}: success consumes the inputs and ${recipe.kind === 'upgrade' ? 'improves the target' : 'creates the item'}; failing by 5+ wastes one input.`,
  });
}

/**
 * Applies a crafting result. Returns { character, outcome, text }.
 */
export function applyCraft(character, recipe, { inputIds, targetId = null, result, genre }) {
  const ch = clone(character);
  if (!result.success) {
    if (result.margin <= -5 && inputIds.length) {
      const wasted = ch.inventory.find((i) => i.id === inputIds[0]);
      ch.inventory = ch.inventory.filter((i) => i.id !== inputIds[0]);
      return { character: ch, outcome: 'wasted', text: `The attempt fails badly — ${wasted?.name || 'a material'} is ruined.` };
    }
    return { character: ch, outcome: 'failed', text: 'The attempt fails, but your materials are intact.' };
  }
  ch.inventory = ch.inventory.filter((i) => !inputIds.includes(i.id));
  if (recipe.kind === 'create') {
    let tpl = recipe.output.template;
    if (!tpl && recipe.output.pickTag) {
      const templates = MERCHANT_TEMPLATES[genre] || MERCHANT_TEMPLATES.fantasy;
      tpl = templates.find((t) => t.craftingTags?.includes(recipe.output.pickTag) && t.type === 'consumable');
    }
    const made = itemFromTemplate(tpl);
    ch.inventory.push(made);
    return { character: ch, outcome: 'created', text: `Crafted ${made.name}.` };
  }
  const target = ch.inventory.find((i) => i.id === targetId);
  if (!target) throw new Error('Upgrade target missing.');
  const cur = target.statModifiers?.[recipe.modifier.key] || 0;
  target.statModifiers = { ...(target.statModifiers || {}), [recipe.modifier.key]: Math.min(recipe.modifier.max, cur + recipe.modifier.delta) };
  if (!/\+\d$/.test(target.name)) target.name = `${target.name} +1`;
  else target.name = target.name.replace(/\+(\d)$/, (_, n) => `+${Number(n) + 1}`);
  target.value = Math.round((target.value || 1) * 1.5);
  return { character: ch, outcome: 'upgraded', text: `${target.name} improved (${recipe.modifier.key} ${cur} → ${target.statModifiers[recipe.modifier.key]}).` };
}

// ── Rest ─────────────────────────────────────────────────────────

export function safehouseBuffs(campaign) {
  const sh = campaign.worldState?.safehouse;
  const atSafehouse = sh?.nodeId && sh.nodeId === campaign.worldState.currentNodeId;
  const out = { atSafehouse: Boolean(atSafehouse) };
  if (!atSafehouse) return out;
  for (const u of SAFEHOUSE_UPGRADES) if (sh.upgrades?.includes(u.id)) Object.assign(out, u.effect);
  return out;
}

export function globalSafehouseBuffs(campaign) {
  const sh = campaign.worldState?.safehouse;
  const out = {};
  if (!sh?.nodeId) return out;
  for (const u of SAFEHOUSE_UPGRADES) if (sh.upgrades?.includes(u.id) && u.effect.sellBonusPct) out.sellBonusPct = u.effect.sellBonusPct;
  return out;
}

export function findRation(character) {
  return character.inventory.find((i) => i.craftingTags?.includes('ration')) || null;
}

/**
 * Plans a rest as engine effects for the turn pipeline.
 * @returns {{ engine, summary, error }}
 */
export function planRest(kind, character, campaign) {
  const strict = (campaign.meta?.rulesStrictness ?? 5) >= STRICT_RATIONS;
  const buffs = safehouseBuffs(campaign);
  const maxHp = effectiveMaxHp(character);
  if (kind === 'short') {
    const heal = Math.min(maxHp - character.vitals.hp, shortRestHealing(character));
    return {
      engine: { time_advance_minutes: 60, hp_delta: heal > 0 ? heal : 0, restore_spell_slots: 'pact' },
      summary: `Short rest (1 hour): spend a hit die for a fixed ${shortRestHealing(character)} HP (d${character.hitDie || 8}/2+1 + CON).`,
      error: null,
    };
  }
  const ration = findRation(character);
  const needsRation = strict && !buffs.noRationNeeded;
  if (needsRation && !ration) return { engine: null, summary: '', error: `A long rest requires a ration at this strictness. You have none.` };
  const engine = {
    time_advance_minutes: 480,
    hp_delta: maxHp - character.vitals.hp,
    conditions_removed: ['exhausted', 'frightened'],
    heal_companions_full: true,
    remove_item_ids: needsRation && ration ? [ration.id] : [],
    restore_spell_slots: 'all',
    clear_active_effects: true,
  };
  if (buffs.tempHp) engine.set_temp_hp = buffs.tempHp;
  if (buffs.initiativeBuff) engine.buffs = { initiativeBuff: buffs.initiativeBuff };
  const parts = ['Long rest (8 hours): full HP, companions restored, exhaustion and fear removed.'];
  if (engine.remove_item_ids.length) parts.push(`Consumes 1 ${ration.name}.`);
  if (buffs.atSafehouse) parts.push('Safehouse bonuses apply.');
  return { engine, summary: parts.join(' '), error: null };
}

// ── Safehouse ────────────────────────────────────────────────────

export function canClaimSafehouse(campaign) {
  const node = campaign.mapNodes.find((n) => n.id === campaign.worldState.currentNodeId);
  if (!node) return { ok: false, reason: 'Unknown location.' };
  if (node.type === 'dungeon') return { ok: false, reason: 'You cannot make a home in a dungeon.' };
  if (campaign.combat?.inCombat) return { ok: false, reason: 'Not during combat.' };
  if (campaign.worldState.safehouse?.nodeId === node.id) return { ok: false, reason: 'This is already your safehouse.' };
  return { ok: true, reason: '', node };
}

export function claimSafehouse(campaign, name) {
  const check = canClaimSafehouse(campaign);
  if (!check.ok) throw new Error(check.reason);
  const ws = clone(campaign.worldState);
  const moving = Boolean(ws.safehouse?.nodeId);
  ws.safehouse = { nodeId: check.node.id, name: String(name || `${check.node.label} Safehouse`).slice(0, 60), upgrades: moving ? [] : ws.safehouse?.upgrades || [] };
  return { worldState: ws, mapNodes: campaign.mapNodes.map((n) => (n.id === check.node.id && n.type !== 'town' ? { ...n, type: 'safehouse' } : n)) };
}

export function buyUpgrade(campaign, character, upgradeId) {
  const up = SAFEHOUSE_UPGRADES.find((u) => u.id === upgradeId);
  if (!up) throw new Error('Unknown upgrade.');
  const sh = campaign.worldState.safehouse;
  if (!sh?.nodeId) throw new Error('Claim a safehouse first.');
  if (sh.nodeId !== campaign.worldState.currentNodeId) throw new Error('You must be at your safehouse to build.');
  if (sh.upgrades.includes(up.id)) throw new Error('Already built.');
  if (character.currency.amount < up.cost) throw new Error(`You need ${up.cost} ${character.currency.label}.`);
  const ch = clone(character);
  ch.currency.amount -= up.cost;
  const ws = clone(campaign.worldState);
  ws.safehouse.upgrades = [...ws.safehouse.upgrades, up.id];
  return { character: ch, worldState: ws, upgrade: up };
}
