import { useMemo, useState } from 'react';
import { UserPlus, Copy, Trash2, Pencil, Printer, Sparkles, Dices, Shield, Heart, Swords, Wand2, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { createCharacterDoc, updateCharacterDoc, deleteCharacterDoc } from '../../firebase/db.js';
import { callApi } from '../../firebase/api.js';
import { ABILITIES, ABILITY_LABELS, GENRES, GENRE_IDS, SKILL_KEYS, SKILLS, buildSkin, skillLabel } from '../../config/genreSkins.js';
import { DEFAULT_MODEL, computeTextCost } from '../../config/models.js';
import {
  POINT_BUY_BUDGET,
  POINT_BUY_COSTS,
  STANDARD_ARRAY,
  SKILL_PICKS,
  abilityMod,
  pointBuyCost,
  roll4d6DropLowest,
  createCharacter,
  cloneCharacter,
  defaultHitDie,
  normalizePerkTree,
  startingHp,
} from '../../engine/progression.js';
import { effectiveAc, fmtMod } from '../../engine/diceEngine.js';
import { Modal, EmptyState, Spinner, ConfirmButton, SegmentedControl } from '../common/ui.jsx';
import PerkTree from '../common/PerkTree.jsx';
import PrintSheet from '../common/PrintSheet.jsx';

export default function CharacterVault({ characters, campaigns, onChange }) {
  const user = useGameStore((s) => s.user);
  const toast = useGameStore((s) => s.toast);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [printing, setPrinting] = useState(null);
  const [viewing, setViewing] = useState(null);

  const campaignTitle = (id) => campaigns.find((c) => c.id === id)?.meta?.title;

  const alive = characters.filter((c) => c.status !== 'fallen');
  const fallen = characters.filter((c) => c.status === 'fallen');

  const clone = async (c) => {
    try {
      await createCharacterDoc(user.uid, cloneCharacter(c));
      toast(`Cloned ${c.name}.`, 'success');
      onChange();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const remove = async (c) => {
    try {
      await deleteCharacterDoc(user.uid, c.id);
      toast(`${c.name} was removed from the Roster.`, 'info');
      onChange();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">The Roster</h2>
          <p className="text-sm text-muted">Characters live independently of campaigns. Surviving veterans can carry on into sequels.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          <UserPlus className="h-4 w-4" /> New Character
        </button>
      </div>

      {alive.length === 0 ? (
        <EmptyState icon={<UserPlus className="h-10 w-10" />} title="No heroes yet" action={<button className="btn-primary" onClick={() => setCreating(true)}>Create your first character</button>}>
          Build a character with point-buy, the standard array or honest 4d6 rolls, then forge a world for them.
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {alive.map((c) => (
            <CharacterCard
              key={c.id}
              character={c}
              campaignTitle={campaignTitle(c.activeCampaignId)}
              onView={() => setViewing(c)}
              onEdit={() => setEditing(c)}
              onClone={() => clone(c)}
              onDelete={() => remove(c)}
              onPrint={() => setPrinting(c)}
            />
          ))}
        </div>
      )}

      {fallen.length > 0 && (
        <p className="mt-6 text-sm text-muted">{fallen.length} fallen character(s) rest in the Hall of Fame.</p>
      )}

      {creating && (
        <CharacterCreator
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            onChange();
          }}
        />
      )}
      {editing && (
        <CharacterCreator
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChange();
          }}
        />
      )}
      {viewing && (
        <Modal title={`${viewing.name} — Perk Tree`} onClose={() => setViewing(null)} wide>
          <PerkTree character={viewing} skin={buildSkin(viewing.genre)} />
        </Modal>
      )}
      {printing && <PrintSheet character={printing} skin={buildSkin(printing.genre)} onClose={() => setPrinting(null)} />}
    </section>
  );
}

