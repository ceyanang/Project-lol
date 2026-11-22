import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeAudioContext } from './fakeAudio';

type MusicApi = typeof import('./music');

/** Fresh module state (and a fresh fake AudioContext) for every test. */
async function setup() {
  vi.resetModules();
  const listeners: Record<string, () => void> = {};
  const doc = { visibilityState: 'visible', addEventListener: (n: string, f: () => void) => (listeners[n] = f) };
  vi.stubGlobal('window', { AudioContext: FakeAudioContext });
  vi.stubGlobal('document', doc);
  const sfx = await import('../game/sfx');
  const music: MusicApi = await import('./music');
  const ac = sfx.getAudioContext() as unknown as FakeAudioContext;
  /** Advance the audio clock and let the scheduler timer fire for `seconds`. */
  const run = (seconds: number) => {
    for (let t = 0; t < seconds; t += 0.025) {
      ac.currentTime += 0.025;
      vi.advanceTimersByTime(25);
    }
  };
  return { music, ac, doc, listeners, run, sfx };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('without Web Audio', () => {
  it('every call is safe in any order and the level reads -1', async () => {
    vi.resetModules();
    vi.stubGlobal('window', {});
    const m: MusicApi = await import('./music');
    expect(() => {
      m.setMusicScene('map');
      m.setMusicLayers({ hook: true, enraged: false });
      m.setMusicEnabled(false);
      m.setMusicEnabled(true);
      m.duckMusic(1);
      m.startMusic();
      m.startMusic();
    }).not.toThrow();
    expect(m.musicLevel()).toBe(-1);
    expect(m.musicScene()).toBeNull();
  });
});

describe('before the first gesture', () => {
  it('nothing plays and the level is -1, even if a scene was requested', async () => {
    const { music, ac, run } = await setup();
    music.setMusicScene('map');
    run(1);
    expect(ac.sources).toHaveLength(0);
    expect(music.musicLevel()).toBe(-1);
  });

  it('a scene requested earlier starts playing once music starts', async () => {
    const { music, ac, run } = await setup();
    music.setMusicScene('map');
    music.startMusic();
    run(0.5);
    expect(ac.sources.length).toBeGreaterThan(0);
    expect(music.musicScene()).toBe('map');
  });
});

describe('mute', () => {
  it('turning music off silences it, and turning it on resumes the current scene', async () => {
    const { music, ac, run } = await setup();
    music.startMusic();
    music.setMusicScene('battle');
    run(0.5);
    music.setMusicEnabled(false);
    expect(music.musicScene()).toBeNull();
    const n = ac.sources.length;
    run(2);
    expect(ac.sources.length).toBe(n);
    music.setMusicEnabled(true);
    run(0.5);
    expect(ac.sources.length).toBeGreaterThan(n);
    expect(music.musicScene()).toBe('battle');
  });

  it('a scene requested while muted waits until music is turned on', async () => {
    const { music, ac, run } = await setup();
    music.startMusic();
    music.setMusicEnabled(false);
    music.setMusicScene('menu');
    run(1);
    expect(ac.sources).toHaveLength(0);
    music.setMusicEnabled(true);
    run(0.5);
    expect(music.musicScene()).toBe('menu');
  });
});

describe('scene changes', () => {
  it('rapid changes end up on the last scene only, and the same scene is not restarted', async () => {
    const { music, ac, run } = await setup();
    music.startMusic();
    music.setMusicScene('menu');
    music.setMusicScene('map');
    music.setMusicScene('battle');
    run(0.3);
    expect(music.musicScene()).toBe('battle');
    const n = ac.sources.length;
    music.setMusicScene('battle'); // already playing: no restart
    run(0.025);
    expect(ac.sources.length - n).toBeLessThan(40); // no fresh bar 0 burst
    music.setMusicScene(null);
    expect(music.musicScene()).toBeNull();
  });
});

describe('tab visibility', () => {
  it('suspends the context when hidden and resumes it when visible', async () => {
    const { music, ac, doc, listeners } = await setup();
    music.startMusic();
    music.setMusicScene('menu');
    doc.visibilityState = 'hidden';
    listeners.visibilitychange();
    expect(ac.state).toBe('suspended');
    doc.visibilityState = 'visible';
    listeners.visibilitychange();
    expect(ac.state).toBe('running');
  });
});

describe('ducking', () => {
  it('is safe before and after start', async () => {
    const { music } = await setup();
    expect(() => music.duckMusic(0.5)).not.toThrow();
    music.startMusic();
    expect(() => music.duckMusic(0.5)).not.toThrow();
  });
});

describe('review fixes', () => {
  it('a sound effect or voice clip while hidden does not un-suspend the context', async () => {
    const { music, ac, doc, listeners, sfx } = await setup();
    music.startMusic();
    music.setMusicScene('menu');
    doc.visibilityState = 'hidden';
    listeners.visibilitychange();
    expect(ac.state).toBe('suspended');
    sfx.getAudioContext(); // what playSfx and speakKana do (enemy beats keep firing in the background)
    expect(ac.state).toBe('suspended');
    doc.visibilityState = 'visible';
    listeners.visibilitychange();
    expect(ac.state).toBe('running');
  });

  it('onUserGesture keeps asking until the browser actually lets audio run', async () => {
    const { music, ac, run } = await setup();
    ac.state = 'suspended';
    ac.autoResume = false; // the first touch event is not a user activation
    expect(music.onUserGesture()).toBe(false);
    expect(ac.state).toBe('suspended');
    ac.state = 'running'; // a later event (pointerup / click) is
    expect(music.onUserGesture()).toBe(true);
    music.setMusicScene('menu');
    run(0.5);
    expect(music.musicScene()).toBe('menu');
  });

  it('onUserGesture is false without Web Audio', async () => {
    vi.resetModules();
    vi.stubGlobal('window', {});
    const m: MusicApi = await import('./music');
    expect(m.onUserGesture()).toBe(false);
  });
});
