import kanaJson from '../data/kana.json';
import vocabJson from '../data/vocab.json';
import enemiesJson from '../data/enemies.json';
import relicsJson from '../data/relics.json';
import movesJson from '../data/moves.json';
import type { EnemyDef, Kana, MoveDef, RelicDef, UnlockGroup, Vocab, Script } from './types';

export const KANA = kanaJson as Kana[];
export const VOCAB = vocabJson as Vocab[];
export const ENEMIES = enemiesJson as EnemyDef[];
export const RELICS = relicsJson as RelicDef[];
export const MOVES = movesJson as MoveDef[];

export const KANA_BY_ID: Record<string, Kana> = Object.fromEntries(KANA.map((k) => [k.id, k]));
export const VOCAB_BY_ID: Record<string, Vocab> = Object.fromEntries(VOCAB.map((v) => [v.id, v]));
export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));
export const MOVE_BY_ID: Record<string, MoveDef> = Object.fromEntries(MOVES.map((m) => [m.id, m]));
export const RELIC_BY_ID: Record<string, RelicDef> = Object.fromEntries(RELICS.map((r) => [r.id, r]));

const BASIC_ROWS = ['a', 'ka', 'sa', 'ta', 'na', 'ha', 'ma', 'ya', 'ra', 'wa'];
const VOICED_ROWS = ['ga', 'za', 'da', 'ba', 'pa'];

function rowGroup(script: Script, row: string): UnlockGroup {
  const kana = KANA.filter((k) => k.script === script && k.row === row).map((k) => k.id);
  return { id: `${script[0]}-${row}`, label: `${kana[0]} row · ${kana.join(' ')}`, kana };
}

/** Persistent unlock order: one group per boss kill. See PLAN.md §5. */
export const UNLOCK_GROUPS: UnlockGroup[] = [
  ...BASIC_ROWS.map((r) => rowGroup('hiragana', r)),
  ...VOICED_ROWS.map((r) => rowGroup('hiragana', r)),
  ...BASIC_ROWS.map((r) => rowGroup('katakana', r)),
  ...VOICED_ROWS.map((r) => rowGroup('katakana', r)),
  { id: 'words', label: '📜 Word moves — whole words appear as move labels', kana: [], words: true },
];

/** Kana ids of the unlocked groups, in chart order. */
export function unlockedKanaIds(groups: readonly string[]): string[] {
  const set = new Set(groups);
  return UNLOCK_GROUPS.filter((g) => set.has(g.id)).flatMap((g) => g.kana);
}

/**
 * Fewest different readings the study pool may have: a turn deals up to 5 moves (Paper Lantern),
 * each labelled with a different reading.
 */
export const MIN_STUDY_READINGS = 5;

export function distinctReadings(kanaIds: readonly string[]): number {
  return new Set(kanaIds.map((k) => KANA_BY_ID[k]?.romaji)).size;
}

/**
 * The groups you're studying: unlocked groups minus the ones switched off.
 * If switching off would leave too few sounds (old save, quiz changes), everything unlocked is used.
 */
export function studyGroups(unlocked: readonly string[], off: readonly string[]): string[] {
  const offSet = new Set(off);
  const on = unlocked.filter((g) => !offSet.has(g));
  return distinctReadings(unlockedKanaIds(on)) >= MIN_STUDY_READINGS ? on : [...unlocked];
}

/** Kana that label your moves and fill drills: the groups you're studying. */
export function studyKanaIds(unlocked: readonly string[], off: readonly string[]): string[] {
  return unlockedKanaIds(studyGroups(unlocked, off));
}

/** Can group `id` be switched off without dropping below the minimum number of sounds? */
export function canSwitchOff(unlocked: readonly string[], off: readonly string[], id: string): boolean {
  const offSet = new Set([...off, id]);
  return distinctReadings(unlockedKanaIds(unlocked.filter((g) => !offSet.has(g)))) >= MIN_STUDY_READINGS;
}

/** The most recently unlocked groups, newest first, until they hold at least `minReadings` sounds. */
export function latestGroups(unlocked: readonly string[], minReadings = 8): string[] {
  const picked: string[] = [];
  for (const id of [...unlocked].reverse()) {
    if (id === 'words') continue;
    picked.push(id);
    if (distinctReadings(unlockedKanaIds(picked)) >= minReadings) break;
  }
  return picked;
}

/** The group the next boss kill unlocks: the first one (in unlock order) you don't have yet. */
export function nextLockedGroup(groups: readonly string[]): UnlockGroup | undefined {
  const set = new Set(groups);
  return UNLOCK_GROUPS.find((g) => !set.has(g.id));
}

/** The first N groups in unlock order (used to migrate old saves and in tests). */
export function firstGroups(n: number): string[] {
  return UNLOCK_GROUPS.slice(0, Math.max(1, n)).map((g) => g.id);
}

export interface KanaFamily {
  id: string;
  label: string;
  /** Unlock group ids in this family. */
  groups: string[];
}

/** Big families you can test out of in the Skip-ahead Quiz. */
export const FAMILIES: KanaFamily[] = [
  { id: 'hiragana', label: 'Hiragana', groups: BASIC_ROWS.map((r) => `h-${r}`) },
  { id: 'hiragana-voiced', label: 'Hiragana dakuten ゛゜', groups: VOICED_ROWS.map((r) => `h-${r}`) },
  { id: 'katakana', label: 'Katakana', groups: BASIC_ROWS.map((r) => `k-${r}`) },
  { id: 'katakana-voiced', label: 'Katakana dakuten ゛゜', groups: VOICED_ROWS.map((r) => `k-${r}`) },
];

export function wordMovesUnlocked(groups: readonly string[]): boolean {
  return groups.includes('words');
}

/** Words whose every kana is unlocked. */
export function availableWords(unlocked: Set<string>): Vocab[] {
  return VOCAB.filter((v) => v.kana.every((k) => unlocked.has(k)));
}

export const ELEMENT_META = {
  physical: { emoji: '👊', label: 'Physical' },
  fire: { emoji: '🔥', label: 'Fire' },
  water: { emoji: '💧', label: 'Water' },
  wind: { emoji: '🌪️', label: 'Wind' },
  thunder: { emoji: '⚡', label: 'Thunder' },
} as const;

export function isVoiced(kanaId: string): boolean {
  const g = KANA_BY_ID[kanaId]?.group;
  return g === 'dakuten' || g === 'handakuten';
}
