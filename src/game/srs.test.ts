import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { DAY_MS, isDue, kanaWeight, newStat, recordAnswer } from './srs';

describe('srs', () => {
  it('missed kana weigh 3x a comparable kana', () => {
    const now = 0;
    let s = recordAnswer(newStat(), true, now);
    const ok = s;
    s = recordAnswer(s, false, now);
    expect(s.bucket).toBe('learning');
    expect(kanaWeight(s, now) / kanaWeight({ ...ok, bucket: 'learning' }, now)).toBe(CONFIG.srs.missedMultiplier);
  });

  it('missDebt decays with correct answers', () => {
    let s = recordAnswer(newStat(), false, 0);
    expect(s.missDebt).toBe(3);
    for (let i = 0; i < 3; i++) s = recordAnswer(s, true, 0);
    expect(s.missDebt).toBe(0);
  });

  it('promotes new -> learning -> known -> mastered and schedules review at 1,3,7,14 days', () => {
    let s = newStat();
    let t = 0;
    for (let i = 0; i < CONFIG.srs.knownStreak; i++) s = recordAnswer(s, true, t);
    expect(s.bucket).toBe('known');
    for (let i = CONFIG.srs.knownStreak; i < CONFIG.srs.masteredStreak; i++) s = recordAnswer(s, true, t);
    expect(s.bucket).toBe('mastered');
    expect(s.nextReview).toBe(t + 1 * DAY_MS);
    expect(isDue(s, t + DAY_MS - 1)).toBe(false);
    // answering before due does not advance the schedule
    s = recordAnswer(s, true, t + 10);
    expect(s.nextReview).toBe(t + DAY_MS);
    const expected = [3, 7, 14, 14];
    for (const days of expected) {
      t = s.nextReview!;
      expect(isDue(s, t)).toBe(true);
      s = recordAnswer(s, true, t);
      expect(s.nextReview).toBe(t + days * DAY_MS);
    }
  });

  it('mastered kana never get weight 0, and a miss demotes them', () => {
    let s = newStat();
    for (let i = 0; i < 6; i++) s = recordAnswer(s, true, 0);
    expect(kanaWeight(s, 0)).toBeGreaterThan(0);
    s = recordAnswer(s, false, 0);
    expect(s.bucket).toBe('learning');
    expect(s.nextReview).toBeNull();
  });
});
