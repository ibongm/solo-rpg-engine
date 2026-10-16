import { describe, it, expect } from 'vitest';
import {
  generateShopStock,
  merchantState,
  buy,
  sell,
  buyPrice,
  sellPrice,
  applyHaggle,
  craftingOptions,
  pickInputs,
  applyCraft,
  planRest,
  claimSafehouse,
  buyUpgrade,
  canClaimSafehouse,
} from './economyEngine.js';
import { createCampaignFromSeed } from './campaignFactory.js';
import { createCharacter, itemFromTemplate } from './progression.js';
import { buildSkin } from '../config/genreSkins.js';
import { RECIPES } from '../config/catalog.js';
import { mockWorldSeed } from '../../api/_lib/mock.js';

const stats = { str: 14, dex: 14, con: 14, int: 10, wis: 12, cha: 12 };
const setup = (strictness = 5) => {
  const character = { ...createCharacter({ name: 'M', classOrArchetype: 'Fighter', stats, skillProficiencies: ['medicine'] }), id: 'c1' };
  const { campaign } = createCampaignFromSeed({ seed: mockWorldSeed({}), character, characterId: 'c1', genre: 'fantasy', skin: buildSkin('fantasy'), seedKey: 'k', rulesStrictness: strictness });
  return { character, campaign };
};

describe('merchant', () => {
  it('generates deterministic stock with rations', () => {
    const a = generateShopStock({ genre: 'fantasy', nodeId: 'n', visitId: 'v', seedKey: 's' });
    const b = generateShopStock({ genre: 'fantasy', nodeId: 'n', visitId: 'v', seedKey: 's' });
    expect(a.map((i) => i.name)).toEqual(b.map((i) => i.name));
    expect(a.some((i) => i.craftingTags.includes('ration'))).toBe(true);
    expect(a).toHaveLength(9);
  });

  it('buys with discount, keeps rations in stock, and refuses when broke', () => {
    const { character, campaign } = setup();
    const state = merchantState(campaign);
    const ration = state.stock.find((s) => s.craftingTags.includes('ration'));
    const r = buy(character, { ...state, haggle: { discountPct: 20 } }, ration.id);
    expect(r.price).toBe(1);
    expect(r.state.stock.some((s) => s.id === ration.id)).toBe(true);
    const pricey = state.stock.find((s) => s.value > 50) || state.stock[1];
    expect(() => buy({ ...character, currency: { amount: 0, label: 'Gold' } }, state, pricey.id)).toThrow();
    expect(buyPrice({ value: 50 }, 25)).toBe(38);
  });

  it('sells at half value with fence bonus', () => {
    const { character, campaign } = setup();
    const sword = character.inventory.find((i) => i.type === 'weapon');
    expect(sellPrice(sword)).toBe(7);
    expect(sellPrice(sword, 10)).toBe(8);
    const r = sell(character, merchantState(campaign), sword.id);
    expect(r.character.currency.amount).toBe(character.currency.amount + 7);
  });

  it('haggles once per visit and bans on a bad failure', () => {
    const state = { stock: [], haggle: null };
    const win = applyHaggle(state, 'persuasion', { success: true, margin: 2, total: 15 }, 1);
    expect(win.haggle.discountPct).toBe(20);
    expect(() => applyHaggle(win, 'persuasion', { success: true, margin: 1 }, 1)).toThrow();
    const ban = applyHaggle(state, 'intimidation', { success: false, margin: -6, total: 7 }, 4);
    expect(ban.banned).toBe(true);
    expect(ban.bannedUntilDay).toBe(7);
    const meh = applyHaggle(state, 'intimidation', { success: false, margin: -2, total: 11 }, 4);
    expect(meh.banned).toBeUndefined();
  });

  it('honors bans across visits until the day passes', () => {
    const { campaign } = setup();
    const banned = { ...campaign, merchantVisits: { [campaign.worldState.currentNodeId]: { visitId: 'old', stock: [], haggle: null, bannedUntilDay: 3 } } };
    expect(merchantState(banned).banned).toBe(true);
    const later = { ...banned, worldState: { ...banned.worldState, clock: { ...banned.worldState.clock, day: 3 } } };
    expect(merchantState(later).banned).toBe(false);
  });
});

