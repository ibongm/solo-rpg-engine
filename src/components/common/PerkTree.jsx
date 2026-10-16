import { Lock, Unlock, Star } from 'lucide-react';
import { PERK_TIERS, perkTierUnlockLevel, canUnlockPerk, perkPointsAvailable } from '../../engine/progression.js';
import { skillLabel } from '../../config/genreSkins.js';

function modLabel(key, value, skin) {
  const name = { ac: 'AC', attack: 'Attack', damage: 'Damage', checks: 'All checks', initiative: 'Initiative', maxHp: 'Max HP', speed: 'Speed' }[key] || (key.length === 3 ? key.toUpperCase() : skillLabel(key, skin));
  return `${value > 0 ? '+' : ''}${value} ${name}`;
}

/**
 * Custom 5-tier Perk Tree viewer. If `onUnlock` is provided, unlockable perks are clickable.
 */
export default function PerkTree({ character, skin, onUnlock, compact = false }) {
  const tree = character?.customPerkTree || [];
  if (!tree.length) return <p className="text-sm text-muted">No perk tree yet.</p>;
  const points = perkPointsAvailable(character);
  return (
    <div className="space-y-2">
      {onUnlock && (
        <div className="flex items-center gap-1.5 text-sm">
          <Star className="h-4 w-4 text-accent-2" /> Perk points available: <strong className="font-mono">{points}</strong>
          <span className="text-muted">(1 per level)</span>
        </div>
      )}
      {Array.from({ length: PERK_TIERS }, (_, i) => i + 1).map((tier) => {
        const perks = tree.filter((p) => p.tier === tier);
        const reqLevel = perkTierUnlockLevel(tier);
        return (
          <div key={tier} className="flex gap-2">
            <div className="w-14 shrink-0 pt-1 text-center">
              <div className="font-heading text-xs font-bold">Tier {tier}</div>
              <div className="text-[10px] text-muted">Lv {reqLevel}+</div>
            </div>
            <div className={`grid flex-1 gap-2 ${compact ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {perks.map((p) => {
                const check = onUnlock ? canUnlockPerk(character, p.id) : { ok: false };
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!onUnlock || !check.ok}
                    onClick={() => onUnlock?.(p.id)}
                    title={p.unlocked ? 'Unlocked' : check.ok ? 'Click to unlock' : check.reason}
                    className={`rounded-theme border-theme p-2 text-left text-xs transition ${p.unlocked ? 'border-accent bg-accent/10' : check.ok ? 'border-accent-2 bg-surface hover:shadow-glow' : 'border-line/40 bg-surface-2/40 opacity-80'}`}
                  >
                    <div className="flex items-center gap-1 font-semibold">
                      {p.unlocked ? <Unlock className="h-3 w-3 text-accent" /> : <Lock className="h-3 w-3 text-muted" />}
                      {p.name}
                    </div>
                    <div className="mt-0.5 text-muted">{p.description}</div>
                    {Object.keys(p.modifiers || {}).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Object.entries(p.modifiers).map(([k, v]) => (
                          <span key={k} className="pill font-mono text-[10px]">
                            {modLabel(k, v, skin)}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
