import { useMemo, useState } from 'react';
import { CONFIG } from './config';
import { ENEMIES, availableWords, unlockedKanaIds } from './data';
import { type BattleCtx, type BattleState, createBattle, endTurn, resolvePlay } from './game/battle';
import { buildStartingDeck } from './game/deck';
import { defaultRng, pick } from './game/rng';
import Battle from './screens/Battle';

// Step 3: a single test battle against a random normal enemy.
const unlocked = unlockedKanaIds(2);
const words = availableWords(new Set(unlocked));

function newBattle(ctx: BattleCtx): BattleState {
  const deck = buildStartingDeck(unlocked, unlocked.slice(5), words, ctx.weightOf, false, ctx.rng);
  const enemy = pick(ctx.rng, ENEMIES.filter((e) => e.tier === 'normal' && e.minFloor === 1));
  return createBattle({ enemy, floor: 1, deck, hp: CONFIG.player.startHp, maxHp: CONFIG.player.startHp, relics: [], ctx });
}

export default function App() {
  const ctx = useMemo<BattleCtx>(() => ({ weightOf: () => 1, unlocked, words, rng: defaultRng }), []);
  const [battle, setBattle] = useState(() => newBattle(ctx));
  return (
    <div className="app">
      <Battle
        battle={battle}
        words={words}
        unlocked={unlocked}
        floor={1}
        onPlay={(plan, results) => setBattle((b) => resolvePlay(b, plan, results).battle)}
        onEndTurn={() => setBattle((b) => endTurn(b, ctx))}
        onSpeak={() => {}}
      />
      {battle.outcome !== 'ongoing' && (
        <div className="sheet-backdrop">
          <div className="sheet" style={{ textAlign: 'center' }}>
            <h2>{battle.outcome === 'won' ? 'Victory! 🎉' : 'Defeated 💀'}</h2>
            <button type="button" className="btn btn-gold btn-wide" onClick={() => setBattle(newBattle(ctx))}>
              Fight again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
