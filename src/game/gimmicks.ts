import type { Element, Gimmick, Phase } from '../types';
import type { EnemyState } from './battle';

const find = <T extends Gimmick['type']>(e: Pick<EnemyState, 'gimmicks'>, type: T) =>
  (e.gimmicks ?? []).find((g): g is Extract<Gimmick, { type: T }> => g.type === type);

/** Damage multiplier from an intact shell (1 once broken, or for the breaker element). */
export function shellFactor(e: Pick<EnemyState, 'gimmicks' | 'shellBroken'>, element: Element | undefined): number {
  const g = find(e, 'shell');
  return g && !e.shellBroken && element !== g.breaker ? g.reduction : 1;
}

/** Whether a hit of `element` cracks the shell right now. */
export function breaksShell(e: Pick<EnemyState, 'gimmicks' | 'shellBroken'>, element: Element | undefined): boolean {
  const g = find(e, 'shell');
  return !!g && !e.shellBroken && element === g.breaker;
}

/** What the enemy resists after being hit with `element` (mimic never copies its weakness). */
export function mimicResist(e: EnemyState, element: Element | undefined): EnemyState['resist'] {
  return find(e, 'mimic') && element && element !== e.weak ? element : e.resist;
}

/** Damage the player takes back for hitting with `element` (0 if none). */
export function retaliationDamage(e: Pick<EnemyState, 'gimmicks'>, element: Element | undefined): number {
  const g = find(e, 'retaliate');
  return g && element === g.element ? g.damage : 0;
}

/** Armor gained when the enemy defends (0 if none). */
export function hardenAmount(e: Pick<EnemyState, 'gimmicks'>): number {
  return find(e, 'harden')?.armor ?? 0;
}

/** Whether this enemy freezes a move after it defends. */
export const freezes = (e: Pick<EnemyState, 'gimmicks'>): boolean => !!find(e, 'freeze');

/** Fire the enemy's phase change if its HP has dropped to the threshold (once, never on a kill). */
export function checkPhase(e: EnemyState): { enemy: EnemyState; fired: Phase | null } {
  const ph = e.phase;
  if (!ph || e.phaseDone || e.hp <= 0 || e.hp / e.maxHp > ph.atHpPct) return { enemy: e, fired: null };
  return {
    enemy: {
      ...e,
      phaseDone: true,
      intentIndex: 0,
      pattern: ph.pattern ?? e.pattern,
      strength: e.strength + (ph.strength ?? 0),
      armor: e.armor + (ph.armor ?? 0),
      hp: Math.min(e.maxHp, e.hp + Math.round(e.maxHp * (ph.heal ?? 0))),
      weak: ph.weak ?? e.weak,
      resist: ph.resist ?? e.resist,
    },
    fired: ph,
  };
}
