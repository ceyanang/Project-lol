import { describe, expect, it } from 'vitest';
import { MAX_TICK_MS, tickRemaining } from './turnTimer';

describe('tickRemaining', () => {
  it('counts down while running and stops at 0', () => {
    expect(tickRemaining(6000, 100, true)).toBe(5900);
    expect(tickRemaining(50, 100, true)).toBe(0);
  });
  it('is frozen while paused (enemy beat, hidden tab)', () => {
    expect(tickRemaining(4000, 100, false)).toBe(4000);
  });
  it('caps one huge step (a throttled tab returning) at MAX_TICK_MS', () => {
    expect(tickRemaining(6000, 60_000, true)).toBe(6000 - MAX_TICK_MS);
  });
  it('ignores negative dt', () => {
    expect(tickRemaining(3000, -50, true)).toBe(3000);
  });
});
