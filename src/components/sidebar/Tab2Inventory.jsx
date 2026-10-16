import { useMemo, useState } from 'react';
import { Sword, Shield, FlaskConical, Gem, KeyRound, Hammer, Trash2, Check } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { equipItem, dropItem, consumeItem, startCraft } from '../../store/localActions.js';
import { craftingOptions, pickInputs } from '../../engine/economyEngine.js';
import { fmtMod } from '../../engine/diceEngine.js';
import { skillLabel } from '../../config/genreSkins.js';
import { ConfirmButton, EmptyState, SegmentedControl } from '../common/ui.jsx';

const TYPE_ICON = { weapon: Sword, armor: Shield, consumable: FlaskConical, material: Gem, key: KeyRound };

export function LootCard({ item, skin, actions = null, compact = false }) {
  const Icon = TYPE_ICON[item.type] || Gem;
  return (
    <div className={`rounded-theme border-theme p-2 text-xs transition ${item.equipped ? 'border-accent bg-accent/5 shadow-glow' : 'border-line/40 bg-surface'}`}>
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${item.equipped ? 'text-accent' : 'text-muted'}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="truncate text-sm font-semibold">{item.name}</span>
            {item.value > 0 && <span className="shrink-0 font-mono text-muted">{item.value}</span>}
          </div>
          <div className="capitalize text-muted">
            {item.type}
            {item.equipped ? ' · equipped' : ''}
            {item.damageDice ? ` · ${item.damageDice}` : ''}
          </div>
          {!compact && item.description && <p className="mt-0.5 text-muted">{item.description}</p>}
          {(Object.keys(item.statModifiers || {}).length > 0 || item.craftingTags?.length > 0) && (
            <div className="mt-1 flex flex-wrap gap-1">
              {Object.entries(item.statModifiers || {}).map(([k, v]) => (
                <span key={k} className="pill py-0 font-mono text-[10px]">
                  {typeof v === 'number' ? `${fmtMod(v)} ${k.length <= 3 ? k.toUpperCase() : skillLabel(k, skin)}` : `${k} ${v}`}
                </span>
              ))}
              {item.craftingTags?.map((t) => (
                <span key={t} className="rounded bg-surface-2 px-1 text-[10px] text-muted">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {actions && <div className="mt-2 flex flex-wrap gap-1">{actions}</div>}
    </div>
  );
}

export default function Tab2Inventory() {
  const character = useGameStore((s) => s.character);
  const campaign = useGameStore((s) => s.campaign);
  const busy = useGameStore((s) => s.busy);
  const [filter, setFilter] = useState('all');
  const [recipeId, setRecipeId] = useState(null);
  const [targetId, setTargetId] = useState('');
  const locked = campaign.meta.status !== 'active' || busy;
  const skin = campaign.skin;

  const items = useMemo(() => {
    const list = character.inventory || [];
    const filtered = filter === 'all' ? list : filter === 'gear' ? list.filter((i) => i.type === 'weapon' || i.type === 'armor' || i.type === 'key') : list.filter((i) => i.type === filter);
    return filtered.slice().sort((a, b) => Number(b.equipped) - Number(a.equipped) || a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  }, [character.inventory, filter]);

  const options = useMemo(() => craftingOptions(character), [character]);
  const selected = options.find((o) => o.recipe.id === recipeId);

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="section-title">Loot Cards ({character.inventory.length})</h3>
          <SegmentedControl
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'gear', label: 'Gear' },
              { value: 'consumable', label: 'Use' },
              { value: 'material', label: 'Mats' },
            ]}
          />
        </div>
        {items.length === 0 ? (
          <EmptyState title="Nothing here">Your pack is light.</EmptyState>
        ) : (
          <div className="grid gap-2">
            {items.map((it) => (
              <LootCard
                key={it.id}
                item={it}
                skin={skin}
                actions={
                  locked ? null : (
                    <>
                      {(it.type === 'weapon' || it.type === 'armor' || it.type === 'key') && (
                        <button className="btn px-2 py-0.5 text-xs" onClick={() => equipItem(it.id)}>
                          {it.equipped ? 'Unequip' : 'Equip'}
                        </button>
                      )}
                      {it.type === 'consumable' && (it.statModifiers?.heal || it.craftingTags?.includes('antidote')) && (
                        <button className="btn px-2 py-0.5 text-xs" onClick={() => consumeItem(it.id)} title={campaign.combat?.inCombat ? 'Uses your action in combat' : ''}>
                          Use{campaign.combat?.inCombat ? ' (action)' : ''}
                        </button>
                      )}
                      <ConfirmButton className="btn-ghost ml-auto px-1 py-0.5 text-xs text-danger" confirmLabel="Drop?" onConfirm={() => dropItem(it.id)}>
                        <Trash2 className="h-3 w-3" />
                      </ConfirmButton>
                    </>
                  )
                }
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="section-title mb-2 flex items-center gap-1.5">
          <Hammer className="h-4 w-4" /> Quick-Craft
        </h3>
        <div className="grid gap-1.5">
          {options.map(({ recipe, available, targets }) => (
            <button
              key={recipe.id}
              disabled={!available || locked}
              onClick={() => {
                setRecipeId(recipe.id === recipeId ? null : recipe.id);
                setTargetId(targets[0]?.id || '');
              }}
              className={`rounded-theme border-theme p-2 text-left text-xs transition disabled:opacity-40 ${recipeId === recipe.id ? 'border-accent bg-accent/5' : 'border-line/40 hover:border-accent/60'}`}
            >
              <div className="flex justify-between font-semibold">
                <span>{recipe.label}</span>
                <span className="font-mono text-muted">
                  {skillLabel(recipe.skill, skin)} DC {recipe.dc}
                </span>
              </div>
              <div className="text-muted">
                Needs: {recipe.inputs.map((t) => `#${t}`).join(' + ')}
                {recipe.kind === 'upgrade' ? ` → ${recipe.targetType}` : ''} · {recipe.description}
              </div>
            </button>
          ))}
        </div>
        {selected?.available && !locked && (
          <div className="card-inset mt-2 space-y-2 p-2 text-xs">
            {selected.recipe.kind === 'upgrade' && (
              <label className="block">
                <span className="label">Upgrade target</span>
                <select className="input py-1 text-xs" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                  {selected.targets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(() => {
              const inputIds = pickInputs(character, selected.recipe, targetId ? [targetId] : []);
              const names = (inputIds || []).map((id) => character.inventory.find((i) => i.id === id)?.name);
              return (
                <>
                  <p>Consumes on success: {inputIds ? names.join(', ') : 'missing materials'}</p>
                  <button
                    className="btn-primary w-full text-xs"
                    disabled={!inputIds || (selected.recipe.kind === 'upgrade' && !targetId)}
                    onClick={() => {
                      startCraft(selected.recipe, inputIds, targetId || null);
                      setRecipeId(null);
                    }}
                  >
                    <Check className="h-3 w-3" /> Attempt (1 hour)
                  </button>
                </>
              );
            })()}
          </div>
        )}
      </section>
    </div>
  );
}
