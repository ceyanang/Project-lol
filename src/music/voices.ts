import type { NoteEvent } from './score';

const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const FLOOR = 0.0001;

// ---------------------------------------------------------------- shared buffers and waves (cached per context)

const waves = new WeakMap<AudioContext, Map<string, PeriodicWave>>();
const noises = new WeakMap<AudioContext, AudioBuffer>();

function periodic(ac: AudioContext, key: string, harmonic: (k: number) => number): PeriodicWave {
  let m = waves.get(ac);
  if (!m) waves.set(ac, (m = new Map()));
  let w = m.get(key);
  if (!w) {
    const real = new Float32Array(33);
    const imag = new Float32Array(33);
    for (let k = 1; k <= 32; k++) {
      if (key.startsWith('pulse')) real[k] = harmonic(k);
      else imag[k] = harmonic(k);
    }
    w = ac.createPeriodicWave(real, imag);
    m.set(key, w);
  }
  return w;
}

/** A pulse wave of the given duty (0.5 = square). */
const pulse = (ac: AudioContext, duty: number) => periodic(ac, `pulse${duty}`, (k) => (2 / (k * Math.PI)) * Math.sin(Math.PI * k * duty));
/** A koto-ish pluck: a handful of harmonics falling off as 1/k. */
const pluckWave = (ac: AudioContext) => periodic(ac, 'pluck', (k) => (k <= 8 ? 1 / k ** 1.15 : 0));

function noiseBuffer(ac: AudioContext): AudioBuffer {
  let b = noises.get(ac);
  if (!b) {
    b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noises.set(ac, b);
  }
  return b;
}

// ---------------------------------------------------------------- building blocks

/** A gain node into `out` that jumps up (`attack`) and decays exponentially to silence at `stopAt`. */
function pluckEnv(ac: AudioContext, out: AudioNode, when: number, peak: number, stopAt: number, attack = 0.003): GainNode {
  const g = ac.createGain();
  g.gain.setValueAtTime(FLOOR, when);
  g.gain.exponentialRampToValueAtTime(Math.max(FLOOR * 2, peak), when + attack);
  g.gain.exponentialRampToValueAtTime(FLOOR, stopAt);
  g.connect(out);
  return g;
}

/** A gain node that fades in over `attack`, holds until `holdUntil`, then fades out over `release`. */
function sustainEnv(ac: AudioContext, out: AudioNode, when: number, peak: number, attack: number, holdUntil: number, release: number): GainNode {
  const g = ac.createGain();
  g.gain.setValueAtTime(FLOOR, when);
  g.gain.exponentialRampToValueAtTime(Math.max(FLOOR * 2, peak), when + attack);
  g.gain.setValueAtTime(Math.max(FLOOR * 2, peak), Math.max(holdUntil, when + attack));
  g.gain.exponentialRampToValueAtTime(FLOOR, Math.max(holdUntil, when + attack) + release);
  g.connect(out);
  return g;
}

function osc(ac: AudioContext, dest: AudioNode, type: OscillatorType | PeriodicWave, freq: number, when: number, stopAt: number, cents = 0): OscillatorNode {
  const o = ac.createOscillator();
  if (typeof type === 'string') o.type = type as OscillatorType;
  else o.setPeriodicWave(type as PeriodicWave);
  o.frequency.setValueAtTime(freq, when);
  if (cents) o.detune.setValueAtTime(cents, when);
  o.connect(dest);
  o.start(when);
  o.stop(stopAt);
  return o;
}

function noise(ac: AudioContext, dest: AudioNode, when: number, dur: number): void {
  const s = ac.createBufferSource();
  s.buffer = noiseBuffer(ac);
  s.connect(dest);
  s.start(when);
  s.stop(when + dur);
}

function filter(ac: AudioContext, out: AudioNode, type: BiquadFilterType, freq: number): BiquadFilterNode {
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.connect(out);
  return f;
}

// ---------------------------------------------------------------- voices

