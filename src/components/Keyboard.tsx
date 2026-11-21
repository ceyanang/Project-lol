import { useEffect, useRef } from 'react';
import { playSfx } from '../game/sfx';

interface Props {
  onLetter: (letter: string) => void;
  onBackspace: () => void;
  /** Enter key / ⏎ button. Omit to hide the button. */
  onEnter?: () => void;
  enterLabel?: string;
  disabled?: boolean;
}

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

/**
 * In-game QWERTY keyboard for typing romaji. It never opens the phone's keyboard,
 * so autocorrect can't interfere. A physical keyboard works too (letters, Backspace, Enter).
 */
export default function Keyboard({ onLetter, onBackspace, onEnter, enterLabel = '⏎', disabled }: Props) {
  // keep the latest handlers for the window listener
  const h = useRef({ onLetter, onBackspace, onEnter, disabled });
  h.current = { onLetter, onBackspace, onEnter, disabled };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (h.current.disabled || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[a-zA-Z]$/.test(e.key)) {
        h.current.onLetter(e.key.toLowerCase());
        playSfx('tap');
      } else if (e.key === 'Backspace') h.current.onBackspace();
      else if (e.key === 'Enter' && h.current.onEnter) h.current.onEnter();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={`kbd ${disabled ? 'is-disabled' : ''}`} role="group" aria-label="Romaji keyboard">
      {ROWS.map((row, i) => (
        <div key={row} className="kbd-row">
          {[...row].map((k) => (
            <button key={k} type="button" className="kbd-key" disabled={disabled} onClick={() => onLetter(k)} aria-label={k}>
              {k}
            </button>
          ))}
          {i === 2 && (
            <button type="button" className="kbd-key kbd-wide kbd-back" disabled={disabled} onClick={onBackspace} aria-label="Delete">
              ⌫
            </button>
          )}
          {i === 2 && onEnter && (
            <button type="button" className="kbd-key kbd-wide kbd-enter" disabled={disabled} onClick={onEnter} aria-label="Enter">
              {enterLabel}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
