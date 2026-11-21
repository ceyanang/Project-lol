import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { ENEMY_BY_ID, KANA_BY_ID, availableWords, unlockedKanaIds } from '../data';
import { canCastSpell, castSpell, createBattle, endTurn } from './battle';
import { makeCard } from './deck';
import { seeded } from './rng';
import { kanaOptions } from './distractors';
import { isRightKana } from './battle';

const unlocked = unlockedKanaIds(3);
const ctx = { weightOf: () => 1, unlocked, words: availableWords(new Set(unlocked)), rng: seeded(7) };
const battle = (spells: string[]) =>
  createBattle({ enemy: ENEMY_BY_ID.kodama, floor: 1, deck: [makeCard('あ', 'attack'), makeCard('い', 'block')], hp: 50, maxHp: 50, relics: [], spells, ctx });

describe('spells', () => {
  it('draws spells into the spellbook, each labelled with a different kana', () => {
    const b = battle(['fire_talisman', 'stone_ward', 'wind_slash']);
    expect(b.spellHand).toHaveLength(CONFIG.spells.drawPerTurn);
    expect(new Set(b.spellHand.map((s) => s.kana)).size).toBe(b.spellHand.length);
    expect(b.spellHand.every((s) => unlocked.includes(s.kana))).toBe(true);
  });

  it('typing the right reading casts the spell; only one per turn', () => {
    const b = battle(['fire_talisman', 'fire_talisman']);
    const s = b.spellHand[0];
    const { battle: after, answers } = castSpell(b, s.uid, s.kana, ctx);
    expect(b.enemy.hp - after.enemy.hp).toBe(10);
    expect(answers).toEqual([{ id: s.kana, correct: true }]);
    expect(canCastSpell(after)).toBe(false);
    const second = castSpell(after, after.spellHand[0].uid, after.spellHand[0].kana, ctx);
    expect(second.battle).toBe(after);
  });

  it('a wrong reading fizzles, costs HP and still uses the turn', () => {
    const b = battle(['fire_talisman', 'stone_ward']);
    const wrong = unlocked.find((k) => KANA_BY_ID[k].romaji !== KANA_BY_ID[b.spellHand[0].kana].romaji)!;
    const { battle: after, answers } = castSpell(b, b.spellHand[0].uid, wrong, ctx);
    expect(after.enemy.hp).toBe(b.enemy.hp);
    expect(after.playerHp).toBe(50 - CONFIG.spells.wrongHpCost);
    expect(answers[0].correct).toBe(false);
    expect(canCastSpell(after)).toBe(false);
  });

  it('the next turn draws a fresh spellbook and resets the cast', () => {
    const b = battle(['fire_talisman', 'stone_ward', 'wind_slash']);
    const cast = castSpell(b, b.spellHand[0].uid, b.spellHand[0].kana, ctx).battle;
    const next = endTurn(cast, ctx);
    expect(canCastSpell(next)).toBe(true);
    expect(next.spellHand).toHaveLength(2);
  });

  it('only the same-script kana with that reading counts', () => {
    expect(isRightKana('か', 'か')).toBe(true);
    expect(isRightKana('か', 'カ')).toBe(false);
    expect(isRightKana('じ', 'ぢ')).toBe(true);
    expect(isRightKana('か', 'が')).toBe(false);
  });

  it('kana options: one right answer, same script, includes look-alikes', () => {
    for (let s = 0; s < 40; s++) {
      const opts = kanaOptions('シ', unlocked, seeded(s), 6);
      expect(opts).toHaveLength(6);
      expect(opts.filter((o) => KANA_BY_ID[o].romaji === 'shi')).toEqual(['シ']);
      expect(opts.every((o) => KANA_BY_ID[o].script === 'katakana')).toBe(true);
      expect(opts).toContain('ツ');
    }
  });
});

import { finishBattle, newRun, takeSpell, STARTER_SPELLS } from './run';
import { newProfile } from './storage';

describe('spell rewards', () => {
  it('runs start with the starter spells and elites offer new spells', () => {
    const profile = newProfile();
    const run = newRun(profile, ctx, 0);
    expect(run.spells).toEqual(STARTER_SPELLS);
    const elite = run.map.find((n) => n.row === 0)!;
    const b = battle(run.spells);
    const won = { ...run, map: run.map.map((n) => (n.id === elite.id ? { ...n, type: 'elite' as const } : n)), battleNode: elite.id, battle: { ...b, outcome: 'won' as const }, phase: 'battle' as const };
    const res = finishBattle(won, profile, ctx);
    const step = res.run.rewards.find((r) => r.kind === 'spells');
    expect(step && step.kind === 'spells' && step.options.every((id) => !STARTER_SPELLS.includes(id))).toBe(true);
    expect(takeSpell(res.run, 'thunder_drum').spells).toContain('thunder_drum');
  });
});

describe('spell kana options', () => {
  it('prefer unlocked kana for decoys', () => {
    const early = unlockedKanaIds(2); // あ + か rows
    for (let s = 0; s < 40; s++) {
      const opts = kanaOptions('お', early, seeded(s), 6);
      expect(opts.every((o) => early.includes(o))).toBe(true);
    }
  });
});
