import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../data';
import { simulate } from './sim';

/**
 * Turns per fight at each enemy's own floor, measured before statuses/gimmicks existed.
 * The new mechanics may shorten fights but must not make them drag: ≤ +25% turns.
 */
const BASELINE_TURNS: Record<string, number> = {
  kodama: 2.5, hitodama: 2.1, bakeneko: 3.0, kappa: 4.3, kasaobake: 3.8, tanuki: 5.1, chochin: 5.9,
  tengu: 6.6, yukionna: 4.9, jorogumo: 8.1, oni: 6.4, gashadokuro: 11.8, ryujin: 8.1, memorywraith: 3.2,
};

describe('balance (fast regression, starter deck, perfect reader)', () => {
  for (const e of ENEMIES) {
    it(`${e.name} on floor ${e.minFloor} keeps its pace`, () => {
      const r = simulate(e, e.minFloor, 60);
      expect(r.turns).toBeLessThanOrEqual(BASELINE_TURNS[e.id] * 1.25);
      expect(r.turns).toBeGreaterThanOrEqual(BASELINE_TURNS[e.id] * 0.5);
      if (e.tier === 'normal') expect(r.hpLost).toBeLessThan(20 + 5 * (e.minFloor - 1)); // floor-scaled: chōchin is a floor-3 enemy
      if (e.tier === 'elite') expect(r.hpLost).toBeLessThan(33);
      expect(r.deathRate).toBeLessThanOrEqual(0.1);
    });
  }
});
