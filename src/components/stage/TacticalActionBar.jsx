import { useState } from 'react';
import { Sword, Crosshair, Sparkles, FlaskConical, Users, ShieldHalf, Footprints, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { submitAction, makeRollRecord } from '../../store/turnRunner.js';
import { consumeItem } from '../../store/localActions.js';
import { buildCheck, damageExpression } from '../../engine/diceEngine.js';
import { companionAttack } from '../../engine/combatEngine.js';

/**
 * Combat drawer: 1-click weapon attacks, perks, consumables, companion commands and stances.
 * Attacks against scanned enemies roll immediately against the revealed AC; otherwise the
 * storyteller is asked to call the attack roll with the target's true AC shown as the DC.
 */
export default function TacticalActionBar() {
  const campaign = useGameStore((s) => s.campaign);
  const character = useGameStore((s) => s.character);
  const busy = useGameStore((s) => s.busy);
  const retryQueue = useGameStore((s) => s.retryQueue);
  const openRollPrompt = useGameStore((s) => s.openRollPrompt);
  const toast = useGameStore((s) => s.toast);
  const [open, setOpen] = useState(true);
  const enemies = (campaign.combat?.enemies || []).filter((e) => e.health_tier !== 'Defeated');
  const [targetId, setTargetId] = useState(enemies[0]?.id || '');
  const target = enemies.find((e) => e.id === targetId) || enemies[0];
  const disabled = busy || Boolean(retryQueue) || character.vitals.hp <= 0 || Boolean(campaign.pendingRoll);

  const weapons = character.inventory.filter((i) => i.type === 'weapon').sort((a, b) => Number(b.equipped) - Number(a.equipped));
  const consumables = character.inventory.filter((i) => i.type === 'consumable' && (i.statModifiers?.heal || i.craftingTags?.includes('antidote')));
  const perks = (character.customPerkTree || []).filter((p) => p.unlocked);
  const companions = (character.companionRoster || []).filter((c) => c.isRecruited && c.hp > 0);

  const attack = (weapon) => {
    if (!target) return;
    if (target.inspected && Number.isInteger(target.revealed_ac)) {
      const check = buildCheck({ character, skillOrStat: 'attack', dc: target.revealed_ac, weather: campaign.worldState.weather, skin: campaign.skin, weapon, reason: `Attack ${target.name} (revealed AC ${target.revealed_ac})` });
      openRollPrompt({
        origin: 'ai',
        title: check.label,
        subtitle: check.reason,
        check,
        withDamage: true,
        onResolve: ({ result, damage }) =>
          submitAction({
            kind: 'roll_result',
            text: `I attack ${target.name} with ${weapon?.name || 'my fists'}: ${result.total} vs AC ${target.revealed_ac} — ${result.success ? `hit for ${damage?.total ?? 0}` : 'miss'}.`,
            roll: makeRollRecord(check, result, { damage: damage || null, targetId: target.id, targetName: target.name }),
          }),
      });
      return;
    }
    const preview = buildCheck({ character, skillOrStat: 'attack', weapon, weather: campaign.worldState.weather });
    submitAction({
      text: `I attack ${target.name} with ${weapon?.name || 'my bare hands'}.`,
      stance: 'Aggressive',
      engineNotes: [`Player attacks enemy [${target.id}] ${target.name} with ${weapon?.name || 'unarmed strike'} (${preview.isRanged ? 'ranged' : 'melee'}, damage ${damageExpression(preview, character).expr}). Request roll_request skill_or_stat "attack" with dc = ${target.name}'s true AC.`],
    });
  };

  const commandCompanion = (c) => {
    if (!target) return;
    const r = companionAttack({ companion: c, enemy: target });
    toast(r.summary, r.hit ? 'success' : 'info', 6000);
    submitAction({
      text: `I signal ${c.name} to attack ${target.name}.`,
      stance: 'Tactical',
      companionActions: [r.summary],
      engineNotes: ['Narrate the companion’s attack exactly as the engine resolved it and update the enemy health_tier accordingly. Then continue the round.'],
    });
  };

  return (
    <div className="border-t-theme border-danger/40 bg-surface/90 px-4 py-2 no-print">
      <div className="flex items-center justify-between gap-2">
        <button className="section-title flex items-center gap-1" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />} Tactical Actions
        </button>
        {enemies.length > 0 && (
          <label className="flex items-center gap-1 text-xs">
            <Crosshair className="h-3.5 w-3.5 text-danger" />
            <select className="input w-auto py-0.5 text-xs" value={target?.id || ''} onChange={(e) => setTargetId(e.target.value)} aria-label="Target">
              {enemies.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.distance}, {e.health_tier})
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {open && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {(weapons.length ? weapons : [null]).map((w) => {
            const check = buildCheck({ character, skillOrStat: 'attack', weapon: w, weather: campaign.worldState.weather });
            return (
              <button key={w?.id || 'unarmed'} className="card w-36 shrink-0 p-2 text-left text-xs transition hover:shadow-glow disabled:opacity-50" disabled={disabled || !target} onClick={() => attack(w)}>
                <div className="flex items-center gap-1 font-semibold">
                  <Sword className="h-3.5 w-3.5 text-accent" /> {w?.name || 'Unarmed'}
                </div>
                <div className="mt-0.5 font-mono text-muted">
                  {check.totalModifier >= 0 ? '+' : ''}
                  {check.totalModifier} to hit · {damageExpression(check, character).expr}
                </div>
                {w?.equipped && <div className="text-[10px] text-accent">equipped</div>}
              </button>
            );
          })}
          {perks.map((p) => (
            <button
              key={p.id}
              className="card w-36 shrink-0 p-2 text-left text-xs transition hover:shadow-glow disabled:opacity-50"
              disabled={disabled}
              onClick={() => submitAction({ text: `I use my ${p.name} perk${target ? ` against ${target.name}` : ''}: ${p.description}`, stance: 'Tactical' })}
              title={p.description}
            >
              <div className="flex items-center gap-1 font-semibold">
                <Sparkles className="h-3.5 w-3.5 text-accent-2" /> {p.name}
              </div>
              <div className="line-clamp-2 text-muted">{p.description}</div>
            </button>
          ))}
          {consumables.map((c) => (
            <button key={c.id} className="card w-32 shrink-0 p-2 text-left text-xs transition hover:shadow-glow disabled:opacity-50" disabled={disabled} onClick={() => consumeItem(c.id)}>
              <div className="flex items-center gap-1 font-semibold">
                <FlaskConical className="h-3.5 w-3.5 text-success" /> {c.name}
              </div>
              <div className="text-muted">{c.statModifiers?.heal ? `Heal ${c.statModifiers.heal}` : 'Cure poison'}</div>
            </button>
          ))}
          {companions.map((c) => (
            <button key={c.id} className="card w-36 shrink-0 p-2 text-left text-xs transition hover:shadow-glow disabled:opacity-50" disabled={disabled || !target} onClick={() => commandCompanion(c)}>
              <div className="flex items-center gap-1 font-semibold">
                <Users className="h-3.5 w-3.5 text-success" /> {c.name}
              </div>
              <div className="font-mono text-muted">
                +{c.attackBonus} · {c.damageDice}
              </div>
            </button>
          ))}
          {[
            { label: 'Dodge', icon: ShieldHalf, text: 'I take the Dodge action, focusing entirely on avoiding attacks.' },
            { label: 'Disengage', icon: Footprints, text: 'I Disengage and fall back carefully.' },
            { label: 'Hide', icon: EyeOff, text: 'I try to Hide.' },
          ].map(({ label, icon: Icon, text }) => (
            <button key={label} className="card w-24 shrink-0 p-2 text-left text-xs transition hover:shadow-glow disabled:opacity-50" disabled={disabled} onClick={() => submitAction({ text, stance: 'Tactical' })}>
              <div className="flex items-center gap-1 font-semibold">
                <Icon className="h-3.5 w-3.5" /> {label}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
