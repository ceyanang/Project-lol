/** Longest single step the turn timer will count, so a throttled or backgrounded tab can't burn the clock in one jump. */
export const MAX_TICK_MS = 250;

/** Time left after `dtMs` of wall time; frozen while not running, never below 0. */
export function tickRemaining(remainingMs: number, dtMs: number, running: boolean): number {
  if (!running) return remainingMs;
  return Math.max(0, remainingMs - Math.min(Math.max(dtMs, 0), MAX_TICK_MS));
}
