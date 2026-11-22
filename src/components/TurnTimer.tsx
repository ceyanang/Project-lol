import { useEffect, useRef, useState } from 'react';
import { tickRemaining } from '../game/turnTimer';

interface Props {
  /** Changing this refills the meter (a new turn was dealt). */
  turnKey: string | number;
  /** Frozen while false (enemy beats, battle over). The meter also freezes while the tab is hidden. */
  running: boolean;
  durationMs: number;
  onExpire: () => void;
}

const STEP_MS = 100;

/** The per-turn countdown meter. Counts accumulated running time, so pauses never cost the player. */
export default function TurnTimer({ turnKey, running, durationMs, onExpire }: Props) {
  const [left, setLeft] = useState(durationMs);
  const leftRef = useRef(durationMs);
  const expire = useRef(onExpire);
  expire.current = onExpire;

  useEffect(() => {
    leftRef.current = durationMs;
    setLeft(durationMs);
  }, [turnKey, durationMs]);

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      if (document.hidden || leftRef.current <= 0) return;
      leftRef.current = tickRemaining(leftRef.current, dt, true);
      setLeft(leftRef.current);
      if (leftRef.current <= 0) expire.current();
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [running, turnKey]);

  const secs = Math.ceil(left / 1000);
  return (
    <div className={`turn-timer ${left <= 2000 ? 'is-low' : ''}`} role="progressbar" aria-label="Time left this turn" aria-valuemin={0} aria-valuemax={durationMs} aria-valuenow={Math.round(left)}>
      <span className="turn-timer-fill" style={{ width: `${(left / durationMs) * 100}%` }} />
      <span className="turn-timer-text">{secs}s</span>
    </div>
  );
}
