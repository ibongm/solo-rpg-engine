import { useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, ImagePlus, Dices, MessageSquareQuote, BookMarked, Check, X, Sparkles } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { editLastTurn, paintScene } from '../../store/turnRunner.js';
import { fmtMod } from '../../engine/diceEngine.js';
import { Spinner } from '../common/ui.jsx';

const EVENT_TONE = {
  success: 'border-success/50 text-success',
  danger: 'border-danger/50 text-danger',
  warning: 'border-warning/50 text-warning',
  info: 'border-info/40 text-info',
};

export default function NarrativeLog() {
  const turns = useGameStore((s) => s.turns);
  const campaign = useGameStore((s) => s.campaign);
  const character = useGameStore((s) => s.character);
  const busy = useGameStore((s) => s.busy);
  const busyLabel = useGameStore((s) => s.busyLabel);
  const diary = useGameStore((s) => s.diary);
  const openTab = useGameStore((s) => s.openTab);
  const endRef = useRef(null);

  const ordered = useMemo(() => turns.slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0)), [turns]);
  const lastTurn = ordered[ordered.length - 1];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [ordered.length, busy, lastTurn?.imageUrl]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4" aria-live="polite">
      {diary.length > 0 && (
        <button className="card-inset mb-4 flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted hover:text-ink" onClick={() => openTab(5)}>
          <BookMarked className="h-4 w-4" />
          {diary.length} earlier chapter{diary.length > 1 ? 's' : ''} recorded in the Campaign Diary.
        </button>
      )}
      <div className="mx-auto max-w-3xl space-y-5">
        {ordered.map((t) => (
          <TurnEntry
            key={t.id}
            turn={t}
            isLast={t.id === lastTurn?.id}
            editable={t.id === campaign.lastTurnId && campaign.lastTurnEditable && Boolean(t.player) && campaign.meta.status === 'active' && !busy}
            imageMode={campaign.meta.imageMode}
            heroName={character.name}
          />
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-muted">
            <Spinner /> <span className="italic">{busyLabel || 'The storyteller weaves…'}</span>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function RollCard({ roll }) {
  const resultTone = roll.success === null || roll.success === undefined ? 'border-line' : roll.success ? 'border-success' : 'border-danger';
  return (
    <div className={`rounded-theme border-l-4 ${resultTone} bg-surface-2/60 px-3 py-2 text-sm`}>
      <div className="flex flex-wrap items-center gap-2">
        <Dices className="h-4 w-4 text-accent" />
        <strong>{roll.label}</strong>
        <span className="font-mono">
          d20{roll.faces?.length > 1 ? ` [${roll.faces.join(', ')}] (${roll.advantage})` : ''} {roll.natural} {fmtMod(roll.totalModifier)} = <strong>{roll.total}</strong>
        </span>
        {roll.dc !== null && roll.dc !== undefined && (
          <span className={`pill ${roll.success ? 'border-success text-success' : 'border-danger text-danger'}`}>
            DC {roll.dc} · {roll.success ? 'Success' : 'Failure'}
          </span>
        )}
        {roll.critical && <span className="pill border-accent text-accent">Natural 20</span>}
        {roll.fumble && <span className="pill border-danger text-danger">Natural 1</span>}
        {roll.deathSave && <span className="pill capitalize">{roll.deathSave}</span>}
      </div>
      {roll.breakdown?.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
          {roll.breakdown.map((b, i) => (
            <span key={i}>
              {b.label} {fmtMod(b.value)}
            </span>
          ))}
        </div>
      )}
      {roll.damage && (
        <div className="mt-1 font-mono text-xs">
          Damage {roll.damage.expr}
          {roll.damage.critical ? ' (crit: dice doubled)' : ''}: [{roll.damage.rolls.join(', ')}]{roll.damage.bonus ? ` ${fmtMod(roll.damage.bonus)}` : ''} = <strong>{roll.damage.total}</strong>
          {roll.targetName ? ` → ${roll.targetName}` : ''}
        </div>
      )}
    </div>
  );
}

function TurnEntry({ turn, isLast, editable, imageMode, heroName }) {
  const paintingTurnIds = useGameStore((s) => s.paintingTurnIds);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(turn.player?.text || '');
  const painting = Boolean(paintingTurnIds[turn.id]);
  const isRollTurn = turn.player?.kind === 'roll_result' || turn.player?.kind === 'death_save';

  return (
    <article className={`animate-fade-in ${isLast ? '' : 'opacity-95'}`}>
      {turn.player && (
        <div className="mb-2 flex justify-end">
          <div className={`max-w-[85%] rounded-theme px-3 py-2 text-sm ${turn.player.ooc ? 'border-theme border-dashed border-info/60 bg-info/5 italic' : 'bg-accent/10'}`}>
            <div className="mb-0.5 flex items-center justify-end gap-1.5 text-[11px] uppercase tracking-wide text-muted">
              {turn.player.ooc && (
                <span className="pill border-info py-0 text-info">
                  <MessageSquareQuote className="h-3 w-3" /> OOC
                </span>
              )}
              {turn.player.stance && <span className="pill py-0">{turn.player.stance}</span>}
              <span>{turn.player.kind === 'travel' ? 'Travel' : turn.player.kind === 'roll_result' ? 'Roll' : turn.player.kind === 'death_save' ? 'Death Save' : heroName}</span>
            </div>
            {editing ? (
              <div className="space-y-2">
                {isRollTurn ? (
                  <p className="text-xs text-muted">The dice result is locked. Regenerate the storyteller’s response to this roll:</p>
                ) : (
                  <textarea className="input min-h-[70px]" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
                )}
                <div className="flex justify-end gap-1">
                  <button className="btn px-2 py-1 text-xs" onClick={() => setEditing(false)}>
                    <X className="h-3 w-3" /> Cancel
                  </button>
                  <button
                    className="btn-primary px-2 py-1 text-xs"
                    disabled={!isRollTurn && !text.trim()}
                    onClick={async () => {
                      setEditing(false);
                      await editLastTurn(isRollTurn ? undefined : text.trim());
                    }}
                  >
                    <Check className="h-3 w-3" /> Regenerate
                  </button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-line">{turn.player.text}</p>
            )}
          </div>
        </div>
      )}
      {turn.roll && (
        <div className="mb-2">
          <RollCard roll={turn.roll} />
        </div>
      )}
      {turn.imageUrl && (
        <figure className="mb-3 overflow-hidden rounded-theme border-theme border-line/40 shadow-theme">
          <img src={turn.imageUrl} alt={turn.ai?.scene_visual_prompt || 'Scene illustration'} className="w-full object-cover" loading="lazy" />
        </figure>
      )}
      {turn.ai?.narrative_text && <div className="whitespace-pre-line font-body text-[1.05rem] leading-relaxed">{turn.ai.narrative_text}</div>}
      {turn.engineEvents?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {turn.engineEvents.map((e, i) => (
            <span key={i} className={`pill bg-transparent ${EVENT_TONE[e.tone] || EVENT_TONE.info}`}>
              {e.text}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {editable && !editing && (
          <button className="btn-ghost text-xs" onClick={() => setEditing(true)} title="Edit Last Turn — fix a misread or hallucination">
            <Pencil className="h-3.5 w-3.5" /> Edit Last Turn
          </button>
        )}
        {imageMode !== 'off' && !turn.imageUrl && turn.ai?.scene_visual_prompt && (
          <button className="btn-ghost text-xs" disabled={painting} onClick={() => paintScene(turn.id, turn.ai.scene_visual_prompt)} title="Paint this scene">
            {painting ? <Spinner className="h-3.5 w-3.5" /> : <ImagePlus className="h-3.5 w-3.5" />} {painting ? 'Painting…' : 'Paint Scene'}
          </button>
        )}
        {turn.model && isLast && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-muted">
            <Sparkles className="h-3 w-3" /> {turn.model}
          </span>
        )}
      </div>
    </article>
  );
}
