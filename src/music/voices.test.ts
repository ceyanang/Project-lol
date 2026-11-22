import { describe, expect, it } from 'vitest';
import { FakeAudioContext } from './fakeAudio';
import { createReverb, playEvent } from './voices';
import type { NoteEvent, Voice } from './score';

const VOICES: Voice[] = ['pluck', 'bell', 'breath', 'pad', 'bass', 'bassSq', 'arp', 'zap', 'lead', 'horn', 'stab', 'kick', 'snare', 'hat', 'openHat', 'tick', 'taiko'];

describe('playEvent', () => {
  for (const voice of VOICES) {
    it(`${voice}: builds its sound, starts it on time and always stops it`, () => {
      const ac = new FakeAudioContext();
      const ev: NoteEvent = { beat: 0, voice, midi: voice === 'kick' || voice === 'snare' || voice === 'hat' || voice === 'openHat' || voice === 'taiko' ? undefined : [57, 64], len: 2, gain: 0.5 };
      expect(() => playEvent(ac as unknown as AudioContext, ac.destination as unknown as AudioNode, ev, 3, 0.4)).not.toThrow();
      expect(ac.sources.length).toBeGreaterThan(0);
      for (const s of ac.sources) {
        expect(s.startedAt).not.toBeNull();
        expect(s.startedAt!).toBeGreaterThanOrEqual(3 - 1e-9);
        expect(s.stoppedAt, 'every source must be stopped so nothing leaks').not.toBeNull();
        expect(s.stoppedAt!).toBeGreaterThan(s.startedAt!);
        expect(s.stoppedAt! - 3).toBeLessThan(25); // long pads are fine, runaway tails are not
      }
    });
  }

  it('a chord starts one set of oscillators per pitch', () => {
    const one = new FakeAudioContext();
    const three = new FakeAudioContext();
    playEvent(one as unknown as AudioContext, one.destination as unknown as AudioNode, { beat: 0, voice: 'stab', midi: [60], len: 1, gain: 0.5 }, 0, 0.5);
    playEvent(three as unknown as AudioContext, three.destination as unknown as AudioNode, { beat: 0, voice: 'stab', midi: [60, 64, 67], len: 1, gain: 0.5 }, 0, 0.5);
    expect(three.sources.length).toBe(one.sources.length * 3);
  });
});

describe('createReverb', () => {
  it('builds an impulse of the requested length', () => {
    const ac = new FakeAudioContext();
    const r = createReverb(ac as unknown as AudioContext, 2) as unknown as { buffer: { length: number } };
    expect(r.buffer.length).toBe(ac.sampleRate * 2);
  });
});
