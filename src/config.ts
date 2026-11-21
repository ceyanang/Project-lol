/**
 * Every tunable number in the game. Keep PLAN.md in sync when you change these.
 */
export const CONFIG = {
  player: {
    startHp: 50,
    energyPerTurn: 3,
    handSize: 5,
    firstRunDeck: ['あ', 'い', 'う', 'え', 'お'],
    laterRunDeckSize: 12,
    starterWords: 2,
  },
  cards: {
    attackDamage: 6,
    blockAmount: 5,
    kanaCost: 1,
    wordScrollCost: 2,
    wordScrollDamagePerKana: 5,
  },
  combat: {
    /** false = unmatched cards still play at base value (see PLAN.md §1). */
    requireMatch: false,
    /**
     * false = cards never reveal which prompt they match before you play them
     * (no glow, no ×2 preview). The bonus is revealed after the play.
     */
    showMatchHints: false,
    /** Prompt readings added as distractors in the reading check, so guessing from the prompt can fail. */
    promptDecoysInCheck: true,
    weakSpotMultiplier: 2,
    perfectGuardMultiplier: 2,
    weakSpotCount: 2,
    guardFromHandChance: 0.8,
    wordPromptChance: 0.5,
    wordPromptBonus: 1.5,
    comboPerExtraKana: 0.5,
    wrongReadingHpCost: 2,
    wordAssistChance: 0.5,
    maxWordAssistLength: 3,
    readingOptions: 4,
  },
  srs: {
    bucketWeights: { new: 1.5, learning: 2, known: 1, mastered: 0.35 },
    missedMultiplier: 3,
    missDebtOnMiss: 3,
    dueMultiplier: 2,
    knownStreak: 3,
    masteredStreak: 6,
    reviewIntervalsDays: [1, 3, 7, 14],
  },
  scaling: {
    hpPerFloor: 0.3,
    damagePerFloor: 0.2,
  },
  run: {
    floors: 3,
    choiceRows: 4,
    nodesPerRow: [2, 3] as [number, number],
    nodeOdds: { fight: 0.55, elite: 0.15, rest: 0.15, review: 0.15 },
    restHealPct: 0.3,
    studyKana: 5,
    studyMaxHpPerCorrect: 1,
    studyHealPerCorrect: 3,
    bossHealMissingPct: 0.5,
    cardRewardOptions: 3,
    eliteRelicOptions: 2,
    bossRelicOptions: 3,
    maxEchoCards: 6,
  },
  relics: {
    dakutenPierceBonus: 2,
    maxHpBonus: 12,
    comboBoost: 0.5,
    extraDraw: 1,
    healAfterFight: 5,
    startBlock: 8,
    firstTurnEnergy: 2,
    perfectGuardMultiplier: 3,
    weakSpotMultiplier: 2.5,
    handakutenBonus: 4,
    energyPlus: 1,
  },
} as const;

export type SrsBucket = keyof typeof CONFIG.srs.bucketWeights;
