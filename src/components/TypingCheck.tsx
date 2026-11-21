import { useState } from 'react';
import { KANA_BY_ID } from '../data';
import { kanaReadings, matchesReading, normalizeTyped } from '../game/romaji';
import { playSfx } from '../game/sfx';
import type { KeyboardMode } from '../game/storage';
import ReadingInput from './ReadingInput';

interface Props {
  /** Kana ids to ask, in order. */
  kana: string[];
  title?: string;
  onAnswer?: (kanaId: string, correct: boolean) => void;
  onDone: (results: boolean[]) => void;
  onCancel?: () => void;
  keyboardMode?: KeyboardMode;
}

/** Typed reading check: see a kana, type its romaji on the in-game keyboard, press Enter. */
export default function TypingCheck({ kana, title, onAnswer, onDone, onCancel, keyboardMode = 'game' }: Props) {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [results, setResults] = useState<boolean[]>([]);
  const [verdict, setVerdict] = useState<null | 'ok' | 'bad'>(null);
  const id = kana[index];
  const k = KANA_BY_ID[id];

  function next(nextResults: boolean[]) {
    setVerdict(null);
    setTyped('');
    if (index + 1 >= kana.length) onDone(nextResults);
    else setIndex(index + 1);
  }

  function submit() {
    if (verdict === 'bad') return next(results); // Enter = "Got it"
    if (verdict || !typed) return;
    const ok = matchesReading([id], typed);
    const nextResults = [...results, ok];
    setResults(nextResults);
    setVerdict(ok ? 'ok' : 'bad');
    playSfx(ok ? 'correct' : 'wrong');
    onAnswer?.(id, ok);
    if (ok) window.setTimeout(() => next(nextResults), 380);
  }

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Typing check">
      <div className="sheet typing-check">
        <div className="rc-head">
          <span className="rc-title">{title ?? 'Type the reading'}</span>
          <span className="small muted">
            {index + 1}/{kana.length}
          </span>
        </div>
        <div className="tc-row">
          <div className={`rc-glyph jp tc-glyph ${verdict === 'ok' ? 'flash-ok' : verdict === 'bad' ? 'flash-bad' : ''}`}>{k.char}</div>
        </div>

        {verdict === 'bad' && (
          <div className="rc-feedback">
            <p>
              <span className="jp big-inline">{k.char}</span> is <strong>{kanaReadings(id)[0]}</strong>, not “{normalizeTyped(typed)}”.
            </p>
            <p className="muted">💡 {k.mnemonic}</p>
            <button type="button" className="btn btn-gold btn-wide" onClick={() => next(results)}>
              Got it (⏎)
            </button>
          </div>
        )}
        {/* stays mounted after a miss so the phone keyboard doesn't close; ⏎ = Got it */}
        <ReadingInput
          mode={keyboardMode}
          value={verdict === 'bad' ? '' : typed}
          onChange={(v) => !verdict && setTyped(normalizeTyped(v).slice(0, 6))}
          onEnter={submit}
          disabled={verdict === 'ok'}
          autoFocus={keyboardMode === 'phone'}
          status={verdict === 'ok' ? 'ok' : null}
          placeholder={verdict === 'bad' ? '⏎ to continue' : keyboardMode === 'phone' ? 'tap to type · Go submits' : 'type it…'}
        />
        {!verdict && index === 0 && !typed && onCancel && (
          <button type="button" className="btn btn-ghost btn-wide" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
