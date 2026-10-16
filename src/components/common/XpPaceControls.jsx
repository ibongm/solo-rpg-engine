import { XP_PACES, XP_PACE_INFO, XP_FINE_TUNE, estimatedTurnsPerLevel, milestoneCooldown } from '../../engine/deeds.js';
import { SegmentedControl, Tooltip } from './ui.jsx';
import { help } from '../../config/helpTooltips.js';

/**
 * Leveling pace + fine-tune, shared by the World Forge (new campaigns) and the Engine tab (mid-campaign).
 * Shows the engine's own turns-per-level estimate so the choice is concrete.
 */
export default function XpPaceControls({ mode = 'deeds', pace, fineTune = 1, onChange, level = 1, disabled = false, idPrefix = 'xp' }) {
  const info = XP_PACE_INFO[pace] || XP_PACE_INFO.standard;
  const estimate = mode === 'milestone' ? null : estimatedTurnsPerLevel(level, pace, fineTune);
  return (
    <div className="space-y-2">
      <div>
        <div className="label"><Tooltip help={help('forge.xpPace')}>Leveling pace</Tooltip></div>
        <SegmentedControl
          value={pace}
          onChange={(v) => !disabled && onChange({ pace: v, fineTune })}
          options={XP_PACES.map((p) => ({ value: p, label: XP_PACE_INFO[p].label, title: XP_PACE_INFO[p].blurb }))}
        />
        <p className="mt-1 text-[11px] text-muted">{info.blurb}</p>
      </div>
      {mode !== 'milestone' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="label mb-0" id={`${idPrefix}-fine-label`}>
            <Tooltip help={help('forge.xpFineTune')}>XP fine-tune</Tooltip>
          </span>
          <select
            id={`${idPrefix}-fine`}
            aria-labelledby={`${idPrefix}-fine-label`}
            className="input w-auto py-1 text-sm"
            value={fineTune}
            disabled={disabled}
            onChange={(e) => onChange({ pace, fineTune: Number(e.target.value) })}
          >
            {XP_FINE_TUNE.map((v) => (
              <option key={v} value={v}>
                {v}× XP
              </option>
            ))}
          </select>
        </div>
      )}
      <p className="text-[11px] text-muted">
        {mode === 'milestone'
          ? `Milestones at least ${milestoneCooldown(level, pace)} turns apart at level ${level}.`
          : estimate
            ? `About ${estimate} ordinary turns to reach level ${level + 1}. Big deeds (quests, defeated foes, new allies) shorten it.`
            : 'Maximum level reached.'}
      </p>
    </div>
  );
}
