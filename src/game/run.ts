import { CONFIG } from '../config';
import { ENEMIES, RELICS, SPELLS, UNLOCK_GROUPS, VOCAB, availableWords, unlockedKanaIds, wordScrollsUnlocked } from '../data';
import type { Card, EnemyDef, EnemyTier } from '../types';
import { type BattleCtx, type BattleState, createBattle } from './battle';
import { buildStartingDeck, makeCard } from './deck';
import { type MapNode, generateMap, nodeById } from './map';
import { type Rng, chance, pick, shuffle, weightedSample } from './rng';
import { type SrsStats, dueKana } from './srs';
import type { Profile } from './storage';

export type RunPhase = 'map' | 'battle' | 'reward' | 'rest' | 'over';

export type RewardStep =
  | { kind: 'unlock'; groupId: string }
  | { kind: 'cards'; options: Card[] }
  | { kind: 'relics'; options: string[] }
  | { kind: 'spells'; options: string[] };

export interface RunState {
  version: 1;
  floor: number;
  hp: number;
  maxHp: number;
  deck: Card[];
  relics: string[];
  /** Spell ids in the spell deck. */
  spells: string[];
  map: MapNode[];
  position: string | null;
  visited: string[];
  phase: RunPhase;
  battle: BattleState | null;
  battleNode: string | null;
  rewards: RewardStep[];
  /** What happens once the reward queue is empty. */
  afterRewards: 'map' | 'nextFloor';
  result: 'victory' | 'defeat' | null;
  stats: { fights: number; correct: number; wrong: number; words: number; missed: string[]; unlocked: string[] };
}

export function runCtx(profile: Profile, rng: Rng, weightOf: (id: string) => number): BattleCtx {
  const unlocked = unlockedKanaIds(profile.unlockedCount);
  return { unlocked, words: availableWords(new Set(unlocked)), weightOf, rng };
}

function hasDue(srs: SrsStats, unlocked: readonly string[], now: number) {
  return dueKana(srs, unlocked, now).length > 0;
}

export function newRun(profile: Profile, ctx: BattleCtx, now: number): RunState {
  const newestGroup = UNLOCK_GROUPS[profile.unlockedCount - 1]?.kana ?? [];
  const deck = buildStartingDeck(ctx.unlocked, newestGroup, ctx.words, ctx.weightOf, profile.runs === 0, ctx.rng);
  return {
    version: 1,
    floor: 1,
    hp: CONFIG.player.startHp,
    maxHp: CONFIG.player.startHp,
    deck,
    relics: [],
    spells: STARTER_SPELLS.slice(),
    map: generateMap(1, hasDue(profile.srs, ctx.unlocked, now), ctx.rng),
    position: null,
    visited: [],
    phase: 'map',
    battle: null,
    battleNode: null,
    rewards: [],
    afterRewards: 'map',
    result: null,
    stats: { fights: 0, correct: 0, wrong: 0, words: 0, missed: [], unlocked: [] },
  };
}

/** Pick an enemy for a node. Bosses: the strongest one available for this floor. */
export function pickEnemy(tier: EnemyTier, floor: number, rng: Rng): EnemyDef {
  const pool = ENEMIES.filter((e) => e.tier === tier && e.minFloor <= floor);
  if (tier === 'boss') {
    const bosses = ENEMIES.filter((e) => e.tier === 'boss').sort((a, b) => a.minFloor - b.minFloor);
    return bosses[(floor - 1) % bosses.length];
  }
  // prefer enemies new to this floor half the time
  const fresh = pool.filter((e) => e.minFloor === floor);
  return pick(rng, fresh.length && rng.next() < 0.5 ? fresh : pool.length ? pool : ENEMIES.filter((e) => e.tier === 'normal'));
}

export function enterNode(run: RunState, nodeId: string, srs: SrsStats, ctx: BattleCtx, now: number): RunState {
  const node = nodeById(run.map, nodeId);
  if (!node) return run;
  const moved: RunState = { ...run, position: node.id, visited: [...run.visited, node.id] };
  if (node.type === 'rest') return { ...moved, phase: 'rest' };
  const tier: EnemyTier = node.type === 'fight' ? 'normal' : node.type;
  const reviewKana = node.type === 'review' ? shuffle(ctx.rng, dueKana(srs, ctx.unlocked, now)) : [];
  const battle = createBattle({
    enemy: pickEnemy(tier, run.floor, ctx.rng),
    floor: run.floor,
    deck: run.deck,
    hp: run.hp,
    maxHp: run.maxHp,
    relics: run.relics,
    spells: run.spells,
    reviewKana,
    ctx,
  });
  return { ...moved, phase: 'battle', battle, battleNode: node.id };
}

