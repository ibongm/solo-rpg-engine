import { useState } from 'react';
import { Skull, Download, ScrollText, Calendar } from 'lucide-react';
import { ABILITIES } from '../../config/genreSkins.js';
import { downloadText, slugify } from '../../engine/exporters.js';
import { EmptyState, Modal } from '../common/ui.jsx';

export default function GraveyardMemorial({ memorials }) {
  const [reading, setReading] = useState(null);

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-bold">Hall of Fame</h2>
        <p className="text-sm text-muted">Three failed death saves are final. There is no rewind — only remembrance.</p>
      </div>
      {memorials.length === 0 ? (
        <EmptyState icon={<Skull className="h-10 w-10" />} title="No graves yet">
          May it stay that way.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {memorials.map((m) => {
            const c = m.charSnapshot || {};
            return (
              <article key={m.id} className="card relative overflow-hidden p-4">
                <Skull className="absolute -right-4 -top-4 h-24 w-24 text-ink/5" aria-hidden="true" />
                <h3 className="text-lg font-bold">{c.name}</h3>
                <p className="text-sm text-muted">
                  Level {m.finalLevel} {c.classOrArchetype}
                </p>
                <p className="mt-2 text-sm">
                  <span className="text-muted">Fell in</span> <em>{m.campaignTitle}</em>
                </p>
                <p className="mt-1 text-sm">
                  <span className="text-muted">Cause:</span> {m.causeOfDeath}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="pill">{m.turnsSurvived} turns survived</span>
                  <span className="pill">
                    <Calendar className="h-3 w-3" /> {m.diedAt ? new Date(m.diedAt).toLocaleDateString() : '—'}
                  </span>
                </div>
                {c.stats && (
                  <div className="mt-3 grid grid-cols-6 gap-1 text-center">
                    {ABILITIES.map((ab) => (
                      <div key={ab} className="card-inset py-1">
                        <div className="text-[10px] font-bold uppercase text-muted">{ab}</div>
                        <div className="font-mono text-sm">{c.stats[ab]}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <button className="btn" onClick={() => setReading(m)}>
                    <ScrollText className="h-4 w-4" /> Read
                  </button>
                  <button className="btn" onClick={() => downloadText(`${slugify(c.name)}-chronicle.md`, m.markdownChronicle || '', 'text/markdown')}>
                    <Download className="h-4 w-4" /> Chronicle .md
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {reading && (
        <Modal title={`The Chronicle of ${reading.charSnapshot?.name}`} onClose={() => setReading(null)} wide>
          <pre className="whitespace-pre-wrap font-body text-sm leading-relaxed">{reading.markdownChronicle}</pre>
        </Modal>
      )}
    </section>
  );
}
