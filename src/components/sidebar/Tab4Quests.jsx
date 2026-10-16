import { useState } from 'react';
import { Flag, Target, Megaphone, Hourglass, CheckCircle2, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { minutesUntilDeadline, formatDuration } from '../../engine/clockWeatherEngine.js';
import { EmptyState } from '../common/ui.jsx';

function QuestCard({ quest, clock }) {
  const remaining = minutesUntilDeadline(quest.deadline, clock);
  const urgent = remaining !== null && remaining < 6 * 60;
  return (
    <div className={`card-inset p-3 text-sm ${urgent && quest.status === 'active' ? 'border-danger' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <strong>{quest.title}</strong>
        {quest.status === 'completed' && <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />}
        {quest.status === 'failed' && <XCircle className="h-4 w-4 shrink-0 text-danger" />}
      </div>
      <p className="mt-0.5 text-xs text-muted">{quest.description}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        {quest.deadline && quest.status === 'active' && (
          <span className={`pill font-mono ${urgent ? 'border-danger text-danger' : 'border-warning text-warning'}`}>
            <Hourglass className="h-3 w-3" /> {remaining > 0 ? `${formatDuration(remaining)} left` : 'Overdue'} · Day {quest.deadline.day} {String(quest.deadline.hour).padStart(2, '0')}:00
          </span>
        )}
        {quest.failedReason === 'deadline_passed' && <span className="pill border-danger text-danger">Deadline passed</span>}
        {quest.rewards?.map((r, i) => (
          <span key={i} className="pill">
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Tab4Quests() {
  const campaign = useGameStore((s) => s.campaign);
  const [showDone, setShowDone] = useState(false);
  const clock = campaign.worldState.clock;
  const quests = campaign.quests || [];
  const active = quests.filter((q) => q.status === 'active');
  const main = active.filter((q) => q.type === 'main');
  const bounties = active.filter((q) => q.type === 'bounty');
  const rumorQuests = active.filter((q) => q.type === 'rumor');
  const done = quests.filter((q) => q.status !== 'active');
  const current = campaign.mapNodes.find((n) => n.id === campaign.worldState.currentNodeId);
  const otherRumors = campaign.mapNodes.filter((n) => n.visited && n.id !== current?.id && n.rumors?.length);

  return (
    <div className="space-y-5">
      <section>
        <h3 className="section-title mb-2 flex items-center gap-1.5">
          <Flag className="h-4 w-4" /> Quests
        </h3>
        {main.length + rumorQuests.length === 0 ? (
          <EmptyState title="No active quests">The world is waiting for you to make your mark.</EmptyState>
        ) : (
          <div className="space-y-2">
            {[...main, ...rumorQuests].map((q) => (
              <QuestCard key={q.id} quest={q} clock={clock} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="section-title mb-2 flex items-center gap-1.5">
          <Target className="h-4 w-4" /> Bounty Board
        </h3>
        {bounties.length === 0 ? (
          <p className="text-xs text-muted">No open bounties. Bounties expire if their deadline passes.</p>
        ) : (
          <div className="space-y-2">
            {bounties.map((q) => (
              <QuestCard key={q.id} quest={q} clock={clock} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="section-title mb-2 flex items-center gap-1.5">
          <Megaphone className="h-4 w-4" /> Rumor Mill
        </h3>
        {current?.rumors?.length ? (
          <div className="mb-2">
            <div className="label">Heard in {current.label}</div>
            <ul className="space-y-1 text-sm">
              {current.rumors.map((r, i) => (
                <li key={i} className="card-inset px-2 py-1 italic">
                  “{r}”
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mb-2 text-xs text-muted">No rumors here yet. Taverns and conversations are good sources.</p>
        )}
        {otherRumors.map((n) => (
          <div key={n.id} className="mb-2">
            <div className="label">From {n.label}</div>
            <ul className="space-y-1 text-xs text-muted">
              {n.rumors.map((r, i) => (
                <li key={i}>“{r}”</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {done.length > 0 && (
        <section>
          <button className="section-title flex items-center gap-1" onClick={() => setShowDone((s) => !s)}>
            {showDone ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} Resolved ({done.length})
          </button>
          {showDone && (
            <div className="mt-2 space-y-2">
              {done.map((q) => (
                <QuestCard key={q.id} quest={q} clock={clock} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
