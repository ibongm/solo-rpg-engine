import { useState } from 'react';
import { ArrowDownUp, Download, Upload, FileJson, BookText, Printer, Swords } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { createCharacterDoc, importCampaignBundle, loadCampaignSubcollections, getCharacter } from '../../firebase/db.js';
import { buildSkin } from '../../config/genreSkins.js';
import {
  exportCharacterBundle,
  exportCampaignBundle,
  parseImportJson,
  campaignToMarkdown,
  toFoundryActor,
  downloadText,
  slugify,
} from '../../engine/exporters.js';
import { Modal, Spinner } from '../common/ui.jsx';
import PrintSheet from '../common/PrintSheet.jsx';

export default function ImportExportModal({ characters, campaigns, onClose, onImported }) {
  const user = useGameStore((s) => s.user);
  const toast = useGameStore((s) => s.toast);
  const [charId, setCharId] = useState(characters[0]?.id || '');
  const [campId, setCampId] = useState(campaigns[0]?.id || '');
  const [busy, setBusy] = useState('');
  const [printing, setPrinting] = useState(null);

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

  const importFile = (file) =>
    run('import', async () => {
      if (!file) return;
      const text = await file.text();
      const parsed = parseImportJson(text);
      if (parsed.kind === 'character') {
        await createCharacterDoc(user.uid, parsed.data);
        toast(`Imported character ${parsed.data.name}${parsed.source === 'foundry' ? ' from 5e VTT JSON' : ''}.`, 'success');
      } else {
        await importCampaignBundle(user.uid, parsed.data);
        toast(`Imported campaign “${parsed.data.campaign.meta.title}”.`, 'success');
      }
      onImported();
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
          <p className="mb-3 text-sm text-muted">Native character or campaign bundles, or a Foundry VTT dnd5e actor export. Imports always create new copies.</p>
          <label className={`btn-primary cursor-pointer ${busy ? 'pointer-events-none opacity-60' : ''}`}>
            {busy === 'import' ? <Spinner /> : <Upload className="h-4 w-4" />} Choose .json file
            <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => importFile(e.target.files?.[0])} />
          </label>
          <p className="mt-3 text-xs text-muted">Markdown lore can be imported inside the World Forge wizard.</p>
        </section>
      </div>
      {printing && <PrintSheet character={printing} skin={buildSkin(printing.genre)} onClose={() => setPrinting(null)} />}
    </Modal>
  );
}
