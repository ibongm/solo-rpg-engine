import { useMemo, useState } from 'react';
import { Dices, Hand, Swords, ArrowRight } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { d20Count, resolveCheck, rollCheck, fmtMod, parseDice, damageExpression } from '../../engine/diceEngine.js';
import { resolveDamage } from '../../store/turnRunner.js';
import { commitCampaignSettings } from '../../engine/stateMutator.js';
import { Modal, SegmentedControl, Spinner } from '../common/ui.jsx';

/**
 * The visible dice prompt. No secret rolls: DC, advantage and every modifier are shown
 * before rolling. Supports animated digital d20s and manually entered physical dice.
 * Once rolled, the result is locked — closing the prompt submits it.
 */
export default function DicePromptModal() {
  const prompt = useGameStore((s) => s.rollPrompt);
  const close = useGameStore((s) => s.closeRollPrompt);
  const campaign = useGameStore((s) => s.campaign);
  const character = useGameStore((s) => s.character);
  const user = useGameStore((s) => s.user);
  const diceMode = campaign?.meta?.diceMode || 'digital';
  const { check } = prompt;
  const need = d20Count(check);

  const [phase, setPhase] = useState('ready'); // ready | rolling | result | damage | done
  const [manual, setManual] = useState(Array(need).fill(''));
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [damage, setDamage] = useState(null);
  const [manualDamage, setManualDamage] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const dmgInfo = useMemo(() => {
    if (!prompt.withDamage || !check.isAttack) return null;
    const { expr } = damageExpression(check, character);
    const parsed = parseDice(expr);
    return { expr, parsed };
  }, [prompt.withDamage, check, character]);

  const needsDamage = Boolean(dmgInfo && result?.success);
  const damageDiceCount = dmgInfo?.parsed ? dmgInfo.parsed.count * (result?.critical ? 2 : 1) : 0;

  const finish = async (res = result, dmg = damage) => {
    if (submitting) return;
    setSubmitting(true);
    close();
    try {
      await prompt.onResolve({ result: res, damage: dmg });
    } catch (err) {
      useGameStore.getState().toast(err.message, 'error');
    }
  };

  const doDigitalRoll = () => {
    setPhase('rolling');
    const r = rollCheck(check);
    setTimeout(() => {
      setResult(r);
      setPhase('result');
    }, 900);
  };

  const doManualSubmit = () => {
    try {
      const faces = manual.map((v) => parseInt(v, 10));
      const r = resolveCheck(check, faces);
      setResult(r);
      setError('');
      setPhase('result');
    } catch (err) {
      setError(err.message);
    }
  };

  const rollDamageDigital = () => {
    const d = resolveDamage(check, character, { critical: result.critical });
    setDamage(d);
  };

  const submitManualDamage = () => {
    try {
      const faces = manualDamage.map((v) => parseInt(v, 10));
      const d = resolveDamage(check, character, { critical: result.critical, manualFaces: dmgInfo.parsed.count === 0 ? [] : faces });
      setDamage(d);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const onClose = () => {
    if (!result) {
      close();
      return;
    }
    // A rolled result is locked in; a hit without damage gets its damage rolled digitally.
    if (needsDamage && !damage) finish(result, resolveDamage(check, character, { critical: result.critical }));
    else finish();
  };

  const setDiceMode = (mode) => commitCampaignSettings({ uid: user.uid, campaign, patch: { 'meta.diceMode': mode } }).catch(() => {});

  const outcomeTone = result ? (result.success === null ? 'text-ink' : result.success ? 'text-success' : 'text-danger') : '';

  return (
    <Modal title={prompt.title} icon={<Dices className="h-5 w-5 text-accent" />} onClose={onClose}>
      {prompt.subtitle && <p className="mb-3 text-sm text-muted">{prompt.subtitle}</p>}

      <div className="card-inset mb-4 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-heading text-lg font-bold">{check.label}</div>
          <div className="flex items-center gap-2">
            {check.dc !== null && (
              <span className="pill border-accent text-base font-bold text-accent">
                {check.isAttack ? 'AC' : 'DC'} {check.dc}
              </span>
            )}
            {check.advantage !== 'normal' && <span className={`pill capitalize ${check.advantage === 'advantage' ? 'border-success text-success' : 'border-danger text-danger'}`}>{check.advantage}</span>}
          </div>
        </div>
        <table className="mt-2 w-full text-sm">
          <tbody>
            <tr>
              <td className="py-0.5 text-muted">d20{need > 1 ? ` ×2 (${check.advantage === 'advantage' ? 'take higher' : 'take lower'})` : ''}</td>
              <td className="text-right font-mono">{result ? result.natural : '?'}</td>
            </tr>
            {check.breakdown.map((b, i) => (
              <tr key={i}>
                <td className="py-0.5 text-muted">{b.label}</td>
                <td className="text-right font-mono">{fmtMod(b.value)}</td>
              </tr>
            ))}
            <tr className="border-t-theme border-line/40 font-bold">
              <td className="pt-1">Total</td>
              <td className="pt-1 text-right font-mono">{result ? result.total : `d20 ${fmtMod(check.totalModifier)}`}</td>
            </tr>
          </tbody>
        </table>
        {check.conditionNotes?.length > 0 && <p className="mt-1 text-xs text-warning">Conditions: {check.conditionNotes.join(', ')}</p>}
      </div>

      {phase === 'ready' && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-muted">Dice mode</span>
            <SegmentedControl
              value={diceMode}
              onChange={setDiceMode}
              options={[
                { value: 'digital', label: 'Digital' },
                { value: 'manual', label: 'Physical' },
              ]}
            />
          </div>
          {diceMode === 'digital' ? (
            <button className="btn-primary w-full py-3 text-base" onClick={doDigitalRoll} autoFocus>
              <Dices className="h-5 w-5" /> Roll {need > 1 ? '2d20' : 'd20'}
            </button>
          ) : (
            <div>
              <p className="mb-2 text-sm">Roll {need > 1 ? 'two real d20s' : 'a real d20'} at your desk and enter the result{need > 1 ? 's' : ''}:</p>
              <div className="flex gap-2">
                {manual.map((v, i) => (
                  <input
                    key={i}
                    type="number"
                    min={1}
                    max={20}
                    inputMode="numeric"
                    className="input w-24 text-center font-mono text-lg"
                    value={v}
                    autoFocus={i === 0}
                    onChange={(e) => setManual(manual.map((m, j) => (j === i ? e.target.value : m)))}
                    onKeyDown={(e) => e.key === 'Enter' && doManualSubmit()}
                    aria-label={`d20 result ${i + 1}`}
                  />
                ))}
                <button className="btn-primary flex-1" onClick={doManualSubmit}>
                  <Hand className="h-4 w-4" /> Submit
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'rolling' && (
        <div className="flex flex-col items-center py-4">
          <div className="flex h-20 w-20 animate-dice-tumble items-center justify-center rounded-xl border-2 border-accent bg-surface font-mono text-3xl font-bold text-accent shadow-glow">20</div>
          <p className="mt-3 text-sm text-muted">Rolling…</p>
        </div>
      )}

      {(phase === 'result' || phase === 'damage') && result && (
        <div className="text-center">
          <div className="mb-2 flex justify-center gap-3">
            {result.faces.map((f, i) => (
              <div
                key={i}
                className={`flex h-16 w-16 items-center justify-center rounded-xl border-2 font-mono text-2xl font-bold ${f === result.natural ? 'border-accent text-accent shadow-glow' : 'border-line text-muted line-through'} ${f === 20 ? 'bg-success/10' : f === 1 ? 'bg-danger/10' : 'bg-surface'}`}
              >
                {f}
              </div>
            ))}
          </div>
          <p className={`font-heading text-2xl font-bold ${outcomeTone}`}>
            {result.total}
            {result.success !== null && ` — ${result.success ? 'Success' : 'Failure'}`}
          </p>
          {result.critical && <p className="text-sm font-bold text-success">Natural 20!</p>}
          {result.fumble && <p className="text-sm font-bold text-danger">Natural 1!</p>}

          {needsDamage && (
            <div className="card-inset mt-4 p-3 text-left">
              <div className="mb-2 flex items-center gap-2 font-bold">
                <Swords className="h-4 w-4" /> Damage: {dmgInfo.expr}
                {result.critical && <span className="pill border-success text-success">Critical — dice doubled</span>}
              </div>
              {damage ? (
                <p className="font-mono">
                  [{damage.rolls.join(', ')}]{damage.bonus ? ` ${fmtMod(damage.bonus)}` : ''} = <strong className="text-lg">{damage.total}</strong>
                </p>
              ) : diceMode === 'digital' || damageDiceCount === 0 ? (
                <button className="btn-primary" onClick={damageDiceCount === 0 ? submitManualDamage : rollDamageDigital}>
                  <Dices className="h-4 w-4" /> Roll Damage
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {Array.from({ length: damageDiceCount }, (_, i) => (
                    <input
                      key={i}
                      type="number"
                      min={1}
                      max={dmgInfo.parsed.sides}
                      className="input w-16 text-center font-mono"
                      value={manualDamage[i] ?? ''}
                      onChange={(e) => {
                        const next = manualDamage.slice();
                        next[i] = e.target.value;
                        setManualDamage(next);
                      }}
                      aria-label={`d${dmgInfo.parsed.sides} result ${i + 1}`}
                    />
                  ))}
                  <button className="btn-primary" onClick={submitManualDamage}>
                    Submit d{dmgInfo.parsed.sides}s
                  </button>
                </div>
              )}
            </div>
          )}

          <button className="btn-primary mt-4 w-full" onClick={() => finish()} disabled={submitting || (needsDamage && !damage)} autoFocus={!needsDamage}>
            {submitting ? <Spinner /> : <ArrowRight className="h-4 w-4" />} Continue
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </Modal>
  );
}
