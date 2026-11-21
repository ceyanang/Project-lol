import { CONFIG } from '../config';
import { FAMILIES, UNLOCK_GROUPS } from '../data';
import { type Rng, pick, shuffle } from './rng';
import type { Profile } from './storage';

/** A Skip-ahead Quiz: answer these kana; pass → the groups unlock. */
export interface QuizPlan {
  title: string;
  groups: string[];
  /** Kana ids asked, in order. */
  kana: string[];
  maxMisses: number;
}

const groupById = (id: string) => UNLOCK_GROUPS.find((g) => g.id === id)!;

/** Test out of one row: every kana in it, shuffled. */
export function rowQuiz(groupId: string, rng: Rng): QuizPlan {
  const g = groupById(groupId);
  return { title: g.label, groups: [g.id], kana: shuffle(rng, g.kana), maxMisses: CONFIG.quiz.rowMaxMisses };
}

/** Test out of a whole family: at least one kana from every row, then random extras. */
export function familyQuiz(familyId: string, rng: Rng): QuizPlan {
  const fam = FAMILIES.find((f) => f.id === familyId)!;
  const rows = fam.groups.map(groupById);
  const picked = new Set(rows.map((g) => pick(rng, g.kana)));
  const all = shuffle(rng, rows.flatMap((g) => g.kana));
  for (const k of all) {
    if (picked.size >= Math.max(CONFIG.quiz.familyQuestions, rows.length)) break;
    picked.add(k);
  }
  return { title: fam.label, groups: fam.groups, kana: shuffle(rng, [...picked]), maxMisses: CONFIG.quiz.familyMaxMisses };
}

export function quizPassed(plan: QuizPlan, results: readonly boolean[]): boolean {
  const misses = results.filter((r) => !r).length;
  return results.length === plan.kana.length && misses <= plan.maxMisses;
}

/** Unlock the quiz's groups (keeps any already unlocked). */
export function applyQuizUnlock(profile: Profile, plan: QuizPlan): Profile {
  return { ...profile, unlocked: [...new Set([...profile.unlocked, ...plan.groups])] };
}

/** All kana in a family (used as the distractor pool so options stay relevant). */
export function familyKana(groups: readonly string[]): string[] {
  return groups.flatMap((id) => groupById(id).kana);
}
