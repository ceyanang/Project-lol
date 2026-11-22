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
  /** Fixed for the whole fight: moves of this element deal ×2. */
  weak: Element;
  /** Moves of this element deal ×0.5. */
  resist?: Element;
  gimmicks?: Gimmick[];
}

export type Element = 'physical' | 'fire' | 'water' | 'wind' | 'thunder';

/** Elemental statuses on an enemy. */
export type StatusKind = 'burn' | 'soak' | 'stun' | 'gust';

/** Special rules an enemy fights by (see PLAN.md §1). */
export type Gimmick = { type: 'immune'; to: StatusKind[] };

export type RelicEffect =
  | 'voicedBonus'
  | 'maxHp'
  | 'firstMissFree'
  | 'wordBoost'
  | 'extraMove'
  | 'healAfterFight'
  | 'startBlock'
  | 'firstMoveDouble'
  | 'blockBonus'
  | 'weaknessBoost'
  | 'healBonus'
  | 'attackBonus';

export interface RelicDef {
  id: string;
  name: string;
  emoji: string;
  effect: RelicEffect;
  description: string;
}

export type MoveKind = 'attack' | 'block' | 'heal' | 'weaken' | 'mirror' | 'drain';

/** A move card. Moves are not tied to any kana: each turn they get a fresh romaji label. */
export interface MoveDef {
  id: string;
  name: string;
  emoji: string;
  kind: MoveKind;
  element?: Element;
  value: number;
  hits?: number;
  pierce?: boolean;
  rarity: 'starter' | 'common' | 'rare';
  description: string;
}

/** A move card in the player's deck. Copies make a move more likely to be dealt. */
export interface Card {
  uid: string;
  moveId: string;
}

/** One question in a reading check (kana → romaji, or word → meaning). */
export interface ReadingStep {
  /** Kana id, or vocab id when `kind` is 'meaning'. */
  ref: string;
  kind: 'romaji' | 'meaning';
}

export interface UnlockGroup {
  id: string;
  label: string;
  /** Kana ids unlocked by this group (empty for the word-scroll group). */
  kana: string[];
  words?: boolean;
}
