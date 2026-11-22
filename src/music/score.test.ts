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

describe('battle (exciting)', () => {
  const hookOff = NO_LAYERS;
  const hookOn = { hook: true, enraged: false };

  it('is 156 bpm with a kick on every beat of every bar', () => {
    expect(barSeconds('battle', hookOff)).toBeCloseTo((4 * 60) / 156, 6);
    for (let bar = 0; bar < TRACKS.battle.bars; bar++) {
      const kicks = notesForBar('battle', bar, hookOff).filter((e) => e.voice === 'kick').map((e) => e.beat);
      expect(kicks).toEqual([0, 1, 2, 3]);
    }
  });

  it('has snares on 2 and 4, plus an eight-hit fill every fourth bar', () => {
    const snares = (bar: number) => notesForBar('battle', bar, hookOff).filter((e) => e.voice === 'snare');
    expect(snares(0).map((e) => e.beat)).toEqual([1, 3]);
    expect(snares(3)).toHaveLength(2 + 8);
  });

  it('the hook melody is a layer: present with hook on, absent with it off', () => {
    for (let bar = 0; bar < TRACKS.battle.bars; bar++) {
      expect(notesForBar('battle', bar, hookOff).some((e) => e.voice === 'lead')).toBe(false);
    }
    expect(notesForBar('battle', 0, hookOn).some((e) => e.voice === 'lead')).toBe(true);
  });

  it('is deterministic and wraps at 16 bars', () => {
    expect(notesForBar('battle', 16, hookOn)).toEqual(notesForBar('battle', 0, hookOn));
  });
});

describe('boss (dangerous)', () => {
  it('is faster than the 92 bpm sample, and faster again once enraged', () => {
    expect(barSeconds('boss', NO_LAYERS)).toBeCloseTo((4 * 60) / 126, 6);
    expect(barSeconds('boss', NO_LAYERS)).toBeLessThan((4 * 60) / 92);
    expect(barSeconds('boss', { hook: false, enraged: true })).toBeCloseTo((4 * 60) / 126 / 1.08, 6);
  });

  it('plays its horn melody in E phrygian over a taiko pulse', () => {
    const allowed = new Set([4, 5, 7, 9, 10, 11, 0, 2]);
    const all = Array.from({ length: TRACKS.boss.bars }, (_, i) => notesForBar('boss', i, NO_LAYERS)).flat();
    const horn = pcs(all, ['horn']);
    expect(horn.size).toBeGreaterThan(0);
    for (const pc of horn) expect(allowed.has(pc)).toBe(true);
    expect(notesForBar('boss', 0, NO_LAYERS).filter((e) => e.voice === 'taiko').length).toBeGreaterThanOrEqual(2);
  });

  it('enraged adds more taiko and an extra drone note in every bar', () => {
    for (let bar = 0; bar < TRACKS.boss.bars; bar++) {
      const calm = notesForBar('boss', bar, NO_LAYERS);
      const mad = notesForBar('boss', bar, { hook: false, enraged: true });
      expect(mad.filter((e) => e.voice === 'taiko').length).toBeGreaterThan(calm.filter((e) => e.voice === 'taiko').length);
    }
    const padNotes = (l: { hook: boolean; enraged: boolean }) => notesForBar('boss', 0, l).filter((e) => e.voice === 'pad').flatMap((e) => e.midi ?? []).length;
    expect(padNotes({ hook: false, enraged: true })).toBeGreaterThan(padNotes(NO_LAYERS));
  });
});
