import { CONFIG } from '../config';
import { MOVE_BY_ID, availableWords, firstGroups, unlockedKanaIds } from '../data';
import type { EnemyDef } from '../types';
import { type BattleState, createBattle, incomingDamage, playTurn, previewMove, setTyped } from './battle';
import { makeCard } from './deck';
import { seeded } from './rng';

export interface SimResult {
  turns: number;
  hpLost: number;
  deathRate: number;
}

/** A perfect reader with a greedy policy, `n` seeded fights against `enemy` on `floor` (see PLAN.md §1 Balance). */
export function simulate(enemy: EnemyDef, floor: number, n: number, extra: readonly string[] = []): SimResult {
  const unlocked = unlockedKanaIds(firstGroups(3));
  const deck = [...(CONFIG.player.starterDeck as readonly string[]), ...extra];
  let lost = 0;
  let turns = 0;
  let deaths = 0;
  for (let i = 0; i < n; i++) {
    const ctx = { weightOf: () => 1, unlocked, words: availableWords(new Set(unlocked)), wordsUnlocked: false, rng: seeded(i * 7 + floor) };
    let b: BattleState = createBattle({ enemy, floor, deck: deck.map(makeCard), hp: CONFIG.player.startHp, maxHp: CONFIG.player.startHp, relics: [], ctx });
    let t = 0;
    while (b.outcome === 'ongoing' && t < 60) {
      const inc = incomingDamage(b.enemy);
      const score = (s: (typeof b.slots)[number]) => {
        const p = previewMove(MOVE_BY_ID[s.card.moveId], s.label, b);
        const dmg = p.damagePerHit * p.hits - (p.pierce ? 0 : b.enemy.armor * p.hits);
        const blk = Math.min(p.block, inc);
        const lethal = dmg >= b.enemy.hp + b.enemy.block ? 1000 : 0;
        const frozen = b.frozen.includes(s.uid) ? -10000 : 0;
        return frozen + lethal + dmg + blk * (b.playerHp < 25 ? 1.5 : 1) + (b.playerHp < 30 ? p.heal : 0) + p.weaken * 2;
      };
      const best = b.slots.slice().sort((x, y) => score(y) - score(x))[0];
      b = playTurn(setTyped(b, best.label.romaji), ctx).battle;
      t++;
    }
    turns += t;
    lost += CONFIG.player.startHp - b.playerHp;
    if (b.outcome === 'lost') deaths++;
  }
  return { turns: turns / n, hpLost: lost / n, deathRate: deaths / n };
}
