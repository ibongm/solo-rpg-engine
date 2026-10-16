/**
 * Tavern Minigames — Liar's Dice, Blackjack, High-Stakes Dice. Pure & deterministic given
 * an RNG; every die and card is visible except opponents' hidden cups (as in the real game).
 */
import { rollDie, shuffle, getDefaultRng } from './rng.js';

export const CHEAT_DC = { blackjack: 15, liars_dice: 14, high_stakes: 13 };

// ── Blackjack ────────────────────────────────────────────────────

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function cardValue(rank) {
  if (rank === 'A') return 11;
  if (rank === 'K' || rank === 'Q' || rank === 'J') return 10;
  return Number(rank);
}

export function newDeck(rng = getDefaultRng()) {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ rank: r, suit: s });
  return shuffle(deck, rng);
}

export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c.rank);
    if (c.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 && total <= 21 };
}

const isBlackjack = (cards) => cards.length === 2 && handValue(cards).total === 21;

export function newBlackjack(stake, rng = getDefaultRng()) {
  const deck = newDeck(rng);
  const player = [deck.pop(), deck.pop()];
  const dealer = [deck.pop(), deck.pop()];
  const state = { game: 'blackjack', stake, deck, player, dealer, status: 'player', result: null, payout: 0, cheated: false };
  if (isBlackjack(player) || isBlackjack(dealer)) return settleBlackjack({ ...state, status: 'dealer' });
  return state;
}

export function bjHit(state) {
  if (state.status !== 'player') return state;
  const deck = state.deck.slice();
  const player = [...state.player, deck.pop()];
  const next = { ...state, deck, player };
  if (handValue(player).total > 21) return settleBlackjack({ ...next, status: 'dealer' });
  if (handValue(player).total === 21) return bjStand(next);
  return next;
}

/** Successful cheat: palm the best card from the deck (highest that does not bust). */
export function bjCheatHit(state) {
  if (state.status !== 'player') return state;
  const total = handValue(state.player).total;
  const deck = state.deck.slice();
  let bestIdx = -1;
  let bestTotal = -1;
  deck.forEach((c, i) => {
    const t = handValue([...state.player, c]).total;
    if (t <= 21 && t > bestTotal) {
      bestTotal = t;
      bestIdx = i;
    }
  });
  if (bestIdx < 0) bestIdx = deck.length - 1;
  const [card] = deck.splice(bestIdx, 1);
  const player = [...state.player, card];
  const next = { ...state, deck, player, cheated: true };
  if (handValue(player).total >= 21 || total >= 21) return bjStand(next);
  return next;
}

export function bjStand(state) {
  if (state.status !== 'player') return state;
  const deck = state.deck.slice();
  const dealer = state.dealer.slice();
  // Dealer stands on all 17s.
  while (handValue(dealer).total < 17) dealer.push(deck.pop());
  return settleBlackjack({ ...state, deck, dealer, status: 'dealer' });
}

export function settleBlackjack(state) {
  const p = handValue(state.player).total;
  const d = handValue(state.dealer).total;
  const pBJ = isBlackjack(state.player);
  const dBJ = isBlackjack(state.dealer);
  let result;
  let payout;
  if (p > 21) [result, payout] = ['bust', -state.stake];
  else if (pBJ && !dBJ) [result, payout] = ['blackjack', Math.floor(state.stake * 1.5)];
  else if (dBJ && !pBJ) [result, payout] = ['lose', -state.stake];
  else if (d > 21) [result, payout] = ['win', state.stake];
  else if (p > d) [result, payout] = ['win', state.stake];
  else if (p < d) [result, payout] = ['lose', -state.stake];
  else [result, payout] = ['push', 0];
  return { ...state, status: 'done', result, payout };
}

// ── High-Stakes Dice ─────────────────────────────────────────────

export function highStakesRoll(rng = getDefaultRng()) {
  return [rollDie(6, rng), rollDie(6, rng)];
}

/** Player vs house, 2d6 each. Higher wins; doubles on a win pay double; ties push. */
export function settleHighStakes(stake, playerDice, houseDice) {
  const p = playerDice[0] + playerDice[1];
  const h = houseDice[0] + houseDice[1];
  if (p > h) {
    const doubles = playerDice[0] === playerDice[1];
    return { result: doubles ? 'win_doubles' : 'win', payout: doubles ? stake * 2 : stake, p, h };
  }
  if (p < h) return { result: 'lose', payout: -stake, p, h };
  return { result: 'push', payout: 0, p, h };
}

// ── Liar's Dice ──────────────────────────────────────────────────

export const LIARS_DICE_PER_PLAYER = 5;

export function newLiarsDice(stake, opponentNames = ['One-Eyed Jack', 'Mother Brisk'], rng = getDefaultRng()) {
  const players = [
    { id: 'you', name: 'You', human: true, count: LIARS_DICE_PER_PLAYER, dice: [], revealed: false },
    ...opponentNames.map((n, i) => ({ id: `npc${i}`, name: n, human: false, count: LIARS_DICE_PER_PLAYER, dice: [], revealed: false })),
  ];
  return rollLiarsRound({ game: 'liars_dice', stake, players, bid: null, turn: 0, log: [], status: 'playing', result: null, payout: 0, lastReveal: null }, rng);
}

