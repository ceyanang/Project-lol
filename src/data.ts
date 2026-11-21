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

export function unlockedKanaIds(unlockedCount: number): string[] {
  return UNLOCK_GROUPS.slice(0, unlockedCount).flatMap((g) => g.kana);
}

export function wordMovesUnlocked(unlockedCount: number): boolean {
  return UNLOCK_GROUPS.slice(0, unlockedCount).some((g) => g.words);
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
