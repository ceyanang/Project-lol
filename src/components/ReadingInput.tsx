import { type ReactNode, useEffect, useRef } from 'react';
import type { KeyboardMode } from '../game/storage';
import Keyboard from './Keyboard';

interface Props {
  mode: KeyboardMode;
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
  disabled?: boolean;
  /** Shown in the box when empty (or as the status while disabled). */
  placeholder: string;
  /** Extra content beside the box (e.g. pile counts). */
  left?: ReactNode;
  right?: ReactNode;
  /** Reports whether the phone keyboard is open (the input is focused). */
  onTypingChange?: (typing: boolean) => void;
  autoFocus?: boolean;
  status?: 'ok' | 'bad' | null;
}

/**
 * Where the player types a romaji reading.
 * - 'game': a typed box + the in-game QWERTY keyboard (never opens the phone keyboard).
 * - 'phone': a real text field for the device keyboard, with autocorrect, autocapitalize,
 *   spellcheck and autofill turned off. Its Go/⏎ key submits.
 */
export default function ReadingInput({ mode, value, onChange, onEnter, disabled, placeholder, left, right, onTypingChange, autoFocus, status }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const statusClass = status === 'ok' ? 'is-ok' : status === 'bad' ? 'is-bad' : '';

  // keep the phone keyboard open between turns: refocus if it was open when we got disabled
  useEffect(() => {
    if (mode === 'phone' && autoFocus) input.current?.focus({ preventScroll: true });
  }, [mode, autoFocus]);

  if (mode === 'phone') {
    return (
      <form
        className="reading-input dock-row"
        onSubmit={(e) => {
          e.preventDefault();
          onEnter();
        }}
      >
        {left}
        <input
          ref={input}
          className={`typed-box typed-input ${statusClass}`}
          type="text"
          inputMode="text"
          enterKeyHint="go"
          name="kana-reading"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore="true"
          aria-label="Type the reading"
          placeholder={placeholder}
          value={value}
          // stays editable during enemy beats so the phone keyboard doesn't close; input is ignored then
          onChange={(e) => !disabled && onChange(e.target.value)}
          onFocus={() => onTypingChange?.(true)}
          onBlur={() => onTypingChange?.(false)}
        />
        <button type="submit" className="kbd-key kbd-enter dock-enter" disabled={disabled} aria-label="Enter">
          ⏎
        </button>
        {right}
      </form>
    );
  }

  return (
    <div className="reading-input">
      <div className="dock-row">
        {left}
        <div className={`typed-box grow ${statusClass}`} aria-live="polite" aria-label="Typed reading">
          {value || <span className="typed-placeholder">{placeholder}</span>}
          {!disabled && <span className="caret" />}
        </div>
        {right}
      </div>
      <Keyboard disabled={disabled} onLetter={(l) => onChange(value + l)} onBackspace={() => onChange(value.slice(0, -1))} onEnter={onEnter} enterLabel="⏎" />
    </div>
  );
}
