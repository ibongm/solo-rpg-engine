import { describe, it, expect } from 'vitest';
import {
  handValue,
  newDeck,
  newBlackjack,
  bjHit,
  bjStand,
  bjCheatHit,
  settleBlackjack,
  settleHighStakes,
  newLiarsDice,
  placeBid,
  callLiar,
  isLegalBid,
  npcDecision,
  runNpcTurns,
} from './minigames.js';
import { seededRng } from './rng.js';

const c = (rank) => ({ rank, suit: '♠' });

describe('blackjack', () => {
  it('values hands with soft aces', () => {
    expect(handValue([c('A'), c('K')])).toEqual({ total: 21, soft: true });
    expect(handValue([c('A'), c('A'), c('9')]).total).toBe(21);
    expect(handValue([c('K'), c('Q'), c('5')]).total).toBe(25);
  });

  it('uses a full shuffled deck', () => {
    const d = newDeck(seededRng('d'));
    expect(d).toHaveLength(52);
    expect(new Set(d.map((x) => x.rank + x.suit)).size).toBe(52);
  });

  it('settles payouts', () => {
    const base = { stake: 10, deck: [], status: 'dealer' };
    expect(settleBlackjack({ ...base, player: [c('A'), c('K')], dealer: [c('9'), c('9')] }).payout).toBe(15);
    expect(settleBlackjack({ ...base, player: [c('10'), c('9')], dealer: [c('10'), c('8')] }).payout).toBe(10);
    expect(settleBlackjack({ ...base, player: [c('10'), c('7')], dealer: [c('10'), c('8')] }).payout).toBe(-10);
    expect(settleBlackjack({ ...base, player: [c('10'), c('8')], dealer: [c('10'), c('8')] }).payout).toBe(0);
    expect(settleBlackjack({ ...base, player: [c('10'), c('8'), c('5')], dealer: [c('10'), c('8')] }).result).toBe('bust');
  });

  it('dealer draws to 17 and games always finish', () => {
    for (let i = 0; i < 30; i++) {
      let s = newBlackjack(5, seededRng(`bj${i}`));
      while (s.status === 'player') s = handValue(s.player).total < 15 ? bjHit(s) : bjStand(s);
      expect(s.status).toBe('done');
      if (s.result !== 'bust' && s.result !== 'blackjack' && s.dealer.length > 2) expect(handValue(s.dealer).total).toBeGreaterThanOrEqual(17);
    }
  });

  it('cheat-hit never busts when a safe card exists', () => {
    const s = { stake: 5, deck: [c('K'), c('2'), c('Q')], player: [c('10'), c('6')], dealer: [c('10'), c('7')], status: 'player', cheated: false };
    const next = bjCheatHit(s);
    expect(handValue(next.player).total).toBe(18);
    expect(next.cheated).toBe(true);
  });
});

describe('high-stakes dice', () => {
  it('pays double on winning doubles and pushes on ties', () => {
    expect(settleHighStakes(10, [4, 4], [3, 2]).payout).toBe(20);
    expect(settleHighStakes(10, [6, 1], [3, 2]).payout).toBe(10);
    expect(settleHighStakes(10, [2, 1], [3, 2]).payout).toBe(-10);
    expect(settleHighStakes(10, [3, 2], [4, 1]).payout).toBe(0);
  });
});

describe("liar's dice", () => {
  it('validates raises', () => {
    expect(isLegalBid({ qty: 3, face: 4 }, { qty: 3, face: 3 }, 15)).toBe(true);
    expect(isLegalBid({ qty: 3, face: 2 }, { qty: 3, face: 3 }, 15)).toBe(false);
    expect(isLegalBid({ qty: 16, face: 2 }, null, 15)).toBe(false);
  });

  it('resolves a challenge and removes a die from the loser', () => {
    let s = newLiarsDice(10, ['A', 'B'], seededRng('ld'));
    s = { ...s, players: s.players.map((p, i) => ({ ...p, dice: i === 0 ? [6, 6, 6, 1, 1] : [2, 2, 3, 3, 4] })) };
    s = placeBid(s, { qty: 3, face: 6 });
    expect(s.turn).toBe(1);
    const after = callLiar(s, seededRng('x'));
    expect(after.players[1].count).toBe(4);
    expect(after.lastReveal.count).toBe(3);
  });

  it('NPCs call obvious overbids', () => {
    let s = newLiarsDice(10, ['A', 'B'], seededRng('n'));
    s = { ...s, turn: 1, bid: { qty: 14, face: 5, by: 0 } };
    expect(npcDecision(s).type).toBe('call');
  });

  it('a full NPC-driven game terminates with a payout', () => {
    for (let g = 0; g < 10; g++) {
      const rng = seededRng(`game${g}`);
      let s = runNpcTurns(newLiarsDice(10, ['A', 'B'], rng), rng);
      let guard = 0;
      while (s.status === 'playing' && guard < 200) {
        s = s.bid && s.bid.qty > 3 ? callLiar(s, rng) : placeBid(s, { qty: (s.bid?.qty || 0) + 1, face: 3 });
        s = runNpcTurns(s, rng);
        guard++;
      }
      expect(s.status).toBe('done');
      expect([20, -10]).toContain(s.payout);
    }
  });
});
