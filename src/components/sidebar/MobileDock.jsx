import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Heart, Shield, Clock, ChevronUp, X, Skull, Activity } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { effectiveAc, effectiveMaxHp } from '../../engine/diceEngine.js';
import { formatClock } from '../../engine/clockWeatherEngine.js';
import PinnedVitalsHUD from './PinnedVitalsHUD.jsx';
import { visibleTabs } from './CommandSidebar.jsx';

/**
 * Phone layout dock: a one-line vitals strip plus a bottom tab bar.
 * Nothing opens until the player taps — a tab (or the strip) slides its panel up as a sheet,
 * and tapping the same tab again, the close button, the backdrop, or swiping down closes it.
 */
export default function MobileDock() {
  const character = useGameStore((s) => s.character);
  const campaign = useGameStore((s) => s.campaign);
  const sheet = useGameStore((s) => s.mobileSheet);
  const setSheet = useGameStore((s) => s.setMobileSheet);
  const setSidebarTab = useGameStore((s) => s.setSidebarTab);
  const dockRef = useRef(null);
  const [dockHeight, setDockHeight] = useState(0);

  const tabs = visibleTabs(campaign);
  const v = character.vitals;
  const maxHp = effectiveMaxHp(character);
  const hpPct = Math.max(0, Math.min(100, (v.hp / maxHp) * 100));
  const hpColor = hpPct > 60 ? 'bg-success' : hpPct > 30 ? 'bg-warning' : 'bg-danger';
  const dying = v.hp <= 0 && character.status !== 'fallen';

  // Keep the sheet sitting exactly above the dock, whatever its height.
  useLayoutEffect(() => {
    const el = dockRef.current;
    if (!el) return undefined;
    const update = () => setDockHeight(el.getBoundingClientRect().height);
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A tab can disappear (e.g. quests switched off) while its sheet is open.
  useEffect(() => {
    if (typeof sheet === 'number' && !tabs.some((t) => t.id === sheet)) setSheet(null);
  }, [sheet, tabs, setSheet]);

  const toggleTab = (id) => {
    if (sheet === id) {
      setSheet(null);
    } else {
      setSidebarTab(id);
      setSheet(id);
    }
  };

  const activeTab = typeof sheet === 'number' ? tabs.find((t) => t.id === sheet) : null;

  return (
    <>
      {sheet !== null && (
        <BottomSheet
          bottom={dockHeight}
          onClose={() => setSheet(null)}
          title={activeTab ? activeTab.label : 'Vitals'}
          icon={activeTab ? activeTab.icon : Activity}
        >
          {activeTab ? <activeTab.Component /> : <PinnedVitalsHUD bare />}
        </BottomSheet>
      )}

      <div ref={dockRef} className="relative z-50 border-t-theme border-line/50 bg-surface no-print" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <button
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs ${sheet === 'vitals' ? 'bg-surface-2' : ''}`}
          onClick={() => setSheet(sheet === 'vitals' ? null : 'vitals')}
          aria-expanded={sheet === 'vitals'}
          aria-label="Show full vitals"
        >
          <span className="min-w-0 max-w-[30%] truncate font-heading text-sm font-bold">{character.name}</span>
          {dying ? (
            <span className="flex flex-1 items-center gap-1 font-mono text-danger">
              <Skull className="h-3.5 w-3.5" /> ✔{v.deathSaves?.successes || 0} ✘{v.deathSaves?.failures || 0}
            </span>
          ) : (
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <Heart className="h-3.5 w-3.5 shrink-0 text-danger" />
              <span className="meter h-2 flex-1">
                <span className={`meter-fill block ${hpColor}`} style={{ width: `${hpPct}%` }} />
              </span>
              <span className="shrink-0 font-mono">
                {v.hp}/{maxHp}
              </span>
            </span>
          )}
          <span className="flex shrink-0 items-center gap-0.5 font-mono">
            <Shield className="h-3.5 w-3.5" />
            {effectiveAc(character)}
          </span>
          <span className="hidden shrink-0 items-center gap-0.5 font-mono min-[380px]:flex">
            <Clock className="h-3.5 w-3.5" />
            {formatClock(campaign.worldState.clock).replace(/^Day (\d+), (\d\d:\d\d).*$/, 'D$1 $2')}
          </span>
          {v.conditions?.length > 0 && <span className="h-2 w-2 shrink-0 rounded-full bg-warning" title="Conditions active" />}
          <ChevronUp className={`h-4 w-4 shrink-0 text-muted transition ${sheet === 'vitals' ? 'rotate-180' : ''}`} />
        </button>

        <nav className="flex border-t-theme border-line/30" role="tablist" aria-label="Panels">
          {tabs.map(({ id, label, icon: Icon }) => {
            const on = sheet === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={on}
                aria-label={label}
                onClick={() => toggleTab(id)}
                className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 border-t-2 text-[10px] font-semibold transition ${on ? 'border-accent text-accent' : 'border-transparent text-muted'}`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}

function BottomSheet({ bottom, onClose, title, icon: Icon, children }) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onTouchStart = (e) => {
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e) => {
    if (startY.current === null) return;
    setDragY(Math.max(0, e.touches[0].clientY - startY.current));
  };
  const onTouchEnd = () => {
    if (dragY > 80) onClose();
    setDragY(0);
    startY.current = null;
  };

  return (
    <div className="fixed inset-x-0 top-0 z-40 flex flex-col justify-end no-print" style={{ bottom }}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[80dvh] min-h-[40dvh] animate-fade-in flex-col rounded-t-2xl border-t-theme border-line/60 bg-surface shadow-theme"
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined, transition: dragY ? 'none' : 'transform 0.2s' }}
      >
        <header className="touch-none select-none" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line/50" />
          <div className="flex items-center justify-between px-4 py-2">
            <h2 className="flex items-center gap-2 font-heading text-base font-bold">
              <Icon className="h-4 w-4 text-accent" /> {title}
            </h2>
            <button className="btn-ghost p-2" onClick={onClose} aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
      </section>
    </div>
  );
}
