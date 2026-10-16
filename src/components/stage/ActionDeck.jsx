import { Send, MessageSquareQuote, Dices, HeartPulse, Tent, Store, Beer, Swords, Eye, VenetianMask, Handshake } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { submitAction, promptPendingRoll, promptDeathSave } from '../../store/turnRunner.js';
import { commitCampaignSettings } from '../../engine/stateMutator.js';
import { isDying } from '../../engine/combatEngine.js';
import { STANCES, skillLabel } from '../../config/genreSkins.js';
import { SegmentedControl, Spinner } from '../common/ui.jsx';
import { useIsDesktop } from '../common/useMediaQuery.js';

const STANCE_ICONS = { Diplomatic: Handshake, Aggressive: Swords, Deceptive: VenetianMask, Investigative: Eye };
const PILL_STANCES = ['Diplomatic', 'Aggressive', 'Deceptive', 'Investigative'];

export default function ActionDeck() {
  const campaign = useGameStore((s) => s.campaign);
  const character = useGameStore((s) => s.character);
  const user = useGameStore((s) => s.user);
  const busy = useGameStore((s) => s.busy);
  const retryQueue = useGameStore((s) => s.retryQueue);
  const draft = useGameStore((s) => s.draft);
  const setDraft = useGameStore((s) => s.setDraft);
  const openDrawer = useGameStore((s) => s.openDrawer);
  const isDesktop = useIsDesktop();

  const mode = campaign.meta.actionMode || 'hybrid';
  const skin = campaign.skin;
  const dying = isDying(character);
  const pending = campaign.pendingRoll;
  const disabled = busy || Boolean(retryQueue);
  const node = campaign.mapNodes?.find((n) => n.id === campaign.worldState?.currentNodeId);
  const inTown = node?.type === 'town';
  const inCombat = campaign.combat?.inCombat;

  const setMode = (m) => commitCampaignSettings({ uid: user.uid, campaign, patch: { 'meta.actionMode': m } }).catch(() => {});

  const send = () => {
    const text = draft.text.trim();
    if (!text || disabled) return;
    submitAction({
      text,
      stance: draft.stance,
      preferredSkill: draft.stance ? STANCES[draft.stance] : null,
      ooc: draft.ooc,
    });
  };

  const choose = (c) => {
    if (disabled) return;
    submitAction({
      text: c.label,
      stance: c.stance,
      preferredSkill: c.default_skill || STANCES[c.stance] || null,
    });
  };

  if (dying) {
    const ds = character.vitals.deathSaves || { successes: 0, failures: 0 };
    return (
      <div className="border-t-theme border-danger/50 bg-danger/5 p-4 no-print">
        <div className="mb-2 flex items-center justify-center gap-4 font-mono text-sm">
          <span className="text-success">Successes {'●'.repeat(ds.successes)}{'○'.repeat(3 - ds.successes)}</span>
          <span className="text-danger">Failures {'●'.repeat(ds.failures)}{'○'.repeat(3 - ds.failures)}</span>
        </div>
        <button className="btn-danger w-full py-3 text-base" onClick={promptDeathSave} disabled={disabled}>
          {busy ? <Spinner /> : <HeartPulse className="h-5 w-5" />} Roll Death Saving Throw
        </button>
        <p className="mt-2 text-center text-xs text-muted">You are unconscious at 0 HP. Three failures is permanent death.</p>
      </div>
    );
  }

  const showChoices = (mode === 'guided' || mode === 'hybrid') && campaign.lastChoices?.length > 0;
  const showText = mode === 'freeform' || mode === 'hybrid' || !campaign.lastChoices?.length;

  return (
    <div className="border-t-theme border-line/40 bg-surface/70 px-2 pb-2 pt-2 no-print sm:px-4 sm:pb-3">
      {pending && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-theme border-theme border-accent/60 bg-accent/10 px-3 py-2 text-sm">
          <Dices className="h-4 w-4 text-accent" />
          <span className="flex-1">
            The DM calls for <strong>{skillLabel(pending.skill_or_stat, skin) || pending.skill_or_stat}</strong>
            {pending.dc !== null && (
              <>
                {' '}
                — <strong>DC {pending.dc}</strong>
              </>
            )}
            {pending.advantage_state && pending.advantage_state !== 'normal' && <span className="capitalize"> ({pending.advantage_state})</span>}
            {pending.reason && <span className="text-muted"> · {pending.reason}</span>}
          </span>
          <button className="btn-primary" onClick={promptPendingRoll} disabled={disabled}>
            <Dices className="h-4 w-4" /> Roll
          </button>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between gap-2">
        <SegmentedControl
          value={mode}
          onChange={setMode}
          options={[
            { value: 'guided', label: 'Guided', title: '3 clickable choices' },
            { value: 'freeform', label: 'Freeform', title: 'Open text input' },
            { value: 'hybrid', label: 'Hybrid', title: 'Choices + text' },
          ]}
        />
        <div className="flex gap-0.5 sm:gap-1">
          {!inCombat && (
            <button className="btn-ghost text-xs" onClick={() => openDrawer('campfire')} disabled={disabled} title="Make Camp / Rest" aria-label="Make Camp / Rest">
              <Tent className="h-4 w-4" /> <span className="hidden sm:inline">Camp</span>
            </button>
          )}
          {inTown && !inCombat && (
            <>
              <button className="btn-ghost text-xs" onClick={() => openDrawer('merchant')} disabled={disabled} title="Merchant" aria-label="Merchant">
                <Store className="h-4 w-4" /> <span className="hidden sm:inline">Merchant</span>
              </button>
              <button className="btn-ghost text-xs" onClick={() => openDrawer('tavern')} disabled={disabled} title="Tavern games" aria-label="Tavern games">
                <Beer className="h-4 w-4" /> <span className="hidden sm:inline">Tavern</span>
              </button>
            </>
          )}
        </div>
      </div>

      {showChoices && (
        <div className="scrollbar-none -mx-2 mb-2 flex snap-x snap-mandatory gap-2 overflow-x-auto px-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
          {campaign.lastChoices.slice(0, 3).map((c, i) => {
            const Icon = STANCE_ICONS[c.stance] || Swords;
            return (
              <button
                key={i}
                onClick={() => choose(c)}
                disabled={disabled}
                className="group w-[82%] shrink-0 snap-start rounded-theme border-theme border-line/50 bg-surface p-2 text-left text-sm leading-snug transition hover:border-accent hover:shadow-glow disabled:opacity-50 sm:w-auto"
              >
                <div className="flex items-start gap-1.5">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <span>{c.label}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted">
                  <span className="pill py-0">{c.stance}</span>
                  {c.default_skill && <span className="pill py-0">{skillLabel(c.default_skill, skin)}</span>}
                  {c.estimated_dc && <span className="pill py-0">~DC {c.estimated_dc}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showText && (
        <>
          <div className="scrollbar-none mb-1.5 flex items-center gap-1 overflow-x-auto sm:flex-wrap">
            {PILL_STANCES.map((s) => {
              const Icon = STANCE_ICONS[s];
              const on = draft.stance === s;
              return (
                <button
                  key={s}
                  className={`pill shrink-0 cursor-pointer transition ${on ? 'border-accent bg-accent text-accent-ink' : 'hover:border-accent'}`}
                  onClick={() => setDraft({ stance: on ? null : s })}
                  title={`Primes ${skillLabel(STANCES[s], skin)}`}
                  aria-pressed={on}
                >
                  <Icon className="h-3 w-3" /> {s}
                  {on && <span className="opacity-80">· {skillLabel(STANCES[s], skin)}</span>}
                </button>
              );
            })}
            <button
              className={`pill ml-auto shrink-0 cursor-pointer transition ${draft.ooc ? 'border-info bg-info text-white' : 'hover:border-info'}`}
              onClick={() => setDraft({ ooc: !draft.ooc })}
              aria-pressed={draft.ooc}
              title="Whisper to the DM out-of-character: steer pacing or ask a rule question"
            >
              <MessageSquareQuote className="h-3 w-3" /> <span className="hidden sm:inline">[OOC]</span> Whisper
            </button>
          </div>
          <div className="flex gap-2">
            <textarea
              className={`input min-h-[44px] flex-1 resize-none text-base sm:min-h-[52px] sm:resize-y sm:text-sm ${draft.ooc ? 'border-dashed border-info italic' : ''}`}
              rows={isDesktop ? 2 : 1}
              value={draft.text}
              placeholder={draft.ooc ? 'Whisper to the DM (out of character)…' : isDesktop ? 'What do you do? (Enter to send, Shift+Enter for a new line)' : 'What do you do?'}
              onChange={(e) => setDraft({ text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && isDesktop) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={disabled}
              maxLength={4000}
              aria-label="Action"
            />
            <button className="btn-primary self-stretch px-4" onClick={send} disabled={disabled || !draft.text.trim()} aria-label="Send">
              {busy ? <Spinner /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
