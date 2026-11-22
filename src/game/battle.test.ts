import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { ENEMY_BY_ID, KANA_BY_ID, MOVE_BY_ID, availableWords, firstGroups, unlockedKanaIds } from '../data';
import { type BattleCtx, type BattleState, advanceBeat, comboBonus, confirmTurn, createBattle, incomingDamage, matchSlot, playTurn, previewMove, setTyped } from './battle';
import { makeCard, moveRewardOptions } from './deck';
import { parseRun } from './run';
import { seeded } from './rng';
import { matchesReading, readingsOf } from './romaji';

const H = CONFIG.player.startHp;

const ctxFor = (unlockedCount = 3, seed = 1): BattleCtx => {
  const groups = firstGroups(unlockedCount);
  const unlocked = unlockedKanaIds(groups);
  return { weightOf: () => 1, unlocked, words: availableWords(new Set(unlocked)), wordsUnlocked: groups.includes('words'), rng: seeded(seed) };
};

function battle(deck: string[], enemy = 'kodama', ctx = ctxFor()): BattleState {
  return createBattle({ enemy: ENEMY_BY_ID[enemy], floor: 1, deck: deck.map(makeCard), hp: H, maxHp: H, relics: [], ctx });
}

/** Type the reading of the slot holding `moveId`. */
const typeFor = (b: BattleState, moveId: string) => setTyped(b, b.slots.find((s) => s.card.moveId === moveId)!.label.romaji);

describe('romaji', () => {
  it('accepts Hepburn and common alternates, case-insensitive', () => {
    expect(matchesReading(['し'], 'shi')).toBe(true);
    expect(matchesReading(['し'], 'SI')).toBe(true);
    expect(matchesReading(['つ'], 'tu')).toBe(true);
    expect(matchesReading(['ふ'], 'hu')).toBe(true);
    expect(matchesReading(['し'], 'chi')).toBe(false);
    expect(matchesReading(['ん'], 'nn')).toBe(true);
    expect(readingsOf(['す', 'し'])).toContain('susi');
    expect(matchesReading(['ね', 'こ'], 'neko')).toBe(true);
  });
});

describe('dealing moves', () => {
  it('deals N moves, each labelled with a kana of a distinct reading', () => {
    for (let seed = 1; seed < 30; seed++) {
      const ctx = ctxFor(3, seed);
      const b = battle(CONFIG.player.starterDeck as unknown as string[], 'kodama', ctx);
      expect(b.slots).toHaveLength(CONFIG.combat.movesPerTurn);
      const romaji = b.slots.map((s) => s.label.romaji);
      expect(new Set(romaji).size).toBe(romaji.length);
      for (const s of b.slots) expect(s.label.kana.every((k) => ctx.unlocked.includes(k))).toBe(true);
    }
  });

  it('a move is not tied to any kana: labels change from turn to turn', () => {
    const ctx = ctxFor(5, 3);
    let b = battle(['strike', 'strike', 'strike', 'strike'], 'kodama', ctx);
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      b.slots.forEach((s) => seen.add(s.label.romaji));
      b = { ...playTurn(b, ctx).battle, playerHp: H };
    }
    expect(seen.size).toBeGreaterThan(CONFIG.combat.movesPerTurn);
  });
});

