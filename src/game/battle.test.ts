import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { ENEMY_BY_ID, KANA_BY_ID, MOVE_BY_ID, availableWords, unlockedKanaIds } from '../data';
import { type BattleCtx, type BattleState, confirmTurn, createBattle, pickTile, previewMove } from './battle';
import { makeCard, moveRewardOptions } from './deck';
import { seeded } from './rng';

const ctxFor = (unlockedCount = 3, seed = 1): BattleCtx => {
  const unlocked = unlockedKanaIds(unlockedCount);
  return { weightOf: () => 1, unlocked, words: availableWords(new Set(unlocked)), unlockedCount, rng: seeded(seed) };
};

function battle(deck: string[], enemy = 'kodama', ctx = ctxFor()): BattleState {
  return createBattle({ enemy: ENEMY_BY_ID[enemy], floor: 1, deck: deck.map(makeCard), hp: 50, maxHp: 50, relics: [], ctx });
}

const tileFor = (b: BattleState, moveId: string) => {
  const slot = b.slots.find((s) => s.card.moveId === moveId)!;
  return b.tiles.find((t) => t.slot === slot.uid)!;
};

describe('dealing moves', () => {
  it('deals N moves with distinct romaji labels, plus decoy tiles that match nothing', () => {
    for (let seed = 1; seed < 30; seed++) {
      const ctx = ctxFor(3, seed);
      const b = battle(CONFIG.player.starterDeck as unknown as string[], 'kodama', ctx);
      expect(b.slots).toHaveLength(CONFIG.combat.movesPerTurn);
      const romaji = b.slots.map((s) => s.label.romaji);
      expect(new Set(romaji).size).toBe(romaji.length);
      expect(b.tiles.filter((t) => t.slot)).toHaveLength(b.slots.length);
      const decoys = b.tiles.filter((t) => !t.slot);
      expect(decoys.length).toBe(CONFIG.combat.decoyTiles);
      // a decoy never shares a reading with any move, so exactly one tile reads each label
      for (const d of decoys) expect(romaji).not.toContain(d.romaji);
      // tiles are kana from the unlocked pool
      for (const t of b.tiles) expect(t.kana.every((k) => ctx.unlocked.includes(k))).toBe(true);
    }
  });

  it('a move is not tied to any kana: labels change from turn to turn', () => {
    const ctx = ctxFor(5, 3);
    let b = battle(['strike', 'strike', 'strike', 'strike'], 'kodama', ctx);
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      b.slots.forEach((s) => seen.add(s.label.romaji));
      b = { ...confirmTurn(b, ctx).battle, playerHp: 50 };
    }
    expect(seen.size).toBeGreaterThan(CONFIG.combat.movesPerTurn);
  });
});

describe('confirming a turn', () => {
  it('picking does nothing until End Turn; then the move resolves and the enemy acts', () => {
    const ctx = ctxFor();
    const b = battle(['strike', 'guard', 'water_jet', 'wind_slash']);
    const t = tileFor(b, 'strike');
    const picked = pickTile(b, t.id);
    expect(picked.enemy.hp).toBe(b.enemy.hp);
    const { battle: after, answers } = confirmTurn(picked, ctx);
    expect(b.enemy.hp - after.enemy.hp).toBe(MOVE_BY_ID.strike.value);
    expect(answers).toEqual(t.kana.map((k) => ({ id: k, correct: true })));
    expect(after.turn).toBe(2);
    expect(after.lastResult?.ok).toBe(true);
    expect(after.playerHp).toBe(50 - 5); // kodama attacks for 5
  });

  it('enemy weakness doubles damage, resistance halves it', () => {
    const ctx = ctxFor();
    const b = battle(['fire_talisman', 'water_jet', 'guard', 'strike']); // kodama: weak fire, resists water
    const fire = confirmTurn(pickTile(b, tileFor(b, 'fire_talisman').id), ctx).battle;
    expect(b.enemy.hp - fire.enemy.hp).toBe(Math.min(b.enemy.hp, MOVE_BY_ID.fire_talisman.value * 2));
    const water = confirmTurn(pickTile(b, tileFor(b, 'water_jet').id), ctx).battle;
    expect(b.enemy.hp - water.enemy.hp).toBe(Math.round(MOVE_BY_ID.water_jet.value * 0.5));
  });

  it('block is applied before the enemy attacks', () => {
    const ctx = ctxFor();
    const b = battle(['guard', 'strike', 'strike', 'strike']);
    const after = confirmTurn(pickTile(b, tileFor(b, 'guard').id), ctx).battle;
    expect(after.playerHp).toBe(50); // 8 block vs 5 damage
  });

  it('a decoy fizzles, costs HP and marks the imitated kana as missed', () => {
    const ctx = ctxFor();
    const b = battle(['strike', 'guard', 'water_jet', 'wind_slash']);
    const decoy = b.tiles.find((t) => !t.slot)!;
    const target = b.slots.find((s) => s.uid === decoy.decoyOf)!;
    const { battle: after, answers } = confirmTurn(pickTile(b, decoy.id), ctx);
    expect(after.enemy.hp).toBe(b.enemy.hp);
    expect(after.playerHp).toBe(50 - CONFIG.combat.decoyHpCost - 5);
    expect(answers).toEqual(target.label.kana.map((k) => ({ id: k, correct: false })));
    expect(after.lastResult?.ok).toBe(false);
  });

  it('skipping (no pick) just passes the turn', () => {
    const ctx = ctxFor();
    const b = battle(['strike', 'guard', 'water_jet', 'wind_slash']);
    const { battle: after, answers } = confirmTurn(b, ctx);
    expect(answers).toEqual([]);
    expect(after.enemy.hp).toBe(b.enemy.hp);
  });

  it('killing the enemy ends the fight before it can act', () => {
    const ctx = ctxFor();
    const b = battle(['strike', 'guard', 'water_jet', 'wind_slash']);
    const low = { ...b, enemy: { ...b.enemy, hp: 3 } };
    const after = confirmTurn(pickTile(low, tileFor(low, 'strike').id), ctx).battle;
    expect(after.outcome).toBe('won');
    expect(after.playerHp).toBe(50);
  });
});

describe('relics and words', () => {
  it('word labels give ×1.5 power once word moves are unlocked', () => {
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

  it('reward options never offer starter moves and respect count', () => {
    const opts = moveRewardOptions(3, CONFIG.run.rarityOdds, seeded(2));
    expect(opts).toHaveLength(3);
    expect(opts.every((c) => MOVE_BY_ID[c.moveId].rarity !== 'starter')).toBe(true);
  });
});