/** Build and start the sound for one event at audio-clock time `when`. Every source is stopped on its own. */
export function playEvent(ac: AudioContext, out: AudioNode, ev: NoteEvent, when: number, secondsPerBeat: number): void {
  const dur = ev.len * secondsPerBeat;
  const pitches = ev.midi ?? [];
  const g = ev.gain;

  switch (ev.voice) {
    case 'pluck':
      for (const m of pitches) {
        const stop = when + Math.min(3.5, dur + 1.2);
        osc(ac, pluckEnv(ac, out, when, g * 0.6, stop, 0.002), pluckWave(ac), hz(m), when, stop + 0.02);
        noise(ac, pluckEnv(ac, out, when, g * 0.12, when + 0.012, 0.001), when, 0.014);
      }
      break;

    case 'bell':
      for (const m of pitches) {
        [[1, 1, 1.6], [2.76, 0.5, 0.9], [5.4, 0.25, 0.5]].forEach(([ratio, amp, life]) => {
          osc(ac, pluckEnv(ac, out, when, g * amp * 0.7, when + life, 0.002), 'sine', hz(m) * ratio, when, when + life + 0.02);
        });
      }
      break;

    case 'breath':
      for (const m of pitches) {
        const f = hz(m);
        const stop = when + dur + 0.6;
        const env = sustainEnv(ac, out, when, g * 0.5, 0.25, when + dur, 0.5);
        const o = osc(ac, env, 'sine', f, when, stop);
        osc(ac, env, 'sine', f * 2, when, stop);
        const vib = ac.createGain();
        vib.gain.value = f * 0.004;
        vib.connect(o.frequency);
        osc(ac, vib, 'sine', 5, when, stop);
        noise(ac, filter(ac, sustainEnv(ac, out, when, g * 0.18, 0.25, when + dur, 0.5), 'lowpass', 3500), when, dur + 0.6);
      }
      break;

    case 'pad': {
      const stop = when + dur + 1.1;
      const env = sustainEnv(ac, out, when, g * 0.12, 1.0, when + dur, 1.0);
      const lp = filter(ac, env, 'lowpass', 420);
      for (const m of pitches) {
        osc(ac, lp, 'sawtooth', hz(m), when, stop, -5);
        osc(ac, lp, 'sawtooth', hz(m), when, stop, 5);
      }
      break;
    }

    case 'bass':
      for (const m of pitches) osc(ac, pluckEnv(ac, out, when, g * 0.8, when + Math.max(dur, 0.12) + 0.1, 0.005), 'triangle', hz(m), when, when + Math.max(dur, 0.12) + 0.12);
      break;

    case 'bassSq':
      for (const m of pitches) {
        const stop = when + dur + 0.1;
        const lp = filter(ac, pluckEnv(ac, out, when, g * 0.7, stop, 0.004), 'lowpass', 900);
        osc(ac, lp, pulse(ac, 0.5), hz(m), when, stop + 0.02);
        osc(ac, lp, 'sawtooth', hz(m - 12), when, stop + 0.02);
      }
      break;

    case 'arp':
    case 'zap':
    case 'lead': {
      const duty = ev.voice === 'zap' ? 0.125 : 0.25;
      for (const m of pitches) {
        const stop = when + Math.max(dur, 0.05) + (ev.voice === 'lead' ? 0.12 : 0.05);
        osc(ac, pluckEnv(ac, out, when, g * 0.7, stop, 0.003), pulse(ac, duty), hz(m), when, stop + 0.02);
      }
      break;
    }

    case 'horn':
      for (const m of pitches) {
        const stop = when + dur + 0.2;
        const lp = filter(ac, sustainEnv(ac, out, when, g * 0.5, 0.04, when + dur, 0.1), 'lowpass', 1400);
        osc(ac, lp, 'sawtooth', hz(m), when, stop);
        osc(ac, lp, 'sawtooth', hz(m), when, stop, 7);
        osc(ac, lp, pulse(ac, 0.5), hz(m - 12), when, stop);
      }
      break;

    case 'stab':
      for (const m of pitches) {
        const stop = when + 0.4;
        const lp = filter(ac, pluckEnv(ac, out, when, g * 0.5, stop, 0.005), 'lowpass', 2500);
        osc(ac, lp, 'sawtooth', hz(m), when, stop + 0.02);
      }
      break;

    case 'kick': {
      const o = osc(ac, pluckEnv(ac, out, when, g, when + 0.22, 0.002), 'sine', 135, when, when + 0.24);
      o.frequency.exponentialRampToValueAtTime(45, when + 0.12);
      break;
    }

    case 'taiko': {
      const o = osc(ac, pluckEnv(ac, out, when, g, when + 0.7, 0.003), 'sine', 113, when, when + 0.72);
      o.frequency.exponentialRampToValueAtTime(38, when + 0.35);
      noise(ac, filter(ac, pluckEnv(ac, out, when, g * 0.6, when + 0.08, 0.002), 'lowpass', 400), when, 0.1);
      break;
    }

    case 'snare':
      noise(ac, filter(ac, pluckEnv(ac, out, when, g * 0.7, when + 0.16, 0.002), 'highpass', 1200), when, 0.18);
      osc(ac, pluckEnv(ac, out, when, g * 0.5, when + 0.1, 0.002), 'sine', 190, when, when + 0.12);
      break;

    case 'hat':
    case 'openHat': {
      const life = ev.voice === 'openHat' ? 0.09 : 0.035;
      noise(ac, filter(ac, pluckEnv(ac, out, when, g * 0.5, when + life, 0.001), 'highpass', 7000), when, life + 0.02);
      break;
    }

    case 'tick':
      osc(ac, pluckEnv(ac, out, when, g * 0.7, when + 0.05, 0.001), 'sine', hz(pitches[0] ?? 81), when, when + 0.07);
      break;
  }
}

/** A generated reverb tail (decaying noise) for a ConvolverNode send. */
export function createReverb(ac: AudioContext, seconds: number): ConvolverNode {
  const len = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.5;
  }
  const c = ac.createConvolver();
  c.buffer = buf;
  return c;
}
