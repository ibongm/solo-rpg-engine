import { useState } from 'react';
import { ArrowDownUp, Download, Upload, FileJson, BookText, Printer, Swords, Sparkles, ClipboardPaste } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { createCharacterDoc, importCampaignBundle, loadCampaignSubcollections, getCharacter } from '../../firebase/db.js';
import { buildSkin } from '../../config/genreSkins.js';
import {
  exportCharacterBundle,
  exportCampaignBundle,
  campaignToMarkdown,
  toFoundryActor,
  downloadText,
  slugify,
} from '../../engine/exporters.js';
import { parseImportFile, fromAiConversion, UnrecognizedImportError } from '../../engine/importers.js';
import { callApi } from '../../firebase/api.js';
import { computeTextCost, DEFAULT_MODEL } from '../../config/models.js';
import { Modal, Spinner } from '../common/ui.jsx';
import PrintSheet from '../common/PrintSheet.jsx';

/** onWorldSeed(seed): open the World Forge with an imported campaign document ({ title, prompt, lore[] }). */
export default function ImportExportModal({ characters, campaigns, onClose, onImported, onWorldSeed }) {
  const user = useGameStore((s) => s.user);
  const toast = useGameStore((s) => s.toast);
  const [charId, setCharId] = useState(characters[0]?.id || '');
  const [campId, setCampId] = useState(campaigns[0]?.id || '');
  const [busy, setBusy] = useState('');
  const [printing, setPrinting] = useState(null);
  const [pasted, setPasted] = useState('');
  const [lastSource, setLastSource] = useState(null);
  const [unrecognized, setUnrecognized] = useState(null); // { text, filename, message }
  const [review, setReview] = useState(null); // AI-converted character awaiting confirmation
  const addSessionTelemetry = useGameStore((s) => s.addSessionTelemetry);

  const character = characters.find((c) => c.id === charId);
  const campaign = campaigns.find((c) => c.id === campId);

  const run = async (label, fn) => {
    setBusy(label);
    try {
      await fn();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const exportCharJson = () =>
    run('charjson', async () => {
      downloadText(`${slugify(character.name)}.character.json`, JSON.stringify(exportCharacterBundle(character), null, 2), 'application/json');
    });

  const exportCharVtt = () =>
    run('charvtt', async () => {
      downloadText(`${slugify(character.name)}.dnd5e-actor.json`, JSON.stringify(toFoundryActor(character), null, 2), 'application/json');
    });

  const loadCampaignBundleParts = async () => {
    const subs = await loadCampaignSubcollections(user.uid, campaign.id);
    const hero = campaign.meta?.activeCharId ? await getCharacter(user.uid, campaign.meta.activeCharId) : null;
    return { ...subs, character: hero };
  };

  const exportCampJson = () =>
    run('campjson', async () => {
      const parts = await loadCampaignBundleParts();
      downloadText(`${slugify(campaign.meta.title)}.campaign.json`, JSON.stringify(exportCampaignBundle({ campaign, ...parts }), null, 2), 'application/json');
    });

  const exportCampMd = () =>
    run('campmd', async () => {
      const parts = await loadCampaignBundleParts();
      downloadText(`${slugify(campaign.meta.title)}.storybook.md`, campaignToMarkdown({ campaign, ...parts }), 'text/markdown');
    });

  /** Saves a parsed import: characters and native campaigns are created; campaign documents open the World Forge. */
  const commitImport = async (parsed) => {
    if (parsed.kind === 'character') {
      await createCharacterDoc(user.uid, parsed.data);
      toast(`Imported ${parsed.data.name} (${parsed.sourceLabel}).`, 'success');
      onImported();
    } else if (parsed.kind === 'campaign') {
      await importCampaignBundle(user.uid, parsed.data);
      toast(`Imported campaign “${parsed.data.campaign.meta.title}”.`, 'success');
      onImported();
    } else if (parsed.kind === 'worldSeed') {
      toast(`Opening the World Forge with “${parsed.data.title}” (${parsed.sourceLabel}).`, 'success');
      onWorldSeed?.(parsed.data);
    }
    setLastSource(parsed.sourceLabel);
  };

  const importText = (text, filename) =>
    run('import', async () => {
      setUnrecognized(null);
      setReview(null);
      try {
        await commitImport(parseImportFile(text, filename));
      } catch (err) {
        if (err instanceof UnrecognizedImportError) setUnrecognized({ text, filename, message: err.message });
        else throw err;
      }
    });

  const importFile = async (file) => {
    if (!file) return;
    importText(await file.text(), file.name);
  };

  const smartConvert = () =>
    run('ai', async () => {
      const res = await callApi('world-forge', { mode: 'convertImport', model: DEFAULT_MODEL, text: unrecognized.text.slice(0, 60000), filename: unrecognized.filename }, { timeoutMs: 120_000 });
      const cost = computeTextCost(res.model, res.usage || {});
      addSessionTelemetry({ inputTokens: res.usage?.inputTokens, outputTokens: res.usage?.outputTokens, cachedTokens: res.usage?.cachedTokens, costUSD: cost });
      const converted = fromAiConversion(res.result);
      setUnrecognized(null);
      // Characters are reviewed before saving; campaign documents go straight to the World Forge (also reviewable there).
      if (converted.kind === 'character') setReview(converted);
      else await commitImport(converted);
    });

  return (
    <Modal title="Universal Import / Export" icon={<ArrowDownUp className="h-5 w-5 text-accent" />} onClose={onClose} wide>
      <div className="grid gap-5 md:grid-cols-3">
        <section className="card-inset p-4">
          <h3 className="section-title mb-2">Character</h3>
          {characters.length === 0 ? (
            <p className="text-sm text-muted">No characters to export.</p>
          ) : (
            <>
              <select className="input mb-3" value={charId} onChange={(e) => setCharId(e.target.value)} aria-label="Character to export">
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.status === 'fallen' ? ' (fallen)' : ''}
                  </option>
                ))}
              </select>
              <div className="flex flex-col gap-2">
                <button className="btn justify-start" onClick={exportCharJson} disabled={!character || busy}>
                  {busy === 'charjson' ? <Spinner /> : <FileJson className="h-4 w-4" />} Native .json bundle
                </button>
                <button className="btn justify-start" onClick={exportCharVtt} disabled={!character || busy}>
                  {busy === 'charvtt' ? <Spinner /> : <Swords className="h-4 w-4" />} 5e VTT JSON (Foundry dnd5e)
                </button>
                <button className="btn justify-start" onClick={() => setPrinting(character)} disabled={!character}>
                  <Printer className="h-4 w-4" /> Print / PDF sheet + loot cards
                </button>
              </div>
            </>
          )}
        </section>

        <section className="card-inset p-4">
          <h3 className="section-title mb-2">Campaign</h3>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted">No campaigns to export.</p>
          ) : (
            <>
              <select className="input mb-3" value={campId} onChange={(e) => setCampId(e.target.value)} aria-label="Campaign to export">
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.meta?.title}
                  </option>
                ))}
              </select>
              <div className="flex flex-col gap-2">
                <button className="btn justify-start" onClick={exportCampJson} disabled={!campaign || busy}>
                  {busy === 'campjson' ? <Spinner /> : <Download className="h-4 w-4" />} Full backup (.json)
                </button>
                <button className="btn justify-start" onClick={exportCampMd} disabled={!campaign || busy}>
                  {busy === 'campmd' ? <Spinner /> : <BookText className="h-4 w-4" />} StoryBook (.md)
                </button>
              </div>
            </>
          )}
        </section>

        <section className="card-inset p-4">
          <h3 className="section-title mb-2">Import</h3>
          <p className="mb-3 text-sm text-muted">
            Characters from Solo RPG Engine, Foundry VTT (incl. Plutonium), D&D Beyond, Roll20, generic JSON or a Markdown / text sheet. Campaigns from a native backup, a Foundry journal or a Markdown document. Imports always create new copies; HP, AC and XP are recomputed by the engine.
          </p>
          <label className={`btn-primary cursor-pointer ${busy ? 'pointer-events-none opacity-60' : ''}`}>
            {busy === 'import' ? <Spinner /> : <Upload className="h-4 w-4" />} Choose file (.json, .md, .txt)
            <input type="file" accept=".json,.md,.markdown,.txt,application/json,text/markdown,text/plain" className="hidden" onChange={(e) => importFile(e.target.files?.[0])} />
          </label>
          <textarea
            className="input mt-3 min-h-[90px] text-base sm:text-xs"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="…or paste a character sheet or campaign notes here"
            aria-label="Paste text to import"
          />
          <button className="btn mt-2 w-full" onClick={() => importText(pasted, 'pasted.txt')} disabled={Boolean(busy) || !pasted.trim()}>
            <ClipboardPaste className="h-4 w-4" /> Import pasted text
          </button>
          {lastSource && <p className="mt-2 text-xs">Detected: <span className="pill py-0">{lastSource}</span></p>}
          {unrecognized && (
            <div className="mt-3 rounded-theme border-theme border-warning/60 bg-warning/10 p-2 text-xs">
              <p>{unrecognized.message}</p>
              <button className="btn-primary mt-2 w-full" onClick={smartConvert} disabled={Boolean(busy)}>
                {busy === 'ai' ? <Spinner /> : <Sparkles className="h-4 w-4" />} Smart Convert with AI
              </button>
              <p className="mt-1 text-muted">The storyteller extracts names, scores and items; the engine rebuilds the rest. You review it before saving.</p>
            </div>
          )}
          {review && (
            <div className="mt-3 rounded-theme border-theme border-accent/60 bg-accent/5 p-2 text-xs">
              <p className="font-semibold">
                {review.data.name} — Level {review.data.level} {review.data.speciesName ? `${review.data.speciesName} ` : ''}
                {review.data.classOrArchetype}
              </p>
              <p className="font-mono text-muted">
                {Object.entries(review.data.stats).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(' · ')} · HP {review.data.vitals.maxHp} · d{review.data.hitDie}
              </p>
              {review.data.skillProficiencies.length > 0 && <p className="text-muted">Skills: {review.data.skillProficiencies.join(', ')}</p>}
              {review.data.inventory.length > 0 && <p className="text-muted">Items: {review.data.inventory.map((i) => i.name).join(', ')}</p>}
              <div className="mt-2 flex gap-2">
                <button
                  className="btn-primary flex-1"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    run('import', async () => {
                      await commitImport(review);
                      setReview(null);
                    })
                  }
                >
                  Save character
                </button>
                <button className="btn" onClick={() => setReview(null)}>
                  Discard
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
      {printing && <PrintSheet character={printing} skin={buildSkin(printing.genre)} onClose={() => setPrinting(null)} />}
    </Modal>
  );
}
