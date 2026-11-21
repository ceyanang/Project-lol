import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { ENEMY_BY_ID, availableWords, unlockedKanaIds } from '../data';
import { blindView, createBattle, planPlay, resolvePlay } from './battle';
import { makeCard } from './deck';
import { romajiOptions } from './distractors';
import { seeded } from './rng';

const unlocked = unlockedKanaIds(2);
const ctx = { weightOf: () => 1, unlocked, words: availableWords(new Set(unlocked)), rng: seeded(3) };

describe('match hints', () => {
  const base = createBattle({ enemy: ENEMY_BY_ID.kodama, floor: 1, deck: [makeCard('あ', 'attack')], hp: 50, maxHp: 50, relics: [], ctx });
  const b = { ...base, energy: 3, hand: [makeCard('か', 'attack')], prompts: { guard: null, weak: ['ka'], word: null } };

  it('preview hides the weak-spot bonus by default', () => {
    expect(CONFIG.combat.showMatchHints).toBe(false);
    const preview = planPlay(blindView(b), [b.hand[0].uid], ctx);
    expect(preview.damage).toBe(CONFIG.cards.attackDamage);
    expect(preview.label).toBe('');
  });

  it('the real play still gets the bonus and reveals it afterwards', () => {
    const { battle } = resolvePlay(b, planPlay(b, [b.hand[0].uid], ctx), [true]);
    expect(b.enemy.hp - battle.enemy.hp).toBe(CONFIG.cards.attackDamage * 2);
    expect(battle.fx.some((f) => f.text.includes('Weak spot'))).toBe(true);
  });

  it('prompt readings show up as decoys in the reading check', () => {
    for (let s = 0; s < 50; s++) {
      const opts = romajiOptions('い', unlocked, seeded(s), 4, ['o', 'ka']);
      expect(opts).toContain('i');
      expect(opts).toContain('o');
      expect(opts).toContain('ka');
    }
  });
});
