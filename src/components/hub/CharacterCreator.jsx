import { useEffect, useMemo, useState } from 'react';
import { Dices, Wand2, ChevronLeft, ChevronRight, Save, Check, Minus, Plus, Shield, Heart, Footprints, Lock, Coins } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { createCharacterDoc, updateCharacterDoc } from '../../firebase/db.js';
import { callApi } from '../../firebase/api.js';
import { ABILITIES, ABILITY_LABELS, GENRES, GENRE_IDS, SKILL_KEYS, SKILLS, buildSkin, skillLabel } from '../../config/genreSkins.js';
import { DEFAULT_MODEL, computeTextCost } from '../../config/models.js';
import { SPECIES, CLASSES, BACKGROUNDS, SPECIES_BY_ID, CLASSES_BY_ID, BACKGROUNDS_BY_ID, FIGHTING_STYLES, DRAGON_ANCESTRIES, ITEMS, WEAPONS, ARMOR, GEAR, ANY_LABELS } from '../../config/srd.js';
import { help } from '../../config/helpTooltips.js';
import { sanitizeMediaSkin, mediaSkinOverrides } from '../../engine/mediaSkin.js';
import { genreTerms, speciesName, speciesBlurb, className, backgroundName, itemName, itemLabel, languageName, availableLanguages } from '../../config/srdReskins.js';
import { POINT_BUY_BUDGET, POINT_BUY_COSTS, STANDARD_ARRAY, abilityMod, pointBuyCost, roll4d6DropLowest, normalizePerkTree } from '../../engine/progression.js';
import {
  finalAbilityScores,
  speciesBonusSummary,
  grantedSkills,
  classSkillList,
  resolveKit,
  kitPickSlots,
  optionAllowed,
  itemsForFilter,
  buildProficiencies,
  rollStartingWealth,
  averageStartingWealth,
  itemPrice,
  backgroundKit,
  backgroundGold,
  validateBuild,
  buildSrdCharacter,
} from '../../engine/characterBuilder.js';
import { effectiveAc, effectiveSpeed, fmtMod } from '../../engine/diceEngine.js';
import { isWeaponProficient, isArmorProficient } from '../../engine/characterBuilder.js';
import { Modal, Spinner, SegmentedControl, Tooltip } from '../common/ui.jsx';
import { SPELLS_BY_ID, CLASS_SPELL_LISTS } from '../../config/spells.js';
import { classSpellOptions, validateSpells, preparedLimitFor } from '../../engine/spellEngine.js';
import PerkTree from '../common/PerkTree.jsx';

const toggleIn = (list, v, max) => (list.includes(v) ? list.filter((x) => x !== v) : list.length < max ? [...list, v] : list);

