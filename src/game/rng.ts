/** Small RNG wrapper so game logic can be seeded in tests. */
export interface Rng {
  next(): number;
}

export const defaultRng: Rng = { next: () => Math.random() };

/** Deterministic RNG (mulberry32) for tests. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export function randInt(rng: Rng, n: number): number {
  return Math.floor(rng.next() * n);
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[randInt(rng, arr.length)];
}

export function chance(rng: Rng, p: number): boolean {
  return rng.next() < p;
}

export function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Index chosen proportionally to weights. Returns -1 for an empty list. */
export function weightedIndex(rng: Rng, weights: readonly number[]): number {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (weights.length === 0) return -1;
  if (total <= 0) return randInt(rng, weights.length);
  let r = rng.next() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r < 0) return i;
  }
  return weights.length - 1;
}

export function weightedPick<T>(rng: Rng, items: readonly T[], weightOf: (t: T) => number): T | undefined {
  const i = weightedIndex(rng, items.map(weightOf));
  return i < 0 ? undefined : items[i];
}

/** Pick up to n distinct items, weighted, without replacement. */
export function weightedSample<T>(rng: Rng, items: readonly T[], n: number, weightOf: (t: T) => number): T[] {
  const pool = items.slice();
  const out: T[] = [];
  while (out.length < n && pool.length) {
    const i = weightedIndex(rng, pool.map(weightOf));
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}
