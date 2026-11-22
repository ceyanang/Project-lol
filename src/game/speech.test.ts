import { afterEach, describe, expect, it, vi } from 'vitest';

async function load() {
  vi.resetModules();
  const duckMusic = vi.fn();
  vi.doMock('../music/music', () => ({ duckMusic }));
  const speak = vi.fn();
  class Utterance { lang = ''; rate = 1; volume = 1; voice: unknown = null; constructor(public text: string) {} }
  vi.stubGlobal('window', { speechSynthesis: { speaking: false, pending: false, speak, cancel: vi.fn(), getVoices: () => [] } });
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
  const mod = await import('./speech');
  return { mod, duckMusic, speak };
}

afterEach(() => {
  vi.doUnmock('../music/music');
  vi.unstubAllGlobals();
});

describe('device voice and music', () => {
  it('ducks the music when the device voice reads something (whole words and unloaded kana)', async () => {
    const { mod, duckMusic, speak } = await load();
    mod.speak('ねこ');
    expect(speak).toHaveBeenCalledTimes(1);
    expect(duckMusic).toHaveBeenCalledWith(expect.any(Number));
    expect(duckMusic.mock.calls[0][0]).toBeGreaterThanOrEqual(1);
  });

  it('the silent first-tap warm-up does not duck the music', async () => {
    const { mod, duckMusic } = await load();
    mod.warmUpSpeech();
    expect(duckMusic).not.toHaveBeenCalled();
  });
});