describe('typing and confirming a turn', () => {
  it('typing does nothing until End Turn; then the matching move resolves', () => {
    const ctx = ctxFor();
    const b = battle(['strike', 'guard', 'water_jet', 'wind_slash']);
    const typed = typeFor(b, 'strike');
    expect(typed.enemy.hp).toBe(b.enemy.hp);
    const slot = matchSlot(typed, typed.typed)!;
    const { battle: after, answers } = playTurn(typed, ctx);
    expect(b.enemy.hp - after.enemy.hp).toBe(MOVE_BY_ID.strike.value);
    expect(answers).toEqual(slot.label.kana.map((k) => ({ id: k, correct: true })));
    expect(after.turn).toBe(2);
    expect(after.lastResult?.ok).toBe(true);
    expect(after.playerHp).toBe(H - incomingDamage(b.enemy));
    expect(after.typed).toBe('');
  });

  it('turn beats: your move, then (later) the enemy, then (later) the next deal', () => {
    const ctx = ctxFor();
    const b = battle(['strike', 'guard', 'water_jet', 'wind_slash']);
    const confirmed = confirmTurn(typeFor(b, 'strike')).battle;
    expect(confirmed.pending).toBe('enemy');
    expect(confirmed.enemy.hp).toBeLessThan(b.enemy.hp);
    expect(confirmed.playerHp).toBe(H);
    expect(setTyped(confirmed, 'ka')).toBe(confirmed); // no input mid-beat
    const enemyActed = advanceBeat(confirmed, ctx);
    expect(enemyActed.pending).toBe('deal');
    expect(enemyActed.playerHp).toBe(H - incomingDamage(b.enemy));
    const dealt = advanceBeat(enemyActed, ctx);
    expect(dealt.pending).toBeNull();
    expect(dealt.turn).toBe(2);
  });

  it('a reading that matches no move fizzles, costs HP and marks the closest move’s kana missed', () => {
    const ctx = ctxFor();
    const b = battle(['strike', 'guard', 'water_jet', 'wind_slash']);
    const target = b.slots[0];
    // one wrong letter, e.g. "ka" → "kx"
    const typo = target.label.romaji.slice(0, -1) + 'x';
    const others = b.slots.slice(1).map((s) => s.label.romaji);
    const { battle: after, answers } = playTurn(setTyped(b, typo), ctx);
    expect(after.enemy.hp).toBe(b.enemy.hp);
    expect(after.playerHp).toBe(H - CONFIG.combat.wrongHpCost - incomingDamage(b.enemy));
    expect(after.lastResult?.ok).toBe(false);
    // only asserted when the typo is unambiguously closest to the target
    if (!others.some((r) => r.length === target.label.romaji.length && r.slice(0, -1) === target.label.romaji.slice(0, -1))) {
      expect(answers).toEqual(target.label.kana.map((k) => ({ id: k, correct: false })));
    }
  });

  it('submitting speaks the matched kana, or on a misread the one you were aiming at', () => {
    const ctx = ctxFor();
    const b = battle(['strike', 'guard', 'water_jet', 'wind_slash']);
    const slot = b.slots[0];
    expect(playTurn(setTyped(b, slot.label.romaji), ctx).battle.lastResult?.speak).toBe(slot.label.text);
    const typo = slot.label.romaji.slice(0, -1) + 'x';
    const miss = playTurn(setTyped(b, typo), ctx).battle.lastResult;
    expect(miss?.ok).toBe(false);
    expect(miss?.speak === undefined || b.slots.some((s) => s.label.text === miss.speak)).toBe(true);
    expect(playTurn(b, ctx).battle.lastResult?.speak).toBeUndefined(); // skipping says nothing
  });

  it('typed input is normalized (letters only, lowercase)', () => {
    const b = battle(['strike']);
    expect(setTyped(b, 'K a!').typed).toBe('ka');
  });

  it('skipping (nothing typed) just passes the turn', () => {
    const ctx = ctxFor();
    const b = battle(['strike', 'guard', 'water_jet', 'wind_slash']);
    const { battle: after, answers } = playTurn(b, ctx);
    expect(answers).toEqual([]);
    expect(after.enemy.hp).toBe(b.enemy.hp);
  });

  it('enemy weakness doubles damage, resistance halves it', () => {
    const b = battle(['fire_talisman', 'water_jet', 'guard', 'strike']); // kodama: weak fire, resists water
    // measured right after the move: the enemy's turn would also tick burn damage
    const fire = confirmTurn(typeFor(b, 'fire_talisman')).battle;
    expect(b.enemy.hp - fire.enemy.hp).toBe(MOVE_BY_ID.fire_talisman.value * 2);
    const water = confirmTurn(typeFor(b, 'water_jet')).battle;
    expect(b.enemy.hp - water.enemy.hp).toBe(Math.round(MOVE_BY_ID.water_jet.value * 0.5));
  });

  it('block is applied before the enemy attacks', () => {
    const ctx = ctxFor();
    const b = battle(['guard', 'strike', 'strike', 'strike']);
    expect(playTurn(typeFor(b, 'guard'), ctx).battle.playerHp).toBe(H);
  });

  it('killing the enemy ends the fight before it can act', () => {
    const ctx = ctxFor();
    const b = battle(['strike', 'guard', 'water_jet', 'wind_slash']);
    const low = { ...b, enemy: { ...b.enemy, hp: 3 } };
    const after = playTurn(typeFor(low, 'strike'), ctx).battle;
    expect(after.outcome).toBe('won');
    expect(after.playerHp).toBe(H);
  });

  it('enemy HP is scaled by tier', () => {
    expect(battle(['strike']).enemy.maxHp).toBe(Math.round(ENEMY_BY_ID.kodama.hp * CONFIG.scaling.tierHp.normal));
  });
});

describe('relics and words', () => {
  it('word labels give ×1.5 power and appear once word moves are unlocked', () => {
    const b = battle(['strike']);
    const word = { kind: 'word' as const, ref: 'ねこ', text: 'ねこ', romaji: 'neko', kana: ['ね', 'こ'] };
    expect(previewMove(MOVE_BY_ID.strike, word, b).damagePerHit).toBe(Math.round(MOVE_BY_ID.strike.value * CONFIG.combat.wordMultiplier));
    const ctx = ctxFor(31, 5);
    let words = 0;
    for (let i = 0; i < 20; i++) words += battle(CONFIG.player.starterDeck as unknown as string[], 'kodama', { ...ctx, rng: seeded(i) }).slots.filter((s) => s.label.kind === 'word').length;
    expect(words).toBeGreaterThan(0);
  });

  it('Dakuten Blade boosts moves labelled with a voiced kana', () => {
    const b = { ...battle(['strike']), relics: ['dakuten_blade'] };
    const ga = { kind: 'kana' as const, ref: 'が', text: 'が', romaji: KANA_BY_ID['が'].romaji, kana: ['が'] };
    const p = previewMove(MOVE_BY_ID.strike, ga, b);
    expect(p.damagePerHit).toBe(MOVE_BY_ID.strike.value + CONFIG.relics.voicedBonus);
    expect(p.pierce).toBe(true);
  });

  it('reward options never offer starter moves', () => {
    const opts = moveRewardOptions(3, CONFIG.run.rarityOdds, seeded(2));
    expect(opts).toHaveLength(3);
    expect(opts.every((c) => MOVE_BY_ID[c.moveId].rarity !== 'starter')).toBe(true);
  });
});