/** Record kana missed this run (for the run-over screen). */
export function noteAnswers(run: RunState, answers: { id: string; correct: boolean }[]): RunState {
  const missed = answers.filter((a) => !a.correct).map((a) => a.id);
  if (!missed.length) return run;
  return { ...run, stats: { ...run.stats, missed: [...new Set([...run.stats.missed, ...missed])] } };
}

/**
 * Called once the battle has an outcome. Returns the updated run and profile
 * (bosses unlock the next kana group permanently).
 */
export function finishBattle(run: RunState, profile: Profile, ctx: BattleCtx): { run: RunState; profile: Profile } {
  const b = run.battle;
  if (!b || b.outcome === 'ongoing') return { run, profile };
  const stats = {
    ...run.stats,
    fights: run.stats.fights + 1,
    correct: run.stats.correct + b.stats.correct,
    wrong: run.stats.wrong + b.stats.wrong,
    words: run.stats.words + b.stats.words,
  };
  const bestFloor = Math.max(profile.bestFloor, run.floor);
  if (b.outcome === 'lost') {
    return {
      run: { ...run, hp: 0, stats, battle: null, phase: 'over', result: 'defeat' },
      profile: { ...profile, runs: profile.runs + 1, bestFloor },
    };
  }
  let hp = b.playerHp;
  if (run.relics.includes('matcha')) hp = Math.min(run.maxHp, hp + CONFIG.relics.healAfterFight);
  const node = nodeById(run.map, run.battleNode);
  let next: RunState = { ...run, hp, stats, battle: null, battleNode: null };
  let nextProfile: Profile = { ...profile, bestFloor };

  const rewards: RewardStep[] = [];
  if (node?.type !== 'boss') rewards.push({ kind: 'cards', options: cardRewardOptions(nextProfile, ctx) });
  if (node?.type === 'elite') rewards.push({ kind: 'spells', options: spellOptions(next, CONFIG.spells.eliteSpellOptions, ctx.rng) });
  if (node?.type === 'elite') rewards.push({ kind: 'relics', options: relicOptions(next, CONFIG.run.eliteRelicOptions, ctx.rng) });
  if (node?.type === 'boss') {
    if (nextProfile.unlockedCount < UNLOCK_GROUPS.length) {
      const group = UNLOCK_GROUPS[nextProfile.unlockedCount];
      nextProfile = { ...nextProfile, unlockedCount: nextProfile.unlockedCount + 1 };
      next = { ...next, deck: [...next.deck, ...cardsForGroup(group.id, ctx.rng)], stats: { ...next.stats, unlocked: [...next.stats.unlocked, group.id] } };
      rewards.push({ kind: 'unlock', groupId: group.id });
    }
    rewards.push({ kind: 'relics', options: relicOptions(next, CONFIG.run.bossRelicOptions, ctx.rng) });
  }
  next = { ...next, rewards, phase: 'reward', afterRewards: node?.type === 'boss' ? 'nextFloor' : 'map' };
  return finishRewardsIfEmpty(next, nextProfile, ctx);
}

/** Drop the current reward step (claimed or skipped) and move on when the queue is empty. */
export function popReward(run: RunState, profile: Profile, ctx: BattleCtx): { run: RunState; profile: Profile } {
  return finishRewardsIfEmpty({ ...run, rewards: run.rewards.slice(1) }, profile, ctx);
}

function finishRewardsIfEmpty(run: RunState, profile: Profile, ctx: BattleCtx): { run: RunState; profile: Profile } {
  if (run.rewards.length) return { run, profile };
  if (run.afterRewards === 'nextFloor') return advanceFloor({ ...run, afterRewards: 'map' }, profile, ctx);
  return { run: { ...run, phase: 'map' }, profile };
}

/**
 * Card reward: kana weighted by SRS (missed kana ×3) with the newest row boosted,
 * plus sometimes a Word Scroll once those are unlocked.
 */
export function cardRewardOptions(profile: Profile, ctx: BattleCtx): Card[] {
  const n = CONFIG.run.cardRewardOptions;
  const newest = new Set(UNLOCK_GROUPS[profile.unlockedCount - 1]?.kana ?? []);
  const kana = weightedSample(ctx.rng, ctx.unlocked, n, (k) => ctx.weightOf(k) * (newest.has(k) ? 2 : 1));
  const cards = kana.map((k) => makeCard(k, chance(ctx.rng, 0.5) ? 'attack' : 'block'));
  if (wordScrollsUnlocked(profile.unlockedCount) && ctx.words.length && chance(ctx.rng, 0.5)) {
    cards[cards.length - 1] = makeCard(pick(ctx.rng, ctx.words).id, 'word');
  }
  return cards;
}

