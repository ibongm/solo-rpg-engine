import { useState } from 'react';
import { Beer, Dices, Spade, Coins, Hand, Eye, Gavel } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { settleMinigame, barFight } from '../../store/localActions.js';
import { buildCheck, fmtMod } from '../../engine/diceEngine.js';
import { skillLabel } from '../../config/genreSkins.js';
import {
  CHEAT_DC,
  newBlackjack,
  bjHit,
  bjStand,
  bjCheatHit,
  handValue,
  highStakesRoll,
  settleHighStakes,
  newLiarsDice,
  placeBid,
  callLiar,
  runNpcTurns,
  totalDice,
  isLegalBid,
} from '../../engine/minigames.js';
import { Modal } from '../common/ui.jsx';

const GAMES = [
  { id: 'liars_dice', label: "Liar's Dice", icon: Dices, blurb: 'Bluff against two regulars. Last cup standing takes the pot.' },
  { id: 'blackjack', label: 'Blackjack', icon: Spade, blurb: 'Beat the dealer to 21. Blackjack pays 3:2.' },
  { id: 'high_stakes', label: 'High-Stakes Dice', icon: Coins, blurb: '2d6 vs the house. Winning doubles pay double.' },
];

const DIE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

function Card({ card, hidden }) {
  const red = card && (card.suit === '♥' || card.suit === '♦');
  return (
    <div className={`flex h-16 w-11 items-center justify-center rounded-md border-2 font-mono text-sm font-bold shadow-theme ${hidden ? 'border-line bg-accent/20' : 'border-line bg-white'} ${red ? 'text-red-600' : 'text-gray-900'}`}>
      {hidden ? '?' : `${card.rank}${card.suit}`}
    </div>
  );
}

