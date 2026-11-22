/**
 * Every tunable number in the game. Keep PLAN.md in sync when you change these.
 */
export const CONFIG = {
  player: {
    startHp: 70,
    /** Starting deck: move ids (copies = more likely to be dealt). */
    starterDeck: ['strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'fire_talisman', 'water_jet', 'wind_slash'],
  },
  combat: {
    /** Moves dealt each turn, each labelled with a different romaji. */
    movesPerTurn: 4,

    /** Typing a reading that matches no move: it fizzles and you take this much damage. */
    wrongHpCost: 3,
    /** Time to cast a move each turn, by difficulty; running out (or an empty enter) is a fizzle. */
    turnTimeMs: { easy: 15000, normal: 8000, hard: 6000 },
    weaknessMultiplier: 2,
    resistMultiplier: 0.5,
    /** Chance a move is labelled with a whole word instead of one kana (once Word moves are unlocked). */
    wordMoveChance: 0.25,
    maxWordLength: 3,
    wordMultiplier: 1.5,
    /** Pause after your move before the enemy acts, and after the enemy before the next deal (ms). */
    enemyDelayMs: 1300,
    dealDelayMs: 900,
    /** Reading-check tiles in Study drills. */
    readingOptions: 4,
  },
  /** Consecutive correct readings boost every move's power (highest reached tier applies). Resets on a fizzle or a held turn. */
  combo: {
    tiers: [
      { at: 3, bonus: 0.1 },
      { at: 6, bonus: 0.2 },
      { at: 10, bonus: 0.3 },
    ],
  },
  /** Elemental statuses applied to the enemy by attack moves (see PLAN.md §1). */
  status: {
    burnStacksPerHit: 2,
    burnMax: 6,
    soakTurns: 2,
    /** Thunder on a soaked enemy. */
    shockMultiplier: 1.5,
    /** Fire on a soaked enemy. */
    steamMultiplier: 0.75,
    shockStun: 1,
    gustHits: 1,
  },
  /** Background music (code-made, see PLAN.md Music). Gains are relative to the sfx master (0.22). */
  music: {
    masterGain: 0.12,
    /** While a voice clip plays the music drops to masterGain × duckGain. */
    duckGain: 0.4,
    duckFadeMs: 80,
    crossfadeMs: 1200,
    /** Scheduler: how far ahead (ms) notes are queued, and how often it checks. */
    lookaheadMs: 120,
    tickMs: 25,
    /** Boss phase change: bars get this much faster. */
    enragedTempo: 1.08,
    bpm: { menu: 54, map: 112, battle: 156, boss: 126 },
  },
  /** Skip-ahead Quiz: pass to unlock kana groups without beating bosses. */
  quiz: {
    /** Typed answers. A single row: every kana in it, no misses allowed. */
    rowMaxMisses: 0,
    /** A whole family: one question per row plus extras, up to this many misses. */
    familyQuestions: 14,
    familyMaxMisses: 1,
  },
  srs: {
    bucketWeights: { new: 1.5, learning: 2, known: 1, mastered: 0.35 },
    missedMultiplier: 3,
    missDebtOnMiss: 3,
    dueMultiplier: 2,
    knownStreak: 3,
    masteredStreak: 6,
    reviewIntervalsDays: [1, 3, 7, 14],
    /** Due kana get this extra weight when labelling moves in a review fight. */
    reviewFightBoost: 3,
  },
  scaling: {
    /** Multiplies every enemy's base HP from data/enemies.json, per tier. */
    tierHp: { normal: 2, elite: 1.6, boss: 1.35, review: 1.8 },
    /** Multiplies every enemy attack and block value (longer fights → softer hits). */
    enemyDamage: 0.75,
    hpPerFloor: 0.25,
    damagePerFloor: 0.15,
  },
  run: {
    floors: 3,
    choiceRows: 4,
    nodesPerRow: [2, 3] as [number, number],
    nodeOdds: { fight: 0.55, elite: 0.15, rest: 0.15, review: 0.15 },
    restHealPct: 0.3,
    /** Share of max HP restored after every won fight, before the reward screen. */
    fightHealPct: 0.25,
    studyKana: 5,
    studyMaxHpPerCorrect: 1,
    studyHealPerCorrect: 3,
    bossHealMissingPct: 0.5,
    moveRewardOptions: 3,
    /** Rarity odds for move rewards (elites roll on the elite table). */
    rarityOdds: { common: 0.75, rare: 0.25 },
    eliteRarityOdds: { common: 0.45, rare: 0.55 },
    eliteRelicOptions: 2,
    bossRelicOptions: 3,
  },
  relics: {
    voicedBonus: 5,
    maxHpBonus: 12,
    wordMultiplier: 2,
    extraMove: 1,
    healAfterFight: 5,
    startBlock: 8,
    firstMoveMultiplier: 2,
    blockBonus: 5,
    weaknessMultiplier: 2.5,
    healBonus: 5,
    attackBonus: 2,
  },
} as const;

export type SrsBucket = keyof typeof CONFIG.srs.bucketWeights;
