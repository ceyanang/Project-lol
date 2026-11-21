import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { generateMap, reachableNodes } from './map';
import { seeded } from './rng';

describe('map', () => {
  it('every node is reachable from the start and leads to the boss', () => {
    for (let seed = 1; seed < 200; seed++) {
      const map = generateMap(1, seed % 2 === 0, seeded(seed));
      const reach = new Set<string>();
      const stack = reachableNodes(map, null).map((n) => n.id);
      while (stack.length) {
        const id = stack.pop()!;
        if (reach.has(id)) continue;
        reach.add(id);
        stack.push(...map.find((n) => n.id === id)!.next);
      }
      expect(reach.size).toBe(map.length);
      const boss = map.filter((n) => n.type === 'boss');
      expect(boss).toHaveLength(1);
      const lastRow = map.filter((n) => n.row === CONFIG.run.choiceRows - 1);
      expect(lastRow.some((n) => n.type === 'rest')).toBe(true);
      expect(map.filter((n) => n.row === 0).every((n) => n.type === 'fight')).toBe(true);
      const reviews = map.filter((n) => n.type === 'review').length;
      expect(reviews).toBe(seed % 2 === 0 ? 1 : 0);
    }
  });
});
