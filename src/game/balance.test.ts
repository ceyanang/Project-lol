import { it } from 'vitest';
import { CONFIG } from '../config';
import { ENEMIES, MOVE_BY_ID, availableWords, firstGroups, unlockedKanaIds } from '../data';
import { type BattleState, playTurn, createBattle, incomingDamage, pickTile, previewMove } from './battle';
import { makeCard } from './deck';
import { seeded } from './rng';

// Balance sim: a perfect reader with a simple policy. Run with SIM=1.
const run = process.env.SIM ? it : it.skip;
run('balance sim', () => {
  const unlocked = unlockedKanaIds(firstGroups(3));
  const deck = (CONFIG.player.starterDeck as readonly string[]).slice();
  const extra = process.env.SIM_EXTRA ? process.env.SIM_EXTRA.split(',') : [];
  const rows: string[] = [];
  for (const e of ENEMIES) {
    for (const floor of [1, 2, 3]) {
      if (e.minFloor > floor) continue;
      let lost = 0, turns = 0, deaths = 0;
      const N = 300;
      for (let i = 0; i < N; i++) {
        const ctx = { weightOf: () => 1, unlocked, words: availableWords(new Set(unlocked)), wordsUnlocked: false, difficulty: (process.env.SIM_DIFF ?? 'normal') as 'normal', rng: seeded(i * 7 + floor) };
        let b: BattleState = createBattle({ enemy: e, floor, deck: [...deck, ...extra].map(makeCard), hp: CONFIG.player.startHp, maxHp: CONFIG.player.startHp, relics: [], ctx });
        let t = 0;
        while (b.outcome === 'ongoing' && t < 60) {
          const inc = incomingDamage(b.enemy);
          const score = (s: (typeof b.slots)[number]) => {
            const p = previewMove(MOVE_BY_ID[s.card.moveId], s.label, b);
            const dmg = p.damagePerHit * p.hits - (p.pierce ? 0 : b.enemy.armor * p.hits);
            const blk = Math.min(p.block, inc);
            const lethal = dmg >= b.enemy.hp + b.enemy.block ? 1000 : 0;
            return lethal + dmg + blk * (b.playerHp < 25 ? 1.5 : 1) + (b.playerHp < 30 ? p.heal : 0) + p.weaken * 2;
          };
          const best = b.slots.slice().sort((x, y) => score(y) - score(x))[0];
          const tile = b.tiles.find((tt) => tt.slot === best.uid)!;
          b = playTurn(pickTile(b, tile.id), ctx).battle;
          t++;
        }
        turns += t;
        lost += CONFIG.player.startHp - b.playerHp;
        if (b.outcome === 'lost') deaths++;
      }
      rows.push(`${e.tier.padEnd(6)} ${e.name.padEnd(18)} f${floor}  turns ${(turns / N).toFixed(1).padStart(4)}  hpLost ${(lost / N).toFixed(1).padStart(5)}  deaths ${((deaths / N) * 100).toFixed(0).padStart(3)}%`);
    }
  }
  require('node:fs').writeFileSync(process.env.SIM_OUT ?? 'balance-report.txt', rows.join('\n') + '\n');
});
