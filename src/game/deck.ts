import { CONFIG } from '../config';
import { MOVES } from '../data';
import type { Card, MoveDef } from '../types';
import { type Rng, shuffle, weightedIndex } from './rng';

let uidCounter = 0;
export function makeCard(moveId: string): Card {
  uidCounter += 1;
  return { uid: `c${Date.now().toString(36)}${uidCounter.toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`, moveId };
}

export function starterDeck(rng: Rng): Card[] {
  return shuffle(rng, CONFIG.player.starterDeck.map(makeCard));
}

/** Move reward options: rolls a rarity per option, no duplicates in one offer. */
export function moveRewardOptions(n: number, odds: { common: number; rare: number }, rng: Rng): Card[] {
  const pool = MOVES.filter((m) => m.rarity !== 'starter');
  const picked: MoveDef[] = [];
  for (let i = 0; i < n; i++) {
    const rarity = weightedIndex(rng, [odds.common, odds.rare]) === 0 ? 'common' : 'rare';
    const options = pool.filter((m) => m.rarity === rarity && !picked.includes(m));
    const fallback = pool.filter((m) => !picked.includes(m));
    const from = options.length ? options : fallback;
    if (!from.length) break;
    picked.push(from[Math.floor(rng.next() * from.length)]);
  }
  return picked.map((m) => makeCard(m.id));
}

/** Count copies of each move in a deck, for display. */
export function deckCounts(deck: readonly Card[]): { moveId: string; count: number }[] {
  const m = new Map<string, number>();
  for (const c of deck) m.set(c.moveId, (m.get(c.moveId) ?? 0) + 1);
  return [...m.entries()].map(([moveId, count]) => ({ moveId, count }));
}
