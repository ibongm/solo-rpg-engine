import { useState } from 'react';
import { Dices, Star } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { requestSkillCheck, unlockPerk } from '../../store/localActions.js';
import { ABILITIES, ABILITY_LABELS, SKILL_KEYS, SKILLS, skillLabel } from '../../config/genreSkins.js';
import { abilityMod, proficiencyBonus, xpForNextLevel, XP_THRESHOLDS, perkPointsAvailable } from '../../engine/progression.js';
import { buildCheck, effectiveAbility, fmtMod } from '../../engine/diceEngine.js';
import { Meter } from '../common/ui.jsx';
import PerkTree from '../common/PerkTree.jsx';
import { xpMode, questsEnabled, milestoneCooldown, levelScale, DEED_XP } from '../../engine/deeds.js';

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
        <ProgressPanel character={character} campaign={campaign} prevXp={prevXp} nextXp={nextXp} />
      </section>

      <SheetDetails character={character} weather={weather} skin={skin} />

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

function ProgressPanel({ character, campaign, prevXp, nextXp }) {
  const mode = xpMode(campaign);
  if (mode === 'milestone') {
    const since = Math.max(0, (campaign.turnCount || 0) - (campaign.progress?.lastMilestoneTurn || 0));
    const cooldown = milestoneCooldown(character.level || 1);
    const last = (campaign.progress?.milestones || []).slice(-1)[0];
    return (
      <div className="mt-3 card-inset p-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Level {character.level} · Milestone levelling</span>
          <span className="font-mono text-muted">{nextXp ? (since >= cooldown ? 'ready' : `${cooldown - since} turns`) : 'max'}</span>
        </div>
        <p className="mt-1 text-muted">You level up when the story reaches a major turning point — a significant foe beaten, an arc resolved, an ordeal survived.</p>
        {last && <p className="mt-1">Last milestone: {last.reason}</p>}
      </div>
    );
  }
  const scale = levelScale(character.level);
  const rows = [
    ['Passed check', `${Math.round(DEED_XP.checkEasy * scale)}–${Math.round(DEED_XP.checkHeroic * scale)} (by DC)`],
    ['Failed check', Math.round(DEED_XP.checkFailed * scale)],
    ['Enemy defeated or driven off', Math.round(DEED_XP.enemyOvercome * scale)],
    ['New location discovered', Math.round(DEED_XP.locationDiscovered * scale)],
    ['First visit to a location', Math.round(DEED_XP.locationVisited * scale)],
    ['New codex entry', Math.round(DEED_XP.loreLearned * scale)],
    ['Faction standing improves', Math.round(DEED_XP.factionStanding * scale)],
    ['Companion joins you', Math.round(DEED_XP.allyRecruited * scale)],
    ['Day survived', Math.round(DEED_XP.daySurvived * scale)],
  ];
  if (questsEnabled(campaign)) rows.push(['Quest completed', `${Math.round(DEED_XP.questRumor * scale)}–${Math.round(DEED_XP.questMain * scale)}`]);
  return (
    <div className="mt-3">
      <Meter label={`XP — level ${character.level}`} value={character.xp - prevXp} max={nextXp ? nextXp - prevXp : 1} showValue={false} colorClass="bg-accent-2" />
      {nextXp && <p className="mt-0.5 text-right font-mono text-[11px] text-muted">{character.xp} / {nextXp}</p>}
      <details className="mt-1 text-xs">
        <summary className="cursor-pointer text-muted hover:text-ink">How you earn XP (Deeds)</summary>
        <table className="mt-1 w-full">
          <tbody>
            {rows.map(([label, xp]) => (
              <tr key={label} className="border-b border-line/20 last:border-0">
                <td className="py-0.5">{label}</td>
                <td className="py-0.5 text-right font-mono">+{xp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

/** SRD 5.1 sheet details: saving throws, proficiencies, languages and features. */
function SheetDetails({ character, weather, skin }) {
  const srd = character.rules === 'srd51';
  return (
    <section className="space-y-3">
      {srd && (
        <p className="text-sm">
          <strong>{character.speciesName}</strong> {character.classOrArchetype}
          {character.subclass ? ` (${character.subclass})` : ''} · <span className="text-muted">{character.backgroundName}</span>
        </p>
      )}
      <div>
        <h3 className="section-title mb-1">Saving Throws</h3>
        <div className="grid grid-cols-3 gap-1 text-xs">
          {ABILITIES.map((ab) => {
            const check = buildCheck({ character, skillOrStat: { kind: 'save', key: ab }, weather, skin });
            return (
              <div key={ab} className="flex items-center justify-between rounded-theme bg-surface-2/50 px-2 py-1" title={check.breakdown.map((b) => `${b.label} ${fmtMod(b.value)}`).join(', ')}>
                <span className="flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${check.proficient ? 'bg-accent' : 'border border-line'}`} />
                  {ab.toUpperCase()}
                </span>
                <span className="font-mono">{fmtMod(check.totalModifier)}</span>
              </div>
            );
          })}
        </div>
      </div>
      {srd && (
        <details className="text-xs">
          <summary className="cursor-pointer font-heading text-sm font-bold uppercase tracking-wider text-muted">Features & Proficiencies</summary>
          <div className="mt-2 space-y-2">
            <p>
              <strong>Armor:</strong> {character.armorProficiencies?.length ? character.armorProficiencies.join(', ') : 'none'} · <strong>Weapons:</strong> {(character.weaponProficiencies || []).map((w) => w.replace(/_/g, ' ')).join(', ')}
            </p>
            {character.toolProficiencies?.length > 0 && (
              <p>
                <strong>Tools:</strong> {character.toolProficiencies.join(', ')}
              </p>
            )}
            <p>
              <strong>Languages:</strong> {(character.languages || []).join(', ')}
              {character.darkvision ? ` · Darkvision ${character.darkvision} ft` : ''}
              {character.size === 'small' ? ' · Small' : ''}
            </p>
            {character.expertise?.length > 0 && (
              <p>
                <strong>Expertise:</strong> {character.expertise.map((k) => skillLabel(k, skin)).join(', ')}
              </p>
            )}
            <ul className="space-y-1">
              {(character.features || []).map((f) => (
                <li key={`${f.source}-${f.name}`}>
                  <strong>{f.name}</strong> <span className="text-muted">({f.source})</span> — {f.description}
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </section>
  );
}
