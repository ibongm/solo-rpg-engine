import { useEffect, useRef } from 'react';
import { ArrowLeft, BookMarked, Lock, Skull, RotateCcw, Trash2, AlertTriangle } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { subscribeCampaign, subscribeCharacter, subscribeTurns, subscribeDiary, subscribeCodex } from '../../firebase/db.js';
import { themeForGenre } from '../../config/genreSkins.js';
import { runQueue, discardQueue, promptPendingRoll, initTurnRecovery } from '../../store/turnRunner.js';
import { Spinner, Modal } from '../common/ui.jsx';
import TelemetryPill from '../common/TelemetryPill.jsx';
import NarrativeLog from './NarrativeLog.jsx';
import ActionDeck from './ActionDeck.jsx';
import DicePromptModal from './DicePromptModal.jsx';
import EnemyTacticalBar from './EnemyTacticalBar.jsx';
import TacticalActionBar from './TacticalActionBar.jsx';
import MerchantDrawer from './MerchantDrawer.jsx';
import CampfireDowntime from './CampfireDowntime.jsx';
import TavernMinigameModal from './TavernMinigameModal.jsx';
import CommandSidebar from '../sidebar/CommandSidebar.jsx';
import PinnedVitalsHUD from '../sidebar/PinnedVitalsHUD.jsx';
import MobileDock from '../sidebar/MobileDock.jsx';
import { useIsDesktop } from '../common/useMediaQuery.js';

