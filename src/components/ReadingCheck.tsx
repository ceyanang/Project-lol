import { useMemo, useState } from 'react';
import { KANA_BY_ID, VOCAB_BY_ID } from '../data';
import type { PlayStep } from '../game/battle';
import { meaningOptions, romajiOptions } from '../game/distractors';
import { defaultRng } from '../game/rng';
import { CONFIG } from '../config';

interface Props {
  steps: PlayStep[];
  unlocked: readonly string[];
  title?: string;
  /** Called after each answer, e.g. to speak the kana. */
  onAnswer?: (step: PlayStep, correct: boolean) => void;
  onDone: (results: boolean[]) => void;
  onCancel?: () => void;
}

/**
 * The reading check: one big kana, four romaji tiles. No keyboard — tiles only.
 * For chains, steps through each kana in order.
 */
export default function ReadingCheck({ steps, unlocked, title, onAnswer, onDone, onCancel }: Props) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const step = steps[index];

  const options = useMemo(
    () =>
      step.kind === 'meaning'
        ? meaningOptions(step.ref, defaultRng, CONFIG.combat.readingOptions)
        : romajiOptions(step.ref, unlocked, defaultRng, CONFIG.combat.readingOptions),
    [index, step.ref, step.kind],
  );

  const kana = step.kind === 'romaji' ? KANA_BY_ID[step.ref] : undefined;
  const word = step.kind === 'meaning' ? VOCAB_BY_ID[step.ref] : undefined;
  const correctAnswer = kana ? kana.romaji : word!.meaning;
  const answered = picked !== null;
  const wasCorrect = picked === correctAnswer;

  function advance(nextResults: boolean[]) {
    setPicked(null);
    if (index + 1 >= steps.length) onDone(nextResults);
    else setIndex(index + 1);
  }

  function choose(opt: string) {
    if (answered) return;
    const ok = opt === correctAnswer;
    setPicked(opt);
    const nextResults = [...results, ok];
    setResults(nextResults);
    onAnswer?.(step, ok);
    if (ok) window.setTimeout(() => advance(nextResults), 420);
  }

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Reading check">
      <div className="sheet reading-check">
        <div className="rc-head">
          <span className="rc-title">{title ?? (word ? 'What does it mean?' : 'Read it!')}</span>
          {steps.length > 1 && (
            <span className="rc-progress">
              {steps.map((s, i) => (
                <span
                  key={i}
                  className={`rc-dot jp ${i === index ? 'is-current' : ''} ${results[i] === true ? 'is-ok' : results[i] === false ? 'is-bad' : ''}`}
                >
                  {KANA_BY_ID[s.ref]?.char ?? '?'}
                </span>
              ))}
            </span>
          )}
        </div>

        <div className={`rc-glyph jp ${word ? 'is-word' : ''} ${answered ? (wasCorrect ? 'flash-ok' : 'flash-bad') : ''}`}>
          {kana ? kana.char : word!.reading}
        </div>

        <div className="rc-options">
          {options.map((opt) => {
            const state = !answered ? '' : opt === correctAnswer ? 'is-correct' : opt === picked ? 'is-wrong' : 'is-faded';
            return (
              <button key={opt} type="button" className={`tile ${word ? 'tile-text' : ''} ${state}`} onClick={() => choose(opt)} disabled={answered}>
                {opt}
              </button>
            );
          })}
        </div>

        {answered && !wasCorrect && (
          <div className="rc-feedback">
            <p>
              <span className="jp big-inline">{kana ? kana.char : word!.reading}</span> is <strong>{kana ? kana.romaji : `${word!.romaji} — “${word!.meaning}”`}</strong>
            </p>
            {kana && <p className="muted">💡 {kana.mnemonic}</p>}
            <button type="button" className="btn btn-gold btn-wide" onClick={() => advance(results)}>
              Got it
            </button>
          </div>
        )}

        {!answered && index === 0 && onCancel && (
          <button type="button" className="btn btn-ghost btn-wide" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
