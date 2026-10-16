import { useMemo, useState } from 'react';
import { BookOpen, Search, Users, Pin, Trash2, Plus, ChevronDown, ChevronRight, Heart, Shield, Swords } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { addPin, removePin } from '../../store/localActions.js';
import { EmptyState, Meter, SegmentedControl, ConfirmButton } from '../common/ui.jsx';

const CODEX_TYPES = ['all', 'npc', 'companion', 'location', 'faction', 'item', 'lore'];

export default function Tab5DiaryCodex() {
  const [view, setView] = useState('diary');
  return (
    <div className="space-y-4">
      <SegmentedControl
        value={view}
        onChange={setView}
        options={[
          { value: 'diary', label: 'Diary' },
          { value: 'codex', label: 'Codex' },
          { value: 'companions', label: 'Companions' },
          { value: 'pinboard', label: 'Pinboard' },
        ]}
      />
      {view === 'diary' && <Diary />}
      {view === 'codex' && <Codex />}
      {view === 'companions' && <Companions />}
      {view === 'pinboard' && <Pinboard />}
    </div>
  );
}

function Diary() {
  const diary = useGameStore((s) => s.diary);
  const turns = useGameStore((s) => s.turns);
  const archivistRunning = useGameStore((s) => s.archivistRunning);
  const [open, setOpen] = useState(null);
  const ordered = diary.slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return (
    <section>
      <p className="mb-2 text-xs text-muted">
        The Archivist condenses the oldest 10 turns into a chapter whenever the active buffer reaches 20 turns ({turns.length}/20 now){archivistRunning ? ' — writing now…' : '.'}
      </p>
      {ordered.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-8 w-8" />} title="No chapters yet">
          Your first chapter will be written after 20 turns.
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {ordered.map((ch, i) => (
            <div key={ch.id} className="card-inset">
              <button className="flex w-full items-center gap-2 px-3 py-2 text-left" onClick={() => setOpen(open === ch.id ? null : ch.id)} aria-expanded={open === ch.id}>
                {open === ch.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="font-heading text-sm font-bold">
                  Chapter {i + 1}: {ch.title}
                </span>
              </button>
              {open === ch.id && (
                <div className="px-3 pb-3 text-sm">
                  <p className="whitespace-pre-line leading-relaxed">{ch.summary}</p>
                  {ch.keyEvents?.length > 0 && (
                    <ul className="mt-2 list-inside list-disc text-xs text-muted">
                      {ch.keyEvents.map((e, j) => (
                        <li key={j}>{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Codex() {
  const codex = useGameStore((s) => s.codex);
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return codex
      .filter((c) => type === 'all' || c.type === type)
      .filter((c) => !needle || c.name.toLowerCase().includes(needle) || (c.summary || '').toLowerCase().includes(needle) || (c.tags || []).some((t) => t.includes(needle)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [codex, q, type]);
  return (
    <section>
      <div className="mb-2 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2 h-4 w-4 text-muted" />
          <input className="input pl-8" placeholder="Search the World Codex…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search codex" />
        </div>
        <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter type">
          {CODEX_TYPES.map((t) => (
            <option key={t} value={t}>
              {t === 'all' ? 'All' : t[0].toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </div>
      {filtered.length === 0 ? (
        <p className="text-xs text-muted">No entries match.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <div key={c.id} className="card-inset p-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <strong>{c.name}</strong>
                <span className="pill py-0 text-[10px] capitalize">{c.type}</span>
              </div>
              {c.attitude && <div className="text-xs text-accent">Attitude: {c.attitude}</div>}
              <p className="mt-0.5 text-xs text-muted">{c.summary}</p>
              {c.tags?.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {c.tags.slice(0, 8).map((t) => (
                    <span key={t} className="rounded bg-surface px-1 text-[10px] text-muted">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Companions() {
  const character = useGameStore((s) => s.character);
  const roster = character.companionRoster || [];
  const recruited = roster.filter((c) => c.isRecruited);
  const known = roster.filter((c) => !c.isRecruited);
  return (
    <section className="space-y-3">
      <p className="text-xs text-muted">Companions join only through the story — earn their trust and they may follow you.</p>
      {recruited.length === 0 && <EmptyState icon={<Users className="h-8 w-8" />} title="Travelling alone">No one has joined your party yet.</EmptyState>}
      {recruited.map((c) => (
        <div key={c.id} className="card-inset p-3 text-sm">
          <div className="flex items-center justify-between">
            <strong>{c.name}</strong>
            <span className="text-xs text-muted">{c.archetype}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
            <span className="pill">
              <Heart className="h-3 w-3 text-danger" /> {c.hp}/{c.maxHp}
            </span>
            <span className="pill">
              <Shield className="h-3 w-3" /> AC {c.ac}
            </span>
            <span className="pill">
              <Swords className="h-3 w-3" /> +{c.attackBonus} · {c.damageDice}
            </span>
          </div>
          <Meter className="mt-2" value={c.loyalty} max={100} label="Loyalty" colorClass={c.loyalty >= 70 ? 'bg-success' : c.loyalty >= 35 ? 'bg-warning' : 'bg-danger'} />
          {c.personalityNotes && <p className="mt-1 text-xs italic text-muted">{c.personalityNotes}</p>}
        </div>
      ))}
      {known.length > 0 && (
        <div>
          <div className="label">Acquaintances</div>
          <div className="space-y-1">
            {known.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-xs">
                <span>
                  {c.name} <span className="text-muted">({c.archetype})</span>
                </span>
                <span className="font-mono text-muted">trust {c.loyalty}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Pinboard() {
  const campaign = useGameStore((s) => s.campaign);
  const [text, setText] = useState('');
  const pins = campaign.lorePinboard || [];
  const locked = campaign.meta.status !== 'active';
  return (
    <section>
      <p className="mb-2 text-xs text-muted">House rules and world laws pinned here are locked into the cached system prompt as absolute law.</p>
      {!locked && (
        <div className="mb-3 flex gap-2">
          <input
            className="input"
            placeholder="e.g. Magic is illegal inside city walls."
            value={text}
            maxLength={600}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && text.trim()) {
                await addPin(text);
                setText('');
              }
            }}
          />
          <button
            className="btn-primary"
            disabled={!text.trim()}
            onClick={async () => {
              await addPin(text);
              setText('');
            }}
            aria-label="Pin"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}
      {pins.length === 0 ? (
        <p className="text-xs text-muted">Nothing pinned.</p>
      ) : (
        <ul className="space-y-1.5">
          {pins.map((p, i) => (
            <li key={i} className="card-inset flex items-start gap-2 px-2.5 py-1.5 text-sm">
              <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
              <span className="flex-1">{p}</span>
              {!locked && (
                <ConfirmButton className="btn-ghost px-1 py-0 text-danger" confirmLabel="Unpin?" onConfirm={() => removePin(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </ConfirmButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
