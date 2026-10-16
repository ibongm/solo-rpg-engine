import { useMemo, useState } from 'react';
import { Hammer, Wand2, ChevronLeft, ChevronRight, Upload, RefreshCw, Check, MapPin, Users, ScrollText, Flag } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { callApi } from '../../firebase/api.js';
import { createCampaignWithOpening } from '../../firebase/db.js';
import { GENRES, GENRE_IDS, SKILL_KEYS, SKILLS, buildSkin, THEMES } from '../../config/genreSkins.js';
import { TEXT_MODELS, HEAVY_MODEL, DEFAULT_MODEL, computeTextCost } from '../../config/models.js';
import { createCampaignFromSeed } from '../../engine/campaignFactory.js';
import { XP_MODE_INFO } from '../../engine/deeds.js';
import { markdownToLoreEntries } from '../../engine/exporters.js';
import { Modal, Slider, SegmentedControl, Spinner, fmtUSD, Tooltip } from '../common/ui.jsx';
import XpPaceControls from '../common/XpPaceControls.jsx';
import { help } from '../../config/helpTooltips.js';

const STEPS = ['Genre & Skin', 'Tone & Rules', 'Hero & Prompt', 'Seed the World'];

export default function WorldForgeWizard({ characters, onClose, onCreated }) {
  const user = useGameStore((s) => s.user);
  const toast = useGameStore((s) => s.toast);
  const addSessionTelemetry = useGameStore((s) => s.addSessionTelemetry);

  const [step, setStep] = useState(0);
  const [genre, setGenre] = useState('fantasy');
  const [currencyLabel, setCurrencyLabel] = useState(GENRES.fantasy.currencyLabel);
  const [skillOverrides, setSkillOverrides] = useState({});
  const [tone, setTone] = useState(5);
  const [strictness, setStrictness] = useState(5);
  const [actionMode, setActionMode] = useState('hybrid');
  const [diceMode, setDiceMode] = useState('digital');
  const [imageMode, setImageMode] = useState('manual');
  const [modelPref, setModelPref] = useState(DEFAULT_MODEL);
  const [seedModel, setSeedModel] = useState(HEAVY_MODEL);
  const [questsOn, setQuestsOn] = useState(false);
  const [xpMode, setXpMode] = useState('deeds');
  const [xpPace, setXpPace] = useState({ pace: 'standard', fineTune: 1 });
  const eligible = characters.filter((c) => c.status !== 'fallen' && !c.activeCampaignId);
  const [charId, setCharId] = useState(eligible[0]?.id || '');
  const [prompt, setPrompt] = useState('');
  const [lore, setLore] = useState([]);
  const [loreText, setLoreText] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [seed, setSeed] = useState(null);
  const [seedCost, setSeedCost] = useState({ usage: null, cost: 0 });
  const [creating, setCreating] = useState(false);

  const genreDef = GENRES[genre];
  const skin = useMemo(() => buildSkin(genre, { currencyLabel, skillLabels: skillOverrides }), [genre, currencyLabel, skillOverrides]);
  const character = characters.find((c) => c.id === charId);

  const pickGenre = (g) => {
    setGenre(g);
    setCurrencyLabel(GENRES[g].currencyLabel);
    setSkillOverrides({});
  };

  const importMarkdownFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    const entries = markdownToLoreEntries(text);
    setLore((prev) => [...prev, ...entries].slice(0, 40));
    toast(`Imported ${entries.length} lore entries from ${file.name}.`, 'success');
  };

  const addPastedLore = () => {
    const entries = markdownToLoreEntries(loreText);
    if (!entries.length) return;
    setLore((prev) => [...prev, ...entries].slice(0, 40));
    setLoreText('');
  };

  const runSeed = async () => {
    setSeeding(true);
    try {
      const res = await callApi(
        'world-forge',
        {
          mode: 'seed',
          model: seedModel,
          genre,
          genreLabel: genreDef.label,
          tone,
          strictness,
          currencyLabel,
          prompt,
          questsEnabled: questsOn,
          importedLore: lore,
          character: character ? { name: character.name, level: character.level, classOrArchetype: character.classOrArchetype, backstory: character.backstory } : null,
        },
        { timeoutMs: 180_000 },
      );
      const cost = computeTextCost(res.model, res.usage || {});
      addSessionTelemetry({ inputTokens: res.usage?.inputTokens, outputTokens: res.usage?.outputTokens, cachedTokens: res.usage?.cachedTokens, costUSD: cost });
      setSeed(res.result);
      setSeedCost((prev) => ({ usage: res.usage, cost: prev.cost + cost }));
    } catch (err) {
      toast(`World seeding failed: ${err.message}`, 'error');
    } finally {
      setSeeding(false);
    }
  };

  const create = async () => {
    if (!seed || !character) return;
    setCreating(true);
    try {
      const { campaign, openingTurn, codexEntries, characterPatch } = createCampaignFromSeed({
        seed,
        character,
        characterId: character.id,
        genre,
        skin,
        tone,
        rulesStrictness: strictness,
        actionMode,
        diceMode,
        modelPref,
        imageMode,
        importedLore: lore,
        questsEnabled: questsOn,
        xpMode,
        xpPace: xpPace.pace,
        xpMultiplier: xpPace.fineTune,
      });
      campaign.telemetry = {
        totalInputTokens: seedCost.usage?.inputTokens || 0,
        totalOutputTokens: seedCost.usage?.outputTokens || 0,
        cachedTokens: seedCost.usage?.cachedTokens || 0,
        totalCostUSD: seedCost.cost,
      };
      await createCampaignWithOpening(user.uid, { campaign, openingTurn, characterId: character.id, characterPatch, codexEntries });
      toast(`“${campaign.meta.title}” has been forged.`, 'success');
      onCreated();
    } catch (err) {
      toast(`Could not create the campaign: ${err.message}`, 'error');
    } finally {
      setCreating(false);
    }
  };

  const canNext = [true, true, Boolean(character) && prompt.trim().length >= 10, Boolean(seed)][step];

  return (
    <Modal
      title="World Forge"
      icon={<Hammer className="h-5 w-5 text-accent" />}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={() => (step === 0 ? onClose() : setStep(step - 1))} disabled={seeding || creating}>
            <ChevronLeft className="h-4 w-4" /> {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < 3 ? (
            <button className="btn-primary" onClick={() => setStep(step + 1)} disabled={!canNext}>
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button className="btn-primary" onClick={create} disabled={!seed || creating || seeding}>
              {creating ? <Spinner /> : <Check className="h-4 w-4" />} Create Campaign
            </button>
          )}
        </>
      }
    >
      <ol className="mb-5 flex flex-wrap gap-2 text-xs">
        {STEPS.map((s, i) => (
          <li key={s} className={`pill ${i === step ? 'border-accent bg-accent text-accent-ink' : ''}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {GENRE_IDS.map((g) => (
              <button
                key={g}
                data-theme={GENRES[g].theme}
                onClick={() => pickGenre(g)}
                className={`rounded-theme border-theme bg-surface p-3 text-left text-ink transition ${genre === g ? 'border-accent shadow-glow' : 'border-line/50 hover:border-accent/60'}`}
              >
                <div className="font-heading font-bold">{GENRES[g].label}</div>
                <div className="text-xs text-muted">{GENRES[g].blurb}</div>
                <div className="mt-1 text-[10px] uppercase text-muted">{THEMES[GENRES[g].theme]}</div>
              </button>
            ))}
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div>
              <label className="label" htmlFor="wf-cur">Currency label</label>
              <input id="wf-cur" className="input" value={currencyLabel} onChange={(e) => setCurrencyLabel(e.target.value.slice(0, 20))} />
            </div>
            <div className="md:col-span-2">
              <div className="label">Skill reskin (5e math unchanged)</div>
              <div className="grid max-h-52 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
                {SKILL_KEYS.map((k) => (
                  <div key={k} className="flex items-center gap-1">
                    <span className="w-8 shrink-0 text-[10px] uppercase text-muted">{SKILLS[k]}</span>
                    <input
                      className="input py-1 text-xs"
                      value={skin.skillLabels[k]}
                      onChange={(e) => setSkillOverrides({ ...skillOverrides, [k]: e.target.value.slice(0, 30) })}
                      aria-label={`Label for ${k}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-5">
            <Slider label="Narrative Tone" help={help('forge.tone')} value={tone} onChange={setTone} leftLabel="Witty / Slapstick" rightLabel="Grimdark" />
            <Slider label="Rules Strictness" help={help('forge.strictness')} value={strictness} onChange={setStrictness} leftLabel="Rule of Cool" rightLabel="Hardcore RAW" />
            <p className="text-xs text-muted">At strictness 6+ long rests require rations; at 8+ the DM tracks ammo and encumbrance. Death is always permanent.</p>
          </div>
          <div className="space-y-4">
            <div className="card-inset space-y-3 p-3">
              <div>
                <div className="label"><Tooltip help={help('forge.quests')}>Quests</Tooltip></div>
                <SegmentedControl
                  value={questsOn ? 'on' : 'off'}
                  onChange={(v) => {
                    setQuestsOn(v === 'on');
                    setSeed(null);
                  }}
                  options={[
                    { value: 'off', label: 'Off (sandbox)' },
                    { value: 'on', label: 'On' },
                  ]}
                />
                <p className="mt-1 text-xs text-muted">
                  {questsOn ? 'The world starts with a main quest; the storyteller can hand out quests and bounties.' : 'No quests or imposed objectives — you choose where the story goes. You can switch this later in the Engine tab.'}
                </p>
              </div>
              <div>
                <div className="label"><Tooltip help={help('forge.xpMode')}>Experience</Tooltip></div>
                <SegmentedControl value={xpMode} onChange={setXpMode} options={Object.entries(XP_MODE_INFO).map(([value, m]) => ({ value, label: m.label }))} />
                <p className="mt-1 text-xs text-muted">{XP_MODE_INFO[xpMode].blurb}</p>
                <div className="mt-2">
                  <XpPaceControls mode={xpMode} pace={xpPace.pace} fineTune={xpPace.fineTune} onChange={setXpPace} level={1} idPrefix="wf-xp" />
                </div>
              </div>
            </div>
            <div>
              <div className="label"><Tooltip help={help('forge.actionMode')}>Action input</Tooltip></div>
              <SegmentedControl value={actionMode} onChange={setActionMode} options={[{ value: 'guided', label: 'Guided' }, { value: 'freeform', label: 'Freeform' }, { value: 'hybrid', label: 'Hybrid' }]} />
            </div>
            <div>
              <div className="label"><Tooltip help={help('forge.diceMode')}>Dice</Tooltip></div>
              <SegmentedControl value={diceMode} onChange={setDiceMode} options={[{ value: 'digital', label: 'Animated digital d20' }, { value: 'manual', label: 'Physical dice input' }]} />
            </div>
            <div>
              <div className="label"><Tooltip help={help('forge.imageMode')}>Scene images</Tooltip></div>
              <SegmentedControl value={imageMode} onChange={setImageMode} options={[{ value: 'off', label: 'Off' }, { value: 'manual', label: 'Manual' }, { value: 'auto', label: 'Auto-Director' }]} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="wf-model">Storyteller model</label>
                <select id="wf-model" className="input" value={modelPref} onChange={(e) => setModelPref(e.target.value)}>
                  {Object.values(TEXT_MODELS).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="wf-seedmodel">Seeder model</label>
                <select id="wf-seedmodel" className="input" value={seedModel} onChange={(e) => setSeedModel(e.target.value)}>
                  {Object.values(TEXT_MODELS).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="wf-hero">Hero</label>
              {eligible.length === 0 ? (
                <p className="text-sm text-danger">No available characters. Create one in the Roster (characters already in an active campaign can’t start another).</p>
              ) : (
                <select id="wf-hero" className="input" value={charId} onChange={(e) => setCharId(e.target.value)}>
                  {eligible.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — Lv {c.level} {c.classOrArchetype}
                    </option>
                  ))}
                </select>
              )}
              {character && character.genre !== genre && (
                <p className="mt-1 text-xs text-muted">Crossing genres: {character.name}’s currency will be reskinned to {currencyLabel}.</p>
              )}
            </div>
            <div>
              <label className="label" htmlFor="wf-prompt">World prompt</label>
              <textarea
                id="wf-prompt"
                className="input min-h-[150px]"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={3500}
                placeholder="e.g. A drowned river valley where the dead sing beneath the water, and three powers fight over the last ferry crossing…"
              />
              <p className="mt-1 text-xs text-muted">{prompt.trim().length < 10 ? 'At least 10 characters.' : `${prompt.length}/3500`}</p>
            </div>
          </div>
          <div>
            <div className="label">Import custom Markdown lore (optional)</div>
            <label className="btn mb-2 cursor-pointer">
              <Upload className="h-4 w-4" /> Choose .md file
              <input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" className="hidden" onChange={(e) => importMarkdownFile(e.target.files?.[0])} />
            </label>
            <textarea className="input min-h-[80px] font-mono text-xs" value={loreText} onChange={(e) => setLoreText(e.target.value)} placeholder="…or paste Markdown here" />
            <button className="btn mt-1" onClick={addPastedLore} disabled={!loreText.trim()}>
              Add pasted lore
            </button>
            {lore.length > 0 && (
              <ul className="card-inset mt-3 max-h-48 space-y-1 overflow-y-auto p-2 text-xs">
                {lore.map((l, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="flex-1">{l}</span>
                    <button className="text-danger" onClick={() => setLore(lore.filter((_, j) => j !== i))} aria-label="Remove">
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted">Imported lore is pinned to the Rulebook & Lore Pinboard and locked into the cached system prompt.</p>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button className="btn-primary" onClick={runSeed} disabled={seeding}>
              {seeding ? <Spinner /> : seed ? <RefreshCw className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />} {seed ? 'Re-seed' : 'Seed the World'}
            </button>
            <span className="text-sm text-muted">
              Using {TEXT_MODELS[seedModel].label}. {seedCost.cost > 0 && `Seeding cost so far: ${fmtUSD(seedCost.cost)}.`}
            </span>
          </div>
          {seeding && (
            <div className="card-inset flex items-center gap-2 p-6 text-muted">
              <Spinner /> The world is being forged… heavy reasoning models can take up to a minute.
            </div>
          )}
          {seed && !seeding && <SeedPreview seed={seed} />}
        </div>
      )}
    </Modal>
  );
}

function SeedPreview({ seed }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-2xl font-bold">{seed.campaign_title}</h3>
        <p className="text-sm text-muted">
          {seed.region?.name} · begins in {seed.start_season}
        </p>
        <p className="mt-2 text-sm">{seed.region?.description}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {seed.factions?.map((f) => (
          <div key={f.id} className="card-inset p-3 text-sm">
            <div className="flex items-center gap-1 font-bold">
              <Users className="h-3.5 w-3.5" /> {f.name}
            </div>
            <p className="mt-1 text-xs text-muted">{f.description}</p>
            <p className="mt-1 text-xs">
              Rep {f.starting_reputation ?? 0} · Heat {f.starting_heat ?? 0} · {f.status}
            </p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="card-inset p-3 text-sm">
          <div className="label flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Starting Node
          </div>
          <p className="font-bold">
            {seed.starting_node?.label} <span className="text-xs font-normal text-muted">({seed.starting_node?.type})</span>
          </p>
          <p className="text-xs text-muted">{seed.starting_node?.description}</p>
          {seed.nearby_nodes?.length > 0 && (
            <p className="mt-2 text-xs">Nearby: {seed.nearby_nodes.map((n) => `${n.label} (${n.travel_minutes} min)`).join(', ')}</p>
          )}
        </div>
        {seed.main_quest?.title ? (
          <div className="card-inset p-3 text-sm">
            <div className="label flex items-center gap-1">
              <Flag className="h-3 w-3" /> Main Quest
            </div>
            <p className="font-bold">{seed.main_quest.title}</p>
            <p className="text-xs text-muted">{seed.main_quest.description}</p>
            {seed.main_quest.deadline_days ? <p className="mt-1 text-xs text-warning">Deadline: {seed.main_quest.deadline_days} days</p> : null}
          </div>
        ) : (
          <div className="card-inset p-3 text-sm">
            <div className="label flex items-center gap-1">
              <Flag className="h-3 w-3" /> Open Sandbox
            </div>
            <p className="text-xs text-muted">No quest — follow the rumors, factions and places that catch your interest.</p>
          </div>
        )}
      </div>
      <div className="card-inset p-3 text-sm">
        <div className="label flex items-center gap-1">
          <ScrollText className="h-3 w-3" /> Local Rumors
        </div>
        <ul className="list-inside list-disc space-y-0.5 text-xs">
          {seed.rumors?.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>
      <div className="card p-4">
        <div className="label">Opening Scene</div>
        <p className="whitespace-pre-line font-body leading-relaxed">{seed.opening_narrative}</p>
      </div>
    </div>
  );
}

