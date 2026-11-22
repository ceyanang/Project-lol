import { describe, expect, it } from 'vitest';
import { MIN_STUDY_READINGS, canSwitchOff, distinctReadings, firstGroups, latestGroups, studyGroups, studyKanaIds, unlockedKanaIds } from '../data';
import { createBattle } from './battle';
import { makeCard } from './deck';
import { seeded } from './rng';
import { runCtx } from './run';
import { newProfile } from './storage';
import { ENEMY_BY_ID } from '../data';

const unlocked = ['h-a', 'h-ka', 'h-sa', 'k-a', 'k-ka'];

describe('study focus', () => {
  it('switched-off groups are left out of the pool; new unlocks default on', () => {
    expect(studyGroups(unlocked, ['h-ka'])).toEqual(['h-a', 'h-sa', 'k-a', 'k-ka']);
    expect(studyKanaIds(unlocked, ['k-a', 'k-ka'])).toEqual(unlockedKanaIds(['h-a', 'h-ka', 'h-sa']));
    expect(studyGroups([...unlocked, 'h-ta'], ['h-ka'])).toContain('h-ta');
  });

  it('never leaves fewer sounds than a turn needs', () => {
    expect(canSwitchOff(['h-a', 'h-ka'], [], 'h-a')).toBe(true); // か row alone = 5 sounds
    expect(canSwitchOff(['h-a', 'h-ka'], ['h-a'], 'h-ka')).toBe(false); // nothing left
    expect(canSwitchOff(['h-a', 'h-wa'], [], 'h-a')).toBe(false); // わ row has only 3 sounds
    // a bad save (everything off) falls back to everything unlocked
    expect(studyGroups(['h-a', 'h-ka'], ['h-a', 'h-ka'])).toEqual(['h-a', 'h-ka']);
    expect(distinctReadings(studyKanaIds(['h-a', 'h-ka'], ['h-a']))).toBeGreaterThanOrEqual(MIN_STUDY_READINGS);
  });

  it('katakana and hiragana share sounds, so katakana-only is still enough', () => {
    expect(distinctReadings(unlockedKanaIds(['k-a']))).toBe(5);
  });

  it('latest rows picks the newest groups until there are enough sounds', () => {
    const l = latestGroups(['h-a', 'h-ka', 'h-sa', 'h-ta', 'words']);
    expect(l).toEqual(['h-ta', 'h-sa']);
  });

  it('battles only label moves with studied kana', () => {
    const profile = { ...newProfile(), unlocked: firstGroups(3), studyOff: ['h-a', 'h-sa'] };
    const ctx = runCtx(profile, seeded(1), () => 1);
    expect(ctx.unlocked).toEqual(unlockedKanaIds(['h-ka']));
    for (let seed = 1; seed < 30; seed++) {
      const b = createBattle({ enemy: ENEMY_BY_ID.kodama, floor: 1, deck: ['strike', 'guard', 'strike', 'guard'].map(makeCard), hp: 70, maxHp: 70, relics: [], ctx: { ...ctx, rng: seeded(seed) } });
      for (const s of b.slots) expect(s.label.kana.every((k) => ctx.unlocked.includes(k))).toBe(true);
    }
  });

  it('is saved with the profile and ignores unknown ids', async () => {
    const mem = new Map<string, string>();
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
      clear: () => mem.clear(),
      key: () => null,
      length: 0,
    };
    const { PROFILE_KEY, loadProfile } = await import('./storage');
    mem.set(PROFILE_KEY, JSON.stringify({ version: 1, unlocked: ['h-a', 'h-ka'], studyOff: ['h-ka', 'nope', 7], srs: {} }));
    expect(loadProfile().studyOff).toEqual(['h-ka']);
    mem.set(PROFILE_KEY, JSON.stringify({ version: 1, unlocked: ['h-a'], srs: {} }));
    expect(loadProfile().studyOff).toEqual([]);
  });
});
