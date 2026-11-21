import { useEffect, useMemo, useState } from 'react';
import { CONFIG } from './config';
import { ENEMIES, KANA_BY_ID, availableWords, unlockedKanaIds } from './data';
import { type BattleCtx, type BattleState, createBattle, endTurn, resolvePlay } from './game/battle';
import { buildStartingDeck } from './game/deck';
import { defaultRng, pick } from './game/rng';
import { getStat, makeWeightOf, recordAnswers } from './game/srs';
import { type Profile, loadProfile, saveProfile } from './game/storage';
import Battle from './screens/Battle';

// Step 4: single test battle, SRS stats recorded and persisted to localStorage.
function newBattle(ctx: BattleCtx, profile: Profile): BattleState {
  const deck = buildStartingDeck(ctx.unlocked, ctx.unlocked, ctx.words, ctx.weightOf, profile.runs === 0, ctx.rng);
  const enemy = pick(ctx.rng, ENEMIES.filter((e) => e.tier === 'normal' && e.minFloor === 1));
  return createBattle({ enemy, floor: 1, deck, hp: CONFIG.player.startHp, maxHp: CONFIG.player.startHp, relics: [], ctx });
}

export default function App() {
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  useEffect(() => saveProfile(profile), [profile]);

  const unlocked = useMemo(() => unlockedKanaIds(profile.unlockedCount), [profile.unlockedCount]);
  const words = useMemo(() => availableWords(new Set(unlocked)), [unlocked]);
  const ctx: BattleCtx = { weightOf: makeWeightOf(profile.srs, Date.now()), unlocked, words, rng: defaultRng };
  const missed = useMemo(() => new Set(Object.keys(profile.srs).filter((k) => profile.srs[k].missDebt > 0)), [profile.srs]);
  const [battle, setBattle] = useState(() => newBattle(ctx, profile));

  return (
    <div className="app">
      <Battle
        battle={battle}
        words={words}
        unlocked={unlocked}
        floor={1}
        missed={missed}
        onPlay={(plan, results) => {
          const r = resolvePlay(battle, plan, results);
          setBattle(r.battle);
          setProfile((p) => ({ ...p, srs: recordAnswers(p.srs, r.answers, Date.now()) }));
        }}
        onEndTurn={() => setBattle((b) => endTurn(b, ctx))}
        onSpeak={() => {}}
      />
      {battle.outcome !== 'ongoing' && (
        <div className="sheet-backdrop">
          <div className="sheet" style={{ textAlign: 'center' }}>
            <h2>{battle.outcome === 'won' ? 'Victory! 🎉' : 'Defeated 💀'}</h2>
            <p className="jp">
              {unlocked.map((k) => `${KANA_BY_ID[k].char} ${getStat(profile.srs, k).bucket}`).join(' · ')}
            </p>
            <button type="button" className="btn btn-gold btn-wide" onClick={() => setBattle(newBattle(ctx, profile))}>
              Fight again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
