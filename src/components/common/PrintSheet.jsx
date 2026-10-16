import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { ABILITIES, ABILITY_LABELS, SKILL_KEYS, SKILLS, skillLabel } from '../../config/genreSkins.js';
import { languageName } from '../../config/srdReskins.js';
import { abilityMod, proficiencyBonus } from '../../engine/progression.js';
import { effectiveAc, effectiveMaxHp, fmtMod, itemModifier } from '../../engine/diceEngine.js';

/**
 * Clean @media print character sheet + loot cards. Rendered into #print-root via a portal;
 * the print stylesheet hides everything else.
 */
export default function PrintSheet({ character, skin, onClose }) {
  const prof = proficiencyBonus(character.level);
  const sheet = (
    <div id="print-root" className="fixed inset-0 z-[70] overflow-y-auto bg-white p-8 text-black">
      <div className="no-print mb-4 flex justify-end gap-2">
        <button className="rounded border border-black px-3 py-1 text-sm" onClick={() => window.print()}>
          <Printer className="mr-1 inline h-4 w-4" /> Print / Save as PDF
        </button>
        <button className="rounded border border-black px-3 py-1 text-sm" onClick={onClose}>
          <X className="mr-1 inline h-4 w-4" /> Close
        </button>
      </div>
      <div className="mx-auto max-w-3xl font-serif">
        <div className="print-card mb-3 flex items-end justify-between">
          <div>
            <div className="text-2xl font-bold">{character.name}</div>
            <div className="text-sm">
              Level {character.level} {character.speciesName ? `${character.speciesName} ` : ''}{character.classOrArchetype}{character.backgroundName ? ` · ${character.backgroundName}` : ''} · {character.genre}
            </div>
          </div>
          <div className="text-right text-sm">
            <div>XP {character.xp}</div>
            <div>Proficiency {fmtMod(prof)}</div>
          </div>
        </div>
        <div className="print-grid mb-3">
          <div className="print-card text-center">
            <div className="text-xs uppercase">Hit Points</div>
            <div className="text-xl font-bold">
              {character.vitals.hp} / {effectiveMaxHp(character)}
            </div>
            <div className="text-xs">Hit die d{character.hitDie || 8}</div>
          </div>
          <div className="print-card text-center">
            <div className="text-xs uppercase">Armor Class</div>
            <div className="text-xl font-bold">{effectiveAc(character)}</div>
          </div>
          <div className="print-card text-center">
            <div className="text-xs uppercase">Speed</div>
            <div className="text-xl font-bold">{character.vitals.speed} ft</div>
          </div>
        </div>
        <div className="mb-3 grid grid-cols-6 gap-2">
          {ABILITIES.map((ab) => (
            <div key={ab} className="print-card text-center">
              <div className="text-[10px] uppercase">{ABILITY_LABELS[ab]}</div>
              <div className="text-lg font-bold">{character.stats[ab]}</div>
              <div className="text-xs">{fmtMod(abilityMod(character.stats[ab]))}</div>
            </div>
          ))}
        </div>
        <div className="print-card mb-3">
          <div className="mb-1 text-xs font-bold uppercase">Skills</div>
          <div className="grid grid-cols-3 gap-x-4 text-sm">
            {SKILL_KEYS.map((k) => {
              const p = character.skillProficiencies.includes(k);
              const ex = p && (character.expertise || []).includes(k);
              const total = abilityMod(character.stats[SKILLS[k]]) + (p ? prof * (ex ? 2 : 1) : 0) + itemModifier(character, k);
              return (
                <div key={k} className="flex justify-between">
                  <span>
                    {ex ? '◆' : p ? '●' : '○'} {skillLabel(k, skin)}
                  </span>
                  <span className="font-mono">{fmtMod(total)}</span>
                </div>
              );
            })}
          </div>
        </div>
        {character.savingThrows?.length > 0 && (
          <div className="print-card mb-3 text-sm">
            <div className="mb-1 text-xs font-bold uppercase">Saving Throws</div>
            {Object.keys(character.stats).map((ab) => `${character.savingThrows.includes(ab) ? '●' : '○'} ${ab.toUpperCase()} ${fmtMod(abilityMod(character.stats[ab]) + (character.savingThrows.includes(ab) ? prof : 0))}`).join('   ')}
          </div>
        )}
        {character.features?.length > 0 && (
          <div className="print-card mb-3">
            <div className="mb-1 text-xs font-bold uppercase">Features & Traits</div>
            {character.features.map((f) => (
              <div key={`${f.source}-${f.name}`} className="text-sm">
                <strong>{f.name}</strong> ({f.source}) — {f.description}
              </div>
            ))}
            <div className="mt-1 text-xs">
              Languages: {(character.languages || []).map((l) => languageName(l, character.genre)).join(', ')} · Armor: {(character.armorProficiencies || []).join(', ') || 'none'} · Weapons: {(character.weaponProficiencies || []).join(', ')}
            </div>
          </div>
        )}
        {(character.customPerkTree || []).some((p) => p.unlocked) && (
          <div className="print-card mb-3">
            <div className="mb-1 text-xs font-bold uppercase">Perks</div>
            {character.customPerkTree
              .filter((p) => p.unlocked)
              .map((p) => (
                <div key={p.id} className="text-sm">
                  <strong>{p.name}</strong> (T{p.tier}) — {p.description}
                </div>
              ))}
          </div>
        )}
        {character.backstory && (
          <div className="print-card mb-3 text-sm">
            <div className="mb-1 text-xs font-bold uppercase">Backstory</div>
            {character.backstory}
          </div>
        )}
        <div className="mb-1 mt-4 text-xs font-bold uppercase">
          Loot Cards · {character.currency?.label}: {character.currency?.amount}
        </div>
        <div className="print-grid">
          {(character.inventory || []).map((it) => (
            <div key={it.id} className="print-card text-xs">
              <div className="text-sm font-bold">{it.name}</div>
              <div className="italic">
                {it.type}
                {it.equipped ? ' · equipped' : ''}
              </div>
              {it.damageDice && <div>Damage {it.damageDice}</div>}
              {Object.entries(it.statModifiers || {}).map(([k, v]) => (
                <div key={k}>
                  {k}: {typeof v === 'number' ? fmtMod(v) : v}
                </div>
              ))}
              <div className="mt-1">{it.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  return createPortal(sheet, document.body);
}