function CharacterCard({ character: c, campaignTitle, onView, onEdit, onClone, onDelete, onPrint }) {
  const genre = GENRES[c.genre] || GENRES.fantasy;
  const locked = Boolean(c.activeCampaignId);
  return (
    <article className="card flex flex-col p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-theme border-theme border-line/60 bg-surface-2 font-heading text-xl font-bold text-accent">
          {c.portraitUrl ? <img src={c.portraitUrl} alt="" className="h-full w-full object-cover" /> : c.name.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold">{c.name}</h3>
          <p className="text-sm text-muted">
            Level {c.level} {c.classOrArchetype} · {genre.label}
          </p>
          {locked && <p className="mt-0.5 text-xs text-accent">In campaign: {campaignTitle || 'active campaign'}</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="pill">
          <Heart className="h-3 w-3 text-danger" /> {c.vitals.hp}/{c.vitals.maxHp}
        </span>
        <span className="pill">
          <Shield className="h-3 w-3" /> AC {effectiveAc(c)}
        </span>
        <span className="pill">
          <Swords className="h-3 w-3" /> {c.inventory?.length || 0} items
        </span>
        <span className="pill">
          {c.currency?.amount} {c.currency?.label}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-6 gap-1 text-center">
        {ABILITIES.map((ab) => (
          <div key={ab} className="card-inset py-1">
            <div className="text-[10px] font-bold uppercase text-muted">{ab}</div>
            <div className="font-mono text-sm">{c.stats[ab]}</div>
          </div>
        ))}
      </div>
      <div className="mt-auto flex flex-wrap gap-1 pt-3">
        <button className="btn-ghost" onClick={onEdit} title="Edit">
          <Pencil className="h-4 w-4" />
        </button>
        <button className="btn-ghost" onClick={onClone} title="Clone">
          <Copy className="h-4 w-4" />
        </button>
        <button className="btn-ghost" onClick={onView} title="Perk Tree" disabled={!c.customPerkTree?.length}>
          <Sparkles className="h-4 w-4" />
        </button>
        <button className="btn-ghost" onClick={onPrint} title="Print sheet">
          <Printer className="h-4 w-4" />
        </button>
        <div className="ml-auto">
          <ConfirmButton className="btn-ghost text-danger" confirmLabel="Delete?" onConfirm={onDelete} disabled={locked}>
            <Trash2 className="h-4 w-4" />
          </ConfirmButton>
        </div>
      </div>
    </article>
  );
}

const STEPS = ['Concept', 'Abilities', 'Skills', 'Perk Tree', 'Review'];

function CharacterCreator({ initial = null, onClose, onSaved }) {
  const user = useGameStore((s) => s.user);
  const toast = useGameStore((s) => s.toast);
  const addSessionTelemetry = useGameStore((s) => s.addSessionTelemetry);
  const canRebuild = !initial || (!initial.activeCampaignId && (initial.xp || 0) === 0 && (initial.level || 1) === 1);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initial?.name || '');
  const [genre, setGenre] = useState(initial?.genre || 'fantasy');
  const [archetype, setArchetype] = useState(initial?.classOrArchetype || GENRES.fantasy.archetypes[0]);
  const [backstory, setBackstory] = useState(initial?.backstory || '');
  const [portraitUrl, setPortraitUrl] = useState(initial?.portraitUrl || '');
  const [method, setMethod] = useState('pointbuy');
  const [stats, setStats] = useState(initial?.stats || { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 });
  const [arrayAssign, setArrayAssign] = useState({ str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 });
  const [rolled, setRolled] = useState(null);
  const [rollAssign, setRollAssign] = useState({});
  const [skills, setSkills] = useState(initial?.skillProficiencies || []);
  const [hitDie, setHitDie] = useState(initial?.hitDie || defaultHitDie(archetype));
  const [perks, setPerks] = useState(initial?.customPerkTree || []);
  const [perkBusy, setPerkBusy] = useState(false);

  const genreDef = GENRES[genre] || GENRES.fantasy;
  const skin = useMemo(() => buildSkin(genre), [genre]);

  const finalStats = useMemo(() => {
    if (method === 'array') return arrayAssign;
    if (method === 'roll' && rolled) {
      const out = {};
      for (const ab of ABILITIES) out[ab] = rolled[rollAssign[ab]]?.score ?? 8;
      return out;
    }
    return stats;
  }, [method, arrayAssign, rolled, rollAssign, stats]);

  const pbCost = pointBuyCost(stats);
  const statsValid =
    method === 'pointbuy'
      ? pbCost <= POINT_BUY_BUDGET
      : method === 'array'
        ? STANDARD_ARRAY.slice().sort().join() === Object.values(arrayAssign).slice().sort().join()
        : rolled && new Set(Object.values(rollAssign)).size === 6 && ABILITIES.every((a) => rollAssign[a] !== undefined);

  const stepValid = [Boolean(name.trim()) && Boolean(archetype.trim()), !canRebuild || statsValid, !canRebuild || skills.length === SKILL_PICKS, true, true];

  const generatePerks = async () => {
    setPerkBusy(true);
    try {
      const ranked = ABILITIES.slice().sort((a, b) => finalStats[b] - finalStats[a]);
      const res = await callApi('world-forge', {
        mode: 'perkTree',
        model: DEFAULT_MODEL,
        genre,
        genreLabel: genreDef.label,
        classOrArchetype: archetype,
        concept: `${name}, a ${archetype}. ${backstory}`.slice(0, 1900),
        primaryAbilities: ranked.slice(0, 3).map((a) => ABILITY_LABELS[a]),
      });
      setPerks(normalizePerkTree(res.result?.perks));
      const cost = computeTextCost(res.model, res.usage || {});
      addSessionTelemetry({ inputTokens: res.usage?.inputTokens, outputTokens: res.usage?.outputTokens, cachedTokens: res.usage?.cachedTokens, costUSD: cost });
      toast('Perk Tree forged.', 'success');
    } catch (err) {
      toast(`Perk Tree generation failed: ${err.message}`, 'error');
    } finally {
      setPerkBusy(false);
    }
  };

  const doRoll = () => {
    const r = ABILITIES.map(() => roll4d6DropLowest());
    setRolled(r);
    setRollAssign({});
  };

  const save = async () => {
    setSaving(true);
    try {
      if (initial && !canRebuild) {
        await updateCharacterDoc(user.uid, initial.id, {
          ...initial,
          name: name.trim(),
          classOrArchetype: archetype.trim(),
          backstory,
          portraitUrl: portraitUrl.trim() || null,
          customPerkTree: initial.customPerkTree?.some((p) => p.unlocked) ? initial.customPerkTree : perks,
        });
      } else {
        const fresh = createCharacter({
          name,
          genre,
          classOrArchetype: archetype,
          stats: finalStats,
          skillProficiencies: skills,
          hitDie,
          currencyLabel: genreDef.currencyLabel,
          customPerkTree: perks,
          backstory,
        });
        fresh.portraitUrl = portraitUrl.trim() || null;
        if (initial) await updateCharacterDoc(user.uid, initial.id, { ...fresh, createdAt: initial.createdAt });
        else await createCharacterDoc(user.uid, fresh);
      }
      toast(`${name.trim()} has been ${initial ? 'updated' : 'added to the Roster'}.`, 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const visibleSteps = canRebuild ? STEPS : ['Concept', 'Perk Tree'];
  const stepKey = visibleSteps[step];
  const isLast = step === visibleSteps.length - 1;
  const currentValid = stepValid[STEPS.indexOf(stepKey)];

  return (
    <Modal
      title={initial ? `Edit ${initial.name}` : 'New Character'}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={() => (step === 0 ? onClose() : setStep(step - 1))}>
            <ChevronLeft className="h-4 w-4" /> {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {isLast || (initial && !canRebuild && stepKey === 'Perk Tree') ? (
            <button className="btn-primary" onClick={save} disabled={saving || !stepValid.every(Boolean)}>
              {saving ? <Spinner /> : <Save className="h-4 w-4" />} Save Character
            </button>
          ) : (
            <button className="btn-primary" onClick={() => setStep(step + 1)} disabled={!currentValid}>
              Next <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </>
      }
    >
      <ol className="mb-5 flex flex-wrap gap-2 text-xs">
        {visibleSteps.map((s, i) => (
          <li key={s} className={`pill ${i === step ? 'border-accent bg-accent text-accent-ink' : ''}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      {initial && !canRebuild && step === 0 && (
        <p className="card-inset mb-4 p-2 text-xs text-muted">This character has progressed or is in an active campaign, so stats and skills are locked. You can still edit their concept and portrait.</p>
      )}

      {stepKey === 'Concept' && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="cc-name">Name</label>
            <input id="cc-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Mara Vell" />
          </div>
          <div>
            <label className="label" htmlFor="cc-genre">Genre</label>
            <select
              id="cc-genre"
              className="input"
              value={genre}
              disabled={Boolean(initial) && !canRebuild}
              onChange={(e) => {
                setGenre(e.target.value);
                const a = GENRES[e.target.value].archetypes[0];
                setArchetype(a);
                setHitDie(defaultHitDie(a));
              }}
            >
              {GENRE_IDS.map((g) => (
                <option key={g} value={g}>
                  {GENRES[g].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="cc-arch">Class / Archetype</label>
            <input
              id="cc-arch"
              className="input"
              list="cc-archetypes"
              value={archetype}
              onChange={(e) => {
                setArchetype(e.target.value);
                if (canRebuild) setHitDie(defaultHitDie(e.target.value));
              }}
              maxLength={60}
            />
            <datalist id="cc-archetypes">
              {genreDef.archetypes.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-muted">Pick a preset or type any concept — a custom Perk Tree adapts to it.</p>
          </div>
          <div>
            <label className="label" htmlFor="cc-portrait">Portrait URL (optional)</label>
            <input id="cc-portrait" className="input" value={portraitUrl} onChange={(e) => setPortraitUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="cc-back">Backstory</label>
            <textarea id="cc-back" className="input min-h-[110px]" value={backstory} onChange={(e) => setBackstory(e.target.value)} maxLength={2000} placeholder="Who are they? What do they want? What haunts them?" />
          </div>
        </div>
      )}

      {stepKey === 'Abilities' && (
        <div>
          <SegmentedControl
            size="md"
            value={method}
            onChange={setMethod}
            options={[
              { value: 'pointbuy', label: 'Point Buy (27)' },
              { value: 'array', label: 'Standard Array' },
              { value: 'roll', label: 'Roll 4d6 drop lowest' },
            ]}
          />
          {method === 'pointbuy' && (
            <div className="mt-4">
              <p className={`mb-3 text-sm ${pbCost > POINT_BUY_BUDGET ? 'text-danger' : 'text-muted'}`}>
                Points spent: <strong className="font-mono">{pbCost}</strong> / {POINT_BUY_BUDGET} (scores 8–15)
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {ABILITIES.map((ab) => (
                  <div key={ab} className="card-inset flex items-center justify-between p-2">
                    <div>
                      <div className="text-xs font-bold uppercase">{ABILITY_LABELS[ab]}</div>
                      <div className="text-xs text-muted">mod {fmtMod(abilityMod(stats[ab]))} · cost {POINT_BUY_COSTS[stats[ab]]}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button className="btn px-2 py-0.5" disabled={stats[ab] <= 8} onClick={() => setStats({ ...stats, [ab]: stats[ab] - 1 })} aria-label={`Decrease ${ab}`}>
                        −
                      </button>
                      <span className="w-6 text-center font-mono">{stats[ab]}</span>
                      <button className="btn px-2 py-0.5" disabled={stats[ab] >= 15} onClick={() => setStats({ ...stats, [ab]: stats[ab] + 1 })} aria-label={`Increase ${ab}`}>
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {method === 'array' && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ABILITIES.map((ab) => (
                <div key={ab} className="card-inset p-2">
                  <label className="label" htmlFor={`arr-${ab}`}>{ABILITY_LABELS[ab]}</label>
                  <select id={`arr-${ab}`} className="input" value={arrayAssign[ab]} onChange={(e) => setArrayAssign({ ...arrayAssign, [ab]: Number(e.target.value) })}>
                    {STANDARD_ARRAY.map((v) => (
                      <option key={v} value={v}>
                        {v} ({fmtMod(abilityMod(v))})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {!statsValid && <p className="col-span-full text-sm text-danger">Use each array value (15, 14, 13, 12, 10, 8) exactly once.</p>}
            </div>
          )}
          {method === 'roll' && (
            <div className="mt-4">
              <button className="btn-primary" onClick={doRoll}>
                <Dices className="h-4 w-4" /> {rolled ? 'Re-roll all (visible)' : 'Roll six scores'}
              </button>
              {rolled && (
                <>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {rolled.map((r, i) => (
                      <span key={i} className="pill font-mono" title={`Rolled ${r.rolls.join(', ')}; dropped ${r.dropped}`}>
                        #{i + 1}: {r.score} <span className="text-muted">[{r.rolls.join(',')}]</span>
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {ABILITIES.map((ab) => (
                      <div key={ab} className="card-inset p-2">
                        <label className="label" htmlFor={`roll-${ab}`}>{ABILITY_LABELS[ab]}</label>
                        <select
                          id={`roll-${ab}`}
                          className="input"
                          value={rollAssign[ab] ?? ''}
                          onChange={(e) => setRollAssign({ ...rollAssign, [ab]: e.target.value === '' ? undefined : Number(e.target.value) })}
                        >
                          <option value="">—</option>
                          {rolled.map((r, i) => (
                            <option key={i} value={i} disabled={Object.entries(rollAssign).some(([k, v]) => v === i && k !== ab)}>
                              #{i + 1}: {r.score}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <div className="mt-4 flex items-center gap-3">
            <label className="label mb-0" htmlFor="cc-hd">Hit Die</label>
            <select id="cc-hd" className="input w-auto" value={hitDie} onChange={(e) => setHitDie(Number(e.target.value))}>
              {[6, 8, 10, 12].map((d) => (
                <option key={d} value={d}>
                  d{d}
                </option>
              ))}
            </select>
            <span className="text-sm text-muted">Starting HP: {startingHp(hitDie, finalStats.con)}</span>
          </div>
        </div>
      )}

      {stepKey === 'Skills' && (
        <div>
          <p className="mb-3 text-sm text-muted">
            Choose {SKILL_PICKS} proficient skills ({skills.length}/{SKILL_PICKS}). Labels follow the {genreDef.label} skin.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SKILL_KEYS.map((k) => {
              const on = skills.includes(k);
              return (
                <button
                  key={k}
                  className={`flex items-center justify-between rounded-theme border-theme px-3 py-2 text-left text-sm transition ${on ? 'border-accent bg-accent/10' : 'border-line/40 hover:bg-surface-2'}`}
                  onClick={() => setSkills(on ? skills.filter((s) => s !== k) : skills.length < SKILL_PICKS ? [...skills, k] : skills)}
                >
                  <span>{skillLabel(k, skin)}</span>
                  <span className="text-xs uppercase text-muted">{SKILLS[k]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {stepKey === 'Perk Tree' && (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <button className="btn-primary" onClick={generatePerks} disabled={perkBusy || (initial?.customPerkTree || []).some((p) => p.unlocked)}>
              {perkBusy ? <Spinner /> : <Wand2 className="h-4 w-4" />} {perks.length ? 'Regenerate' : 'Generate'} Custom Perk Tree
            </button>
            <span className="text-sm text-muted">Optional. AI designs 10 perks across 5 tiers for this concept; unlocking uses deterministic 5e math.</span>
          </div>
          {(initial?.customPerkTree || []).some((p) => p.unlocked) && <p className="mb-2 text-xs text-muted">Perks are already unlocked, so the tree is locked in.</p>}
          <PerkTree character={{ ...(initial || {}), level: initial?.level || 1, customPerkTree: perks }} skin={skin} />
        </div>
      )}

      {stepKey === 'Review' && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card-inset p-3">
            <h3 className="text-lg font-bold">{name}</h3>
            <p className="text-sm text-muted">
              Level 1 {archetype} · {genreDef.label} · d{hitDie}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {ABILITIES.map((ab) => (
                <div key={ab} className="card text-center">
                  <div className="text-[10px] font-bold uppercase text-muted">{ab}</div>
                  <div className="font-mono">{finalStats[ab]}</div>
                  <div className="text-xs text-muted">{fmtMod(abilityMod(finalStats[ab]))}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm">
              HP {startingHp(hitDie, finalStats.con)} · AC {10 + abilityMod(finalStats.dex)} (+ armor) · {genreDef.currencyLabel} 50
            </p>
          </div>
          <div className="card-inset p-3 text-sm">
            <div className="label">Skills</div>
            <p>{skills.map((s) => skillLabel(s, skin)).join(', ')}</p>
            <div className="label mt-3">Perk Tree</div>
            <p>{perks.length ? `${perks.length} perks across 5 tiers` : 'None (can be generated later by editing)'}</p>
            <div className="label mt-3">Starter kit</div>
            <p>A genre-appropriate weapon, armor, a healing item and 3 days of {genreDef.rationLabel}.</p>
          </div>
        </div>
      )}
    </Modal>
  );
}