describe('crafting', () => {
  it('lists recipes and crafts a healing draught from two herbs', () => {
    const { character } = setup();
    const herb = { name: 'Herb', type: 'material', craftingTags: ['herb'], value: 2 };
    const c = { ...character, inventory: [...character.inventory, itemFromTemplate(herb), itemFromTemplate(herb)] };
    const opt = craftingOptions(c).find((o) => o.recipe.id === 'healing_draught');
    expect(opt.available).toBe(true);
    const recipe = RECIPES.find((r) => r.id === 'healing_draught');
    const inputs = pickInputs(c, recipe);
    expect(inputs).toHaveLength(2);
    const ok = applyCraft(c, recipe, { inputIds: inputs, result: { success: true, margin: 3 }, genre: 'fantasy' });
    expect(ok.outcome).toBe('created');
    expect(ok.character.inventory.filter((i) => i.name === 'Herb')).toHaveLength(0);
    expect(ok.character.inventory.filter((i) => i.name === 'Potion of Healing')).toHaveLength(2);
    const bad = applyCraft(c, recipe, { inputIds: inputs, result: { success: false, margin: -7 }, genre: 'fantasy' });
    expect(bad.outcome).toBe('wasted');
    expect(bad.character.inventory.filter((i) => i.name === 'Herb')).toHaveLength(1);
  });

  it('upgrades a weapon up to its cap', () => {
    const { character } = setup();
    const ingot = { name: 'Iron Ingot', type: 'material', craftingTags: ['metal', 'upgrade'], value: 8 };
    const c = { ...character, inventory: [...character.inventory, itemFromTemplate(ingot)] };
    const recipe = RECIPES.find((r) => r.id === 'weapon_upgrade');
    const sword = c.inventory.find((i) => i.type === 'weapon');
    const r = applyCraft(c, recipe, { inputIds: pickInputs(c, recipe, [sword.id]), targetId: sword.id, result: { success: true, margin: 0 }, genre: 'fantasy' });
    const up = r.character.inventory.find((i) => i.id === sword.id);
    expect(up.statModifiers.attack).toBe(1);
    expect(up.name).toBe('Longsword +1');
  });
});

describe('rest & safehouse', () => {
  it('requires rations for long rests only at high strictness', () => {
    const strict = setup(7);
    const noFood = { ...strict.character, inventory: strict.character.inventory.filter((i) => !i.craftingTags.includes('ration')) };
    expect(planRest('long', noFood, strict.campaign).error).toBeTruthy();
    const ok = planRest('long', { ...strict.character, vitals: { ...strict.character.vitals, hp: 3 } }, strict.campaign);
    expect(ok.engine.remove_item_ids).toHaveLength(1);
    expect(ok.engine.hp_delta).toBe(strict.character.vitals.maxHp - 3);
    const relaxed = setup(3);
    expect(planRest('long', noFood, relaxed.campaign).error).toBeNull();
    expect(planRest('short', relaxed.character, relaxed.campaign).engine.time_advance_minutes).toBe(60);
  });

  it('claims a safehouse, builds upgrades, and applies their rest buffs', () => {
    const { character, campaign } = setup(7);
    expect(canClaimSafehouse(campaign).ok).toBe(true);
    const patch = claimSafehouse(campaign, 'The Hideout');
    const c2 = { ...campaign, ...patch };
    const rich = { ...character, currency: { amount: 1000, label: 'Gold' } };
    const r = buyUpgrade(c2, rich, 'reinforced_doors');
    expect(r.character.currency.amount).toBe(850);
    const c3 = { ...c2, worldState: r.worldState };
    const noFood = { ...character, inventory: [] };
    expect(planRest('long', noFood, c3).error).toBeNull();
    expect(() => buyUpgrade(c3, rich, 'reinforced_doors')).toThrow();
  });
});