export default function GameStage() {
  const user = useGameStore((s) => s.user);
  const campaignId = useGameStore((s) => s.activeCampaignId);
  const campaign = useGameStore((s) => s.campaign);
  const character = useGameStore((s) => s.character);
  const setGameData = useGameStore((s) => s.setGameData);
  const exitGame = useGameStore((s) => s.exitGame);
  const setTheme = useGameStore((s) => s.setTheme);
  const toast = useGameStore((s) => s.toast);
  const rollPrompt = useGameStore((s) => s.rollPrompt);
  const drawer = useGameStore((s) => s.drawer);
  const modal = useGameStore((s) => s.modal);
  const closeModal = useGameStore((s) => s.closeModal);
  const retryQueue = useGameStore((s) => s.retryQueue);
  const busy = useGameStore((s) => s.busy);
  const archivistRunning = useGameStore((s) => s.archivistRunning);
  const gameError = useGameStore((s) => s.gameError);
  const charId = campaign?.meta?.activeCharId;
  const isDesktop = useIsDesktop();
  const setMobileSheet = useGameStore((s) => s.setMobileSheet);

  // Close any phone sheet when leaving the game or widening to desktop.
  useEffect(() => {
    if (isDesktop) setMobileSheet(null);
  }, [isDesktop, setMobileSheet]);
  useEffect(() => () => setMobileSheet(null), [setMobileSheet]);
  // Resume a turn the phone interrupted when the app went to the background.
  useEffect(() => initTurnRecovery(), []);

  // Live Firestore mirrors
  useEffect(() => {
    if (!user || !campaignId) return undefined;
    const onError = (err) => {
      setGameData({ gameError: err.message });
      toast(`Sync error: ${err.message}`, 'error');
    };
    const unsubs = [
      subscribeCampaign(user.uid, campaignId, (c) => setGameData({ campaign: c, gameError: c ? null : 'Campaign not found.' }), onError),
      subscribeTurns(user.uid, campaignId, (turns) => setGameData({ turns }), onError),
      subscribeDiary(user.uid, campaignId, (diary) => setGameData({ diary }), onError),
      subscribeCodex(user.uid, campaignId, (codex) => setGameData({ codex }), onError),
    ];
    return () => unsubs.forEach((u) => u());
  }, [user, campaignId, setGameData, toast]);

  useEffect(() => {
    if (!user || !charId) return undefined;
    return subscribeCharacter(user.uid, charId, (character) => setGameData({ character }), (err) => toast(`Sync error: ${err.message}`, 'error'));
  }, [user, charId, setGameData, toast]);

  // Genre theme (or Tab 6 override)
  const themeKey = campaign?.meta?.themeOverride || themeForGenre(campaign?.meta?.genreTheme);
  useEffect(() => {
    if (campaign) setTheme(themeKey);
  }, [themeKey, Boolean(campaign)]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-open the dice prompt whenever the storyteller requests a roll.
  const lastPendingKey = useRef(null);
  const pending = campaign?.pendingRoll;
  const pendingKey = pending ? `${campaign.lastTurnId}:${pending.skill_or_stat}:${pending.dc}` : null;
  useEffect(() => {
    if (!pendingKey || busy || retryQueue || rollPrompt || !character || campaign?.meta?.status !== 'active') return;
    if (lastPendingKey.current === pendingKey) return;
    lastPendingKey.current = pendingKey;
    promptPendingRoll();
  }, [pendingKey, busy, retryQueue, rollPrompt, character, campaign?.meta?.status]);

  if (!campaign || !character) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted">
        <Spinner className="h-6 w-6" />
        <p>{gameError || 'Entering the world…'}</p>
        <button className="btn" onClick={exitGame}>
          <ArrowLeft className="h-4 w-4" /> Back to the Guildhall
        </button>
      </div>
    );
  }

  const locked = campaign.meta?.status !== 'active';
  const queueForThis = retryQueue && retryQueue.campaignId === campaign.id;

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex items-center justify-between gap-2 border-b-theme border-line/40 bg-surface/80 px-2 py-1.5 backdrop-blur no-print sm:gap-3 sm:px-4 sm:py-2">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
          <button className="btn-ghost" onClick={exitGame} title="Back to the Guildhall">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="truncate text-base font-bold sm:text-lg">{campaign.meta.title}</h1>
          {locked && (
            <span className={`pill ${campaign.meta.status === 'fallen' ? 'border-danger text-danger' : 'border-info text-info'}`}>
              {campaign.meta.status === 'fallen' ? <Skull className="h-3 w-3" /> : <Lock className="h-3 w-3" />} {campaign.meta.status}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {archivistRunning && (
            <span className="pill animate-pulse" title="Condensing the oldest turns into the Campaign Diary">
              <BookMarked className="h-3 w-3" /> <span className="hidden sm:inline">Archivist writing…</span>
            </span>
          )}
          <TelemetryPill />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[3fr_2fr]">
        {/* Left / Center Stage — 60% */}
        <main className="flex min-h-0 flex-col lg:border-r-theme lg:border-line/30">
          {campaign.combat?.inCombat && <EnemyTacticalBar />}
          <NarrativeLog />
          {queueForThis && !busy && (
            <div className="mx-2 mb-2 flex flex-wrap items-center gap-2 rounded-theme sm:mx-4 border-theme border-warning bg-warning/10 px-3 py-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="flex-1">
                {retryQueue.status === 'paused_background'
                  ? 'Your turn paused while the app was in the background. It resumes automatically.'
                  : retryQueue.status === 'failed'
                    ? retryQueue.error || 'The last turn did not complete.'
                    : 'A turn was interrupted before it finished.'}{' '}
                Your action{retryQueue.roll ? ' and dice roll are' : ' is'} saved locally.
              </span>
              <button className="btn-primary" onClick={() => runQueue()}>
                <RotateCcw className="h-4 w-4" /> Retry Turn
              </button>
              {!retryQueue.response && (
                <button className="btn" onClick={discardQueue} title="Discard the unsent action (nothing was applied)">
                  <Trash2 className="h-4 w-4" /> Discard
                </button>
              )}
            </div>
          )}
          {!locked && campaign.combat?.inCombat && <TacticalActionBar />}
          {locked ? (
            <div className="m-2 card-inset p-4 sm:m-4 text-center text-sm text-muted">
              {campaign.meta.status === 'fallen' ? 'This campaign ended in permadeath. The chronicle is preserved in the Hall of Fame.' : 'This campaign is complete. It remains readable here.'}
            </div>
          ) : (
            <ActionDeck />
          )}
        </main>

        {/* Right Command Sidebar — 40% */}
        {isDesktop && (
          <aside className="flex min-h-0 flex-col bg-surface/40 no-print">
            <PinnedVitalsHUD />
            <CommandSidebar />
          </aside>
        )}
      </div>

      {/* Phone layout: compact vitals strip + bottom tabs that open on tap */}
      {!isDesktop && <MobileDock />}

      {!locked && drawer === 'merchant' && <MerchantDrawer />}
      {!locked && drawer === 'campfire' && <CampfireDowntime />}
      {!locked && drawer === 'tavern' && <TavernMinigameModal />}
      {modal?.type === 'death' && (
        <Modal title="Fallen" icon={<Skull className="h-5 w-5 text-danger" />} onClose={closeModal} footer={<button className="btn-primary" onClick={() => { closeModal(); exitGame(); }}>To the Hall of Fame</button>}>
          <p className="font-heading text-xl font-bold">{modal.props.name} has died.</p>
          <p className="mt-2">{modal.props.causeOfDeath}</p>
          <p className="mt-2 text-sm text-muted">Survived {modal.props.turnsSurvived} turns. There is no rewind. Their chronicle has been enshrined in the Hall of Fame, where you can download it as Markdown.</p>
        </Modal>
      )}
      {/* Rendered last so the dice prompt stacks above drawers and modals. */}
      {rollPrompt && <DicePromptModal />}
    </div>
  );
}
