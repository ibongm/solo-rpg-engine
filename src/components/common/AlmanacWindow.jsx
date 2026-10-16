import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ExternalLink, Minus, Search, X } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { buildAlmanacIndex, searchAlmanac, ALMANAC_TABS } from '../../engine/almanac.js';
import { GENRES, GENRE_IDS } from '../../config/genreSkins.js';
import { useIsDesktop } from './useMediaQuery.js';
import { ALMANAC_CHANNEL, useActiveGenre, useWorldSnapshot } from './AlmanacLauncher.jsx';

const MAX_RESULTS = 150;
const POS_KEY = 'solo-rpg-almanac-pos';

function readPos() {
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
  } catch {
    return null;
  }
}
function writePos(p) {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(p));
  } catch {
    // storage unavailable (private mode) — position just isn't remembered
  }
}

/** The searchable reference body shared by the floating window and the pop-out page. */
function AlmanacBody({ genre, setGenre, world, autoFocus }) {
  const [tab, setTab] = useState('rules');
  const [query, setQuery] = useState('');
  const index = useMemo(() => buildAlmanacIndex({ genre, world }), [genre, world]);
  const hits = useMemo(() => searchAlmanac(index, query, query ? null : tab), [index, query, tab]);
  const tabs = ALMANAC_TABS.filter((t) => t.id !== 'world' || index.some((e) => e.tab === 'world'));
  const groups = [];
  for (const e of hits.slice(0, MAX_RESULTS)) {
    const key = query ? `${ALMANAC_TABS.find((t) => t.id === e.tab)?.label} · ${e.group}` : e.group;
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, items: [] }));
    g.items.push(e);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b-theme border-line/30 p-2">
        <div className="flex gap-2">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              className="input py-1 pl-7 text-base sm:text-sm"
              placeholder="Search everything…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus={autoFocus}
              aria-label="Search the Almanac"
            />
          </label>
          <select className="input w-auto py-1 text-base sm:text-xs" value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Genre">
            {GENRE_IDS.map((g) => (
              <option key={g} value={g}>
                {GENRES[g].label}
              </option>
            ))}
          </select>
        </div>
        {!query && (
          <div className="scrollbar-none flex gap-1 overflow-x-auto" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={`pill shrink-0 cursor-pointer ${tab === t.id ? 'border-accent bg-accent text-accent-ink' : 'hover:border-accent'}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2 text-sm">
        {!hits.length && <p className="p-4 text-center text-muted">Nothing matches “{query}”.</p>}
        {groups.map((g) => (
          <section key={g.key} className="mb-3">
            <h3 className="section-title mb-1 text-xs">{g.key}</h3>
            <ul className="space-y-1">
              {g.items.map((e) => (
                <li key={e.id}>
                  <details className="rounded-theme bg-surface-2/50 px-2 py-1.5">
                    <summary className="cursor-pointer list-none">
                      <span className="font-semibold">{e.title}</span>
                      {e.subtitle && <span className="ml-1 text-xs text-muted">{e.subtitle}</span>}
                    </summary>
                    <p className="mt-1 text-xs">{e.body}</p>
                    {e.details?.length > 0 && (
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted">
                        {e.details.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    )}
                  </details>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {hits.length > MAX_RESULTS && <p className="p-2 text-center text-xs text-muted">Showing {MAX_RESULTS} of {hits.length}. Refine your search to see more.</p>}
      </div>
    </div>
  );
}

/**
 * Non-blocking floating Almanac (no backdrop): draggable panel on desktop, a sheet that minimizes to
 * a pill on phones. Mounted once by App; open/close lives in the store.
 */
export default function AlmanacWindow() {
  const open = useGameStore((s) => s.almanacOpen);
  const setOpen = useGameStore((s) => s.setAlmanacOpen);
  const activeGenre = useActiveGenre();
  const [genre, setGenre] = useState(activeGenre);
  const world = useWorldSnapshot();
  const isDesktop = useIsDesktop();
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState(readPos);
  const drag = useRef(null);

  useEffect(() => setGenre(activeGenre), [activeGenre]);

  if (!open) return null;

  const popOut = () => {
    window.open('/?almanac=1', 'SoloRpgAlmanac', 'width=600,height=780');
    setOpen(false);
  };

  // Minimized on a phone: show a pill, but keep the panel mounted (hidden) so search, tab and scroll survive.
  const hidden = !isDesktop && minimized;

  const onPointerDown = (e) => {
    if (!isDesktop || e.target.closest('button,select,input')) return;
    const rect = e.currentTarget.parentElement.getBoundingClientRect();
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const x = Math.max(0, Math.min(window.innerWidth - 200, e.clientX - drag.current.dx));
    const y = Math.max(0, Math.min(window.innerHeight - 80, e.clientY - drag.current.dy));
    setPos({ x, y });
  };
  const onPointerUp = () => {
    if (drag.current && pos) writePos(pos);
    drag.current = null;
  };

  const style = isDesktop ? (pos ? { left: pos.x, top: pos.y } : { right: 24, top: 72 }) : undefined;
  return (
    <>
    {hidden && (
      <button className="btn-primary fixed bottom-24 left-3 z-[55] rounded-full px-3 py-2 text-xs shadow-theme no-print" onClick={() => setMinimized(false)}>
        <BookOpen className="h-4 w-4" /> Almanac
      </button>
    )}
    <div
      className={`card fixed z-[55] flex-col no-print ${hidden ? 'hidden' : 'flex'} ${isDesktop ? 'max-h-[80dvh] w-[420px] xl:w-[540px]' : 'inset-x-0 bottom-0 h-[75dvh] rounded-b-none'}`}
      style={style}
      role="dialog"
      aria-label="Almanac"
    >
      <div
        className={`flex items-center gap-2 border-b-theme border-line/40 px-3 py-2 ${isDesktop ? 'cursor-move select-none' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <BookOpen className="h-4 w-4 text-accent" />
        <h2 className="flex-1 font-heading font-bold">Almanac</h2>
        <button className="btn-ghost p-1" onClick={popOut} title="Pop out into its own window" aria-label="Pop out">
          <ExternalLink className="h-4 w-4" />
        </button>
        {!isDesktop && (
          <button className="btn-ghost p-1" onClick={() => setMinimized(true)} title="Minimize" aria-label="Minimize">
            <Minus className="h-4 w-4" />
          </button>
        )}
        <button className="btn-ghost p-1" onClick={() => setOpen(false)} title="Close (Alt+A)" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <AlmanacBody genre={genre} setGenre={setGenre} world={world} autoFocus={isDesktop} />
    </div>
    </>
  );
}

/** Full-window Almanac for the pop-out (`/?almanac=1`); follows the main window over BroadcastChannel. */
export function AlmanacStandalone() {
  const [genre, setGenre] = useState('fantasy');
  const [world, setWorld] = useState(null);
  useEffect(() => {
    document.title = 'Almanac — Solo RPG Engine';
    if (typeof BroadcastChannel === 'undefined') return undefined;
    const ch = new BroadcastChannel(ALMANAC_CHANNEL);
    ch.onmessage = (e) => {
      if (e.data?.type !== 'snapshot') return;
      if (e.data.genre) setGenre(e.data.genre);
      setWorld(e.data.world || null);
    };
    ch.postMessage({ type: 'request' });
    return () => ch.close();
  }, []);
  return (
    <div className="flex h-[100dvh] flex-col bg-bg">
      <header className="flex items-center gap-2 border-b-theme border-line/40 bg-surface px-3 py-2">
        <BookOpen className="h-4 w-4 text-accent" />
        <h1 className="font-heading font-bold">Almanac</h1>
      </header>
      <AlmanacBody genre={genre} setGenre={setGenre} world={world} autoFocus />
    </div>
  );
}
