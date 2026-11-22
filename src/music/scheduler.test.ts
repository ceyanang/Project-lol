import { describe, expect, it } from 'vitest';
import { Scheduler } from './scheduler';
import { NO_LAYERS, barSeconds, type NoteEvent } from './score';

interface Played { ev: NoteEvent; when: number; spb: number }

function rig(lookahead = 0.12) {
  const clock = { t: 0 };
  const played: Played[] = [];
  const s = new Scheduler({ now: () => clock.t, play: (ev, when, spb) => played.push({ ev, when, spb }), lookahead });
  /** Advance the clock to `to` in 25 ms ticks, like the real timer. */
  const run = (to: number) => {
    while (clock.t < to) {
      clock.t = Math.min(to, clock.t + 0.025);
      s.tick();
    }
  };
  return { clock, played, s, run };
}
const kicks = (p: Played[]) => p.filter((x) => x.ev.voice === 'kick').map((x) => x.when);

describe('Scheduler', () => {
  it('schedules the first bar at the start time with events at their beat offsets', () => {
    const { clock, played, s } = rig();
    clock.t = 10;
    s.start('battle', NO_LAYERS, 10);
    s.tick();
    const spb = 60 / 156;
    expect(kicks(played).map((w) => +w.toFixed(4))).toEqual([0, 1, 2, 3].map((b) => +(10 + b * spb).toFixed(4)));
    expect(played.every((p) => Math.abs(p.spb - spb) < 1e-9)).toBe(true);
  });

  it('schedules one new bar per bar duration, with no duplicates across repeated ticks', () => {
    const { clock, played, s, run } = rig();
    clock.t = 10;
    s.start('battle', NO_LAYERS, 10);
    const len = barSeconds('battle', NO_LAYERS);
    run(10 + 2 * len + 0.01); // bars 0, 1 and 2 have started; bar 3 is beyond the look-ahead
    const w = kicks(played);
    expect(w).toHaveLength(12);
    expect(new Set(w.map((x) => x.toFixed(6))).size).toBe(12);
  });

  it('a layer change applies from the next unscheduled bar and never touches scheduled ones', () => {
    const { clock, played, s, run } = rig();
    clock.t = 10;
    s.start('battle', NO_LAYERS, 10);
    s.tick(); // bar 0 scheduled without the hook
    const len = barSeconds('battle', NO_LAYERS);
    s.setLayers({ hook: true, enraged: false });
    run(10 + len + 0.01);
    const leads = played.filter((p) => p.ev.voice === 'lead').map((p) => p.when);
    expect(leads.length).toBeGreaterThan(0);
    expect(leads.every((w) => w >= 10 + len - 1e-9)).toBe(true);
    expect(kicks(played)).toHaveLength(8); // nothing from bar 0 was re-emitted
  });

  it('starting another scene discards the old one completely', () => {
    const { clock, played, s, run } = rig();
    clock.t = 10;
    s.start('battle', NO_LAYERS, 10);
    run(11);
    const before = played.length;
    s.start('boss', NO_LAYERS, 11);
    run(14);
    const after = played.slice(before);
    expect(after.some((p) => p.ev.voice === 'zap')).toBe(false);
    expect(after.some((p) => p.ev.voice === 'taiko')).toBe(true);
    expect(s.scene).toBe('boss');
  });

  it('stop() silences it', () => {
    const { clock, played, s, run } = rig();
    clock.t = 10;
    s.start('map', NO_LAYERS, 10);
    run(11);
    s.stop();
    const n = played.length;
    run(20);
    expect(played.length).toBe(n);
    expect(s.scene).toBeNull();
  });

  it('after a long gap (a resumed tab) it skips ahead instead of replaying missed bars', () => {
    const { clock, played, s } = rig();
    clock.t = 10;
    s.start('battle', NO_LAYERS, 10);
    s.tick();
    const n = played.length;
    clock.t = 70; // the page was hidden for a minute
    s.tick();
    const fresh = played.slice(n);
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh.every((p) => p.when >= 70 - 1e-9)).toBe(true);
    expect(kicks(fresh).length).toBeLessThanOrEqual(8);
  });

  it('an enraged boss lays its bars closer together', () => {
    const { clock, played, s, run } = rig();
    clock.t = 5;
    const mad = { hook: false, enraged: true };
    s.start('boss', mad, 5);
    run(5 + 3 * barSeconds('boss', mad));
    const downbeats = played.filter((p) => p.ev.voice === 'taiko' && p.ev.gain === 0.9).map((p) => p.when);
    expect(downbeats.length).toBeGreaterThanOrEqual(3);
    expect(downbeats[1] - downbeats[0]).toBeCloseTo(barSeconds('boss', mad), 6);
    expect(barSeconds('boss', mad)).toBeLessThan(barSeconds('boss', NO_LAYERS));
  });
});
