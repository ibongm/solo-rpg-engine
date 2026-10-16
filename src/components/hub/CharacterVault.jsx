import { useState } from 'react';
import { UserPlus, Copy, Trash2, Pencil, Printer, Sparkles, Shield, Heart, Swords } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { createCharacterDoc, deleteCharacterDoc } from '../../firebase/db.js';
import { ABILITIES, GENRES, buildSkin } from '../../config/genreSkins.js';
import { cloneCharacter } from '../../engine/progression.js';
import { effectiveAc } from '../../engine/diceEngine.js';
import { Modal, EmptyState, ConfirmButton } from '../common/ui.jsx';
import PerkTree from '../common/PerkTree.jsx';
import PrintSheet from '../common/PrintSheet.jsx';
import CharacterCreator from './CharacterCreator.jsx';

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
          Build a full D&D 5e character — species, class, background, abilities and gear — then forge a world for them.
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
            Level {c.level} {c.speciesName ? `${c.speciesName} ` : ''}{c.classOrArchetype} · {genre.label}
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
