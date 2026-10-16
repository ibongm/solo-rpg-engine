/**
 * Zustand store. Persists (localStorage) only what must survive a reload:
 *  - retryQueue: the pending turn action + dice roll, written BEFORE /api/dm-turn fires and
 *    cleared only after Firestore commits the stateMutator batch (Local Rollback / Retry Queue).
 *  - UI preferences (sidebar tab, last theme).
 * Live game data comes from Firestore snapshots and is never persisted here.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { THEME_IDS } from '../config/genreSkins.js';

let toastSeq = 0;

export function applyThemeToDocument(theme) {
  const t = THEME_IDS.includes(theme) ? theme : 'fantasy';
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = t;
  return t;
}

const emptySessionTelemetry = () => ({ inputTokens: 0, outputTokens: 0, cachedTokens: 0, costUSD: 0, calls: 0 });

export const useGameStore = create(
  persist(
    (set, get) => ({
      // ── Auth ────────────────────────────────────────────────
      user: null,
      authReady: false,
      setUser: (user) => set({ user, authReady: true }),

      // ── Navigation ──────────────────────────────────────────
      view: 'hub',
      hubTab: 'shelf',
      setHubTab: (hubTab) => set({ hubTab }),
      sidebarTab: 1,
      setSidebarTab: (sidebarTab) => set({ sidebarTab }),
      // Phone layout: which bottom sheet is open — null, 'vitals', or a tab id 1–6.
      mobileSheet: null,
      setMobileSheet: (mobileSheet) => set({ mobileSheet }),
      /** Shows a sidebar tab: switches it on desktop, and also slides it up as a sheet on phones. */
      openTab: (sidebarTab) =>
        set({
          sidebarTab,
          mobileSheet: typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)').matches ? null : sidebarTab,
        }),

      // ── Theme ───────────────────────────────────────────────
      theme: 'fantasy',
      setTheme: (theme) => set({ theme: applyThemeToDocument(theme) }),

      // ── Active game (live Firestore mirrors) ────────────────
      activeCampaignId: null,
      campaign: null,
      character: null,
      turns: [],
      diary: [],
      codex: [],
      gameError: null,
      setGameData: (patch) => set(patch),
      enterGame: (campaignId) => set({ view: 'game', activeCampaignId: campaignId, campaign: null, character: null, turns: [], diary: [], codex: [], gameError: null, rollPrompt: null }),
      exitGame: () => set({ view: 'hub', activeCampaignId: null, campaign: null, character: null, turns: [], diary: [], codex: [], rollPrompt: null, drawer: null, sessionTelemetry: emptySessionTelemetry() }),

      // ── Turn pipeline state ─────────────────────────────────
      busy: false,
      busyLabel: '',
      setBusy: (busy, busyLabel = '') => set({ busy, busyLabel: busy ? busyLabel : '' }),
      archivistRunning: false,
      setArchivistRunning: (archivistRunning) => set({ archivistRunning }),
      paintingTurnIds: {},
      setPainting: (turnId, on) => set((s) => {
        const next = { ...s.paintingTurnIds };
        if (on) next[turnId] = true;
        else delete next[turnId];
        return { paintingTurnIds: next };
      }),

      /**
       * Visible dice prompt. { check, request, origin, context }
       * origin: 'ai' | 'scan' | 'craft' | 'haggle' | 'cheat' | 'death_save' | 'tend_wounds' | 'skill'
       */
      rollPrompt: null,
      openRollPrompt: (rollPrompt) => set({ rollPrompt }),
      closeRollPrompt: () => set({ rollPrompt: null }),

      // ── Local Retry Queue (persisted) ───────────────────────
      retryQueue: null,
      setRetryQueue: (retryQueue) => set({ retryQueue }),
      clearRetryQueue: () => set({ retryQueue: null }),

      // ── Drawers / modals ────────────────────────────────────
      drawer: null, // 'merchant' | 'campfire' | 'tavern' | 'tactical' | null
      openDrawer: (drawer) => set({ drawer }),
      closeDrawer: () => set({ drawer: null }),
      modal: null, // { type: 'importExport'|'recap'|'print'|'confirm', props }
      openModal: (type, props = {}) => set({ modal: { type, props } }),
      closeModal: () => set({ modal: null }),

      // ── Almanac (global reference window) ──────────────────
      almanacOpen: false,
      setAlmanacOpen: (almanacOpen) => set({ almanacOpen }),
      toggleAlmanac: () => set((s) => ({ almanacOpen: !s.almanacOpen })),
      /** Genre the creator / World Forge is showing, so the Almanac follows it outside a campaign. */
      almanacGenre: null,
      setAlmanacGenre: (almanacGenre) => set({ almanacGenre }),

      // ── Action deck draft ───────────────────────────────────
      draft: { text: '', stance: null, ooc: false },
      setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
      resetDraft: () => set({ draft: { text: '', stance: null, ooc: false } }),

      // ── Session telemetry (this browser session) ────────────
      sessionTelemetry: emptySessionTelemetry(),
      addSessionTelemetry: ({ inputTokens = 0, outputTokens = 0, cachedTokens = 0, costUSD = 0 }) =>
        set((s) => ({
          sessionTelemetry: {
            inputTokens: s.sessionTelemetry.inputTokens + inputTokens,
            outputTokens: s.sessionTelemetry.outputTokens + outputTokens,
            cachedTokens: s.sessionTelemetry.cachedTokens + cachedTokens,
            costUSD: Math.round((s.sessionTelemetry.costUSD + costUSD) * 1e6) / 1e6,
            calls: s.sessionTelemetry.calls + 1,
          },
        })),

      // ── Toasts ──────────────────────────────────────────────
      toasts: [],
      toast: (text, kind = 'info', ms = 4500) => {
        const id = ++toastSeq;
        set((s) => ({ toasts: [...s.toasts.slice(-4), { id, text, kind }] }));
        if (ms > 0) setTimeout(() => get().dismissToast(id), ms);
        return id;
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: 'solo-rpg-engine',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ retryQueue: s.retryQueue, sidebarTab: s.sidebarTab, theme: s.theme, hubTab: s.hubTab }),
      onRehydrateStorage: () => (state) => {
        if (state?.theme) applyThemeToDocument(state.theme);
      },
    },
  ),
);
