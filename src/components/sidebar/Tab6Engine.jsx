import { Cpu, Image, Palette, Dices, Gauge, Download, Database, ArrowLeft, TrendingUp } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { updateSettings } from '../../store/localActions.js';
import { TEXT_MODELS, IMAGE_MODEL, getTextRate } from '../../config/models.js';
import { THEMES, themeForGenre } from '../../config/genreSkins.js';
import { campaignToMarkdown, exportCampaignBundle, downloadText, slugify } from '../../engine/exporters.js';
import { SegmentedControl, fmtTokens, fmtUSD } from '../common/ui.jsx';
import { XP_MODE_INFO, xpMode, xpPace, xpFineTune, questsEnabled } from '../../engine/deeds.js';
import XpPaceControls from '../common/XpPaceControls.jsx';

export default function Tab6Engine() {
  const campaign = useGameStore((s) => s.campaign);
  const character = useGameStore((s) => s.character);
  const turns = useGameStore((s) => s.turns);
  const diary = useGameStore((s) => s.diary);
  const codex = useGameStore((s) => s.codex);
  const session = useGameStore((s) => s.sessionTelemetry);
  const exitGame = useGameStore((s) => s.exitGame);
  const meta = campaign.meta;
  const t = campaign.telemetry || {};
  const locked = meta.status !== 'active';
  const genreTheme = themeForGenre(meta.genreTheme);
  const cache = campaign.cacheRef;
  const cacheLive = cache?.expireTime && Date.parse(cache.expireTime) > Date.now();

  const mode = xpMode(campaign);
  const quests = questsEnabled(campaign);

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="section-title flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4" /> Progression
        </h3>
        <div>
          <div className="label">Quests</div>
          <SegmentedControl
            value={quests ? 'on' : 'off'}
            onChange={(v) => !locked && updateSettings({ 'meta.questsEnabled': v === 'on' })}
            options={[
              { value: 'off', label: 'Off (sandbox)' },
              { value: 'on', label: 'On' },
            ]}
          />
          <p className="mt-1 text-[11px] text-muted">{quests ? 'The storyteller can offer quests and bounties; they appear in the Quests tab.' : 'No quests or bounties. The Quests tab is hidden and you set your own goals.'}</p>
        </div>
        <div>
          <div className="label">Experience</div>
          <SegmentedControl
            value={mode}
            onChange={(v) => {
              if (locked || v === mode) return;
              // Starting milestone mode begins a fresh cooldown so a level is not granted on the very next turn.
              updateSettings(v === 'milestone' ? { 'meta.xpMode': v, 'progress.lastMilestoneTurn': campaign.turnCount || 0 } : { 'meta.xpMode': v });
            }}
            options={Object.entries(XP_MODE_INFO).map(([value, m]) => ({ value, label: m.label }))}
          />
          <p className="mt-1 text-[11px] text-muted">{XP_MODE_INFO[mode].blurb}</p>
        </div>
        <XpPaceControls
          mode={mode}
          pace={xpPace(campaign)}
          fineTune={xpFineTune(campaign)}
          level={character?.level || 1}
          disabled={locked}
          idPrefix="eng-xp"
          onChange={({ pace, fineTune }) => !locked && updateSettings({ 'meta.xpPace': pace, 'meta.xpMultiplier': fineTune })}
        />
      </section>

      <section>
        <h3 className="section-title mb-2 flex items-center gap-1.5">
          <Cpu className="h-4 w-4" /> Storyteller Model
        </h3>
        <div className="space-y-1.5">
          {Object.values(TEXT_MODELS).map((m) => {
            const rate = getTextRate(m.id);
            const on = meta.modelPref === m.id;
            return (
              <button
                key={m.id}
                disabled={locked}
                onClick={() => updateSettings({ 'meta.modelPref': m.id })}
                className={`w-full rounded-theme border-theme p-2 text-left text-sm transition ${on ? 'border-accent bg-accent/10' : 'border-line/40 hover:border-accent/60'}`}
                aria-pressed={on}
              >
                <div className="flex items-center justify-between">
                  <strong>{m.label}</strong>
                  <span className="font-mono text-[10px] text-muted">{m.id}</span>
                </div>
                <div className="text-xs text-muted">{m.role}</div>
                <div className="mt-0.5 font-mono text-[10px] text-muted">
                  ${rate.input}/M in · ${rate.output}/M out · ${rate.cached}/M cached{rate.effectiveUntil ? ` (intro rate until ${rate.effectiveUntil})` : ''}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <div className="label flex items-center gap-1">
            <Image className="h-3 w-3" /> Scene Images ({IMAGE_MODEL.label})
          </div>
          <SegmentedControl
            value={meta.imageMode}
            onChange={(v) => !locked && updateSettings({ 'meta.imageMode': v })}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'manual', label: 'Manual / On-Demand' },
              { value: 'auto', label: 'Auto-Director' },
            ]}
          />
          <p className="mt-1 text-[11px] text-muted">≈{fmtUSD(IMAGE_MODEL.pricing[0].perImage)} per image. Auto-Director paints combat starts, new places, and every 5th turn.</p>
        </div>
        <div>
          <div className="label flex items-center gap-1">
            <Palette className="h-3 w-3" /> Theme
          </div>
          <select className="input" value={meta.themeOverride || ''} onChange={(e) => updateSettings({ 'meta.themeOverride': e.target.value || null })}>
            <option value="">Auto — genre default ({THEMES[genreTheme]})</option>
            {Object.entries(THEMES).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label flex items-center gap-1">
              <Dices className="h-3 w-3" /> Dice
            </div>
            <SegmentedControl
              value={meta.diceMode}
              onChange={(v) => updateSettings({ 'meta.diceMode': v })}
              options={[
                { value: 'digital', label: 'Digital' },
                { value: 'manual', label: 'Physical' },
              ]}
            />
          </div>
          <div>
            <div className="label">Rules</div>
            <p className="text-xs text-muted">
              Tone {meta.toneSlider}/10 · Strictness {meta.rulesStrictness}/10
            </p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="section-title mb-2 flex items-center gap-1.5">
          <Gauge className="h-4 w-4" /> Token & Cost Telemetry
        </h3>
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
              <td>Input tokens</td>
              <td className="text-right">{fmtTokens(session.inputTokens)}</td>
              <td className="text-right">{fmtTokens(t.totalInputTokens)}</td>
            </tr>
            <tr>
              <td>Output tokens</td>
              <td className="text-right">{fmtTokens(session.outputTokens)}</td>
              <td className="text-right">{fmtTokens(t.totalOutputTokens)}</td>
            </tr>
            <tr>
              <td>Cached tokens</td>
              <td className="text-right">{fmtTokens(session.cachedTokens)}</td>
              <td className="text-right">{fmtTokens(t.cachedTokens)}</td>
            </tr>
            <tr className="border-t-theme border-line/40 font-bold">
              <td className="pt-1">Cost (USD)</td>
              <td className="pt-1 text-right">{fmtUSD(session.costUSD)}</td>
              <td className="pt-1 text-right">{fmtUSD(t.totalCostUSD)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 flex items-center gap-1 text-[11px] text-muted">
          <Database className="h-3 w-3" />
          Context cache: {cacheLive ? `active until ${new Date(cache.expireTime).toLocaleTimeString()}` : TEXT_MODELS[meta.modelPref]?.supportsExplicitCache ? 'implicit (prefix below explicit-cache minimum or expired)' : 'implicit only for this model'}
        </p>
      </section>

      <section>
        <h3 className="section-title mb-2">Export</h3>
        <div className="flex flex-wrap gap-2">
          <button className="btn text-xs" onClick={() => downloadText(`${slugify(meta.title)}.storybook.md`, campaignToMarkdown({ campaign, character, diary, turns, codex }), 'text/markdown')}>
            <Download className="h-3.5 w-3.5" /> StoryBook .md
          </button>
          <button className="btn text-xs" onClick={() => downloadText(`${slugify(meta.title)}.campaign.json`, JSON.stringify(exportCampaignBundle({ campaign, character, turns, diary, codex }), null, 2), 'application/json')}>
            <Download className="h-3.5 w-3.5" /> Backup .json
          </button>
          <button className="btn text-xs" onClick={exitGame}>
            <ArrowLeft className="h-3.5 w-3.5" /> Guildhall
          </button>
        </div>
      </section>
    </div>
  );
}