describe('combo meter', () => {
  const strikes = ['strike', 'strike', 'strike', 'strike'];
  const castStrike = (b: BattleState, ctx: BattleCtx) => ({ ...playTurn(setTyped(b, b.slots[0].label.romaji), ctx).battle, playerHp: H });

  it('comboBonus follows the configured tiers', () => {
    expect(comboBonus(0)).toBe(0);
    expect(comboBonus(2)).toBe(0);
    expect(comboBonus(3)).toBe(0.1);
    expect(comboBonus(6)).toBe(0.2);
    expect(comboBonus(10)).toBe(0.3);
    expect(comboBonus(25)).toBe(0.3);
  });

  it('three correct readings in a row boost the next strike by 10%', () => {
    const ctx = ctxFor(3, 4);
    let b = battle(strikes, 'kodama', ctx);
    for (let i = 0; i < 3; i++) b = castStrike(b, ctx);
    expect(b.combo).toBe(3);
    expect(previewMove(MOVE_BY_ID.strike, b.slots[0].label, b).damagePerHit).toBe(Math.round(9 * 1.1));
  });

  it('a fizzle or a held turn resets the combo', () => {
    const ctx = ctxFor(3, 5);
    let b = battle(strikes, 'kodama', ctx);
    b = castStrike(b, ctx);
    b = castStrike(b, ctx);
    expect(b.combo).toBe(2);
    expect(confirmTurn(setTyped(b, 'zzz')).battle.combo).toBe(0);
    expect(confirmTurn(setTyped(b, '')).battle.combo).toBe(0);
  });

  it('the enemyHit fx carries the element and the damage dealt', () => {
    const b = battle(['fire_talisman', 'fire_talisman', 'fire_talisman', 'fire_talisman']);
    const fx = confirmTurn(typeFor(b, 'fire_talisman')).battle.fx.find((f) => f.kind === 'enemyHit')!;
    expect(fx.element).toBe('fire');
    expect(fx.amount).toBe(22);
  });

  it('a saved battle without a combo field loads with combo 0', () => {
    const b = battle(strikes);
    const { combo: _combo, ...old } = b;
    const run = parseRun({ version: 3, deck: [], map: [], hp: 10, floor: 1, phase: 'battle', battle: old });
    expect(run?.battle?.combo).toBe(0);
  });
});

describe('timeout and empty enter fizzle', () => {
  const deck = ['strike', 'strike', 'strike', 'strike'];
  const COST = CONFIG.combat.wrongHpCost;

  it('empty enter is a fizzle', () => {
    const r = confirmTurn(battle(deck));
    expect(r.battle.playerHp).toBe(H - COST);
    expect(r.battle.combo).toBe(0);
    expect(r.battle.stats.wrong).toBe(1);
    expect(r.battle.lastResult?.text).toBe('You froze up!');
    expect(r.battle.pending).toBe('enemy');
    expect(r.answers).toEqual([]);
  });

  it('timeout discards a correct typed answer', () => {
    const b = typeFor(battle(deck), 'strike');
    const r = confirmTurn(b, { timedOut: true });
    expect(r.battle.playerHp).toBe(H - COST);
    expect(r.battle.enemy.hp).toBe(b.enemy.hp);
    expect(r.battle.lastResult?.text).toBe("Time's up!");
    expect(r.battle.stats.wrong).toBe(1);
  });

  it('timeout with a near miss marks the aimed kana missed', () => {
    const b = battle(deck);
    const aim = b.slots[0].label;
    const r = confirmTurn(setTyped(b, aim.romaji.slice(0, -1) || 'z'), { timedOut: true });
    expect(r.answers.every((a) => !a.correct)).toBe(true);
  });

  it('timeout resets the combo; omamori absorbs the first one only', () => {
    let b: BattleState = { ...battle(deck), combo: 4, relics: ['omamori'] };
    b = confirmTurn(b, { timedOut: true }).battle;
    expect(b.combo).toBe(0);
    expect(b.playerHp).toBe(H);
    const second = confirmTurn({ ...b, pending: null }, { timedOut: true }).battle;
    expect(second.playerHp).toBe(H - COST);
  });

  it('timeout at 1 HP loses the battle', () => {
    const r = confirmTurn({ ...battle(deck), playerHp: 1 }, { timedOut: true });
    expect(r.battle.outcome).toBe('lost');
  });

  it('a second resolution while pending does nothing', () => {
    const once = confirmTurn(battle(deck), { timedOut: true }).battle;
    expect(confirmTurn(once, { timedOut: true }).battle).toBe(once);
  });
});
