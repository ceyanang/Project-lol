import { CONFIG } from '../config';
import { type Layers, type Scene, NO_LAYERS } from './scenes';

export { NO_LAYERS };

export type Voice =
  | 'pluck' | 'bell' | 'breath' | 'pad' | 'bass' | 'bassSq' | 'arp' | 'zap' | 'lead' | 'horn' | 'stab'
  | 'kick' | 'snare' | 'hat' | 'openHat' | 'tick' | 'taiko';

/** One note or hit. `beat` is within the bar [0, 4); `len` is in beats and may span bars; `midi` is a pitch or chord. */
export interface NoteEvent {
  beat: number;
  voice: Voice;
  midi?: number[];
  len: number;
  gain: number;
}

export interface TrackDef {
  bpm: number;
  bars: number;
  /** Reverb tail in seconds. */
  reverb: number;
}

export const TRACKS: Record<Scene, TrackDef> = {
  menu: { bpm: CONFIG.music.bpm.menu, bars: 12, reverb: 3.2 },
  map: { bpm: CONFIG.music.bpm.map, bars: 16, reverb: 1.6 },
  battle: { bpm: CONFIG.music.bpm.battle, bars: 16, reverb: 0.8 },
  boss: { bpm: CONFIG.music.bpm.boss, bars: 12, reverb: 2.0 },
};

/** Seconds in one 4-beat bar (the boss gets faster once enraged). */
export function barSeconds(scene: Scene, layers: Layers): number {
  const tempo = scene === 'boss' && layers.enraged ? CONFIG.music.enragedTempo : 1;
  return ((4 * 60) / TRACKS[scene].bpm) / tempo;
}

const ev = (beat: number, voice: Voice, midi: number | number[] | undefined, len: number, gain: number): NoteEvent => ({
  beat,
  voice,
  midi: midi === undefined ? undefined : Array.isArray(midi) ? midi : [midi],
  len,
  gain,
});

/** Events of `list` ([absolute beat, ...]) that fall inside bar `bar` (4 beats), re-based to the bar. */
const inBar = (bar: number, list: [number, Voice, number | number[] | undefined, number, number][]): NoteEvent[] =>
  list.filter(([b]) => b >= bar * 4 && b < bar * 4 + 4).map(([b, v, m, l, g]) => ev(b - bar * 4, v, m, l, g));

// ---------------------------------------------------------------- menu: zen, in-scale D Eb G A Bb, 54 bpm

const D = 62, EB = 63, G = 67, A = 69, BB = 70;
const MENU_MELODY: [number, number, number][] = [
  [0, D + 12, 2], [2, A, 1], [3, G, 1], [4, BB, 2], [6, A, 1], [7, G, 1],
  [8, D + 12, 1.5], [9.5, EB + 12, 0.5], [10, D + 12, 1], [11, BB, 1], [12, A, 3.5],
  [16, G, 1], [17, A, 1], [18, BB, 2], [20, D + 12, 2], [22, EB + 12, 1], [23, D + 12, 1],
  [24, A, 1.5], [25.5, G, 0.5], [26, D, 2.5],
  [32, D + 12, 2], [34, BB, 1], [35, A, 1], [36, G, 2], [38, A, 2], [40, BB, 1], [41, D + 12, 1], [42, EB + 12, 2], [44, D + 12, 3],
];
const MENU_BREATH: [number, number, number][] = [[12, A + 12, 3.4], [24, D + 12, 4.2], [44, D + 12, 5]];
const MENU_BELLS: [number, number][] = [[6.5, 86], [15.5, 88], [27, 91], [37.5, 86], [45, 93]];

function menuBar(bar: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  if (bar % 4 === 0) out.push(ev(0, 'pad', [38, 45, 50], 17, 0.5)); // overlaps the next one a little so the drone never drops
  out.push(...inBar(bar, MENU_MELODY.map(([b, n, l]) => [b, 'pluck', n, Math.min(3.2, l + 1.8), 0.5] as [number, Voice, number, number, number])));
  for (let b = 0; b < 48; b += 8) out.push(...inBar(bar, [[b, 'pluck', 50, 4, 0.55], [b + 4, 'pluck', 45, 4, 0.4]]));
  out.push(...inBar(bar, MENU_BREATH.map(([b, n, l]) => [b, 'breath', n, l, 0.35] as [number, Voice, number, number, number])));
  out.push(...inBar(bar, MENU_BELLS.map(([b, n]) => [b, 'bell', n, 1.6, 0.22] as [number, Voice, number, number, number])));
  return out;
}

// ---------------------------------------------------------------- map: calm but upbeat, yo pentatonic, 112 bpm

const MAP_PROG: [number, number[]][] = [[48, [60, 62, 67]], [43, [55, 62, 67]], [45, [57, 60, 64]], [41, [53, 57, 60]]];
const MAP_MEL: (number | null)[][] = [
  [72, 74, 79, 79, 81, 79, 74, 72], [74, 79, 81, 79, 74, 79, 76, 74], [72, 76, 81, 81, 79, 76, 72, null], [77, 77, 81, 79, 77, 74, 72, 74],
];
const MAP_MEL2: (number | null)[][] = [
  [79, 81, 84, 81, 79, 74, 76, 79], [81, 79, 74, 79, 81, 86, 84, 81], [84, 81, 79, 76, 72, 76, 79, 81], [77, 81, 84, 81, 79, 77, 74, 72],
];