export default function CharacterCreator({ initial = null, onClose, onSaved }) {
  const user = useGameStore((s) => s.user);
  const toast = useGameStore((s) => s.toast);
  const addSessionTelemetry = useGameStore((s) => s.addSessionTelemetry);
  const canRebuild = !initial || (!initial.activeCampaignId && (initial.xp || 0) === 0 && (initial.level || 1) === 1);
  const fromSrd = initial?.rules === 'srd51';

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  // Concept
  const [name, setName] = useState(initial?.name || '');
  const [genre, setGenre] = useState(initial?.genre || 'fantasy');
  const [mediaSkin, setMediaSkin] = useState(initial?.mediaSkin || null);
  const [mediaTitle, setMediaTitle] = useState(initial?.mediaSkin?.title || '');
  const [mediaNotes, setMediaNotes] = useState('');
  const [mediaBusy, setMediaBusy] = useState(false);
  // TV / movie universe names (null for every other genre).
  const media = genre === 'tv_movie' ? mediaSkin : null;
  // The Almanac follows the genre on screen while no campaign is open.
  useEffect(() => {
    useGameStore.getState().setAlmanacGenre(genre);
    return () => useGameStore.getState().setAlmanacGenre(null);
  }, [genre]);
  const [backstory, setBackstory] = useState(initial?.backstory || '');
  const [portraitUrl, setPortraitUrl] = useState(initial?.portraitUrl || '');
  // Species
  const [speciesId, setSpeciesId] = useState(fromSrd ? initial.speciesId : 'human');
  const [flexible, setFlexible] = useState([]);
  const [speciesSkills, setSpeciesSkills] = useState([]);
  const [dragonAncestry, setDragonAncestry] = useState('red');
  const [toolChoice, setToolChoice] = useState('');
  const [languages, setLanguages] = useState([]);
  // Class
  const [classId, setClassId] = useState(fromSrd ? initial.classId : 'fighter');
  const [fightingStyle, setFightingStyle] = useState(initial?.fightingStyle || 'defense');
  // Abilities
  const [method, setMethod] = useState('pointbuy');
  const [stats, setStats] = useState(initial?.baseStats || { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 });
  const [arrayAssign, setArrayAssign] = useState({ str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 });
  const [rolled, setRolled] = useState(null);
  const [rollAssign, setRollAssign] = useState({});
  // Background & skills
  const [backgroundId, setBackgroundId] = useState(fromSrd ? initial.backgroundId : 'veteran');
  const [backgroundSkills, setBackgroundSkills] = useState([]);
  const [classSkills, setClassSkills] = useState([]);
  const [expertise, setExpertise] = useState([]);
  // Equipment
  const [equipMode, setEquipMode] = useState('kit');
  const [kitChoices, setKitChoices] = useState({});
  const [anyPicks, setAnyPicks] = useState({});
  const [wealth, setWealth] = useState(null);
  const [cart, setCart] = useState({});
  // Spells
  const [cantripPicks, setCantripPicks] = useState([]);
  const [knownPicks, setKnownPicks] = useState([]);
  const [preparedPicks, setPreparedPicks] = useState([]);
  const [bookPicks, setBookPicks] = useState([]);
  const [speciesCantrip, setSpeciesCantrip] = useState('');
  // Perks
  const [perks, setPerks] = useState(initial?.customPerkTree || []);
  const [perkBusy, setPerkBusy] = useState(false);

  const genreDef = GENRES[genre] || GENRES.fantasy;
  const skin = useMemo(() => buildSkin(genre, mediaSkinOverrides(media)), [genre, media]);
  const terms = genreTerms(genre, media);
  const sp = SPECIES_BY_ID[speciesId];
  const cls = CLASSES_BY_ID[classId];
  const bg = BACKGROUNDS_BY_ID[backgroundId];
  const profs = useMemo(() => buildProficiencies(speciesId, classId), [speciesId, classId]);

  const baseStats = useMemo(() => {
    if (method === 'array') return arrayAssign;
    if (method === 'roll' && rolled) {
      const out = {};
      for (const ab of ABILITIES) out[ab] = rolled[rollAssign[ab]]?.score ?? 8;
      return out;
    }
    return stats;
  }, [method, arrayAssign, rolled, rollAssign, stats]);
  const finalStats = useMemo(() => finalAbilityScores(baseStats, speciesId, flexible), [baseStats, speciesId, flexible]);

  const pbCost = pointBuyCost(stats);
  const statsValid =
    method === 'pointbuy'
      ? pbCost <= POINT_BUY_BUDGET
      : method === 'array'
        ? STANDARD_ARRAY.slice().sort().join() === Object.values(arrayAssign).slice().sort().join()
        : rolled && new Set(Object.values(rollAssign)).size === 6 && ABILITIES.every((a) => rollAssign[a] !== undefined);

  const granted = useMemo(() => grantedSkills({ speciesId, backgroundId, speciesSkillChoices: speciesSkills, backgroundSkillChoices: backgroundSkills }), [speciesId, backgroundId, speciesSkills, backgroundSkills]);
  const classPicks = classSkills.filter((s) => !granted.includes(s));
  const allSkills = Array.from(new Set([...granted, ...classPicks]));
  const extraLanguageCount = (sp?.extraLanguages || 0) + (bg?.extraLanguages || 0);

  const equipment = useMemo(() => {
    if (equipMode === 'gold') return Object.entries(cart).filter(([, q]) => q > 0).map(([id, qty]) => ({ id, qty }));
    return [...resolveKit({ classId, choices: kitChoices, anyPicks }), ...backgroundKit(backgroundId)];
  }, [equipMode, cart, classId, kitChoices, anyPicks, backgroundId]);
  const spent = Object.entries(cart).reduce((sum, [id, q]) => sum + itemPrice(id) * q, 0);
  const currency = equipMode === 'gold' ? Math.max(0, (wealth?.total || 0) - spent) : backgroundGold(backgroundId);
  const slots = kitPickSlots({ classId, choices: kitChoices });
  const kitComplete = equipMode === 'gold' ? Boolean(wealth) && spent <= (wealth?.total || 0) : slots.every((s) => anyPicks[s.key]);

  const build = {
    name,
    genre,
    mediaSkin: media,
    speciesId,
    classId,
    backgroundId,
    baseStats,
    flexibleBonuses: flexible,
    speciesSkills,
    backgroundSkills,
    classSkills: classPicks,
    expertise,
    fightingStyle,
    dragonAncestry,
    toolChoice,
    languages,
    equipment,
    currency,
    backstory,
    portraitUrl,
    customPerkTree: perks,
    spells: { cantrips: cantripPicks, known: knownPicks, prepared: preparedPicks, spellbook: bookPicks, speciesCantrip },
  };
  const spellErrors = canRebuild ? validateSpells({ classId, speciesId, finalStats, cantrips: cantripPicks, known: knownPicks, prepared: preparedPicks, spellbook: bookPicks, speciesCantrip }) : [];
  const buildErrors = canRebuild ? [...validateBuild(build), ...spellErrors] : [];
  const needsSpells = Boolean(cls?.spellcasting || sp?.bonusCantrip);
  const preview = useMemo(() => {
    if (!canRebuild || validateBuild(build).length || spellErrors.length) return null;
    try {
      return buildSrdCharacter(build);
    } catch {
      return null;
    }
  }, [JSON.stringify(build)]); // eslint-disable-line react-hooks/exhaustive-deps

  const STEPS = canRebuild
    ? ['Concept', terms.species, terms.class, 'Abilities', terms.background, 'Skills', 'Equipment', ...(needsSpells ? [terms.spells] : []), 'Perk Tree', 'Review']
    : ['Concept', 'Perk Tree'];
  const stepKey = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const stepValid = (key) => {
    switch (key) {
      case 'Concept':
        return Boolean(name.trim());
      case terms.species:
        return (!sp?.flexibleBonuses || flexible.length === sp.flexibleBonuses.count) && (!sp?.skillChoices || speciesSkills.length === sp.skillChoices);
      case terms.class:
        return Boolean(cls) && (!cls.fightingStyle || Boolean(fightingStyle));
      case 'Abilities':
        return Boolean(statsValid);
      case terms.background:
        return Boolean(bg) && (bg.skills || backgroundSkills.length === 2);
      case 'Skills':
        return classPicks.length === cls.skillCount && (!cls.expertise || expertise.filter((e) => allSkills.includes(e)).length === cls.expertise);
      case 'Equipment':
        return kitComplete;
      case terms.spells:
        return spellErrors.length === 0;
      default:
        return true;
    }
  };

  const resetSpells = () => {
    setCantripPicks([]);
    setKnownPicks([]);
    setPreparedPicks([]);
    setBookPicks([]);
  };
  const pickSpecies = (id) => {
    setSpeciesId(id);
    setSpeciesCantrip('');
    setFlexible([]);
    setSpeciesSkills([]);
    setLanguages([]);
  };
  const pickClass = (id) => {
    setClassId(id);
    resetSpells();
    setClassSkills([]);
    setExpertise([]);
    setKitChoices({});
    setAnyPicks({});
    setCart({});
    setWealth(null);
  };
  const pickBackground = (id) => {
    setBackgroundId(id);
    setBackgroundSkills([]);
    setLanguages([]);
  };

  const generatePerks = async () => {
    setPerkBusy(true);
    try {
      const ranked = ABILITIES.slice().sort((a, b) => finalStats[b] - finalStats[a]);
      const archetype = canRebuild ? className(classId, genre, media) : initial.classOrArchetype;
      const res = await callApi('world-forge', {
        mode: 'perkTree',
        model: DEFAULT_MODEL,
        genre,
        genreLabel: genreDef.label,
        classOrArchetype: archetype,
        concept: `${name}, a ${canRebuild ? `${speciesName(speciesId, genre, media)} ` : ''}${archetype}. ${backstory}`.slice(0, 1900),
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

  const tailorToUniverse = async () => {
    if (!mediaTitle.trim()) return;
    setMediaBusy(true);
    try {
      const res = await callApi('world-forge', { mode: 'mediaSkin', mediaTitle: mediaTitle.trim(), mediaNotes: mediaNotes.trim() || undefined });
      const clean = sanitizeMediaSkin(res.result);
      if (!clean) throw new Error('No usable names came back.');
      setMediaSkin(clean);
      setLanguages([]);
      const cost = computeTextCost(res.model, res.usage || {});
      addSessionTelemetry({ inputTokens: res.usage?.inputTokens, outputTokens: res.usage?.outputTokens, cachedTokens: res.usage?.cachedTokens, costUSD: cost });
      toast(`Tailored to ${clean.title}.`, 'success');
    } catch (err) {
      toast(`Could not tailor to that universe: ${err.message}`, 'error');
    } finally {
      setMediaBusy(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      if (initial && !canRebuild) {
        await updateCharacterDoc(user.uid, initial.id, {
          ...initial,
          name: name.trim(),
          backstory,
          portraitUrl: portraitUrl.trim() || null,
          customPerkTree: initial.customPerkTree?.some((p) => p.unlocked) ? initial.customPerkTree : perks,
        });
      } else {
        const errors = validateBuild(build);
        if (errors.length) throw new Error(errors[0]);
        const fresh = buildSrdCharacter(build);
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
          {isLast ? (
            <button className="btn-primary" onClick={save} disabled={saving || buildErrors.length > 0 || !name.trim()}>
              {saving ? <Spinner /> : <Save className="h-4 w-4" />} Save Character
            </button>
          ) : (
            <button className="btn-primary" onClick={() => setStep(step + 1)} disabled={!stepValid(stepKey)}>
              Next <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </>
      }
    >
      <ol className="scrollbar-none -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1 text-xs">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              className={`pill shrink-0 whitespace-nowrap ${i === step ? 'border-accent bg-accent text-accent-ink' : i < step ? 'border-accent/60' : ''}`}
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
            >
              {i < step ? <Check className="h-3 w-3" /> : `${i + 1}.`} {s}
            </button>
          </li>
        ))}
      </ol>
      {initial && !canRebuild && step === 0 && (
        <p className="card-inset mb-4 p-2 text-xs text-muted">This character has progressed or is in an active campaign, so the build is locked. You can still edit their concept, portrait and (if nothing is unlocked yet) their Perk Tree.</p>
      )}

      {stepKey === 'Concept' && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="cc-name">Name</label>
            <input id="cc-name" className="input text-base sm:text-sm" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Mara Vell" />
          </div>
          <div>
            <label className="label" htmlFor="cc-genre">Genre</label>
            <select id="cc-genre" className="input text-base sm:text-sm" value={genre} disabled={!canRebuild} onChange={(e) => { setGenre(e.target.value); setLanguages([]); }}>
              {GENRE_IDS.map((g) => (
                <option key={g} value={g}>
                  {GENRES[g].label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">D&D 5e (SRD 5.1) rules underneath; names are reskinned to the genre.</p>
          </div>
          {genre === 'tv_movie' && (
            <div className="card-inset space-y-2 p-3 md:col-span-2">
              <label className="label" htmlFor="cc-media">
                TV Series / Movie Universe
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="cc-media"
                  className="input flex-1 text-base sm:text-sm"
                  value={mediaTitle}
                  onChange={(e) => setMediaTitle(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Jericho, The Walking Dead, Firefly, The Expanse, Deadwood"
                  disabled={!canRebuild}
                />
                <button className="btn-primary shrink-0" onClick={tailorToUniverse} disabled={!canRebuild || mediaBusy || !mediaTitle.trim()}>
                  {mediaBusy ? <Spinner /> : null} Tailor to Universe
                </button>
              </div>
              <input
                className="input text-base sm:text-sm"
                value={mediaNotes}
                onChange={(e) => setMediaNotes(e.target.value)}
                maxLength={2000}
                placeholder="Optional notes: season, setting, tone (e.g. small Kansas town after nuclear attacks)"
                disabled={!canRebuild}
                aria-label="Universe notes"
              />
              <p className="text-xs text-muted">
                {mediaSkin
                  ? `Tailored to ${mediaSkin.title}: ${['human', 'dwarf', 'elf'].map((id) => mediaSkin.species?.[id]?.name).filter(Boolean).join(', ')}… The rules underneath stay D&D 5e.`
                  : 'The storyteller renames species, classes, backgrounds, skills and languages for that universe. Only names change.'}
              </p>
            </div>
          )}
          <div className="md:col-span-2">
            <label className="label" htmlFor="cc-portrait">Portrait URL (optional)</label>
            <input id="cc-portrait" className="input text-base sm:text-sm" value={portraitUrl} onChange={(e) => setPortraitUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="cc-back">Backstory</label>
            <textarea id="cc-back" className="input min-h-[110px] text-base sm:text-sm" value={backstory} onChange={(e) => setBackstory(e.target.value)} maxLength={2000} placeholder="Who are they? What do they want? What haunts them?" />
          </div>
        </div>
      )}

      {stepKey === terms.species && (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SPECIES.map((s) => (
              <ChoiceCard
                key={s.id}
                selected={speciesId === s.id}
                onClick={() => pickSpecies(s.id)}
                title={speciesName(s.id, genre, media)}
                subtitle={speciesName(s.id, genre, media) !== s.name ? s.name : null}
                meta={`${Object.entries(s.abilityBonuses).map(([a, v]) => `${a.toUpperCase()} +${v}`).join(' ')}${s.flexibleBonuses ? ` +1 ×${s.flexibleBonuses.count}` : ''} · ${s.speed} ft${s.size === 'small' ? ' · Small' : ''}`}
                blurb={speciesBlurb(s.id, genre, media)}
              />
            ))}
          </div>
          {sp && (
            <div className="card-inset space-y-3 p-3 text-sm">
              <TraitList traits={sp.traits} />
              {sp.flexibleBonuses && (
                <PickRow label={`+1 to two abilities (${flexible.length}/2)`}>
                  {ABILITIES.filter((a) => !sp.flexibleBonuses.exclude.includes(a)).map((a) => (
                    <Tooltip key={a} help={help(`ability.${a}`)} title={ABILITY_LABELS[a]}>
                      <Chip on={flexible.includes(a)} onClick={() => setFlexible(toggleIn(flexible, a, sp.flexibleBonuses.count))}>
                        {ABILITY_LABELS[a]}
                      </Chip>
                    </Tooltip>
                  ))}
                </PickRow>
              )}
              {sp.skillChoices && (
                <PickRow label={`Skill Versatility — pick ${sp.skillChoices} (${speciesSkills.length}/${sp.skillChoices})`}>
                  {SKILL_KEYS.map((k) => (
                    <Tooltip key={k} help={help(`skill.${k}`)} title={skillLabel(k, skin)}>
                      <Chip on={speciesSkills.includes(k)} onClick={() => setSpeciesSkills(toggleIn(speciesSkills, k, sp.skillChoices))}>
                        {skillLabel(k, skin)}
                      </Chip>
                    </Tooltip>
                  ))}
                </PickRow>
              )}
              {sp.ancestryChoice && (
                <div>
                  <label className="label" htmlFor="cc-anc">Draconic ancestry</label>
                  <select id="cc-anc" className="input text-base sm:text-sm" value={dragonAncestry} onChange={(e) => setDragonAncestry(e.target.value)}>
                    {DRAGON_ANCESTRIES.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} — {d.damage}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {sp.toolChoice && (
                <div>
                  <label className="label" htmlFor="cc-tool">Tool proficiency</label>
                  <select id="cc-tool" className="input text-base sm:text-sm" value={toolChoice || sp.toolChoice[0]} onChange={(e) => setToolChoice(e.target.value)}>
                    {sp.toolChoice.map((t) => (
                      <option key={t} value={t}>
                        {ITEMS[t] ? itemName(t, genre) : t}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <p className="text-xs text-muted">Languages: {sp.languages.map((l) => languageName(l, genre, media)).join(', ')}{sp.extraLanguages ? ` + ${sp.extraLanguages} of your choice (pick in the ${terms.background} step)` : ''}.</p>
            </div>
          )}
        </div>
      )}

      {stepKey === terms.class && (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CLASSES.map((c) => (
              <ChoiceCard
                key={c.id}
                selected={classId === c.id}
                onClick={() => pickClass(c.id)}
                title={className(c.id, genre, media)}
                subtitle={className(c.id, genre, media) !== c.name ? c.name : null}
                meta={`d${c.hitDie} · saves ${c.savingThrows.map((a) => a.toUpperCase()).join('/')} · ${c.spellcasting ? `${terms.spells} (${c.spellcasting.ability.toUpperCase()})` : 'martial'}`}
                blurb={`Best with high ${c.primary.map((a) => ABILITY_LABELS[a]).join(' & ')}.`}
              />
            ))}
          </div>
          {cls && (
            <div className="card-inset space-y-3 p-3 text-sm">
              <div className="grid gap-1 text-xs sm:grid-cols-2">
                <p>
                  <strong>Hit die:</strong> d{cls.hitDie}
                </p>
                <p>
                  <strong>Saving throws:</strong> {cls.savingThrows.map((a) => ABILITY_LABELS[a]).join(', ')}
                </p>
                <p>
                  <strong>Armor:</strong> {cls.armor.length ? cls.armor.map((a) => (a === 'shield' ? 'shields' : a)).join(', ') : 'none'}
                </p>
                <p>
                  <strong>Weapons:</strong> {cls.weapons.map((w) => (ITEMS[w] ? itemName(w, genre) : w)).join(', ')}
                </p>
                <p>
                  <strong>Skills:</strong> {cls.skillCount} from {cls.skillList === 'any' ? 'any' : cls.skillList.map((k) => skillLabel(k, skin)).join(', ')}
                </p>
                {cls.subclass && (
                  <p>
                    <strong>Path:</strong> {cls.subclass}
                  </p>
                )}
              </div>
              <TraitList traits={cls.features} />
              {cls.fightingStyle && (
                <div>
                  <div className="label">Fighting style</div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {FIGHTING_STYLES.map((f) => (
                      <button key={f.id} className={`rounded-theme border-theme p-2 text-left text-xs ${fightingStyle === f.id ? 'border-accent bg-accent/10' : 'border-line/40'}`} onClick={() => setFightingStyle(f.id)}>
                        <strong>{f.name}</strong> — {f.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {cls.spellcasting && <p className="text-xs text-muted">You choose your {terms.spells.toLowerCase()} after picking equipment.</p>}
            </div>
          )}
        </div>
      )}

      {stepKey === 'Abilities' && (
        <AbilityStep
          method={method}
          setMethod={setMethod}
          stats={stats}
          setStats={setStats}
          pbCost={pbCost}
          arrayAssign={arrayAssign}
          setArrayAssign={setArrayAssign}
          rolled={rolled}
          setRolled={setRolled}
          rollAssign={rollAssign}
          setRollAssign={setRollAssign}
          statsValid={statsValid}
          bonuses={speciesBonusSummary(speciesId, flexible)}
          finalStats={finalStats}
          primary={cls?.primary || []}
          speciesLabel={speciesName(speciesId, genre, media)}
        />
      )}

      {stepKey === terms.background && (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {BACKGROUNDS.map((b) => (
              <ChoiceCard
                key={b.id}
                selected={backgroundId === b.id}
                onClick={() => pickBackground(b.id)}
                title={backgroundName(b.id, genre, media)}
                subtitle={backgroundName(b.id, genre, media) !== b.name ? b.name : null}
                meta={b.skills ? b.skills.map((k) => skillLabel(k, skin)).join(', ') : 'Any 2 skills'}
                blurb={`${b.feature[0]}: ${b.feature[1]}`}
              />
            ))}
          </div>
          {bg && (
            <div className="card-inset space-y-3 p-3 text-sm">
              {!bg.skills && (
                <PickRow label={`Background skills — pick 2 (${backgroundSkills.length}/2)`}>
                  {SKILL_KEYS.map((k) => (
                    <Tooltip key={k} help={help(`skill.${k}`)} title={skillLabel(k, skin)}>
                      <Chip on={backgroundSkills.includes(k)} onClick={() => setBackgroundSkills(toggleIn(backgroundSkills, k, 2))}>
                        {skillLabel(k, skin)}
                      </Chip>
                    </Tooltip>
                  ))}
                </PickRow>
              )}
              {bg.tools?.length > 0 && <p className="text-xs">Tools: {bg.tools.map((t) => (ITEMS[t] ? itemName(t, genre) : t)).join(', ')}</p>}
              <p className="text-xs">
                Gear: {bg.equipment.map((e) => itemName(e.id, genre)).join(', ')} · {bg.gold} {genreDef.currencyLabel}
              </p>
              {extraLanguageCount > 0 && (
                <PickRow label={`Extra languages (${languages.length}/${extraLanguageCount})`}>
                  {availableLanguages(genre, media).filter((l) => !(sp?.languages || []).some((own) => languageName(own, genre, media) === l)).map((l) => (
                    <Chip key={l} on={languages.includes(l)} onClick={() => setLanguages(toggleIn(languages, l, extraLanguageCount))}>
                      {l}
                    </Chip>
                  ))}
                </PickRow>
              )}
            </div>
          )}
        </div>
      )}

      {stepKey === 'Skills' && cls && (
        <div className="space-y-4 text-sm">
          <div>
            <div className="label">Already proficient</div>
            <div className="flex flex-wrap gap-1.5">
              {granted.length ? granted.map((k) => (
                <span key={k} className="pill">
                  <Lock className="h-3 w-3" /> {skillLabel(k, skin)}
                </span>
              )) : <span className="text-xs text-muted">None yet.</span>}
            </div>
          </div>
          <PickRow label={`${className(classId, genre, media)} skills — pick ${cls.skillCount} (${classPicks.length}/${cls.skillCount})`}>
            {classSkillList(classId)
              .filter((k) => !granted.includes(k))
              .map((k) => (
                <Tooltip key={k} help={help(`skill.${k}`)} title={skillLabel(k, skin)}>
                  <Chip on={classSkills.includes(k)} onClick={() => setClassSkills(toggleIn(classPicks, k, cls.skillCount))}>
                    {skillLabel(k, skin)} <span className="opacity-60">{SKILLS[k].toUpperCase()}</span>
                  </Chip>
                </Tooltip>
              ))}
          </PickRow>
          {cls.expertise && (
            <PickRow label={`Expertise — double proficiency in ${cls.expertise} (${expertise.filter((e) => allSkills.includes(e)).length}/${cls.expertise})`}>
              {allSkills.map((k) => (
                <Tooltip key={k} help={help(`skill.${k}`)} title={skillLabel(k, skin)}>
                  <Chip on={expertise.includes(k)} onClick={() => setExpertise(toggleIn(expertise.filter((e) => allSkills.includes(e)), k, cls.expertise))}>
                    {skillLabel(k, skin)}
                  </Chip>
                </Tooltip>
              ))}
            </PickRow>
          )}
        </div>
      )}

      {stepKey === 'Equipment' && cls && (
        <EquipmentStep
          cls={cls}
          bg={bg}
          genre={genre}
          currencyLabel={genreDef.currencyLabel}
          profs={profs}
          equipMode={equipMode}
          setEquipMode={setEquipMode}
          kitChoices={kitChoices}
          setKitChoices={setKitChoices}
          anyPicks={anyPicks}
          setAnyPicks={setAnyPicks}
          slots={slots}
          wealth={wealth}
          setWealth={setWealth}
          cart={cart}
          setCart={setCart}
          spent={spent}
        />
      )}

      {stepKey === terms.spells && needsSpells && (
        <SpellStep
          cls={cls}
          sp={sp}
          genre={genre}
          terms={terms}
          finalStats={finalStats}
          speciesLabel={speciesName(speciesId, genre, media)}
          cantripPicks={cantripPicks}
          setCantripPicks={setCantripPicks}
          knownPicks={knownPicks}
          setKnownPicks={setKnownPicks}
          preparedPicks={preparedPicks}
          setPreparedPicks={setPreparedPicks}
          bookPicks={bookPicks}
          setBookPicks={setBookPicks}
          speciesCantrip={speciesCantrip}
          setSpeciesCantrip={setSpeciesCantrip}
        />
      )}

      {stepKey === 'Perk Tree' && (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <button className="btn-primary" onClick={generatePerks} disabled={perkBusy || (initial?.customPerkTree || []).some((p) => p.unlocked)}>
              {perkBusy ? <Spinner /> : <Wand2 className="h-4 w-4" />} {perks.length ? 'Regenerate' : 'Generate'} Custom Perk Tree
            </button>
            <span className="text-sm text-muted">Optional extra on top of the 5e rules: 10 perks across 5 tiers, unlocked as you level.</span>
          </div>
          {(initial?.customPerkTree || []).some((p) => p.unlocked) && <p className="mb-2 text-xs text-muted">Perks are already unlocked, so the tree is locked in.</p>}
          <PerkTree character={{ ...(initial || {}), level: initial?.level || 1, customPerkTree: perks }} skin={skin} />
        </div>
      )}

      {stepKey === 'Review' && <Review preview={preview} errors={buildErrors} genre={genre} skin={skin} terms={terms} />}
    </Modal>
  );
}

function ChoiceCard({ selected, onClick, title, subtitle, meta, blurb }) {
  return (
    <button onClick={onClick} className={`rounded-theme border-theme p-2.5 text-left transition ${selected ? 'border-accent bg-accent/10 shadow-glow' : 'border-line/40 hover:border-accent/60'}`} aria-pressed={selected}>
      <div className="flex items-baseline justify-between gap-2">
        <strong className="text-sm">{title}</strong>
        {subtitle && <span className="shrink-0 text-[10px] text-muted">{subtitle}</span>}
      </div>
      <div className="mt-0.5 font-mono text-[10px] text-muted">{meta}</div>
      {blurb && <p className="mt-1 text-xs text-muted">{blurb}</p>}
    </button>
  );
}

function TraitList({ traits }) {
  return (
    <ul className="space-y-1 text-xs">
      {traits.map(([n, d]) => (
        <li key={n}>
          <strong>{n}.</strong> {d}
        </li>
      ))}
    </ul>
  );
}

function PickRow({ label, children }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ on, onClick, children }) {
  return (
    <button className={`pill cursor-pointer py-1 transition ${on ? 'border-accent bg-accent text-accent-ink' : 'hover:border-accent'}`} onClick={onClick} aria-pressed={on}>
      {on && <Check className="h-3 w-3" />}
      {children}
    </button>
  );
}

function AbilityStep({ method, setMethod, stats, setStats, pbCost, arrayAssign, setArrayAssign, rolled, setRolled, rollAssign, setRollAssign, statsValid, bonuses, finalStats, primary, speciesLabel }) {
  const doRoll = () => {
    setRolled(ABILITIES.map(() => roll4d6DropLowest()));
    setRollAssign({});
  };
  return (
    <div>
      <SegmentedControl
        size="md"
        value={method}
        onChange={setMethod}
        options={[
          { value: 'pointbuy', label: 'Point Buy' },
          { value: 'array', label: 'Standard Array' },
          { value: 'roll', label: 'Roll 4d6' },
        ]}
      />
      {primary.length > 0 && <p className="mt-2 text-xs text-muted">Tip: your class relies on {primary.map((a) => ABILITY_LABELS[a]).join(' and ')}.</p>}
      {method === 'pointbuy' && (
        <p className={`mt-3 text-sm ${pbCost > POINT_BUY_BUDGET ? 'text-danger' : 'text-muted'}`}>
          Points spent: <strong className="font-mono">{pbCost}</strong> / {POINT_BUY_BUDGET} (base scores 8–15)
        </p>
      )}
      {method === 'roll' && (
        <div className="mt-3">
          <button className="btn-primary" onClick={doRoll}>
            <Dices className="h-4 w-4" /> {rolled ? 'Re-roll all (visible)' : 'Roll six scores'}
          </button>
          {rolled && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {rolled.map((r, i) => (
                <span key={i} className="pill font-mono" title={`Rolled ${r.rolls.join(', ')}; dropped ${r.dropped}`}>
                  #{i + 1}: {r.score} <span className="text-muted">[{r.rolls.join(',')}]</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ABILITIES.map((ab) => (
          <div key={ab} className={`card-inset p-2 ${primary.includes(ab) ? 'border-accent/60' : ''}`}>
            <div className="flex items-center justify-between">
              <Tooltip help={help(`ability.${ab}`)}>
                <span className="text-xs font-bold uppercase">{ABILITY_LABELS[ab]}</span>
              </Tooltip>
              <span className="font-heading text-lg font-bold">{finalStats[ab]}</span>
            </div>
            <div className="mb-1 text-[11px] text-muted">
              mod {fmtMod(abilityMod(finalStats[ab]))}
              {bonuses[ab] ? ` · ${speciesLabel} +${bonuses[ab]}` : ''}
            </div>
            {method === 'pointbuy' && (
              <div className="flex items-center justify-between">
                <button className="btn px-2.5 py-1" disabled={stats[ab] <= 8} onClick={() => setStats({ ...stats, [ab]: stats[ab] - 1 })} aria-label={`Decrease ${ab}`}>
                  <Minus className="h-3 w-3" />
                </button>
                <span className="font-mono text-sm">
                  {stats[ab]} <span className="text-[10px] text-muted">({POINT_BUY_COSTS[stats[ab]]} pt)</span>
                </span>
                <button className="btn px-2.5 py-1" disabled={stats[ab] >= 15} onClick={() => setStats({ ...stats, [ab]: stats[ab] + 1 })} aria-label={`Increase ${ab}`}>
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            )}
            {method === 'array' && (
              <select className="input text-base sm:text-sm" value={arrayAssign[ab]} onChange={(e) => setArrayAssign({ ...arrayAssign, [ab]: Number(e.target.value) })} aria-label={ABILITY_LABELS[ab]}>
                {STANDARD_ARRAY.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            )}
            {method === 'roll' && rolled && (
              <select
                className="input text-base sm:text-sm"
                value={rollAssign[ab] ?? ''}
                onChange={(e) => setRollAssign({ ...rollAssign, [ab]: e.target.value === '' ? undefined : Number(e.target.value) })}
                aria-label={ABILITY_LABELS[ab]}
              >
                <option value="">—</option>
                {rolled.map((r, i) => (
                  <option key={i} value={i} disabled={Object.entries(rollAssign).some(([k, v]) => v === i && k !== ab)}>
                    #{i + 1}: {r.score}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>
      {method === 'array' && !statsValid && <p className="mt-2 text-sm text-danger">Use each array value (15, 14, 13, 12, 10, 8) exactly once.</p>}
    </div>
  );
}

function EquipmentStep({ cls, bg, genre, currencyLabel, profs, equipMode, setEquipMode, kitChoices, setKitChoices, anyPicks, setAnyPicks, slots, wealth, setWealth, cart, setCart, spent }) {
  const fakeChar = { weaponProficiencies: profs.weaponProficiencies, armorProficiencies: profs.armorProficiencies };
  const profBadge = (id) => {
    const it = ITEMS[id];
    if (!it) return null;
    const ok = it.kind === 'weapon' ? isWeaponProficient(fakeChar, { srdId: id, category: it.category }) : it.kind === 'armor' ? isArmorProficient(fakeChar, it) : true;
    return ok ? null : <span className="pill border-warning py-0 text-[10px] text-warning">not proficient</span>;
  };
  const refLabel = (ref) => `${ref.qty > 1 ? `${ref.qty}× ` : ''}${ref.id ? itemLabel(ref.id, genre) : ANY_LABELS[ref.any]}`;
  const remaining = (wealth?.total || 0) - spent;
  const add = (id, d) => setCart({ ...cart, [id]: Math.max(0, (cart[id] || 0) + d) });

  return (
    <div className="space-y-4 text-sm">
      <SegmentedControl
        size="md"
        value={equipMode}
        onChange={setEquipMode}
        options={[
          { value: 'kit', label: 'Starting kit' },
          { value: 'gold', label: 'Buy with coin' },
        ]}
      />
      {equipMode === 'kit' ? (
        <>
          {cls.equipment.map((group, g) =>
            group.items ? (
              <div key={g} className="card-inset p-2">
                <div className="label">Included</div>
                <p>{group.items.map(refLabel).join(', ')}</p>
                {slots.filter((s) => s.key.startsWith(`${g}:-1:`)).map((s) => (
                  <AnyPicker key={s.key} slot={s} genre={genre} value={anyPicks[s.key]} onChange={(v) => setAnyPicks({ ...anyPicks, [s.key]: v })} profBadge={profBadge} />
                ))}
              </div>
            ) : (
              <div key={g} className="card-inset space-y-1.5 p-2">
                <div className="label">Choose one</div>
                {group.choose.map((opt, o) => {
                  const allowed = optionAllowed(opt, profs);
                  const on = (kitChoices[g] ?? 0) === o;
                  return (
                    <div key={o}>
                      <button
                        className={`w-full rounded-theme border-theme px-2 py-1.5 text-left transition ${on ? 'border-accent bg-accent/10' : 'border-line/40'} disabled:opacity-40`}
                        disabled={!allowed}
                        onClick={() => setKitChoices({ ...kitChoices, [g]: o })}
                      >
                        ({String.fromCharCode(97 + o)}) {opt.map(refLabel).join(' + ')} {!allowed && <span className="text-xs">— needs proficiency</span>}
                      </button>
                      {on &&
                        slots.filter((s) => s.key.startsWith(`${g}:${o}:`)).map((s) => (
                          <AnyPicker key={s.key} slot={s} genre={genre} value={anyPicks[s.key]} onChange={(v) => setAnyPicks({ ...anyPicks, [s.key]: v })} profBadge={profBadge} />
                        ))}
                    </div>
                  );
                })}
              </div>
            ),
          )}
          <div className="card-inset p-2">
            <div className="label">From your background</div>
            <p>
              {bg.equipment.map((e) => itemName(e.id, genre)).join(', ')} · <strong>{bg.gold}</strong> {currencyLabel}
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="card-inset flex flex-wrap items-center gap-2 p-2">
            <button className="btn-primary" onClick={() => setWealth(rollStartingWealth(cls.id))}>
              <Dices className="h-4 w-4" /> Roll {cls.startingWealth.dice}
              {cls.startingWealth.multiplier > 1 ? ` × ${cls.startingWealth.multiplier}` : ''}
            </button>
            <button className="btn" onClick={() => setWealth({ rolls: [], total: averageStartingWealth(cls.id), average: true })}>
              Take average ({averageStartingWealth(cls.id)})
            </button>
            {wealth && (
              <span className="pill font-mono">
                <Coins className="h-3 w-3" /> {wealth.rolls.length ? `[${wealth.rolls.join(', ')}] → ` : ''}
                {wealth.total} {currencyLabel}
              </span>
            )}
          </div>
          <p className="text-xs text-muted">Buying with coin replaces your class and background gear (5e rule). Prices round up to whole {currencyLabel}.</p>
          {wealth && (
            <>
              <p className={`sticky top-0 z-10 rounded-theme bg-surface/95 py-1 font-mono ${remaining < 0 ? 'text-danger' : ''}`}>
                Spent {spent} · Left {remaining} {currencyLabel}
              </p>
              <ShopSection title="Simple weapons" items={WEAPONS.filter((w) => w.category === 'simple')} genre={genre} cart={cart} add={add} profBadge={profBadge} />
              <ShopSection title="Martial weapons" items={WEAPONS.filter((w) => w.category === 'martial')} genre={genre} cart={cart} add={add} profBadge={profBadge} />
              <ShopSection title="Armor & shields" items={ARMOR} genre={genre} cart={cart} add={add} profBadge={profBadge} />
              <ShopSection title="Gear" items={GEAR} genre={genre} cart={cart} add={add} profBadge={profBadge} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function AnyPicker({ slot, genre, value, onChange, profBadge }) {
  const options = itemsForFilter(slot.filter);
  return (
    <div className="mt-1 flex items-center gap-2 pl-4">
      <select className="input text-base sm:text-sm" value={value || ''} onChange={(e) => onChange(e.target.value)} aria-label={ANY_LABELS[slot.filter]}>
        <option value="">Choose {ANY_LABELS[slot.filter]}…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {itemLabel(o.id, genre)}
            {o.damageDice ? ` — ${o.damageDice}` : ''}
          </option>
        ))}
      </select>
      {value && profBadge(value)}
    </div>
  );
}

function ShopSection({ title, items, genre, cart, add, profBadge }) {
  return (
    <details className="card-inset p-2" open={title.includes('weapons')}>
      <summary className="cursor-pointer font-semibold">{title}</summary>
      <ul className="mt-1 divide-y divide-line/20">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2 py-1">
            <div className="min-w-0 flex-1">
              <div className="truncate">
                {itemLabel(it.id, genre)} {profBadge(it.id)}
              </div>
              <div className="font-mono text-[10px] text-muted">
                {it.kind === 'weapon' ? (
                  <>
                    {`${it.damageDice || '—'} ${it.damageType || ''}`}
                    {it.properties.length > 0 && ' · '}
                    <PropertyList properties={it.properties} />
                  </>
                ) : it.kind === 'armor' ? `AC ${it.armorCategory === 'shield' ? '+2' : it.baseAc}${it.dexCap === null ? ' + Dex' : it.dexCap ? ` + Dex (max ${it.dexCap})` : ''}` : it.contents || ''}
              </div>
            </div>
            <span className="w-10 text-right font-mono text-xs">{itemPrice(it.id)}</span>
            <button className="btn px-2 py-1" onClick={() => add(it.id, -1)} disabled={!cart[it.id]} aria-label={`Remove ${it.name}`}>
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-5 text-center font-mono">{cart[it.id] || 0}</span>
            <button className="btn px-2 py-1" onClick={() => add(it.id, 1)} aria-label={`Add ${it.name}`}>
              <Plus className="h-3 w-3" />
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Review({ preview, errors, genre, skin, terms }) {
  if (!preview) {
    return (
      <div className="card-inset p-3 text-sm">
        <p className="font-semibold text-danger">Some choices still need attention:</p>
        <ul className="mt-1 list-inside list-disc">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </div>
    );
  }
  const c = preview;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card-inset p-3">
        <h3 className="text-lg font-bold">{c.name}</h3>
        <p className="text-sm text-muted">
          Level 1 {c.speciesName} {c.classOrArchetype} · {c.backgroundName}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          <span className="pill">
            <Heart className="h-3 w-3 text-danger" /> {c.vitals.maxHp} HP
          </span>
          <span className="pill">
            <Shield className="h-3 w-3" /> AC {effectiveAc(c)}
          </span>
          <span className="pill">
            <Footprints className="h-3 w-3" /> {effectiveSpeed(c)} ft
          </span>
          <span className="pill">d{c.hitDie}</span>
          <span className="pill">
            <Coins className="h-3 w-3" /> {c.currency.amount} {c.currency.label}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {ABILITIES.map((ab) => (
            <div key={ab} className="card py-1 text-center">
              <div className="text-[10px] font-bold uppercase text-muted">
                {ab}
                {c.savingThrows.includes(ab) ? ' ●' : ''}
              </div>
              <div className="font-mono">{c.stats[ab]}</div>
              <div className="text-xs text-muted">{fmtMod(abilityMod(c.stats[ab]))}</div>
            </div>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-muted">● proficient saving throw</p>
        <div className="label mt-3">Skills</div>
        <p className="text-sm">{c.skillProficiencies.map((s) => `${skillLabel(s, skin)}${c.expertise.includes(s) ? ' (expertise)' : ''}`).join(', ')}</p>
        <div className="label mt-3">Proficiencies</div>
        <p className="text-xs">
          Armor: {c.armorProficiencies.length ? c.armorProficiencies.join(', ') : 'none'} · Weapons: {c.weaponProficiencies.map((w) => (ITEMS[w] ? itemName(w, genre) : w)).join(', ')}
          {c.toolProficiencies.length ? ` · Tools: ${c.toolProficiencies.join(', ')}` : ''} · Languages: {c.languages.join(', ')}
        </p>
      </div>
      <div className="space-y-3">
        <div className="card-inset p-3 text-sm">
          <div className="label">Equipment</div>
          <ul className="space-y-0.5 text-xs">
            {c.inventory.map((i) => (
              <li key={i.id}>
                {i.equipped && <strong className="text-accent">[equipped] </strong>}
                {i.name} <span className="text-muted">{i.description ? `— ${i.description}` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card-inset p-3 text-sm">
          <div className="label">Features & traits</div>
          <ul className="space-y-1 text-xs">
            {c.features.map((f) => (
              <li key={`${f.source}-${f.name}`}>
                <strong>{f.name}</strong> <span className="text-muted">({f.source})</span> — {f.description}
              </li>
            ))}
          </ul>
          {(c.spellcasting || c.speciesCantrip) && (
            <>
              <div className="label mt-3">{terms.spells}</div>
              <p className="text-xs">
                {[c.speciesCantrip?.id, ...(c.spellcasting?.cantrips || []), ...(c.spellcasting?.alwaysPrepared || []), ...(c.spellcasting?.known || []), ...(c.spellcasting?.prepared || [])]
                  .filter(Boolean)
                  .map((id) => SPELLS_BY_ID[id]?.name || id)
                  .join(', ')}
                {c.spellcasting?.spellbook?.length ? ` · Spellbook: ${c.spellcasting.spellbook.map((id) => SPELLS_BY_ID[id]?.name).join(', ')}` : ''}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function spellLine(spell) {
  const bits = [];
  if (spell.kind === 'attack') bits.push(`${spell.attackType} attack, ${spell.damage} ${spell.damageType}`);
  else if (spell.kind === 'save') bits.push(`${spell.save.toUpperCase()} save, ${spell.damage} ${spell.damageType}`);
  else if (spell.kind === 'auto') bits.push(`auto-hit ${spell.damage}`);
  else if (spell.kind === 'heal') bits.push(`heal ${spell.heal} + mod`);
  else if (spell.kind === 'temp_hp') bits.push(`${spell.tempHp} temp HP`);
  if (spell.concentration) bits.push('concentration');
  if (spell.ritual) bits.push('ritual');
  return bits.join(' · ');
}

function SpellPicker({ label, ids, picked, setPicked, max, exclude = [] }) {
  return (
    <div>
      <div className="label">
        {label} ({picked.length}/{max})
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {ids
          .filter((id) => !exclude.includes(id))
          .map((id) => {
            const spell = SPELLS_BY_ID[id];
            if (!spell) return null;
            const on = picked.includes(id);
            return (
              <button
                key={id}
                className={`rounded-theme border-theme p-2 text-left text-xs transition ${on ? 'border-accent bg-accent/10' : 'border-line/40 hover:border-accent/60'}`}
                onClick={() => setPicked(max === 1 ? (on ? [] : [id]) : toggleIn(picked, id, max))}
                aria-pressed={on}
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm">{spell.name}</strong>
                  {on && <Check className="h-3.5 w-3.5 text-accent" />}
                </div>
                {spellLine(spell) && <div className="font-mono text-[10px] text-muted">{spellLine(spell)}</div>}
                <p className="mt-0.5 text-muted">{spell.desc}</p>
              </button>
            );
          })}
      </div>
    </div>
  );
}

function SpellStep({ cls, sp, terms, finalStats, speciesLabel, cantripPicks, setCantripPicks, knownPicks, setKnownPicks, preparedPicks, setPreparedPicks, bookPicks, setBookPicks, speciesCantrip, setSpeciesCantrip }) {
  const sc = cls?.spellcasting;
  const opts = classSpellOptions(cls?.id);
  const prepLimit = sc?.prepared ? preparedLimitFor(cls.id, finalStats) : 0;
  const bc = sp?.bonusCantrip;
  return (
    <div className="space-y-5 text-sm">
      {sc && (
        <p className="text-xs text-muted">
          Casting ability: <strong>{sc.ability.toUpperCase()}</strong> · two 1st-level slots{sc.pact ? ' (one pact slot, back on a short rest)' : ''}.
          {sc.alwaysPrepared?.length ? ` Always prepared: ${sc.alwaysPrepared.map((id) => SPELLS_BY_ID[id]?.name).join(', ')}.` : ''}
        </p>
      )}
      {bc && (
        <div className="card-inset p-2">
          {bc.fixed ? (
            <p className="text-xs">
              {speciesLabel} {terms.cantrips?.toLowerCase() || 'cantrip'}: <strong>{SPELLS_BY_ID[bc.fixed]?.name}</strong> ({bc.ability.toUpperCase()}).
            </p>
          ) : (
            <SpellPicker
              label={`${speciesLabel} bonus cantrip (${bc.ability.toUpperCase()})`}
              ids={CLASS_SPELL_LISTS[bc.list]?.cantrips || []}
              picked={speciesCantrip ? [speciesCantrip] : []}
              setPicked={(list) => setSpeciesCantrip(list[list.length - 1] || '')}
              max={1}
              exclude={cantripPicks}
            />
          )}
        </div>
      )}
      {sc && <SpellPicker label={terms.cantrips || 'Cantrips'} ids={opts.cantrips} picked={cantripPicks} setPicked={setCantripPicks} max={sc.cantrips} exclude={speciesCantrip ? [speciesCantrip] : []} />}
      {sc?.known && <SpellPicker label={`1st-level ${terms.spells.toLowerCase()} known`} ids={opts.level1} picked={knownPicks} setPicked={setKnownPicks} max={sc.known} />}
      {sc?.spellbook && (
        <>
          <SpellPicker label={`Spellbook (${sc.spellbook} 1st-level ${terms.spells.toLowerCase()})`} ids={opts.level1} picked={bookPicks} setPicked={(list) => { setBookPicks(list); setPreparedPicks(preparedPicks.filter((id) => list.includes(id))); }} max={sc.spellbook} />
          {bookPicks.length > 0 && <SpellPicker label={`Prepared today (up to ${prepLimit})`} ids={bookPicks} picked={preparedPicks} setPicked={setPreparedPicks} max={prepLimit} />}
        </>
      )}
      {sc?.prepared && !sc.spellbook && <SpellPicker label={`Prepared ${terms.spells.toLowerCase()} (up to ${prepLimit}; change after a long rest)`} ids={opts.level1} picked={preparedPicks} setPicked={setPreparedPicks} max={prepLimit} exclude={sc.alwaysPrepared || []} />}
    </div>
  );
}

/** Weapon properties, each with its rules tooltip. */
function PropertyList({ properties }) {
  return properties.map((pr, i) => (
    <span key={pr}>
      {i > 0 && ', '}
      <Tooltip help={help(`property.${pr}`)}>{pr}</Tooltip>
    </span>
  ));
}
