import { useEffect } from 'react';
import { User, Backpack, Map, ScrollText, BookOpen, Cpu } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import Tab1Character from './Tab1Character.jsx';
import Tab2Inventory from './Tab2Inventory.jsx';
import Tab3MapFactions from './Tab3MapFactions.jsx';
import Tab4Quests from './Tab4Quests.jsx';
import Tab5DiaryCodex from './Tab5DiaryCodex.jsx';
import Tab6Engine from './Tab6Engine.jsx';

export const TABS = [
  { id: 1, label: 'Character', icon: User, Component: Tab1Character },
  { id: 2, label: 'Inventory', icon: Backpack, Component: Tab2Inventory },
  { id: 3, label: 'Map', icon: Map, Component: Tab3MapFactions },
  { id: 4, label: 'Quests', icon: ScrollText, Component: Tab4Quests },
  { id: 5, label: 'Diary', icon: BookOpen, Component: Tab5DiaryCodex },
  { id: 6, label: 'Engine', icon: Cpu, Component: Tab6Engine },
];

/** Quests can be switched off per campaign; the Quests tab is hidden then (other tabs keep their numbers). */
export function questsEnabled(campaign) {
  return campaign?.meta?.questsEnabled !== false;
}

export function visibleTabs(campaign) {
  return TABS.filter((t) => t.id !== 4 || questsEnabled(campaign));
}

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/** 6-tab Command Sidebar (desktop). Keys 1–6 switch tabs when not typing in a field. */
export default function CommandSidebar() {
  const tab = useGameStore((s) => s.sidebarTab);
  const setTab = useGameStore((s) => s.setSidebarTab);
  const campaign = useGameStore((s) => s.campaign);
  const tabs = visibleTabs(campaign);

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return;
      const st = useGameStore.getState();
      if (st.rollPrompt || st.modal) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && visibleTabs(st.campaign).some((t) => t.id === n)) {
        e.preventDefault();
        setTab(n);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setTab]);

  const active = tabs.find((t) => t.id === tab) || tabs[0];
  const { Component } = active;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav className="flex border-b-theme border-line/40 bg-surface/60" role="tablist" aria-label="Command Sidebar">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={active.id === id}
            onClick={() => setTab(id)}
            className={`flex flex-1 flex-col items-center gap-0.5 border-b-2 py-2 text-[11px] font-semibold transition ${active.id === id ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'}`}
            title={`${label} (${id})`}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden xl:inline">{label}</span>
            <kbd className="rounded border border-line/50 px-1 font-mono text-[9px] leading-tight">{id}</kbd>
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto p-4" role="tabpanel">
        <Component />
      </div>
    </div>
  );
}