function mapBar(bar: number): NoteEvent[] {
  const [root, chord] = MAP_PROG[bar % 4];
  const out: NoteEvent[] = [];
  for (let i = 0; i < 8; i++) out.push(ev(i / 2, 'bass', i % 4 === 2 ? root + 7 : root, 0.45, 0.5));
  for (let i = 0; i < 16; i++) out.push(ev(i / 4, 'arp', chord[i % 3] + 12, 0.22, 0.1));
  if (bar >= 4) {
    const mel = (bar >= 12 ? MAP_MEL2 : MAP_MEL)[bar % 4];
    mel.forEach((n, i) => {
      if (n === null) return;
      out.push(ev(i / 2, 'pluck', n, 0.9, 0.5), ev(i / 2, 'lead', n, 0.4, 0.12));
    });
  }
  for (let i = 0; i < 8; i++) out.push(ev(i / 2 + 0.25, 'hat', undefined, 0.1, 0.35));
  out.push(ev(1, 'tick', 81, 0.1, 0.5), ev(3, 'tick', 86, 0.1, 0.5));
  if (bar % 2 === 0) out.push(ev(0, 'kick', undefined, 0.3, 0.45));
  return out;
}

// ---------------------------------------------------------------- battle: exciting, A minor, 156 bpm

const BATTLE_PROG: [number, number[]][] = [[45, [69, 72, 76, 72]], [43, [67, 71, 74, 71]], [41, [65, 69, 72, 69]], [40, [64, 68, 71, 68]]];
const BATTLE_HOOK: (number | null)[][] = [
  [81, null, 79, 81, 84, null, 81, 79], [79, null, 76, 79, 83, null, 79, 76], [77, null, 76, 77, 81, null, 77, 76], [76, null, 76, 80, 83, null, 80, 76],
];

function battleBar(bar: number, layers: Layers): NoteEvent[] {
  const [root, arp] = BATTLE_PROG[bar % 4];
  const out: NoteEvent[] = [];
  for (let i = 0; i < 8; i++) out.push(ev(i / 2, 'bassSq', root, 0.42, 0.5));
  for (let i = 0; i < 16; i++) out.push(ev(i / 4, 'zap', arp[i % 4], 0.2, 0.16));
  for (let beat = 0; beat < 4; beat++) out.push(ev(beat, 'kick', undefined, 0.3, 0.9));
  for (const beat of [1, 3]) out.push(ev(beat, 'snare', undefined, 0.2, 0.7));
  for (let i = 0; i < 8; i++) out.push(ev(i / 2 + 0.25, i === 7 ? 'openHat' : 'hat', undefined, 0.15, 0.45));
  if (layers.hook) {
    BATTLE_HOOK[bar % 4].forEach((n, i) => {
      if (n === null) return;
      out.push(ev(i / 2, 'lead', n, 0.45, 0.32), ev(i / 2, 'bass', n - 12, 0.45, 0.1));
    });
  }
  if (bar % 4 === 3) for (let i = 0; i < 8; i++) out.push(ev(3 + i / 8, 'snare', undefined, 0.15, 0.25 + 0.05 * i)); // fill
  return out;
}

// ---------------------------------------------------------------- boss: dangerous, E phrygian, 126 bpm

const BOSS_HORN: [number, number, number][] = [
  [0, 52, 2], [2, 53, 1], [3, 52, 1], [4, 55, 2], [6, 53, 1], [7, 52, 1], [8, 58, 2], [10, 57, 1], [11, 55, 1], [12, 53, 2], [14, 52, 2],
  [16, 52, 1], [17, 53, 1], [18, 55, 2], [20, 58, 2], [22, 59, 2], [24, 57, 1], [25, 55, 1], [26, 53, 2], [28, 52, 4],
];

function bossBar(bar: number, layers: Layers): NoteEvent[] {
  const out: NoteEvent[] = [];
  if (bar % 4 === 0) out.push(ev(0, 'pad', layers.enraged ? [28, 40, 46, 52, 34] : [28, 40, 46, 52], 17, 0.5)); // E and Bb: the tritone
  out.push(...inBar(bar, BOSS_HORN.map(([b, n, l]) => [b, 'horn', n, l, 0.5] as [number, Voice, number, number, number])));
  out.push(ev(0, 'taiko', undefined, 0.7, 0.9), ev(2, 'taiko', undefined, 0.7, 0.72));
  if (bar % 4 === 3) for (let i = 0; i < 12; i++) out.push(ev(2 + i / 6, 'taiko', undefined, 0.3, 0.3 + 0.03 * i)); // roll into the next phrase
  if (bar % 2 === 1) out.push(ev(3.5, 'stab', [64, 65, 71], 0.35, 0.5));
  for (let i = 0; i < 4; i++) out.push(ev(i + 0.5, 'hat', undefined, 0.1, 0.2));
  if (bar === 2 || bar === 6 || bar === 10) out.push(ev(2, 'breath', 76, 3, 0.4));
  if (layers.enraged) for (let i = 0; i < 4; i++) out.push(ev(1 + i / 4, 'taiko', undefined, 0.2, 0.4)); // extra 16th roll
  return out;
}

/** The note events of one bar of a scene's track (bar wraps around the track length). */
export function notesForBar(scene: Scene, bar: number, layers: Layers): NoteEvent[] {
  const n = bar % TRACKS[scene].bars;
  switch (scene) {
    case 'menu':
      return menuBar(n);
    case 'map':
      return mapBar(n);
    case 'battle':
      return battleBar(n, layers);
    case 'boss':
      return bossBar(n, layers);
  }
}
