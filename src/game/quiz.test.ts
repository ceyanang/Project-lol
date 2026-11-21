import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { FAMILIES, KANA_BY_ID, UNLOCK_GROUPS, nextLockedGroup } from '../data';
import { applyQuizUnlock, familyQuiz, quizPassed, rowQuiz } from './quiz';
import { seeded } from './rng';
import { newProfile } from './storage';

describe('skip-ahead quiz', () => {
  it('a row quiz asks every kana in the row and allows no misses', () => {
    const plan = rowQuiz('h-ka', seeded(1));
    expect([...plan.kana].sort()).toEqual(['か', 'き', 'く', 'け', 'こ'].sort());
    expect(quizPassed(plan, [true, true, true, true, true])).toBe(true);
    expect(quizPassed(plan, [true, true, false, true, true])).toBe(false);
  });

  it('a family quiz covers every row of the family', () => {
    for (const fam of FAMILIES) {
      const plan = familyQuiz(fam.id, seeded(3));
      expect(plan.kana.length).toBeGreaterThanOrEqual(Math.min(CONFIG.quiz.familyQuestions, fam.groups.length));
      for (const gid of fam.groups) {
        const g = UNLOCK_GROUPS.find((x) => x.id === gid)!;
        expect(plan.kana.some((k) => g.kana.includes(k))).toBe(true);
      }
      expect(new Set(plan.kana).size).toBe(plan.kana.length);
      expect(plan.kana.every((k) => KANA_BY_ID[k])).toBe(true);
    }
  });

  it('passing unlocks the groups, out of order; bosses then unlock the next missing one', () => {
    const plan = familyQuiz('katakana', seeded(2));
    const p = applyQuizUnlock(newProfile(), plan);
    expect(p.unlocked).toContain('k-a');
    expect(p.unlocked).toContain('k-wa');
    expect(p.unlocked).toContain('h-a');
    expect(nextLockedGroup(p.unlocked)?.id).toBe('h-ka');
  });
});