export default function TavernMinigameModal() {
  const character = useGameStore((s) => s.character);
  const campaign = useGameStore((s) => s.campaign);
  const close = useGameStore((s) => s.closeDrawer);
  const openRollPrompt = useGameStore((s) => s.openRollPrompt);
  const busy = useGameStore((s) => s.busy);
  const [gameId, setGameId] = useState(null);
  const [stake, setStake] = useState(Math.min(10, character.currency.amount));
  const [state, setState] = useState(null);
  const [hs, setHs] = useState(null);
  const [bid, setBid] = useState({ qty: 1, face: 2 });
  const [peek, setPeek] = useState(null);
  const [cheatUsed, setCheatUsed] = useState(false);
  const [settling, setSettling] = useState(false);
  const cur = character.currency;
  const skin = campaign.skin;
  const maxStake = Math.max(0, Math.min(cur.amount, 200));

  const reset = () => {
    setState(null);
    setHs(null);
    setPeek(null);
    setCheatUsed(false);
  };

  const start = () => {
    if (stake < 1 || stake > maxStake) return;
    setCheatUsed(false);
    setPeek(null);
    if (gameId === 'blackjack') setState(newBlackjack(stake));
    if (gameId === 'liars_dice') {
      const s = runNpcTurns(newLiarsDice(stake));
      setState(s);
      setBid({ qty: Math.max(1, (s.bid?.qty || 0) + 1), face: s.bid?.face || 2 });
    }
    if (gameId === 'high_stakes') {
      const player = highStakesRoll();
      setHs({ stake, player, house: null, rerolled: false });
    }
  };

  const settle = async (payout) => {
    setSettling(true);
    await settleMinigame({ currencyDelta: payout, game: GAMES.find((g) => g.id === gameId)?.label });
    setSettling(false);
    reset();
  };

  const cheat = (onSuccess) => {
    const check = buildCheck({ character, skillOrStat: 'sleight_of_hand', dc: CHEAT_DC[gameId], skin, reason: `Cheat: success tilts the game; failure means you are caught — lose your ${stake} stake and a bar fight erupts.` });
    setCheatUsed(true);
    openRollPrompt({
      origin: 'cheat',
      title: `Cheat — ${check.label}`,
      subtitle: check.reason,
      check,
      onResolve: async ({ result }) => {
        if (result.success) onSuccess();
        else {
          reset();
          await barFight(stake, { check, result });
        }
      },
    });
  };

  const cheatPreview = gameId ? buildCheck({ character, skillOrStat: 'sleight_of_hand', dc: CHEAT_DC[gameId], skin }) : null;

  // Walking away never dodges a stake: unfinished games are forfeited, finished ones settle.
  const onClose = async () => {
    if (settling) return;
    if (state) {
      const payout = state.status === 'done' ? state.payout : -state.stake;
      if (payout !== 0) await settleMinigame({ currencyDelta: payout, game: GAMES.find((g) => g.id === gameId)?.label });
    } else if (hs) {
      const payout = hs.house ? settleHighStakes(hs.stake, hs.player, hs.house).payout : -hs.stake;
      if (payout !== 0) await settleMinigame({ currencyDelta: payout, game: 'High-Stakes Dice' });
    }
    close();
  };

  return (
    <Modal title="The Tavern" icon={<Beer className="h-5 w-5 text-accent-2" />} onClose={onClose} wide>
      {!gameId && (
        <div className="grid gap-3 md:grid-cols-3">
          {GAMES.map((g) => (
            <button key={g.id} className="card-inset p-4 text-left transition hover:shadow-glow" onClick={() => setGameId(g.id)}>
              <g.icon className="mb-2 h-6 w-6 text-accent" />
              <div className="font-heading font-bold">{g.label}</div>
              <p className="text-xs text-muted">{g.blurb}</p>
            </button>
          ))}
          <p className="text-xs text-muted md:col-span-3">Winning loosens tongues — the next scene will bring you a fresh rumor. Each game takes 30 minutes of in-game time.</p>
        </div>
      )}

      {gameId && !state && !hs && (
        <div className="space-y-4">
          <button className="btn-ghost text-xs" onClick={() => setGameId(null)}>
            ← Choose another game
          </button>
          <h3 className="font-heading text-xl font-bold">{GAMES.find((g) => g.id === gameId).label}</h3>
          <div className="flex flex-wrap items-end gap-3">
            <label>
              <span className="label">Stake ({cur.label})</span>
              <input type="number" className="input w-32 font-mono" min={1} max={maxStake} value={stake} onChange={(e) => setStake(Math.max(0, Math.min(maxStake, parseInt(e.target.value, 10) || 0)))} />
            </label>
            <button className="btn-primary" disabled={busy || stake < 1 || stake > maxStake} onClick={start}>
              <Gavel className="h-4 w-4" /> Play for {stake}
            </button>
            <span className="text-sm text-muted">
              Purse: {cur.amount} {cur.label}
            </span>
          </div>
          {cheatPreview && (
            <p className="text-xs text-muted">
              Cheating is possible mid-game: {skillLabel('sleight_of_hand', skin)} {fmtMod(cheatPreview.totalModifier)} vs DC {CHEAT_DC[gameId]}. Getting caught starts a bar fight.
            </p>
          )}
        </div>
      )}

      {gameId === 'blackjack' && state && (
        <div className="space-y-4">
          <div>
            <div className="label">Dealer {state.status === 'done' ? `(${handValue(state.dealer).total})` : ''}</div>
            <div className="flex gap-2">
              {state.dealer.map((c, i) => (
                <Card key={i} card={c} hidden={state.status === 'player' && i === 1} />
              ))}
            </div>
          </div>
          <div>
            <div className="label">You ({handValue(state.player).total}{handValue(state.player).soft ? ' soft' : ''})</div>
            <div className="flex gap-2">
              {state.player.map((c, i) => (
                <Card key={i} card={c} />
              ))}
            </div>
          </div>
          {state.status === 'player' ? (
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => setState(bjHit(state))}>
                Hit
              </button>
              <button className="btn" onClick={() => setState(bjStand(state))}>
                Stand
              </button>
              <button className="btn" disabled={cheatUsed} onClick={() => cheat(() => setState((s) => bjCheatHit(s)))} title="Palm the best card from the deck">
                <Hand className="h-4 w-4" /> Palm a card (DC {CHEAT_DC.blackjack})
              </button>
            </div>
          ) : (
            <Result payout={state.payout} label={state.result} cur={cur} settling={settling} onSettle={() => settle(state.payout)} />
          )}
        </div>
      )}

      {gameId === 'high_stakes' && hs && (
        <div className="space-y-4">
          <div className="flex items-center gap-6">
            <div>
              <div className="label">You</div>
              <div className="text-5xl">{hs.player.map((d) => DIE_FACES[d]).join(' ')}</div>
              <div className="font-mono text-sm">= {hs.player[0] + hs.player[1]}</div>
            </div>
            <div>
              <div className="label">House</div>
              <div className="text-5xl">{hs.house ? hs.house.map((d) => DIE_FACES[d]).join(' ') : '? ?'}</div>
              {hs.house && <div className="font-mono text-sm">= {hs.house[0] + hs.house[1]}</div>}
            </div>
          </div>
          {!hs.house ? (
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => setHs({ ...hs, house: highStakesRoll() })}>
                <Dices className="h-4 w-4" /> House rolls
              </button>
              <button
                className="btn"
                disabled={cheatUsed}
                onClick={() =>
                  cheat(() =>
                    setHs((h) => {
                      const lowIdx = h.player[0] <= h.player[1] ? 0 : 1;
                      const re = highStakesRoll()[0];
                      const player = h.player.slice();
                      player[lowIdx] = Math.max(player[lowIdx], re);
                      return { ...h, player, rerolled: true };
                    }),
                  )
                }
                title="Swap your lower die with a loaded one"
              >
                <Hand className="h-4 w-4" /> Loaded die (DC {CHEAT_DC.high_stakes})
              </button>
            </div>
          ) : (
            (() => {
              const r = settleHighStakes(hs.stake, hs.player, hs.house);
              return <Result payout={r.payout} label={r.result.replace('_', ' ')} cur={cur} settling={settling} onSettle={() => settle(r.payout)} />;
            })()
          )}
        </div>
      )}

      {gameId === 'liars_dice' && state && (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {state.players.map((p, i) => (
              <div key={p.id} className={`card-inset p-2 text-sm ${state.turn === i && state.status === 'playing' ? 'border-accent' : ''} ${p.count === 0 ? 'opacity-40' : ''}`}>
                <div className="flex justify-between">
                  <strong>{p.name}</strong>
                  <span className="font-mono text-xs">{p.count} dice</span>
                </div>
                <div className="mt-1 text-2xl">
                  {p.human || (peek === p.id && state.status === 'playing') ? p.dice.map((d) => DIE_FACES[d]).join(' ') : '🂠'.repeat(Math.min(p.count, 5))}
                </div>
              </div>
            ))}
          </div>
          {state.lastReveal && (
            <p className="card-inset p-2 text-xs">
              Last challenge: {state.lastReveal.qty}× {DIE_FACES[state.lastReveal.face]} — there were {state.lastReveal.count}. {state.lastReveal.loser} lost a die.
            </p>
          )}
          <div className="max-h-24 overflow-y-auto font-mono text-xs text-muted">
            {state.log.slice(-6).map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
          {state.status === 'playing' ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="text-sm">
                Current bid: <strong>{state.bid ? `${state.bid.qty}× ${DIE_FACES[state.bid.face]}` : 'none'}</strong> ({totalDice(state)} dice in play)
              </div>
              <label>
                <span className="label">Qty</span>
                <input type="number" className="input w-20" min={1} max={totalDice(state)} value={bid.qty} onChange={(e) => setBid({ ...bid, qty: parseInt(e.target.value, 10) || 1 })} />
              </label>
              <label>
                <span className="label">Face</span>
                <select className="input w-20" value={bid.face} onChange={(e) => setBid({ ...bid, face: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5, 6].map((f) => (
                    <option key={f} value={f}>
                      {f} {DIE_FACES[f]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn-primary"
                disabled={!isLegalBid(bid, state.bid, totalDice(state))}
                onClick={() => {
                  const s = runNpcTurns(placeBid(state, bid));
                  setState(s);
                  setPeek(null);
                  if (s.bid) setBid({ qty: s.bid.qty + 1, face: s.bid.face });
                }}
              >
                Bid
              </button>
              <button
                className="btn-danger"
                disabled={!state.bid}
                onClick={() => {
                  const s = runNpcTurns(callLiar(state));
                  setState(s);
                  setPeek(null);
                  setBid({ qty: Math.max(1, (s.bid?.qty || 0) + 1), face: s.bid?.face || 2 });
                }}
              >
                Liar!
              </button>
              <button
                className="btn"
                disabled={cheatUsed}
                onClick={() => {
                  const target = state.players.find((p) => !p.human && p.count > 0);
                  cheat(() => setPeek(target?.id || null));
                }}
                title="Sneak a look under an opponent's cup"
              >
                <Eye className="h-4 w-4" /> Peek (DC {CHEAT_DC.liars_dice})
              </button>
            </div>
          ) : (
            <Result payout={state.payout} label={state.result} cur={cur} settling={settling} onSettle={() => settle(state.payout)} />
          )}
        </div>
      )}
    </Modal>
  );
}

function Result({ payout, label, cur, settling, onSettle }) {
  return (
    <div className={`rounded-theme border-theme p-3 text-center ${payout > 0 ? 'border-success bg-success/10' : payout < 0 ? 'border-danger bg-danger/10' : 'border-line'}`}>
      <p className="font-heading text-xl font-bold capitalize">{label}</p>
      <p className="font-mono">
        {payout > 0 ? `+${payout}` : payout} {cur.label}
      </p>
      <button className="btn-primary mt-2" onClick={onSettle} disabled={settling}>
        {payout > 0 ? 'Collect winnings' : payout < 0 ? 'Pay up' : 'Take back stake'}
      </button>
    </div>
  );
}
