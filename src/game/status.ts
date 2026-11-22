import { CONFIG } from '../config';
import type { Element } from '../types';
import type { EnemyState } from './battle';

/** Status counters on an enemy (all 0 when clean). */
export interface Status {
  burn: number;
  soak: number;
  stun: number;
  gust: number;
}

export const NO_STATUS: Status = { burn: 0, soak: 0, stun: 0, gust: 0 };

/** The enemy's status, defaulting for saves made before statuses existed. */
export const statusOf = (e: Pick<EnemyState, 'status'>): Status => e.status ?? NO_STATUS;

export type Reaction = 'steam' | 'shock';

/** Damage multiplier from a reaction a hit of `element` would trigger right now. */
export function reactionMultiplier(e: Pick<EnemyState, 'status'>, element: Element | undefined): number {
  if (statusOf(e).soak > 0) {
    if (element === 'thunder') return CONFIG.status.shockMultiplier;
    if (element === 'fire') return CONFIG.status.steamMultiplier;
  }
  return 1;
}

/** Apply the status an attack of `element` leaves behind (once per move), or trigger its reaction. */
export function applyElementStatus(e: EnemyState, element: Element | undefined): { enemy: EnemyState; reaction: Reaction | null } {
  const s = { ...statusOf(e) };
  let reaction: Reaction | null = null;
  const C = CONFIG.status;
  if (element === 'fire') {
    if (s.soak > 0) {
      s.soak = 0;
      reaction = 'steam';
    } else s.burn = Math.min(C.burnMax, s.burn + C.burnStacksPerHit);
  } else if (element === 'water') s.soak = C.soakTurns;
  else if (element === 'wind') s.gust = C.gustHits;
  else if (element === 'thunder' && s.soak > 0) {
    s.soak = 0;
    s.stun = C.shockStun;
    reaction = 'shock';
  }
  return { enemy: { ...e, status: s }, reaction };
}

/** End of the enemy's action: burn hurts (ignores block and armor) then decays; soak wears off. */
export function tickStatuses(e: EnemyState): { enemy: EnemyState; burnDamage: number } {
  const s = statusOf(e);
  const burnDamage = Math.min(s.burn, e.hp);
  return {
    enemy: { ...e, hp: e.hp - burnDamage, status: { ...s, burn: Math.max(0, s.burn - 1), soak: Math.max(0, s.soak - 1) } },
    burnDamage,
  };
}
