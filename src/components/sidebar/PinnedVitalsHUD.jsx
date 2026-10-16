import { Heart, Shield, Footprints, Clock, CloudRain, Sun, CloudFog, Snowflake, Wind, CloudLightning, MapPin, Coins, Skull } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { effectiveAc, effectiveMaxHp, effectiveSpeed, CONDITION_EFFECTS, fmtMod } from '../../engine/diceEngine.js';
import { formatClock, timeOfDay } from '../../engine/clockWeatherEngine.js';

function weatherIcon(type = '') {
  const t = type.toLowerCase();
  if (t.includes('snow') || t.includes('blizzard') || t.includes('icy')) return Snowflake;
  if (t.includes('thunder')) return CloudLightning;
  if (t.includes('rain')) return CloudRain;
  if (t.includes('fog') || t.includes('haze')) return CloudFog;
  if (t.includes('wind') || t.includes('gale') || t.includes('dust')) return Wind;
  return Sun;
}

/** Always-visible HP, AC, conditions, Living World Clock and weather modifier pill. */
export default function PinnedVitalsHUD() {
  const character = useGameStore((s) => s.character);
  const campaign = useGameStore((s) => s.campaign);
  const v = character.vitals;
  const maxHp = effectiveMaxHp(character);
  const hpPct = Math.max(0, Math.min(100, (v.hp / maxHp) * 100));
  const hpColor = hpPct > 60 ? 'bg-success' : hpPct > 30 ? 'bg-warning' : 'bg-danger';
  const weather = campaign.worldState?.weather;
  const WIcon = weatherIcon(weather?.type);
  const node = campaign.mapNodes?.find((n) => n.id === campaign.worldState?.currentNodeId);
  const ds = v.deathSaves || { successes: 0, failures: 0 };

  return (
    <div className="border-b-theme border-line/40 bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-heading text-base font-bold">{character.name}</div>
          <div className="text-xs text-muted">
            Lv {character.level} {character.classOrArchetype}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="pill" title="Armor Class (incl. gear & perks)">
            <Shield className="h-3 w-3" /> {effectiveAc(character)}
          </span>
          <span className="pill" title="Speed">
            <Footprints className="h-3 w-3" /> {effectiveSpeed(character)}
          </span>
          <span className="pill" title={character.currency.label}>
            <Coins className="h-3 w-3 text-accent-2" /> {character.currency.amount}
          </span>
        </div>
      </div>

      <div className="mt-2">
        <div className="mb-0.5 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1">
            <Heart className="h-3 w-3 text-danger" /> HP
          </span>
          <span className="font-mono">
            {v.hp}/{maxHp}
            {v.tempHp > 0 && <span className="text-info"> +{v.tempHp}</span>}
          </span>
        </div>
        <div className="meter h-2.5" role="progressbar" aria-valuenow={v.hp} aria-valuemax={maxHp} aria-label="Hit points">
          <div className={`meter-fill ${hpColor}`} style={{ width: `${hpPct}%` }} />
        </div>
      </div>

      {v.hp <= 0 && character.status !== 'fallen' && (
        <div className="mt-2 flex items-center gap-2 rounded-theme bg-danger/10 px-2 py-1 font-mono text-xs text-danger">
          <Skull className="h-3.5 w-3.5" /> Death saves: ✔ {ds.successes}/3 · ✘ {ds.failures}/3
        </div>
      )}

      {v.conditions?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {v.conditions.map((c) => (
            <span key={c} className="pill border-warning capitalize text-warning" title={CONDITION_EFFECTS[c]?.note || c}>
              {c}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="pill" title={timeOfDay(campaign.worldState.clock)}>
          <Clock className="h-3 w-3" /> {formatClock(campaign.worldState.clock)} · {timeOfDay(campaign.worldState.clock)}
        </span>
        {weather && (
          <span className={`pill ${weather.modifierValue < 0 ? 'border-warning' : ''}`} title={weather.mechanicalEffect}>
            <WIcon className="h-3 w-3" /> {weather.type}
            {weather.modifierValue ? <strong className="font-mono text-warning">{fmtMod(weather.modifierValue)}</strong> : null}
          </span>
        )}
        {node && (
          <span className="pill">
            <MapPin className="h-3 w-3" /> {node.label}
          </span>
        )}
      </div>
    </div>
  );
}
