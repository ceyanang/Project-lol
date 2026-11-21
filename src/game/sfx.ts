/**
 * Tiny synthesized sound effects (Web Audio API). No audio files, so they work offline.
 * Side-effect module: only UI code calls it.
 */

export type Sfx =
  | 'tap'
  | 'select'
  | 'correct'
  | 'wrong'
  | 'hit'
  | 'hurt'
  | 'block'
  | 'combo'
  | 'buff'
  | 'victory'
  | 'defeat'
  | 'unlock'
  | 'step'
  | 'pickup'
  | 'heal';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

export function setSfxEnabled(on: boolean) {
  enabled = on;
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
  }
  // browsers start the context suspended until a user gesture
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface ToneOpts {
  freq: number;
  to?: number;
  dur: number;
  type?: OscillatorType;
  at?: number;
  vol?: number;
}

function tone(ac: AudioContext, { freq, to, dur, type = 'sine', at = 0, vol = 1 }: ToneOpts) {
  const t0 = ac.currentTime + at;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master!);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(ac: AudioContext, { dur, at = 0, vol = 1, cutoff = 1200 }: { dur: number; at?: number; vol?: number; cutoff?: number }) {
  const t0 = ac.currentTime + at;
  const len = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g).connect(master!);
  src.start(t0);
}

const arp = (ac: AudioContext, freqs: number[], step: number, type: OscillatorType = 'triangle', vol = 0.7) =>
  freqs.forEach((f, i) => tone(ac, { freq: f, dur: step * 1.8, type, at: i * step, vol }));

export function playSfx(name: Sfx) {
  if (!enabled) return;
  try {
    const ac = audio();
    if (!ac || !master) return;
    switch (name) {
      case 'tap':
        tone(ac, { freq: 700, dur: 0.035, type: 'square', vol: 0.25 });
        break;
      case 'select':
        tone(ac, { freq: 520, to: 780, dur: 0.07, type: 'triangle', vol: 0.5 });
        break;
      case 'correct':
        tone(ac, { freq: 880, dur: 0.09, type: 'sine', vol: 0.6 });
        tone(ac, { freq: 1320, dur: 0.14, type: 'sine', at: 0.07, vol: 0.6 });
        break;
      case 'wrong':
        tone(ac, { freq: 220, to: 120, dur: 0.28, type: 'sawtooth', vol: 0.45 });
        break;
      case 'hit':
        noise(ac, { dur: 0.12, vol: 0.9, cutoff: 1800 });
        tone(ac, { freq: 160, to: 60, dur: 0.14, type: 'square', vol: 0.5 });
        break;
      case 'hurt':
        noise(ac, { dur: 0.2, vol: 0.9, cutoff: 700 });
        tone(ac, { freq: 130, to: 55, dur: 0.25, type: 'sawtooth', vol: 0.5 });
        break;
      case 'block':
        tone(ac, { freq: 1200, dur: 0.08, type: 'triangle', vol: 0.45 });
        tone(ac, { freq: 1800, dur: 0.1, type: 'triangle', at: 0.02, vol: 0.3 });
        break;
      case 'combo':
        arp(ac, [523, 659, 784, 1047], 0.06);
        break;
      case 'buff':
        tone(ac, { freq: 180, to: 420, dur: 0.3, type: 'sawtooth', vol: 0.3 });
        break;
      case 'victory':
        arp(ac, [523, 659, 784, 1047, 1319], 0.09, 'triangle', 0.6);
        break;
      case 'defeat':
        arp(ac, [392, 330, 262, 196], 0.16, 'sawtooth', 0.3);
        break;
      case 'unlock':
        arp(ac, [784, 988, 1175, 1568, 1976], 0.07, 'sine', 0.5);
        break;
      case 'step':
        tone(ac, { freq: 440, to: 520, dur: 0.06, type: 'triangle', vol: 0.4 });
        break;
      case 'pickup':
        tone(ac, { freq: 784, dur: 0.08, type: 'square', vol: 0.25 });
        tone(ac, { freq: 1175, dur: 0.14, type: 'square', at: 0.07, vol: 0.25 });
        break;
      case 'heal':
        tone(ac, { freq: 392, to: 784, dur: 0.45, type: 'sine', vol: 0.5 });
        break;
    }
  } catch {
    // audio is a nicety; never break the game over it
  }
}
