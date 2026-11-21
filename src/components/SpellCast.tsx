import { useState } from 'react';
import { KANA_BY_ID, SPELL_BY_ID } from '../data';
import type { SpellInHand } from '../game/battle';
import { acceptedReadings, isCorrectTyped } from '../game/romaji';
import { playSfx } from '../game/sfx';

interface Props {
  spell: SpellInHand;
  onCast: (typed: string) => void;
  onCancel: () => void;
}

const VOWELS = ['a', 'i', 'u', 'e', 'o'];
const CONSONANTS = ['k', 's', 't', 'n', 'h', 'm', 'y', 'r', 'w', 'g', 'z', 'd', 'b', 'p', 'j', 'c', 'f'];
const MAX_LEN = 4;

/**
 * Cast a spell by typing the reading of its kana on an in-game romaji keypad.
 * No device keyboard, so autocorrect can never interfere.
 */
export default function SpellCast({ spell, onCast, onCancel }: Props) {
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<'ok' | 'bad' | null>(null);
  const def = SPELL_BY_ID[spell.spellId];
  const kana = KANA_BY_ID[spell.kana];

  function key(k: string) {
    if (result || typed.length >= MAX_LEN) return;
    playSfx('tap');
    setTyped(typed + k);
  }

  function submit() {
    if (!typed || result) return;
    const ok = isCorrectTyped(spell.kana, typed);
    setResult(ok ? 'ok' : 'bad');
    playSfx(ok ? 'correct' : 'wrong');
    if (ok) window.setTimeout(() => onCast(typed), 380);
  }

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label={`Cast ${def.name}`}>
      <div className="sheet spell-cast">
        <div className="rc-head">
          <span className="rc-title">
            {def.emoji} {def.name}
          </span>
          <span className="small muted">{def.description}</span>
        </div>

        <div className="spell-cast-row">
          <div className={`rc-glyph jp spell-glyph ${result === 'ok' ? 'flash-ok' : result === 'bad' ? 'flash-bad' : ''}`}>{kana.char}</div>
          <div className={`typed ${result === 'ok' ? 'is-ok' : result === 'bad' ? 'is-bad' : ''}`} aria-live="polite" aria-label="Typed reading">
            {typed || <span className="typed-placeholder">type it…</span>}
            {!result && <span className="caret" />}
          </div>
        </div>

        {result === 'bad' ? (
          <div className="rc-feedback">
            <p>
              <span className="jp big-inline">{kana.char}</span> is <strong>{acceptedReadings(spell.kana)[0]}</strong>, not “{typed}”. The spell fizzles.
            </p>
            <p className="muted">💡 {kana.mnemonic}</p>
            <button type="button" className="btn btn-gold btn-wide" onClick={() => onCast(typed)}>
              Got it
            </button>
          </div>
        ) : (
          <>
            <div className="keypad" role="group" aria-label="Romaji keypad">
              <div className="keypad-vowels">
                {VOWELS.map((k) => (
                  <button key={k} type="button" className="key key-vowel" onClick={() => key(k)}>
                    {k}
                  </button>
                ))}
              </div>
              <div className="keypad-consonants">
                {CONSONANTS.map((k) => (
                  <button key={k} type="button" className="key" onClick={() => key(k)}>
                    {k}
                  </button>
                ))}
                <button type="button" className="key key-back" onClick={() => setTyped(typed.slice(0, -1))} aria-label="Delete">
                  ⌫
                </button>
              </div>
            </div>
            <div className="spell-actions">
              <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={!!result}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary grow" onClick={submit} disabled={!typed || !!result}>
                🪄 Cast
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
