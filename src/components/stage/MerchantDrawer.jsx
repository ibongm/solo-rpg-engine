import { Store, X, Handshake, Swords, Ban, Coins, Tag } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { merchantBuy, merchantSell, startHaggle } from '../../store/localActions.js';
import { merchantState, buyPrice, sellPrice, globalSafehouseBuffs, HAGGLE_DC, HAGGLE_DISCOUNT } from '../../engine/economyEngine.js';
import { skillLabel } from '../../config/genreSkins.js';
import { buildCheck, fmtMod } from '../../engine/diceEngine.js';
import { LootCard } from '../sidebar/Tab2Inventory.jsx';

export default function MerchantDrawer() {
  const campaign = useGameStore((s) => s.campaign);
  const character = useGameStore((s) => s.character);
  const close = useGameStore((s) => s.closeDrawer);
  const busy = useGameStore((s) => s.busy);
  const state = merchantState(campaign);
  const node = campaign.mapNodes.find((n) => n.id === campaign.worldState.currentNodeId);
  const discount = state.haggle?.discountPct || 0;
  const sellBonus = globalSafehouseBuffs(campaign).sellBonusPct || 0;
  const skin = campaign.skin;
  const cur = character.currency;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40 no-print" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <aside className="card flex h-full w-full max-w-lg animate-fade-in flex-col rounded-none" role="dialog" aria-label="Merchant">
        <header className="flex items-center justify-between border-b-theme border-line/40 px-4 py-3">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Store className="h-5 w-5 text-accent" /> {node?.label} Merchant
          </h2>
          <div className="flex items-center gap-2">
            <span className="pill font-mono">
              <Coins className="h-3 w-3 text-accent-2" /> {cur.amount} {cur.label}
            </span>
            <button className="btn-ghost" onClick={close} aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {state.banned ? (
            <div className="rounded-theme border-theme border-danger bg-danger/10 p-4 text-center text-sm">
              <Ban className="mx-auto mb-1 h-6 w-6 text-danger" />
              The merchant refuses to deal with you until Day {state.bannedUntilDay}.
            </div>
          ) : (
            <>
              <section className="card-inset p-3">
                <h3 className="section-title mb-1">Haggle (once per visit)</h3>
                {state.haggle ? (
                  <p className={`text-sm ${state.haggle.success ? 'text-success' : 'text-warning'}`}>
                    {state.haggle.success ? `Deal struck: ${state.haggle.discountPct}% off everything this visit.` : 'The merchant would not budge this visit.'}
                  </p>
                ) : (
                  <>
                    <p className="mb-2 text-xs text-muted">
                      DC {HAGGLE_DC}. Fail by 5 or more and you are banned for 3 days.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {['persuasion', 'intimidation'].map((sk) => {
                        const c = buildCheck({ character, skillOrStat: sk, dc: HAGGLE_DC, skin });
                        const Icon = sk === 'persuasion' ? Handshake : Swords;
                        return (
                          <button key={sk} className="btn" disabled={busy} onClick={() => startHaggle(sk)}>
                            <Icon className="h-4 w-4" /> {skillLabel(sk, skin)} {fmtMod(c.totalModifier)} → {HAGGLE_DISCOUNT[sk]}% off
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>

              <section>
                <h3 className="section-title mb-2">For Sale</h3>
                <div className="grid gap-2">
                  {state.stock.map((it) => {
                    const price = buyPrice(it, discount);
                    return (
                      <LootCard
                        key={it.id}
                        item={it}
                        skin={skin}
                        compact
                        actions={
                          <button className="btn-primary ml-auto px-2 py-0.5 text-xs" disabled={busy || cur.amount < price} onClick={() => merchantBuy(it.id)}>
                            <Tag className="h-3 w-3" /> Buy {price}
                            {discount > 0 && <span className="line-through opacity-60">{it.value}</span>}
                          </button>
                        }
                      />
                    );
                  })}
                </div>
              </section>

              <section>
                <h3 className="section-title mb-2">Sell{sellBonus ? ` (+${sellBonus}% fence bonus)` : ''}</h3>
                {character.inventory.length === 0 ? (
                  <p className="text-xs text-muted">Nothing to sell.</p>
                ) : (
                  <div className="grid gap-1">
                    {character.inventory.map((it) => (
                      <div key={it.id} className="flex items-center justify-between gap-2 rounded-theme px-2 py-1 text-sm hover:bg-surface-2">
                        <span className="truncate">
                          {it.name}
                          {it.equipped && <span className="text-xs text-accent"> (equipped)</span>}
                        </span>
                        <button className="btn px-2 py-0.5 text-xs" disabled={busy || sellPrice(it, sellBonus) === 0} onClick={() => merchantSell(it.id)}>
                          Sell {sellPrice(it, sellBonus)}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
