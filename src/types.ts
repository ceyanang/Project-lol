export type Script = 'hiragana' | 'katakana';
export type KanaGroup = 'basic' | 'dakuten' | 'handakuten';

export interface Kana {
  id: string;
  char: string;
  romaji: string;
  script: Script;
  row: string;
  group: KanaGroup;
  /** For dakuten / handakuten kana: the plain kana it is built from. */
  base?: string;
  mnemonic: string;
}

export interface Vocab {
  id: string;
  reading: string;
  romaji: string;
  meaning: string;
  script: Script;
  /** Kana ids used by the word, in order. */
  kana: string[];
}

export type IntentType = 'attack' | 'multi' | 'defend' | 'buff';

export interface Intent {
  type: IntentType;
  value: number;
  times?: number;
}

export type EnemyTier = 'normal' | 'elite' | 'boss' | 'review';

export interface EnemyDef {
  id: string;
  name: string;
  emoji: string;
  tier: EnemyTier;
  minFloor: number;
  hp: number;
  armor: number;
  flavor: string;
  pattern: Intent[];
}

export type RelicEffect =
  | 'dakutenPierce'
  | 'maxHp'
  | 'firstMissFree'
  | 'comboBoost'
  | 'extraDraw'
  | 'healAfterFight'
  | 'startBlock'
  | 'firstTurnEnergy'
  | 'perfectGuardBoost'
  | 'weakSpotBoost'
  | 'handakutenBonus'
  | 'energyPlus';

export interface RelicDef {
  id: string;
  name: string;
  emoji: string;
  effect: RelicEffect;
  description: string;
}

export type CardType = 'attack' | 'block' | 'word';

export interface Card {
  uid: string;
  /** Kana id for attack/block cards, vocab id for word scrolls. */
  ref: string;
  type: CardType;
  /** Temporary review card, removed after the fight. */
  echo?: boolean;
}

export interface UnlockGroup {
  id: string;
  label: string;
  /** Kana ids unlocked by this group (empty for the word-scroll group). */
  kana: string[];
  words?: boolean;
}
