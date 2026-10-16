import { useState } from 'react';
import { BookOpen, Play, Hammer, Trash2, MapPin, Clock, Coins, Trophy, Tv, Skull, Flag } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { deleteCampaignCascade, updateCampaignDoc, updateCharacterDoc, getCharacter } from '../../firebase/db.js';
import { GENRES, THEMES, themeForGenre } from '../../config/genreSkins.js';
import { formatClock } from '../../engine/clockWeatherEngine.js';
import { Modal, EmptyState, ConfirmButton, fmtUSD, timeAgo } from '../common/ui.jsx';

const STATUS_STYLE = {
  active: 'border-success text-success',
  completed: 'border-info text-info',
  fallen: 'border-danger text-danger',
};

export default function CampaignShelf({ campaigns, characters, onChange, onForge }) {
  const user = useGameStore((s) => s.user);
  const toast = useGameStore((s) => s.toast);
  const enterGame = useGameStore((s) => s.enterGame);
  const setTheme = useGameStore((s) => s.setTheme);
  const [recapFor, setRecapFor] = useState(null);

  const charName = (id) => characters.find((c) => c.id === id)?.name || 'Unknown';
  const nodeLabel = (c) => c.mapNodes?.find((n) => n.id === c.worldState?.currentNodeId)?.label || '—';

  const resume = (c) => {
    setTheme(c.meta?.themeOverride || themeForGenre(c.meta?.genreTheme));
    enterGame(c.id);
  };

  const complete = async (c) => {
    try {
      await updateCampaignDoc(user.uid, c.id, { 'meta.status': 'completed' });
      const ch = await getCharacter(user.uid, c.meta.activeCharId);
      if (ch && ch.activeCampaignId === c.id) await updateCharacterDoc(user.uid, ch.id, { ...ch, activeCampaignId: null });
      toast(`“${c.meta.title}” marked complete. ${ch?.name || 'Your hero'} returns to the Roster as a veteran.`, 'success');
      onChange();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const remove = async (c) => {
    try {
      await deleteCampaignCascade(user.uid, c);
      toast(`Deleted “${c.meta.title}”.`, 'info');
      onChange();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Campaign Shelf</h2>
          <p className="text-sm text-muted">Active and completed adventures.</p>
        </div>
        <button className="btn-primary" onClick={onForge}>
          <Hammer className="h-4 w-4" /> World Forge
        </button>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-10 w-10" />} title="The shelf is empty" action={<button className="btn-primary" onClick={onForge}>Forge a new world</button>}>
          Create a character in the Roster, then use the World Forge to seed a region, rival factions and an opening scene.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.map((c) => {
            const genre = GENRES[c.meta?.genreTheme] || GENRES.fantasy;
            const status = c.meta?.status || 'active';
            return (
              <article key={c.id} className="card flex flex-col p-4" data-theme={c.meta?.themeOverride || genre.theme}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold">{c.meta?.title}</h3>
                    <p className="text-sm text-muted">
                      {genre.label} · {THEMES[c.meta?.themeOverride || genre.theme]}
                    </p>
                  </div>
                  <span className={`pill shrink-0 capitalize ${STATUS_STYLE[status]}`}>
                    {status === 'fallen' ? <Skull className="h-3 w-3" /> : status === 'completed' ? <Trophy className="h-3 w-3" /> : <Flag className="h-3 w-3" />}
                    {status}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted">Hero:</span> {charName(c.meta?.activeCharId)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted" /> {nodeLabel(c)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted" /> {timeAgo(c.meta?.lastPlayedAt)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Coins className="h-3.5 w-3.5 text-muted" /> {fmtUSD(c.telemetry?.totalCostUSD)} API cost
                  </div>
                  <div className="col-span-2 text-xs text-muted">{formatClock(c.worldState?.clock)}</div>
                </dl>
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                  <button className="btn-primary" onClick={() => setRecapFor(c)}>
                    <Play className="h-4 w-4" /> {status === 'active' ? 'Continue' : 'Open (read-only)'}
                  </button>
                  {status === 'active' && (
                    <ConfirmButton className="btn" confirmLabel="Mark complete?" onConfirm={() => complete(c)}>
                      <Trophy className="h-4 w-4" /> Complete
                    </ConfirmButton>
                  )}
                  <div className="ml-auto">
                    <ConfirmButton className="btn-ghost text-danger" confirmLabel="Delete forever?" onConfirm={() => remove(c)}>
                      <Trash2 className="h-4 w-4" />
                    </ConfirmButton>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {recapFor && <PreviouslyOnModal campaign={recapFor} heroName={charName(recapFor.meta?.activeCharId)} onClose={() => setRecapFor(null)} onResume={() => resume(recapFor)} />}
    </section>
  );
}

/** “Previously On...” TV-style session recap shown when loading a saved campaign. */
export function PreviouslyOnModal({ campaign, heroName, onClose, onResume }) {
  const recap = campaign.sessionRecap || {};
  const bullets = recap.bullets?.length ? recap.bullets : ['Your story is only just beginning.'];
  return (
    <Modal
      title="Previously On…"
      icon={<Tv className="h-5 w-5 text-accent" />}
      onClose={onClose}
      footer={
        <button className="btn-primary" onClick={onResume} autoFocus>
          <Play className="h-4 w-4" /> {campaign.meta?.status === 'active' ? 'Resume' : 'Open'}
        </button>
      }
    >
      <p className="mb-1 font-heading text-lg font-bold">{campaign.meta?.title}</p>
      <p className="mb-4 text-sm text-muted">
        {heroName} · {formatClock(campaign.worldState?.clock)}
      </p>
      <ul className="space-y-2">
        {bullets.slice(0, 3).map((b, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-heading font-bold text-accent">{i + 1}.</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      {recap.immediateObjective && (
        <div className="card-inset mt-4 p-3">
          <div className="label">Immediate Objective</div>
          <p>{recap.immediateObjective}</p>
        </div>
      )}
      {recap.presentNPCs?.length > 0 && (
        <div className="mt-3">
          <div className="label">Present</div>
          <div className="flex flex-wrap gap-1">
            {recap.presentNPCs.map((n) => (
              <span key={n} className="pill">
                {n}
              </span>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
