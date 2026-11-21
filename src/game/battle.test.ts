import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { ENEMY_BY_ID, VOCAB, availableWords, unlockedKanaIds } from '../data';
import { type BattleCtx, createBattle, endTurn, planPlay, resolvePlay } from './battle';
import { makeCard, matchWord, weightedDraw } from './deck';
import { seeded } from './rng';

const unlocked = unlockedKanaIds(2);
const ctx = (seed = 1): BattleCtx => ({
  weightOf: () => 1,
  unlocked,
  words: availableWords(new Set(unlocked)),
  rng: seeded(seed),
});

function battleWith(handRefs: [string, 'attack' | 'block'][], enemy = 'kodama') {
  const c = ctx();
  const b = createBattle({ enemy: ENEMY_BY_ID[enemy], floor: 1, deck: [makeCard('あ', 'attack')], hp: 50, maxHp: 50, relics: [], ctx: c });
  return { b: { ...b, hand: handRefs.map(([r, t]) => makeCard(r, t)), energy: 3, prompts: { guard: null, weak: [], word: null } }, c };
}

describe('battle', () => {
  it('a correct single attack deals base damage minus armor', () => {
    const { b, c } = battleWith([['か', 'attack']], 'kappa');
    const plan = planPlay(b, [b.hand[0].uid], c);
    const { battle, answers } = resolvePlay(b, plan, [true]);
    expect(battle.enemy.hp).toBe(b.enemy.hp - (CONFIG.cards.attackDamage - 1));
    expect(answers).toEqual([{ id: 'か', correct: true }]);
    expect(battle.energy).toBe(2);
  });

  it('weak spot doubles damage and is consumed', () => {
    const { b, c } = battleWith([['か', 'attack']]);
    const withPrompt = { ...b, prompts: { guard: null, weak: ['ka'], word: null } };
    const { battle } = resolvePlay(withPrompt, planPlay(withPrompt, [b.hand[0].uid], c), [true]);
    expect(b.enemy.hp - battle.enemy.hp).toBe(CONFIG.cards.attackDamage * 2);
    expect(battle.prompts.weak).toEqual([]);
  });

  it('a wrong reading costs HP and the card fizzles', () => {
    const { b, c } = battleWith([['か', 'attack']]);
    const { battle, answers } = resolvePlay(b, planPlay(b, [b.hand[0].uid], c), [false]);
    expect(battle.enemy.hp).toBe(b.enemy.hp);
    expect(battle.playerHp).toBe(50 - CONFIG.combat.wrongReadingHpCost);
    expect(answers[0].correct).toBe(false);
  });

  it('chained kana in any tap order form a word combo', () => {
    const { b, c } = battleWith([['こ', 'attack'], ['あ', 'block'], ['か', 'attack']]);
    // tapped こ then か — should be reordered to かこ? not a word; あか = red
    const plan = planPlay(b, [b.hand[2].uid, b.hand[1].uid], c);
    expect(plan.word?.reading).toBe('あか');
    expect(plan.cost).toBe(1);
    const { battle } = resolvePlay(b, plan, [true, true]);
    expect(battle.stats.words).toBe(1);
    expect(battle.playerBlock).toBe(Math.round(CONFIG.cards.blockAmount * 1.5));
    expect(b.enemy.hp - battle.enemy.hp).toBe(Math.round(CONFIG.cards.attackDamage * 1.5));
  });

  it('a miss inside a chain breaks the combo multiplier', () => {
    const { b, c } = battleWith([['あ', 'attack'], ['か', 'attack']]);
    const plan = planPlay(b, [b.hand[0].uid, b.hand[1].uid], c);
    const { battle } = resolvePlay(b, plan, [true, false]);
    expect(b.enemy.hp - battle.enemy.hp).toBe(CONFIG.cards.attackDamage);
    expect(battle.stats.words).toBe(0);
  });

  it('enemy attacks through block on end turn and a new hand is drawn', () => {
    const { b, c } = battleWith([['あ', 'block']]);
    const blocked = { ...b, playerBlock: 3 };
    const after = endTurn(blocked, c);
    expect(after.playerHp).toBe(50 - (5 - 3));
    expect(after.hand.length).toBeGreaterThan(0);
    expect(after.turn).toBe(b.turn + 1);
  });

  it('matchWord finds words regardless of order', () => {
    const cards = [makeCard('こ', 'attack'), makeCard('ね', 'attack')];
    expect(matchWord(cards, VOCAB)?.word.reading).toBe('ねこ');
  });

  it('weighted draw favours heavy kana (missed ×3)', () => {
    const rng = seeded(42);
    let heavy = 0;
    for (let i = 0; i < 2000; i++) {
      const pile = [makeCard('あ', 'attack'), makeCard('い', 'attack')];
      const { drawn } = weightedDraw(pile, 1, (k) => (k === 'あ' ? 3 : 1), rng);
      if (drawn[0].ref === 'あ') heavy++;
    }
    expect(heavy / 2000).toBeGreaterThan(0.7);
    expect(heavy / 2000).toBeLessThan(0.8);
  });
});
