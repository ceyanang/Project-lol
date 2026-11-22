import { CONFIG } from '../config';
import { ENEMY_BY_ID, availableWords, firstGroups, unlockedKanaIds } from '../data';
import { type BattleCtx, type BattleState, createBattle, setTyped } from './battle';
import { makeCard } from './deck';
import { seeded } from './rng';

/** Shared helpers for engine tests. */
export const HP = CONFIG.player.startHp;

export const ctxFor = (unlockedCount = 3, seed = 1): BattleCtx => {
  const groups = firstGroups(unlockedCount);
  const unlocked = unlockedKanaIds(groups);
  return { weightOf: () => 1, unlocked, words: availableWords(new Set(unlocked)), wordsUnlocked: groups.includes('words'), rng: seeded(seed) };
};

export function makeBattle(deck: string[], enemy = 'kodama', ctx = ctxFor(), floor = 1): BattleState {
  return createBattle({ enemy: ENEMY_BY_ID[enemy], floor, deck: deck.map(makeCard), hp: HP, maxHp: HP, relics: [], ctx });
}

/** Type the reading of the slot holding `moveId`. */
export const typeFor = (b: BattleState, moveId: string) => setTyped(b, b.slots.find((s) => s.card.moveId === moveId)!.label.romaji);
