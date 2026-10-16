import { useEffect, useRef, useState } from 'react';
import { X, Loader2, AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';

export function Spinner({ className = 'h-4 w-4' }) {
  return <Loader2 className={`${className} animate-spin`} aria-hidden="true" />;
}

export function Modal({ title, onClose, children, wide = false, footer = null, icon = null }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      // Only the topmost dialog reacts, so stacked modals close one at a time.
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs[dialogs.length - 1] !== ref.current) return;
      onClose?.();
    };
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 no-print" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`card flex max-h-[92vh] w-full animate-fade-in flex-col outline-none ${wide ? 'max-w-5xl' : 'max-w-xl'}`}
      >
        <div className="flex items-center justify-between gap-3 border-b-theme border-line/40 px-5 py-3">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            {icon}
            {title}
          </h2>
          {onClose && (
            <button className="btn-ghost" onClick={onClose} aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t-theme border-line/40 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Meter({ value, max, colorClass = 'bg-accent', label, showValue = true, className = '' }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="mb-0.5 flex justify-between text-xs">
          <span className="text-muted">{label}</span>
          {showValue && (
            <span className="font-mono">
              {value}/{max}
            </span>
          )}
        </div>
      )}
      <div className="meter" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
        <div className={`meter-fill ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Bipolar meter for reputation (−100..100). */
export function BipolarMeter({ value, label }) {
  const v = Math.max(-100, Math.min(100, value || 0));
  const left = v < 0 ? 50 + v / 2 : 50;
  const width = Math.abs(v) / 2;
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-mono">{v > 0 ? `+${v}` : v}</span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="absolute inset-y-0 left-1/2 w-px bg-line" />
        <div className={`absolute inset-y-0 rounded-full ${v >= 0 ? 'bg-success' : 'bg-danger'}`} style={{ left: `${left}%`, width: `${width}%` }} />
      </div>
    </div>
  );
}

export function Toasts() {
  const toasts = useGameStore((s) => s.toasts);
  const dismiss = useGameStore((s) => s.dismissToast);
  const icons = {
    info: <Info className="h-4 w-4 text-info" />,
    success: <CheckCircle2 className="h-4 w-4 text-success" />,
    warning: <AlertTriangle className="h-4 w-4 text-warning" />,
    error: <XCircle className="h-4 w-4 text-danger" />,
  };
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[60] flex w-80 flex-col gap-2 no-print" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="card pointer-events-auto flex animate-fade-in items-start gap-2 px-3 py-2 text-sm">
          <span className="mt-0.5">{icons[t.kind] || icons.info}</span>
          <span className="flex-1">{t.text}</span>
          <button className="text-muted hover:text-ink" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }) {
  return (
    <div className="card-inset flex flex-col items-center gap-2 px-6 py-10 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <h3 className="font-heading text-lg font-bold">{title}</h3>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Slider({ label, value, onChange, min = 1, max = 10, leftLabel, rightLabel }) {
  return (
    <div>
      <div className="flex justify-between">
        <span className="label">{label}</span>
        <span className="font-mono text-sm">{value}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[rgb(var(--c-accent))]" aria-label={label} />
      <div className="flex justify-between text-xs text-muted">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

/** Two-click confirm button (no browser confirm() dialogs). */
export function ConfirmButton({ onConfirm, children, confirmLabel = 'Click again to confirm', className = 'btn-danger', disabled }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={className}
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}

export function SegmentedControl({ options, value, onChange, size = 'sm' }) {
  return (
    <div className="inline-flex rounded-theme border-theme border-line/60 bg-surface-2/50 p-0.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          className={`rounded-theme px-2.5 ${size === 'sm' ? 'py-1 text-xs' : 'py-1.5 text-sm'} font-medium transition ${value === o.value ? 'bg-accent text-accent-ink shadow-theme' : 'text-muted hover:text-ink'}`}
          onClick={() => onChange(o.value)}
          title={o.title}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function fmtUSD(n) {
  const v = Number(n) || 0;
  if (v === 0) return '$0.00';
  if (v < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

export function fmtTokens(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 10_000) return `${Math.round(v / 1000)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

export function timeAgo(ts) {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}
