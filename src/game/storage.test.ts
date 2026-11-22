import { beforeEach, describe, expect, it } from 'vitest';
import { PROFILE_KEY, loadProfile, newProfile, saveProfile } from './storage';
import { recordAnswers } from './srs';

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  };
});

describe('storage', () => {
  it('round-trips SRS stats', () => {
    const p = { ...newProfile(), srs: recordAnswers({}, [{ id: 'か', correct: false }], 123) };
    saveProfile(p);
    const back = loadProfile();
    expect(back.srs['か'].missDebt).toBe(3);
    expect(back.srs['か'].lastSeen).toBe(123);
  });

  it('migrates the old unlockedCount to a list of groups', () => {
    mem.set(PROFILE_KEY, JSON.stringify({ version: 1, unlockedCount: 3, srs: {} }));
    expect(loadProfile().unlocked).toEqual(['h-a', 'h-ka', 'h-sa']);
  });

  it('keyboard setting defaults to the in-game keyboard and keeps "phone"', () => {
    expect(newProfile().settings.keyboard).toBe('game');
    mem.set(PROFILE_KEY, JSON.stringify({ version: 1, unlocked: ['h-a'], srs: {}, settings: { autoSpeak: true, sfx: true, keyboard: 'phone' } }));
    expect(loadProfile().settings.keyboard).toBe('phone');
    mem.set(PROFILE_KEY, JSON.stringify({ version: 1, unlocked: ['h-a'], srs: {}, settings: { keyboard: 'weird' } }));
    expect(loadProfile().settings.keyboard).toBe('game');
  });

  it('music defaults to on (also for saves made before it existed) and keeps an explicit off', () => {
    expect(newProfile().settings.music).toBe(true);
    mem.set(PROFILE_KEY, JSON.stringify({ version: 1, unlocked: ['h-a'], srs: {}, settings: { autoSpeak: true, sfx: true, keyboard: 'game' } }));
    expect(loadProfile().settings.music).toBe(true);
    mem.set(PROFILE_KEY, JSON.stringify({ version: 1, unlocked: ['h-a'], srs: {}, settings: { music: false } }));
    expect(loadProfile().settings.music).toBe(false);
  });

  it('falls back to a fresh profile on garbage', () => {
    mem.set(PROFILE_KEY, '{not json');
    expect(loadProfile()).toEqual(newProfile());
    mem.set(PROFILE_KEY, JSON.stringify({ version: 1, unlockedCount: 'x', srs: { か: 'bad' } }));
    const p = loadProfile();
    expect(p.unlocked).toEqual(['h-a']);
    expect(p.srs).toEqual({});
  });
});