export function rollLiarsRound(state, rng = getDefaultRng()) {
  const players = state.players.map((p) => ({ ...p, dice: Array.from({ length: p.count }, () => rollDie(6, rng)), revealed: false }));
  return { ...state, players, bid: null };
}

export function totalDice(state) {
  return state.players.reduce((a, p) => a + p.count, 0);
}

export function isLegalBid(bid, prev, total) {
  if (!bid || bid.qty < 1 || bid.face < 1 || bid.face > 6 || bid.qty > total) return false;
  if (!prev) return true;
  return bid.qty > prev.qty || (bid.qty === prev.qty && bid.face > prev.face);
}

function nextActive(state, from) {
  const n = state.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (from + i) % n;
    if (state.players[idx].count > 0) return idx;
  }
  return from;
}

export function placeBid(state, bid) {
  if (state.status !== 'playing') return state;
  if (!isLegalBid(bid, state.bid, totalDice(state))) throw new Error('Bid must raise the quantity, or keep it and raise the face.');
  const who = state.players[state.turn];
  return { ...state, bid: { ...bid, by: state.turn }, turn: nextActive(state, state.turn), log: [...state.log, `${who.name} bids ${bid.qty}× ${bid.face}`] };
}

/** Calls "Liar!" on the current bid. Loser of the challenge loses a die; a new round starts. */
export function callLiar(state, rng = getDefaultRng()) {
  if (state.status !== 'playing' || !state.bid) return state;
  const caller = state.turn;
  const bidder = state.bid.by;
  const count = state.players.reduce((a, p) => a + p.dice.filter((d) => d === state.bid.face).length, 0);
  const bidHolds = count >= state.bid.qty;
  const loserIdx = bidHolds ? caller : bidder;
  const players = state.players.map((p, i) => ({ ...p, revealed: true, count: i === loserIdx ? p.count - 1 : p.count }));
  const loser = players[loserIdx];
  const log = [...state.log, `${state.players[caller].name} calls LIAR on ${state.bid.qty}× ${state.bid.face}: there are ${count}. ${loser.name} loses a die.`];
  const lastReveal = { players: state.players.map((p) => ({ name: p.name, dice: p.dice })), face: state.bid.face, qty: state.bid.qty, count, loser: loser.name };
  let next = { ...state, players, log, lastReveal };
  const human = players.find((p) => p.human);
  const alive = players.filter((p) => p.count > 0);
  if (human.count === 0) return { ...next, status: 'done', result: 'lose', payout: -state.stake };
  if (alive.length === 1 && alive[0].human) return { ...next, status: 'done', result: 'win', payout: state.stake * (state.players.length - 1) };
  next = rollLiarsRound(next, rng);
  // Loser starts the next round (or the next active player if eliminated).
  next.turn = loser.count > 0 ? loserIdx : nextActive(next, loserIdx);
  return next;
}

/** Deterministic NPC policy: call when the bid exceeds expectation, else make a modest raise. */
export function npcDecision(state) {
  const me = state.players[state.turn];
  const total = totalDice(state);
  const unknown = total - me.count;
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of me.dice) counts[d]++;
  if (state.bid) {
    const expected = counts[state.bid.face] + unknown / 6;
    if (state.bid.qty > expected + 1.2) return { type: 'call' };
  }
  let bestFace = 1;
  for (let f = 2; f <= 6; f++) if (counts[f] > counts[bestFace] || (counts[f] === counts[bestFace] && f > bestFace)) bestFace = f;
  const prev = state.bid;
  let qty;
  if (!prev) qty = Math.max(1, Math.round(counts[bestFace] + unknown / 6) - 1);
  else qty = bestFace > prev.face ? prev.qty : prev.qty + 1;
  const bid = { qty: Math.max(1, qty), face: bestFace };
  if (!isLegalBid(bid, prev, total)) {
    const fallback = prev ? { qty: prev.qty + 1, face: prev.face } : { qty: 1, face: bestFace };
    if (!isLegalBid(fallback, prev, total) || (prev && fallback.qty > counts[fallback.face] + unknown / 6 + 1.5)) return { type: 'call' };
    return { type: 'bid', bid: fallback };
  }
  return { type: 'bid', bid };
}

/** Advances NPC turns until it is the human's move or the game ends. */
export function runNpcTurns(state, rng = getDefaultRng()) {
  let s = state;
  let guard = 0;
  while (s.status === 'playing' && !s.players[s.turn].human && guard < 20) {
    const d = npcDecision(s);
    s = d.type === 'call' && s.bid ? callLiar(s, rng) : placeBid(s, d.bid || { qty: (s.bid?.qty || 0) + 1, face: s.bid?.face || 1 });
    guard++;
  }
  return s;
}
