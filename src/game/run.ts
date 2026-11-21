import { CONFIG } from '../config';
import { ENEMIES, RELICS, availableWords, nextLockedGroup, unlockedKanaIds, wordMovesUnlocked } from '../data';
import type { Card, EnemyDef, EnemyTier } from '../types';
import { type BattleCtx, type BattleState, createBattle } from './battle';
import { moveRewardOptions, starterDeck } from './deck';
import { type MapNode, generateMap, nodeById } from './map';
import { type Rng, pick, shuffle } from './rng';
import { type SrsStats, dueKana } from './srs';
import type { Difficulty, Profile } from './storage';

export type RunPhase = 'map' | 'battle' | 'reward' | 'rest' | 'over';

export type RewardStep =
  | { kind: 'unlock'; groupId: string }
  | { kind: 'moves'; options: Card[] }
  | { kind: 'relics'; options: string[] };

export interface RunState {
  version: 2;
  difficulty: Difficulty;
  floor: number;
  hp: number;
  maxHp: number;
  deck: Card[];
  relics: string[];
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

/** Battle context for a run. The run's own difficulty wins over the profile's last pick. */
export function runCtx(profile: Profile, rng: Rng, weightOf: (id: string) => number, difficulty?: Difficulty): BattleCtx {
  const unlocked = unlockedKanaIds(profile.unlocked);
  return {
    unlocked,
    words: availableWords(new Set(unlocked)),
    wordsUnlocked: wordMovesUnlocked(profile.unlocked),
    difficulty: difficulty ?? profile.difficulty,
    weightOf,
    rng,
  };
}

function hasDue(srs: SrsStats, unlocked: readonly string[], now: number) {
  return dueKana(srs, unlocked, now).length > 0;
}

export function newRun(profile: Profile, ctx: BattleCtx, now: number): RunState {
  const deck = starterDeck(ctx.rng);
  return {
    version: 2,
    difficulty: ctx.difficulty,
    floor: 1,
    hp: CONFIG.player.startHp,
    maxHp: CONFIG.player.startHp,
    deck,
    relics: [],
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
  if (node?.type !== 'boss') {
    const odds = node?.type === 'elite' ? CONFIG.run.eliteRarityOdds : CONFIG.run.rarityOdds;
    rewards.push({ kind: 'moves', options: moveRewardOptions(CONFIG.run.moveRewardOptions, odds, ctx.rng) });
  }
  if (node?.type === 'elite') rewards.push({ kind: 'relics', options: relicOptions(next, CONFIG.run.eliteRelicOptions, ctx.rng) });
  if (node?.type === 'boss') {
    const group = nextLockedGroup(nextProfile.unlocked);
    if (group) {
      nextProfile = { ...nextProfile, unlocked: [...nextProfile.unlocked, group.id] };
      next = { ...next, stats: { ...next.stats, unlocked: [...next.stats.unlocked, group.id] } };
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

export function relicOptions(run: RunState, n: number, rng: Rng): string[] {
  return shuffle(rng, RELICS.filter((r) => !run.relics.includes(r.id)).map((r) => r.id)).slice(0, n);
}

export function takeCard(run: RunState, card: Card): RunState {
  return { ...run, deck: [...run.deck, card] };
}

export function takeRelic(run: RunState, relicId: string): RunState {
  if (run.relics.includes(relicId)) return run;
  let next = { ...run, relics: [...run.relics, relicId] };
  if (relicId === 'daruma') next = { ...next, maxHp: next.maxHp + CONFIG.relics.maxHpBonus, hp: next.hp + CONFIG.relics.maxHpBonus };
  return next;
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
  const unlocked = unlockedKanaIds(profile.unlocked);
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
  if (r.version !== 2 || !Array.isArray(r.deck) || !Array.isArray(r.map) || typeof r.hp !== 'number' || typeof r.floor !== 'number') return null;
  if (!r.phase || !['map', 'battle', 'reward', 'rest', 'over'].includes(r.phase)) return null;
  if (r.phase === 'battle' && (!r.battle || !Array.isArray(r.battle.tiles))) return null;
  return { rewards: [], relics: [], visited: [], afterRewards: 'map', difficulty: 'normal', ...r } as RunState;
}
