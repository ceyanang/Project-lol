import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../data';
import { simulate } from './sim';

/**
 * Turns per fight at each enemy's own floor (normal enemies retuned to ~3 turns on average).
 * The new mechanics may shorten fights but must not make them drag: ≤ +25% turns.
 */
const BASELINE_TURNS: Record<string, number> = {
  kodama: 1.6, hitodama: 1.5, bakeneko: 2.1, kappa: 2.7, kasaobake: 2.8, tanuki: 3.2, chochin: 3.8,
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
