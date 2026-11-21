import { CONFIG } from '../config';
import { type Rng, chance, randInt, weightedIndex } from './rng';

export type NodeType = 'fight' | 'elite' | 'rest' | 'review' | 'boss';

export interface MapNode {
  id: string;
  row: number;
  /** Horizontal position 0..1 for rendering. */
  x: number;
  type: NodeType;
  next: string[];
}

export const NODE_ICON: Record<NodeType, string> = { fight: '⚔️', elite: '💀', rest: '🔥', review: '📜', boss: '👹' };
export const NODE_LABEL: Record<NodeType, string> = { fight: 'Fight', elite: 'Elite', rest: 'Rest', review: 'Review', boss: 'Boss' };

function rollType(rng: Rng, allowReview: boolean): NodeType {
  const o = CONFIG.run.nodeOdds;
  const types: NodeType[] = ['fight', 'elite', 'rest', 'review'];
  const t = types[weightedIndex(rng, [o.fight, o.elite, o.rest, allowReview ? o.review : 0])];
  return t;
}

/**
 * Branching floor map: `choiceRows` rows of 2–3 nodes, then one boss node.
 * Row 0 is all fights; the row before the boss always has a rest.
 */
export function generateMap(floor: number, hasDueKana: boolean, rng: Rng): MapNode[] {
  const { choiceRows, nodesPerRow } = CONFIG.run;
  const rows: MapNode[][] = [];
  for (let r = 0; r < choiceRows; r++) {
    const count = nodesPerRow[0] + randInt(rng, nodesPerRow[1] - nodesPerRow[0] + 1);
    const row: MapNode[] = [];
    for (let i = 0; i < count; i++) {
      row.push({ id: `f${floor}r${r}n${i}`, row: r, x: (i + 1) / (count + 1), type: r === 0 ? 'fight' : rollType(rng, hasDueKana), next: [] });
    }
    rows.push(row);
  }
  const last = rows[choiceRows - 1];
  if (!last.some((n) => n.type === 'rest')) last[randInt(rng, last.length)].type = 'rest';
  // at most one review node per floor keeps it special
  let seenReview = false;
  for (const n of rows.flat()) {
    if (n.type === 'review') {
      if (seenReview) n.type = 'fight';
      seenReview = true;
    }
  }
  if (hasDueKana && !seenReview) {
    const mid = rows[Math.min(1, choiceRows - 1)];
    const target = mid.find((n) => n.type === 'fight') ?? mid[0];
    target.type = 'review';
  }

  const boss: MapNode = { id: `f${floor}boss`, row: choiceRows, x: 0.5, type: 'boss', next: [] };

  for (let r = 0; r < choiceRows - 1; r++) {
    const a = rows[r];
    const b = rows[r + 1];
    a.forEach((n, i) => {
      const j = Math.round((i * (b.length - 1)) / Math.max(1, a.length - 1));
      n.next.push(b[j].id);
      if (j + 1 < b.length && chance(rng, 0.35)) n.next.push(b[j + 1].id);
      else if (j - 1 >= 0 && chance(rng, 0.35)) n.next.push(b[j - 1].id);
    });
    b.forEach((m, j) => {
      if (a.some((n) => n.next.includes(m.id))) return;
      const i = Math.round((j * (a.length - 1)) / Math.max(1, b.length - 1));
      a[i].next.push(m.id);
    });
  }
  for (const n of last) n.next.push(boss.id);
  return [...rows.flat(), boss];
}

export function nodeById(map: readonly MapNode[], id: string | null): MapNode | undefined {
  return id ? map.find((n) => n.id === id) : undefined;
}

/** Nodes the player may enter next. */
export function reachableNodes(map: readonly MapNode[], position: string | null): MapNode[] {
  if (!position) return map.filter((n) => n.row === 0);
  const cur = nodeById(map, position);
  return cur ? map.filter((n) => cur.next.includes(n.id)) : [];
}
