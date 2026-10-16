import { useCallback, useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import { Users, BookOpen, Skull, ArrowDownUp, LogOut, Dices, Palette } from 'lucide-react';
import { auth } from '../../firebase/config.js';
import { listCharacters, listCampaigns, listGraveyard } from '../../firebase/db.js';
import { useGameStore } from '../../store/useGameStore.js';
import { THEMES } from '../../config/genreSkins.js';
import { Spinner } from '../common/ui.jsx';
import CharacterVault from './CharacterVault.jsx';
import CampaignShelf from './CampaignShelf.jsx';
import WorldForgeWizard from './WorldForgeWizard.jsx';
import GraveyardMemorial from './GraveyardMemorial.jsx';
import ImportExportModal from './ImportExportModal.jsx';

const TABS = [
  { id: 'vault', label: 'The Roster', icon: Users },
  { id: 'shelf', label: 'Campaign Shelf', icon: BookOpen },
  { id: 'graveyard', label: 'Hall of Fame', icon: Skull },
];

export default function GuildhallHub() {
  const user = useGameStore((s) => s.user);
  const hubTab = useGameStore((s) => s.hubTab);
  const setHubTab = useGameStore((s) => s.setHubTab);
  const theme = useGameStore((s) => s.theme);
  const setTheme = useGameStore((s) => s.setTheme);
  const toast = useGameStore((s) => s.toast);

  const [characters, setCharacters] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [memorials, setMemorials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forging, setForging] = useState(false);
  const [ioOpen, setIoOpen] = useState(false);

  const reload = useCallback(async () => {
    if (!user) return;
    try {
      const [c, k, g] = await Promise.all([listCharacters(user.uid), listCampaigns(user.uid), listGraveyard(user.uid)]);
      setCharacters(c);
      setCampaigns(k);
      setMemorials(g);
    } catch (err) {
      toast(`Could not load the Guildhall: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    setTheme(theme);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeTab = TABS.some((t) => t.id === hubTab) ? hubTab : 'shelf';

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 pb-16 pt-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Dices className="h-9 w-9 text-accent" />
          <div>
            <h1 className="text-2xl font-bold leading-tight">The Guildhall</h1>
            <p className="text-sm text-muted">Welcome back{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-muted">
            <Palette className="h-4 w-4" />
            <select className="input w-auto py-1" value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Hub theme">
              {Object.entries(THEMES).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" onClick={() => setIoOpen(true)}>
            <ArrowDownUp className="h-4 w-4" /> Import / Export
          </button>
          <button className="btn-ghost" onClick={() => signOut(auth)} title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <nav className="mb-5 flex gap-1 border-b-theme border-line/40" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setHubTab(id)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 font-heading text-sm font-bold transition ${activeTab === id ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-muted">
          <Spinner /> Loading…
        </div>
      ) : (
        <>
          {activeTab === 'vault' && <CharacterVault characters={characters} campaigns={campaigns} onChange={reload} />}
          {activeTab === 'shelf' && <CampaignShelf campaigns={campaigns} characters={characters} onChange={reload} onForge={() => setForging(true)} />}
          {activeTab === 'graveyard' && <GraveyardMemorial memorials={memorials} />}
        </>
      )}

      {forging && (
        <WorldForgeWizard
          characters={characters}
          onClose={() => setForging(false)}
          onCreated={() => {
            setForging(false);
            reload();
          }}
        />
      )}
      {ioOpen && <ImportExportModal characters={characters} campaigns={campaigns} onClose={() => setIoOpen(false)} onImported={reload} />}
    </div>
  );
}
