import { describe, expect, it } from 'vitest';
import { NO_LAYERS, TRACKS, barSeconds, notesForBar } from './score';

const pcs = (evs: ReturnType<typeof notesForBar>, voices: string[]) =>
  new Set(evs.filter((e) => voices.includes(e.voice)).flatMap((e) => (e.midi ?? []).map((m) => m % 12)));
const bars = (scene: 'menu' | 'map') => Array.from({ length: TRACKS[scene].bars }, (_, i) => notesForBar(scene, i, NO_LAYERS));

describe('timing', () => {
  it('menu is 54 bpm and map is 112 bpm', () => {
    expect(barSeconds('menu', NO_LAYERS)).toBeCloseTo((4 * 60) / 54, 6);
    expect(barSeconds('map', NO_LAYERS)).toBeCloseTo((4 * 60) / 112, 6);
    expect(TRACKS.menu.bars).toBe(12);
    expect(TRACKS.map.bars).toBe(16);
  });
});

describe('every track', () => {
  it('is deterministic, wraps around its length, and emits well-formed events', () => {
    for (const scene of ['menu', 'map'] as const) {
      const n = TRACKS[scene].bars;
      expect(notesForBar(scene, 0, NO_LAYERS)).toEqual(notesForBar(scene, n, NO_LAYERS));
      expect(notesForBar(scene, 3, NO_LAYERS)).toEqual(notesForBar(scene, 3, NO_LAYERS));
      for (const ev of bars(scene).flat()) {
        expect(ev.beat).toBeGreaterThanOrEqual(0);
        expect(ev.beat).toBeLessThan(4);
        expect(ev.len).toBeGreaterThan(0);
        expect(ev.gain).toBeGreaterThan(0);
        expect(ev.gain).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('menu (zen)', () => {
  it('keeps its melody in the in-scale D E♭ G A B♭', () => {
    const allowed = new Set([2, 3, 7, 9, 10]);
    for (const pc of pcs(bars('menu').flat(), ['pluck', 'breath'])) expect(allowed.has(pc)).toBe(true);
  });

  it('has a drone pad from the first bar and shakuhachi only on long notes', () => {
    expect(notesForBar('menu', 0, NO_LAYERS).some((e) => e.voice === 'pad')).toBe(true);
    const breaths = bars('menu').flat().filter((e) => e.voice === 'breath');
    expect(breaths.length).toBeGreaterThan(0);
    for (const b of breaths) expect(b.len).toBeGreaterThanOrEqual(3);
  });
});

describe('map (upbeat adventure)', () => {
  it('stays in the yo pentatonic (arpeggios may add E)', () => {
    const allowed = new Set([0, 2, 4, 5, 7, 9]);
    for (const pc of pcs(bars('map').flat(), ['pluck', 'lead', 'arp'])) expect(allowed.has(pc)).toBe(true);
  });

  it('the melody enters after four bars of groove', () => {
    const lead = (bar: number) => notesForBar('map', bar, NO_LAYERS).filter((e) => e.voice === 'lead' || e.voice === 'pluck').length;
    for (let b = 0; b < 4; b++) expect(lead(b)).toBe(0);
    expect(lead(4)).toBeGreaterThan(0);
  });

  it('has a bass line, arpeggio, shaker and woodblock in every bar', () => {
    for (const evs of bars('map')) for (const v of ['bass', 'arp', 'hat', 'tick']) expect(evs.some((e) => e.voice === v)).toBe(true);
  });
});
