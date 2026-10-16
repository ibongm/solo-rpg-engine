import { useState } from 'react';
import { Dices, Star } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { requestSkillCheck, unlockPerk } from '../../store/localActions.js';
import { ABILITIES, ABILITY_LABELS, SKILL_KEYS, SKILLS, skillLabel } from '../../config/genreSkins.js';
import { abilityMod, proficiencyBonus, xpForNextLevel, XP_THRESHOLDS, perkPointsAvailable } from '../../engine/progression.js';
import { buildCheck, effectiveAbility, fmtMod } from '../../engine/diceEngine.js';
import { Meter } from '../common/ui.jsx';
import PerkTree from '../common/PerkTree.jsx';

export default function Tab1Character() {
  const character = useGameStore((s) => s.character);
  const campaign = useGameStore((s) => s.campaign);
  const busy = useGameStore((s) => s.busy);
  const draft = useGameStore((s) => s.draft);
  const [intent, setIntent] = useState('');
  const skin = campaign.skin;
  const weather = campaign.worldState?.weather;
  const nextXp = xpForNextLevel(character.level);
  const prevXp = XP_THRESHOLDS[character.level - 1] || 0;
  const locked = campaign.meta.status !== 'active';
  const points = perkPointsAvailable(character);

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="section-title">Abilities</h3>
          <span className="text-xs text-muted">Proficiency {fmtMod(proficiencyBonus(character.level))}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {ABILITIES.map((ab) => {
            const score = effectiveAbility(character, ab);
            return (
              <div key={ab} className="card-inset py-2 text-center" title={ABILITY_LABELS[ab]}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted">{ABILITY_LABELS[ab]}</div>
                <div className="font-heading text-xl font-bold">{fmtMod(abilityMod(score))}</div>
                <div className="font-mono text-xs text-muted">
                  {score}
                  {score !== character.stats[ab] && <span className="text-info"> ({character.stats[ab]})</span>}
                </div>
              </div>
            );
          })}
        </div>
        <Meter className="mt-3" label={`XP — level ${character.level}`} value={character.xp - prevXp} max={nextXp ? nextXp - prevXp : 1} showValue={Boolean(nextXp)} colorClass="bg-accent-2" />
        {nextXp && <p className="mt-0.5 text-right font-mono text-[11px] text-muted">{character.xp} / {nextXp}</p>}
      </section>

      <section>
        <h3 className="section-title mb-1">Skills</h3>
        <p className="mb-2 text-xs text-muted">Click a skill to ask the DM for a check — the DC is always shown before you roll. Modifiers include gear, perks and weather.</p>
        <input
          className="input mb-2 py-1 text-xs"
          placeholder={draft.text ? `Uses your draft: “${draft.text.slice(0, 40)}”` : 'Optional: what are you trying to do?'}
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          disabled={locked}
        />
        <div className="grid grid-cols-2 gap-1">
          {SKILL_KEYS.map((k) => {
            const check = buildCheck({ character, skillOrStat: { kind: 'skill', key: k }, weather, skin });
            const prof = character.skillProficiencies.includes(k);
            return (
              <button
                key={k}
                disabled={busy || locked}
                onClick={() => {
                  requestSkillCheck(k, intent || draft.text);
                  setIntent('');
                }}
                className="group flex items-center justify-between rounded-theme px-2 py-1 text-left text-sm transition hover:bg-surface-2 disabled:opacity-50"
                title={`${skillLabel(k, skin)} (${SKILLS[k].toUpperCase()}) — ${check.breakdown.map((b) => `${b.label} ${fmtMod(b.value)}`).join(', ')}`}
              >
                <span className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${prof ? 'bg-accent' : 'border border-line'}`} aria-label={prof ? 'proficient' : 'not proficient'} />
                  <span className="truncate">{skillLabel(k, skin)}</span>
                </span>
                <span className="flex items-center gap-1 font-mono text-xs">
                  {check.weatherMod !== 0 && <span className="text-warning">☂</span>}
                  {fmtMod(check.totalModifier)}
                  <Dices className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="section-title">Custom Perk Tree</h3>
          {points > 0 && !locked && (
            <span className="pill border-accent-2 text-accent-2">
              <Star className="h-3 w-3" /> {points} point{points > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <PerkTree character={character} skin={skin} onUnlock={locked ? undefined : unlockPerk} compact />
      </section>

      {character.backstory && (
        <section>
          <h3 className="section-title mb-1">Backstory</h3>
          <p className="whitespace-pre-line text-sm text-muted">{character.backstory}</p>
        </section>
      )}
    </div>
  );
}
