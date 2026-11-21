import { CONFIG, type SrsBucket } from '../config';

export interface KanaStat {
  seen: number;
  correct: number;
  lastSeen: number | null;
  streak: number;
  /** >0 means "recently missed": weight ×missedMultiplier. */
  missDebt: number;
  bucket: SrsBucket;
  reviewStage: number;
  nextReview: number | null;
}

export type SrsStats = Record<string, KanaStat>;

export interface Answer {
  id: string;
  correct: boolean;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

export function newStat(): KanaStat {
  return { seen: 0, correct: 0, lastSeen: null, streak: 0, missDebt: 0, bucket: 'new', reviewStage: 0, nextReview: null };
}

export function getStat(stats: SrsStats, id: string): KanaStat {
  return stats[id] ?? newStat();
}

export function isDue(stat: KanaStat, now: number): boolean {
  return stat.bucket === 'mastered' && stat.nextReview !== null && stat.nextReview <= now;
}

/** Draw / prompt weight. See PLAN.md §2. Never 0. */
export function kanaWeight(stat: KanaStat, now: number): number {
  const s = CONFIG.srs;
  let w: number = s.bucketWeights[stat.bucket];
  if (stat.missDebt > 0) w *= s.missedMultiplier;
  if (isDue(stat, now)) w *= s.dueMultiplier;
  return w;
}

export function recordAnswer(prev: KanaStat, correct: boolean, now: number): KanaStat {
  const s = CONFIG.srs;
  const stat: KanaStat = { ...prev, seen: prev.seen + 1, lastSeen: now };
  if (!correct) {
    return { ...stat, streak: 0, missDebt: s.missDebtOnMiss, bucket: 'learning', reviewStage: 0, nextReview: null };
  }
  const wasDue = isDue(prev, now);
  stat.correct += 1;
  stat.streak += 1;
  stat.missDebt = Math.max(0, prev.missDebt - 1);
  const intervals = s.reviewIntervalsDays;
  if (prev.bucket === 'mastered') {
    if (wasDue) {
      stat.reviewStage = Math.min(prev.reviewStage + 1, intervals.length - 1);
      stat.nextReview = now + intervals[stat.reviewStage] * DAY_MS;
    }
  } else if (stat.streak >= s.masteredStreak) {
    stat.bucket = 'mastered';
    stat.reviewStage = 0;
    stat.nextReview = now + intervals[0] * DAY_MS;
  } else if (stat.streak >= s.knownStreak) {
    stat.bucket = 'known';
  } else {
    stat.bucket = 'learning';
  }
  return stat;
}

export function recordAnswers(stats: SrsStats, answers: Answer[], now: number): SrsStats {
  if (!answers.length) return stats;
  const next = { ...stats };
  for (const a of answers) next[a.id] = recordAnswer(getStat(next, a.id), a.correct, now);
  return next;
}

export function dueKana(stats: SrsStats, ids: readonly string[], now: number): string[] {
  return ids.filter((id) => isDue(getStat(stats, id), now));
}

export function makeWeightOf(stats: SrsStats, now: number): (id: string) => number {
  return (id) => kanaWeight(getStat(stats, id), now);
}
