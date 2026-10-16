import { ScanEye, Shield, Swords, User, Users, Skull } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { submitAction, makeRollRecord } from '../../store/turnRunner.js';
import { scanOptions, healthTierPct, healthTierTone, SCAN_DC } from '../../engine/combatEngine.js';

const DIST_STYLE = { Melee: 'border-danger text-danger', Near: 'border-warning text-warning', Far: 'border-info text-info' };

/** Visible enemy cards: turn order, range, HP tier, and the Inspect/Scan mechanic. */
export default function EnemyTacticalBar() {
  const campaign = useGameStore((s) => s.campaign);
  const character = useGameStore((s) => s.character);
  const busy = useGameStore((s) => s.busy);
  const retryQueue = useGameStore((s) => s.retryQueue);
  const openRollPrompt = useGameStore((s) => s.openRollPrompt);
  const combat = campaign.combat;
  const locked = campaign.meta.status !== 'active' || busy || Boolean(retryQueue) || character.vitals.hp <= 0;

  const scan = (enemy) => {
    const [best] = scanOptions(character, campaign.skin);
    const check = { ...best, reason: `Inspect / Scan ${enemy.name}: success reveals exact AC and traits (DC ${SCAN_DC}).` };
    openRollPrompt({
      origin: 'scan',
      title: `Inspect — ${enemy.name}`,
      subtitle: check.reason,
      check,
      onResolve: ({ result }) =>
        submitAction({
          kind: 'roll_result',
          text: `I study ${enemy.name} for weaknesses (${check.label} ${result.total} vs DC ${SCAN_DC} — ${result.success ? 'success' : 'failure'}).`,
          roll: makeRollRecord(check, result, { targetId: enemy.id, targetName: enemy.name }),
          engineNotes: [
            result.success
              ? `Inspect/Scan SUCCEEDED against enemy [${enemy.id}] ${enemy.name}: set inspected=true and reveal its true revealed_ac and 1–3 revealed_traits.`
              : `Inspect/Scan FAILED against enemy [${enemy.id}] ${enemy.name}: keep it uninspected.`,
          ],
        }),
    });
  };

  return (
    <div className="border-b-theme border-danger/40 bg-danger/5 px-4 py-2 no-print">
      <div className="mb-2 flex items-center gap-2 overflow-x-auto text-xs">
        <span className="pill shrink-0 border-danger font-bold text-danger">
          <Swords className="h-3 w-3" /> Round {combat.round || 1}
        </span>
        {(combat.order || []).map((o, i) => {
          const enemy = combat.enemies.find((e) => e.id === o.id);
          const down = enemy?.health_tier === 'Defeated';
          const Icon = o.kind === 'player' ? User : o.kind === 'companion' ? Users : down ? Skull : Swords;
          return (
            <span
              key={o.id}
              className={`pill shrink-0 ${o.kind === 'player' ? 'border-accent text-accent' : o.kind === 'companion' ? 'border-success text-success' : ''} ${down ? 'line-through opacity-50' : ''}`}
              title={`Initiative ${o.initiative} (d20 ${o.natural} ${o.mod >= 0 ? '+' : ''}${o.mod})`}
            >
              <span className="font-mono">{i + 1}.</span>
              <Icon className="h-3 w-3" /> {o.name} <span className="font-mono opacity-70">{o.initiative}</span>
            </span>
          );
        })}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {combat.enemies.map((e) => {
          const defeated = e.health_tier === 'Defeated';
          return (
            <div key={e.id} className={`card w-48 shrink-0 p-2 text-xs ${defeated ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between gap-1">
                <strong className="truncate text-sm">{e.name}</strong>
                <span className={`pill py-0 text-[10px] ${DIST_STYLE[e.distance] || ''}`}>{e.distance}</span>
              </div>
              <div className="mt-1.5">
                <div className={`mb-0.5 text-[11px] font-semibold ${healthTierTone(e.health_tier)}`}>{e.health_tier}</div>
                <div className="meter h-1.5">
                  <div className={`meter-fill ${healthTierPct(e.health_tier) > 60 ? 'bg-success' : healthTierPct(e.health_tier) > 30 ? 'bg-warning' : 'bg-danger'}`} style={{ width: `${healthTierPct(e.health_tier)}%` }} />
                </div>
              </div>
              {e.inspected ? (
                <div className="mt-1.5">
                  <span className="pill py-0">
                    <Shield className="h-3 w-3" /> AC {e.revealed_ac ?? '?'}
                  </span>
                  {e.revealed_traits?.length > 0 && (
                    <ul className="mt-1 list-inside list-disc text-[10px] text-muted">
                      {e.revealed_traits.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                !defeated && (
                  <button className="btn mt-1.5 w-full py-0.5 text-[11px]" disabled={locked} onClick={() => scan(e)}>
                    <ScanEye className="h-3 w-3" /> Inspect / Scan (DC {SCAN_DC})
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