export function relicOptions(run: RunState, n: number, rng: Rng): string[] {
  return shuffle(rng, RELICS.filter((r) => !run.relics.includes(r.id)).map((r) => r.id)).slice(0, n);
}

export function takeCard(run: RunState, card: Card): RunState {
  return { ...run, deck: [...run.deck, card] };
}

export const STARTER_SPELLS = SPELLS.filter((s) => s.starter).map((s) => s.id);

/** Spells you don't own yet first; duplicates only once you own them all. */
export function spellOptions(run: RunState, n: number, rng: Rng): string[] {
  const fresh = SPELLS.filter((s) => !run.spells.includes(s.id)).map((s) => s.id);
  const pool = fresh.length >= n ? fresh : SPELLS.map((s) => s.id);
  return shuffle(rng, pool).slice(0, n);
}

export function takeSpell(run: RunState, spellId: string): RunState {
  return { ...run, spells: [...run.spells, spellId] };
}

export function takeRelic(run: RunState, relicId: string): RunState {
  if (run.relics.includes(relicId)) return run;
  let next = { ...run, relics: [...run.relics, relicId] };
  if (relicId === 'daruma') next = { ...next, maxHp: next.maxHp + CONFIG.relics.maxHpBonus, hp: next.hp + CONFIG.relics.maxHpBonus };
  return next;
}

/** New cards added to the deck when a group unlocks. */
export function cardsForGroup(groupId: string, rng: Rng): Card[] {
  const g = UNLOCK_GROUPS.find((x) => x.id === groupId);
  if (!g) return [];
  if (g.words) {
    return shuffle(rng, VOCAB.filter((v) => v.kana.length <= 3))
      .slice(0, 2)
      .map((v) => makeCard(v.id, 'word'));
  }
  return g.kana.map((k, i) => makeCard(k, i % 2 ? 'block' : 'attack'));
}

/** After a boss (and its rewards): next floor, or victory after the last floor. */
export function advanceFloor(run: RunState, profile: Profile, ctx: BattleCtx, now = Date.now()): { run: RunState; profile: Profile } {
  if (run.floor >= CONFIG.run.floors) {
    return {
      run: { ...run, phase: 'over', result: 'victory', rewards: [] },
      profile: { ...profile, runs: profile.runs + 1, wins: profile.wins + 1, bestFloor: Math.max(profile.bestFloor, run.floor) },
    };
  }
  const floor = run.floor + 1;
  const heal = Math.round((run.maxHp - run.hp) * CONFIG.run.bossHealMissingPct);
  const unlocked = unlockedKanaIds(profile.unlockedCount);
  return {
    run: {
      ...run,
      floor,
      hp: run.hp + heal,
      map: generateMap(floor, hasDue(profile.srs, unlocked, now), ctx.rng),
      position: null,
      visited: [],
      phase: 'map',
      rewards: [],
    },
    profile,
  };
}

export function restHeal(run: RunState): RunState {
  return { ...run, hp: Math.min(run.maxHp, run.hp + Math.round(run.maxHp * CONFIG.run.restHealPct)), phase: 'map' };
}

export function studyReward(run: RunState, correct: number): RunState {
  const R = CONFIG.run;
  const maxHp = run.maxHp + correct * R.studyMaxHpPerCorrect;
  return { ...run, maxHp, hp: Math.min(maxHp, run.hp + correct * (R.studyHealPerCorrect + R.studyMaxHpPerCorrect)), phase: 'map' };
}

/** Light validation for saved runs: anything odd → discard the save. */
export function parseRun(raw: unknown): RunState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<RunState>;
  if (r.version !== 1 || !Array.isArray(r.deck) || !Array.isArray(r.map) || typeof r.hp !== 'number' || typeof r.floor !== 'number') return null;
  if (!r.phase || !['map', 'battle', 'reward', 'rest', 'over'].includes(r.phase)) return null;
  if (r.phase === 'battle' && !r.battle) return null;
  const run = { rewards: [], relics: [], visited: [], afterRewards: 'map', spells: STARTER_SPELLS.slice(), ...r } as RunState;
  // saves from before spells existed: give the battle an empty spellbook
  if (run.battle && !Array.isArray(run.battle.spellHand)) {
    run.battle = { ...run.battle, spellPile: run.spells.slice(), spellDiscard: [], spellHand: [], spellsCast: 0 };
  }
  return run;
}
