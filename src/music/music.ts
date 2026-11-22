import { CONFIG } from '../config';
import { getAudioContext } from '../game/sfx';
import { type Layers, type Scene, NO_LAYERS } from './scenes';
import { Scheduler } from './scheduler';
import { TRACKS } from './score';
import { createReverb, playEvent } from './voices';

/*
 * The music controller: one shared AudioContext, one master gain, one bus per playing scene so scenes
 * can crossfade. Requests made before the first user gesture (scene, layers, on/off) are remembered and
 * applied when startMusic() runs. Everything is a no-op without Web Audio.
 */

interface Playing {
  scene: Scene;
  bus: GainNode;
  send: GainNode;
}

const REVERB_SEND: Record<Scene, number> = { menu: 0.5, map: 0.25, battle: 0.12, boss: 0.4 };

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let scheduler: Scheduler | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let duckTimer: ReturnType<typeof setTimeout> | null = null;
let playing: Playing | null = null;
const reverbs = new Map<Scene, ConvolverNode>();

let started = false;
let enabled = true;
let wantScene: Scene | null = null;
let wantLayers: Layers = NO_LAYERS;

function reverbFor(scene: Scene): ConvolverNode {
  let r = reverbs.get(scene);
  if (!r) {
    r = createReverb(ac!, TRACKS[scene].reverb);
    r.connect(master!);
    reverbs.set(scene, r);
  }
  return r;
}

function fadeOut(run: Playing): void {
  const now = ac!.currentTime;
  const x = CONFIG.music.crossfadeMs / 1000;
  run.bus.gain.cancelScheduledValues(now);
  run.bus.gain.setTargetAtTime(0, now, x / 4);
  setTimeout(() => {
    run.bus.disconnect();
    run.send.disconnect();
  }, (x + 0.6) * 1000);
}

function stopTimer(): void {
  if (timer !== null) clearInterval(timer);
  timer = null;
}

function startTimer(): void {
  if (timer === null) timer = setInterval(() => scheduler?.tick(), CONFIG.music.tickMs);
}

/** Make what is playing match what was asked for. */
function reconcile(): void {
  if (!started || !ac || !master || !scheduler) return;
  const target = enabled ? wantScene : null;
  if (!target) {
    if (playing) fadeOut(playing);
    playing = null;
    scheduler.stop();
    stopTimer();
    return;
  }
  if (playing?.scene === target && scheduler.scene === target) return;

  const now = ac.currentTime;
  const x = CONFIG.music.crossfadeMs / 1000;
  if (playing) fadeOut(playing);
  const bus = ac.createGain();
  bus.gain.setValueAtTime(0.0001, now);
  bus.gain.linearRampToValueAtTime(1, now + x);
  const send = ac.createGain();
  send.gain.value = REVERB_SEND[target];
  bus.connect(master);
  bus.connect(send);
  send.connect(reverbFor(target));
  playing = { scene: target, bus, send };
  scheduler.start(target, wantLayers, now + 0.06);
  startTimer();
}

/** Call on the first user gesture (browsers refuse audio before one). Safe to call repeatedly. */
export function startMusic(): void {
  if (started) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  ac = ctx;
  master = ctx.createGain();
  master.gain.value = CONFIG.music.masterGain;
  analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  master.connect(analyser);
  analyser.connect(ctx.destination);
  scheduler = new Scheduler({
    now: () => ctx.currentTime,
    play: (ev, when, spb) => {
      if (playing) playEvent(ctx, playing.bus, ev, when, spb);
    },
    lookahead: CONFIG.music.lookaheadMs / 1000,
  });
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!started || !enabled || !ac) return;
      if (document.visibilityState === 'hidden') void ac.suspend();
      else void ac.resume();
    });
  }
  started = true;
  reconcile();
}

/**
 * Call on every user gesture until it returns true. Starts the music (once) and nudges the shared
 * context awake; returns true only once the browser really lets audio run. A touch `pointerdown` is not
 * a user activation on phones, so the first call may stay false and a later `pointerup`/`click` succeeds.
 */
export function onUserGesture(): boolean {
  startMusic();
  const ctx = getAudioContext(); // resumes the context if it is suspended (and the tab is visible)
  return started && !!ctx && ctx.state === 'running';
}

/** Which track plays (null = silence). Switching crossfades; asking for the playing scene again does nothing. */
export function setMusicScene(scene: Scene | null): void {
  wantScene = scene;
  reconcile();
}

/** Reactive layers; they take effect from the next bar. */
export function setMusicLayers(layers: Layers): void {
  wantLayers = layers;
  scheduler?.setLayers(layers);
}

export function setMusicEnabled(on: boolean): void {
  enabled = on;
  reconcile();
}

/** Dip the music for `seconds` (while a voice clip plays) so the reading stays clear. */
export function duckMusic(seconds: number): void {
  if (!ac || !master) return;
  const base = CONFIG.music.masterGain;
  const now = ac.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setTargetAtTime(base * CONFIG.music.duckGain, now, CONFIG.music.duckFadeMs / 3000);
  if (duckTimer !== null) clearTimeout(duckTimer);
  duckTimer = setTimeout(() => {
    if (ac && master) master.gain.setTargetAtTime(base, ac.currentTime, 0.12);
  }, seconds * 1000);
}

/** The scene currently being played (null when silent or not started). */
export function musicScene(): Scene | null {
  return playing?.scene ?? null;
}

/** RMS level of the music output in [0, 1]; -1 when music has not started. */
export function musicLevel(): number {
  if (!started || !analyser) return -1;
  const data = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(data);
  let sum = 0;
  for (const v of data) sum += v * v;
  return Math.sqrt(sum / data.length);
}
