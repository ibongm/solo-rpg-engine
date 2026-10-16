import { useEffect, useMemo } from 'react';
import { BookOpen } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';

/** BroadcastChannel name shared with the pop-out Almanac (`/?almanac=1`). */
export const ALMANAC_CHANNEL = 'solo-rpg-almanac';

/** Genre the Almanac should show: the active campaign's, else what the creator / World Forge shows. */
export function useActiveGenre() {
  const campaignGenre = useGameStore((s) => s.campaign?.meta?.genreTheme);
  const almanacGenre = useGameStore((s) => s.almanacGenre);
  return campaignGenre || almanacGenre || 'fantasy';
}

/** Snapshot of the active campaign's world for the World Codex tab (null outside a campaign). */
export function useWorldSnapshot() {
  const campaign = useGameStore((s) => s.campaign);
  const codex = useGameStore((s) => s.codex);
  return useMemo(
    () => (campaign ? { codex: codex || [], mapNodes: campaign.mapNodes || [], factions: campaign.factions || [], lorePinboard: campaign.lorePinboard || [] } : null),
    [campaign, codex],
  );
}

/**
 * Always mounted in the main window (small, no reference data): the floating launcher button,
 * the Alt+A / "?" hotkeys, and the BroadcastChannel feed that keeps a popped-out Almanac in sync.
 */
export default function AlmanacLauncher() {
  const toggle = useGameStore((s) => s.toggleAlmanac);
  const open = useGameStore((s) => s.almanacOpen);
  const view = useGameStore((s) => s.view);
  const genre = useActiveGenre();
  const world = useWorldSnapshot();

  useEffect(() => {
    const onKey = (e) => {
      const el = document.activeElement;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyA') {
        e.preventDefault();
        toggle();
      } else if (e.key === '?' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    const ch = new BroadcastChannel(ALMANAC_CHANNEL);
    const send = () => ch.postMessage({ type: 'snapshot', genre, world });
    ch.onmessage = (e) => e.data?.type === 'request' && send();
    send();
    return () => ch.close();
  }, [genre, world]);

  if (open) return null;
  // In the game on phones, the header has its own Almanac button (the action deck owns the bottom edge).
  return (
    <button
      className={`btn fixed bottom-4 right-4 z-[54] rounded-full px-3 py-2 text-xs shadow-theme no-print ${view === 'game' ? 'hidden lg:inline-flex' : ''}`}
      onClick={toggle}
      title="Almanac (Alt+A or ?)"
      aria-label="Open the Almanac"
    >
      <BookOpen className="h-4 w-4" /> <span className="hidden sm:inline">Almanac</span>
    </button>
  );
}
