import { useState } from 'react';
import { Gauge } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { fmtTokens, fmtUSD } from './ui.jsx';

/** Live session + lifetime token counter (input, output, cached) with exact USD cost. */
export default function TelemetryPill() {
  const session = useGameStore((s) => s.sessionTelemetry);
  const lifetime = useGameStore((s) => s.campaign?.telemetry);
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button className="pill cursor-pointer font-mono hover:border-accent" onClick={() => setOpen((o) => !o)} aria-expanded={open} title="Token & cost telemetry">
        <Gauge className="h-3 w-3" />
        <span className="hidden sm:inline">{fmtTokens(session.inputTokens + session.outputTokens)} tok ·</span> {fmtUSD(session.costUSD)}
        {lifetime && <span className="hidden text-muted sm:inline">/ {fmtUSD(lifetime.totalCostUSD)}</span>}
      </button>
      {open && (
        <div className="card absolute right-0 top-8 z-40 w-[min(18rem,calc(100vw-1rem))] p-3 text-sm" onMouseLeave={() => setOpen(false)}>
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="text-muted">
                <th className="text-left font-normal" />
                <th className="text-right font-normal">Session</th>
                <th className="text-right font-normal">Lifetime</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Input</td>
                <td className="text-right">{fmtTokens(session.inputTokens)}</td>
                <td className="text-right">{fmtTokens(lifetime?.totalInputTokens)}</td>
              </tr>
              <tr>
                <td>Output</td>
                <td className="text-right">{fmtTokens(session.outputTokens)}</td>
                <td className="text-right">{fmtTokens(lifetime?.totalOutputTokens)}</td>
              </tr>
              <tr>
                <td>Cached</td>
                <td className="text-right">{fmtTokens(session.cachedTokens)}</td>
                <td className="text-right">{fmtTokens(lifetime?.cachedTokens)}</td>
              </tr>
              <tr className="font-bold">
                <td>Cost</td>
                <td className="text-right">{fmtUSD(session.costUSD)}</td>
                <td className="text-right">{fmtUSD(lifetime?.totalCostUSD)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-muted">{session.calls} API call(s) this session. Cached input tokens are billed at the discounted rate.</p>
        </div>
      )}
    </div>
  );
}
