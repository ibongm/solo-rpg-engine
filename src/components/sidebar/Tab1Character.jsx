import { useState } from 'react';
import { Dices, Star } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { requestSkillCheck, unlockPerk, castSpell, prepareSpells, learnSpells } from '../../store/localActions.js';
import { hasSpellcasting, castableSpells, slotLevels, castSlotOptions, spellAttackBonus, spellSaveDc, spellDamageDice, preparedLimit, preparableSpells, ordinal } from '../../engine/spellEngine.js';
import { hasPendingSpellChoices, pendingSpellChoices, spellChoiceOptions } from '../../engine/spellProgress.js';
import { SPELLS_BY_ID } from '../../config/spells.js';
import { ABILITIES, ABILITY_LABELS, SKILL_KEYS, skillLabel } from '../../config/genreSkins.js';
import { languageName } from '../../config/srdReskins.js';
import { abilityMod, proficiencyBonus, xpForNextLevel, XP_THRESHOLDS, perkPointsAvailable } from '../../engine/progression.js';
import { buildCheck, effectiveAbility, fmtMod } from '../../engine/diceEngine.js';
import { Meter, Tooltip } from '../common/ui.jsx';
import PerkTree from '../common/PerkTree.jsx';
import { xpMode, xpPace, xpFineTune, XP_PACE_INFO, questsEnabled, milestoneCooldown, levelScale, DEED_XP } from '../../engine/deeds.js';
import { help } from '../../config/helpTooltips.js';

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
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  <Tooltip help={help(`ability.${ab}`)}>{ABILITY_LABELS[ab]}</Tooltip>
                </div>
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

      {hasSpellcasting(character) && <SpellsPanel character={character} campaign={campaign} locked={locked} busy={busy} />}

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
              <Tooltip
                key={k}
                help={help(`skill.${k}`)}
                title={skillLabel(k, skin)}
                flavor={`${fmtMod(check.totalModifier)} = ${check.breakdown.map((b) => `${b.label} ${fmtMod(b.value)}`).join(', ')}`}
                className="w-full min-w-0"
              >
              <button
                disabled={busy || locked}
                onClick={() => {
                  requestSkillCheck(k, intent || draft.text);
                  setIntent('');
                }}
                className="group flex min-w-0 flex-1 items-center justify-between rounded-theme px-2 py-1 text-left text-sm transition hover:bg-surface-2 disabled:opacity-50"
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
              </Tooltip>
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
    const cooldown = milestoneCooldown(character.level || 1, xpPace(campaign));
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
  const pace = xpPace(campaign);
  const fine = xpFineTune(campaign);
  // Same factors scoreDeeds() applies, so the table shows exactly what each deed is worth right now.
  const factor = levelScale(character.level, pace) * XP_PACE_INFO[pace].multiplier * fine;
  const xp = (base) => Math.max(1, Math.round(base * factor));
  const rows = [
    ['Passed check', `${xp(DEED_XP.checkEasy)}–${xp(DEED_XP.checkHeroic)} (by DC)`],
    ['Failed check', xp(DEED_XP.checkFailed)],
    ['Enemy defeated or driven off', xp(DEED_XP.enemyOvercome)],
    ['New location discovered', xp(DEED_XP.locationDiscovered)],
    ['First visit to a location', xp(DEED_XP.locationVisited)],
    ['New codex entry', xp(DEED_XP.loreLearned)],
    ['Faction standing improves', xp(DEED_XP.factionStanding)],
    ['Companion joins you', xp(DEED_XP.allyRecruited)],
    ['Day survived', xp(DEED_XP.daySurvived)],
  ];
  if (questsEnabled(campaign)) rows.push(['Quest completed', `${xp(DEED_XP.questRumor)}–${xp(DEED_XP.questMain)}`]);
  return (
    <div className="mt-3">
      <Meter label={`XP — level ${character.level}`} value={character.xp - prevXp} max={nextXp ? nextXp - prevXp : 1} showValue={false} colorClass="bg-accent-2" />
      {nextXp && <p className="mt-0.5 text-right font-mono text-[11px] text-muted">{character.xp} / {nextXp}</p>}
      <details className="mt-1 text-xs">
        <summary className="cursor-pointer text-muted hover:text-ink">How you earn XP (Deeds · {XP_PACE_INFO[pace].label} pace{fine !== 1 ? ` · ${fine}×` : ''})</summary>
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
        <h3 className="section-title mb-1">
          <Tooltip help={help('stat.save')}>Saving Throws</Tooltip>
        </h3>
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
              <strong>Languages:</strong> {(character.languages || []).map((l) => languageName(l, character.genre)).join(', ')}
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

function spellSummary(character, spell) {
  const area = spell.area ? ' · area' : '';
  if (spell.kind === 'attack') return `${spell.attackType} attack · ${spellDamageDice(character, spell)} ${spell.damageType}${spell.upcast ? ` (+${spell.upcast}/slot)` : ''}`;
  if (spell.kind === 'save') return `${spell.save.toUpperCase()} save · ${spellDamageDice(character, spell)} ${spell.damageType}${spell.onSave === 'half' ? ' (half)' : ''}${spell.upcast ? ` (+${spell.upcast}/slot)` : ''}${area}`;
  if (spell.kind === 'auto') return `auto-hit · ${spellDamageDice(character, spell)} ${spell.damageType}${spell.upcast ? ` (+${spell.upcast}/slot)` : ''}${area}`;
  if (spell.kind === 'heal') return `heal ${spell.heal}${spell.healMod === false ? '' : ' + mod'}${spell.upcast ? ` (+${spell.upcast}/slot)` : ''}`;
  if (spell.kind === 'temp_hp') return `${spell.tempHp} temp HP`;
  return spell.concentration ? 'utility · concentration' : 'utility';
}

function levelLabel(spell, terms) {
  return spell.level === 0 ? terms.cantrips?.replace(/s$/, '') || 'Cantrip' : `${ordinal(spell.level)} level`;
}

/** Spells: attack bonus, save DC, slots per level, active effects, cast (with slot choice), learning and re-preparing. */
function SpellsPanel({ character, campaign, locked, busy }) {
  const [targetId, setTargetId] = useState('');
  const [editing, setEditing] = useState(false);
  const [slotPick, setSlotPick] = useState({});
  const sc = character.spellcasting;
  const terms = character.terms || { spells: 'Spells', cantrips: 'Cantrips' };
  const levels = slotLevels(character);
  const spells = castableSpells(character).slice().sort((a, b) => a.spell.level - b.spell.level || a.spell.name.localeCompare(b.spell.name));
  const enemies = (campaign.combat?.enemies || []).filter((e) => e.health_tier !== 'Defeated');
  const canPrepare = sc && (sc.prepared?.length || sc.spellbook?.length || ['cleric', 'druid', 'paladin'].includes(character.classId)) && !sc.known?.length;
  const pool = canPrepare ? preparableSpells(character) : [];
  const [picked, setPicked] = useState(sc?.prepared || []);
  const limit = sc ? preparedLimit(character) : 0;
  const disabled = locked || busy || Boolean(campaign.pendingRoll);

  return (
    <section>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="section-title">{terms.spells}</h3>
        <span className="font-mono text-xs text-muted">
          attack {fmtMod(spellAttackBonus(character))} · DC {spellSaveDc(character)}
        </span>
      </div>
      {levels.length > 0 && (
        <div className="mb-2 space-y-0.5 text-xs">
          {levels.map((s) => (
            <div key={s.level} className="flex items-center gap-1.5">
              <span className="w-24 shrink-0 text-muted">
                {ordinal(s.level)}-level{sc?.pact ? ' (pact)' : ''}
              </span>
              <span className="flex flex-wrap gap-1">
                {Array.from({ length: s.max }, (_, i) => (
                  <span key={i} className={`h-3 w-3 rounded-full border-theme ${i < s.left ? 'border-accent bg-accent' : 'border-line'}`} aria-hidden="true" />
                ))}
              </span>
              <span className="font-mono">
                {s.left}/{s.max}
              </span>
            </div>
          ))}
          {sc?.pact && <p className="text-[11px] text-muted">Pact slots return on a short rest.</p>}
        </div>
      )}
      {!locked && hasPendingSpellChoices(character) && <LearnSpells character={character} terms={terms} disabled={disabled || campaign.combat?.inCombat} />}
      {(character.activeEffects || []).length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {character.activeEffects.map((e) => (
            <span key={e.id} className="pill border-info text-info">
              {e.name}
              {e.concentration ? ' ◎' : ''}
            </span>
          ))}
        </div>
      )}
      {enemies.length > 0 && (
        <label className="mb-2 flex items-center gap-2 text-xs">
          Target
          <select className="input py-1 text-base sm:text-xs" value={targetId || enemies[0].id} onChange={(e) => setTargetId(e.target.value)}>
            {enemies.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.health_tier})
              </option>
            ))}
          </select>
        </label>
      )}
      <ul className="space-y-1">
        {spells.map(({ spell, source }) => {
          const arcanum = source === 'arcanum';
          const arcanumSpent = arcanum && sc?.arcanumUsed?.[spell.level];
          const options = arcanum ? [] : castSlotOptions(character, spell);
          const noSlot = spell.level > 0 && (arcanum ? arcanumSpent : options.length === 0);
          const chosen = options.includes(Number(slotPick[spell.id])) ? Number(slotPick[spell.id]) : options[0];
          return (
            <li key={spell.id} className="flex items-start gap-2 rounded-theme bg-surface-2/50 px-2 py-1.5">
              <details className="min-w-0 flex-1 text-xs">
                <summary className="cursor-pointer list-none">
                  <span className="text-sm font-semibold">{spell.name}</span>{' '}
                  <span className="text-muted">
                    {levelLabel(spell, terms)}
                    {source === 'species' ? ` · ${character.speciesName}` : source === 'domain' ? ' · domain' : arcanum ? ` · arcanum${arcanumSpent ? ' (spent)' : ''}` : ''}
                  </span>
                  <div className="font-mono text-[10px] text-muted">{spellSummary(character, spell)}</div>
                </summary>
                <p className="mt-1 text-muted">
                  {spell.desc} <span className="opacity-70">({spell.castingTime}, {spell.range})</span>
                </p>
              </details>
              <div className="flex shrink-0 items-center gap-1">
                {options.length > 1 && (
                  <select
                    className="input w-auto px-1 py-1 text-base sm:text-xs"
                    value={chosen}
                    onChange={(e) => setSlotPick({ ...slotPick, [spell.id]: Number(e.target.value) })}
                    aria-label={`Slot level for ${spell.name}`}
                    title="Cast with a higher slot to upcast"
                  >
                    {options.map((l) => (
                      <option key={l} value={l}>
                        {ordinal(l)}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  className="btn px-2.5 py-1 text-xs"
                  disabled={disabled || noSlot}
                  onClick={() => castSpell(spell.id, { targetId: targetId || enemies[0]?.id, slotLevel: arcanum || spell.level === 0 ? null : chosen })}
                  title={noSlot ? (arcanum ? 'Returns after a long rest' : 'No slots left') : `Cast ${spell.name}${chosen && chosen > spell.level ? ` at ${ordinal(chosen)} level` : ''}`}
                >
                  Cast
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {canPrepare && !locked && (
        <div className="mt-2">
          {!editing ? (
            <button className="btn-ghost text-xs" onClick={() => { setPicked(sc.prepared || []); setEditing(true); }} disabled={campaign.combat?.inCombat}>
              Change prepared {terms.spells.toLowerCase()} ({(sc.prepared || []).length}/{limit})
            </button>
          ) : (
            <div className="card-inset space-y-1 p-2 text-xs">
              <div className="label">
                Prepare up to {limit} ({picked.length}/{limit})
              </div>
              <SpellPickList ids={pool} picked={picked} max={limit} onChange={setPicked} />
              <div className="flex gap-2 pt-1">
                <button className="btn-primary px-2 py-1 text-xs" disabled={!picked.length} onClick={async () => { await prepareSpells(picked); setEditing(false); }}>
                  Save
                </button>
                <button className="btn px-2 py-1 text-xs" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Toggle pills grouped by spell level. */
function SpellPickList({ ids, picked, max, onChange }) {
  const byLevel = {};
  for (const id of ids) {
    const sp = SPELLS_BY_ID[id];
    if (sp) (byLevel[sp.level] ??= []).push(sp);
  }
  return (
    <div className="space-y-1">
      {Object.keys(byLevel)
        .map(Number)
        .sort((a, b) => a - b)
        .map((lvl) => (
          <div key={lvl}>
            <div className="text-[10px] uppercase tracking-wide text-muted">{lvl === 0 ? 'Cantrips' : `${ordinal(lvl)} level`}</div>
            <div className="flex flex-wrap gap-1">
              {byLevel[lvl]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((sp) => {
                  const on = picked.includes(sp.id);
                  return (
                    <button
                      key={sp.id}
                      type="button"
                      className={`pill cursor-pointer ${on ? 'border-accent bg-accent text-accent-ink' : ''}`}
                      title={sp.desc}
                      aria-pressed={on}
                      onClick={() => onChange(on ? picked.filter((x) => x !== sp.id) : picked.length < max ? [...picked, sp.id] : picked)}
                    >
                      {sp.name}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
    </div>
  );
}

/** Picks owed after levelling up: new cantrips, spells known, spellbook pages, Mystic Arcanum. */
function LearnSpells({ character, terms, disabled }) {
  const pending = pendingSpellChoices(character);
  const opts = spellChoiceOptions(character);
  const [cantrips, setCantrips] = useState([]);
  const [known, setKnown] = useState([]);
  const [spellbook, setSpellbook] = useState([]);
  const [arcanum, setArcanum] = useState({});
  const [open, setOpen] = useState(false);
  const total = pending.cantrips + pending.known + pending.spellbook + pending.arcanum.length;
  const chosen = cantrips.length + known.length + spellbook.length + Object.keys(arcanum).length;

  if (!open) {
    return (
      <button className="btn-primary mb-2 w-full py-1.5 text-xs" onClick={() => setOpen(true)} disabled={disabled}>
        Learn new {terms.spells.toLowerCase()} ({total} to choose)
      </button>
    );
  }
  return (
    <div className="card-inset mb-2 space-y-2 p-2 text-xs">
      {pending.cantrips > 0 && (
        <div>
          <div className="label">
            {terms.cantrips || 'Cantrips'} ({cantrips.length}/{pending.cantrips})
          </div>
          <SpellPickList ids={opts.cantrips} picked={cantrips} max={pending.cantrips} onChange={setCantrips} />
        </div>
      )}
      {pending.known > 0 && (
        <div>
          <div className="label">
            {terms.spells} known — up to {ordinal(pending.maxLevel)} level ({known.length}/{pending.known})
          </div>
          <SpellPickList ids={opts.known} picked={known} max={pending.known} onChange={setKnown} />
        </div>
      )}
      {pending.spellbook > 0 && (
        <div>
          <div className="label">
            Spellbook — up to {ordinal(pending.maxLevel)} level ({spellbook.length}/{pending.spellbook})
          </div>
          <SpellPickList ids={opts.spellbook} picked={spellbook} max={pending.spellbook} onChange={setSpellbook} />
        </div>
      )}
      {pending.arcanum.map((lvl) => (
        <div key={lvl}>
          <div className="label">Mystic Arcanum — one {ordinal(lvl)}-level spell (once per long rest)</div>
          <SpellPickList ids={opts.arcanum[lvl] || []} picked={arcanum[lvl] ? [arcanum[lvl]] : []} max={1} onChange={(ids) => setArcanum(ids.length ? { ...arcanum, [lvl]: ids[ids.length - 1] } : Object.fromEntries(Object.entries(arcanum).filter(([k]) => Number(k) !== lvl)))} />
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <button
          className="btn-primary px-2 py-1 text-xs"
          disabled={disabled || chosen === 0}
          onClick={async () => {
            const ok = await learnSpells({ cantrips, known, spellbook, arcanum });
            if (ok !== null) {
              setCantrips([]);
              setKnown([]);
              setSpellbook([]);
              setArcanum({});
              setOpen(false);
            }
          }}
        >
          Learn {chosen > 0 ? `(${chosen})` : ''}
        </button>
        <button className="btn px-2 py-1 text-xs" onClick={() => setOpen(false)}>
          Later
        </button>
      </div>
    </div>
  );
}
