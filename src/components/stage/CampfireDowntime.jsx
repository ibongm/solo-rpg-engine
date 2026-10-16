import { useState } from 'react';
import { Tent, X, Moon, Coffee, Stethoscope, Hammer, MessageCircle, Home, Check } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { rest, tendWounds, companionTalk, claimSafehouse, buySafehouseUpgrade } from '../../store/localActions.js';
import { planRest, safehouseBuffs, canClaimSafehouse, findRation, STRICT_RATIONS } from '../../engine/economyEngine.js';
import { SAFEHOUSE_UPGRADES } from '../../config/catalog.js';

/** Make Camp / Rest downtime phase: rests, wound care, crafting, companion talks, safehouse. */
export default function CampfireDowntime() {
  const campaign = useGameStore((s) => s.campaign);
  const character = useGameStore((s) => s.character);
  const close = useGameStore((s) => s.closeDrawer);
  const openTab = useGameStore((s) => s.openTab);
  const busy = useGameStore((s) => s.busy);
  const [topic, setTopic] = useState('');
  const [safeName, setSafeName] = useState('');
  const shortPlan = planRest('short', character, campaign);
  const longPlan = planRest('long', character, campaign);
  const buffs = safehouseBuffs(campaign);
  const claim = canClaimSafehouse(campaign);
  const sh = campaign.worldState.safehouse;
  const companions = (character.companionRoster || []).filter((c) => c.isRecruited);
  const ration = findRation(character);
  const strict = (campaign.meta.rulesStrictness ?? 5) >= STRICT_RATIONS;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center sm:p-4 no-print" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="card max-h-[90dvh] w-full max-w-3xl animate-fade-in overflow-y-auto rounded-b-none sm:rounded-b-theme" role="dialog" aria-label="Campfire">
        <header className="flex items-center justify-between border-b-theme border-line/40 px-5 py-3">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Tent className="h-5 w-5 text-accent-2" /> Make Camp {buffs.atSafehouse && <span className="pill">at {sh.name}</span>}
          </h2>
          <button className="btn-ghost" onClick={close} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <section className="card-inset space-y-2 p-3">
            <h3 className="section-title">Rest</h3>
            <button className="btn w-full justify-start" disabled={busy} onClick={() => rest('short')}>
              <Coffee className="h-4 w-4" /> Short Rest (1 hour)
            </button>
            <p className="text-xs text-muted">{shortPlan.summary}</p>
            <button className="btn-primary w-full justify-start" disabled={busy || Boolean(longPlan.error)} onClick={() => rest('long')}>
              <Moon className="h-4 w-4" /> Long Rest (8 hours)
            </button>
            <p className={`text-xs ${longPlan.error ? 'text-danger' : 'text-muted'}`}>{longPlan.error || longPlan.summary}</p>
            <p className="text-[11px] text-muted">
              Rations: {character.inventory.filter((i) => i.craftingTags?.includes('ration')).length}
              {strict ? ' (required for long rests at this strictness)' : ' (optional at this strictness)'}
              {!ration && strict && !buffs.noRationNeeded ? ' — buy some from a merchant.' : ''}
            </p>
          </section>

          <section className="card-inset space-y-2 p-3">
            <h3 className="section-title">Downtime</h3>
            <button className="btn w-full justify-start" disabled={busy} onClick={tendWounds}>
              <Stethoscope className="h-4 w-4" /> Tend Wounds (Medicine DC 12, 30 min)
            </button>
            <button
              className="btn w-full justify-start"
              onClick={() => {
                openTab(2);
                close();
              }}
            >
              <Hammer className="h-4 w-4" /> Craft / Upgrade Gear{buffs.craftBonus ? ` (+${buffs.craftBonus} bench)` : ''}
            </button>
          </section>

          <section className="card-inset space-y-2 p-3">
            <h3 className="section-title">Companion Conversations</h3>
            {companions.length === 0 ? (
              <p className="text-xs text-muted">No companions travel with you.</p>
            ) : (
              <>
                <input className="input text-sm" placeholder="Topic (optional): their past, the last fight…" value={topic} onChange={(e) => setTopic(e.target.value)} />
                {companions.map((c) => (
                  <button key={c.id} className="btn w-full justify-between" disabled={busy} onClick={() => companionTalk(c.id, topic)}>
                    <span className="flex items-center gap-1.5">
                      <MessageCircle className="h-4 w-4" /> Talk with {c.name}
                    </span>
                    <span className="font-mono text-xs text-muted">loyalty {c.loyalty}</span>
                  </button>
                ))}
              </>
            )}
          </section>

          <section className="card-inset space-y-2 p-3">
            <h3 className="section-title flex items-center gap-1.5">
              <Home className="h-4 w-4" /> Safehouse
            </h3>
            {sh?.nodeId ? (
              <p className="text-sm">
                Home Base: <strong>{sh.name}</strong> {buffs.atSafehouse ? '(you are here)' : `(at ${campaign.mapNodes.find((n) => n.id === sh.nodeId)?.label})`}
              </p>
            ) : (
              <p className="text-xs text-muted">No home base yet. Claim a town, camp or landmark.</p>
            )}
            {claim.ok && (
              <div className="flex gap-2">
                <input className="input text-sm" placeholder={`${claim.node.label} Safehouse`} value={safeName} onChange={(e) => setSafeName(e.target.value)} />
                <button className="btn" onClick={() => claimSafehouse(safeName)} title={sh?.nodeId ? 'Moving resets upgrades' : ''}>
                  {sh?.nodeId ? 'Move here' : 'Claim'}
                </button>
              </div>
            )}
            {buffs.atSafehouse && (
              <div className="space-y-1">
                {SAFEHOUSE_UPGRADES.map((u) => {
                  const owned = sh.upgrades.includes(u.id);
                  return (
                    <div key={u.id} className="flex items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="font-semibold">{u.label}</div>
                        <div className="text-muted">{u.description}</div>
                      </div>
                      {owned ? (
                        <span className="pill border-success text-success">
                          <Check className="h-3 w-3" /> Built
                        </span>
                      ) : (
                        <button className="btn shrink-0 px-2 py-0.5 text-xs" disabled={character.currency.amount < u.cost} onClick={() => buySafehouseUpgrade(u.id)}>
                          {u.cost} {character.currency.label}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
