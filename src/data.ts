import kanaJson from '../data/kana.json';
import vocabJson from '../data/vocab.json';
import enemiesJson from '../data/enemies.json';
import relicsJson from '../data/relics.json';
import spellsJson from '../data/spells.json';
import type { EnemyDef, Kana, RelicDef, SpellDef, UnlockGroup, Vocab, Script } from './types';

export const KANA = kanaJson as Kana[];
export const VOCAB = vocabJson as Vocab[];
export const ENEMIES = enemiesJson as EnemyDef[];
export const RELICS = relicsJson as RelicDef[];
export const SPELLS = spellsJson as SpellDef[];

export const KANA_BY_ID: Record<string, Kana> = Object.fromEntries(KANA.map((k) => [k.id, k]));
export const VOCAB_BY_ID: Record<string, Vocab> = Object.fromEntries(VOCAB.map((v) => [v.id, v]));
export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));
export const SPELL_BY_ID: Record<string, SpellDef> = Object.fromEntries(SPELLS.map((s) => [s.id, s]));
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
  { id: 'words', label: '📜 Word Scrolls — whole-word cards', kana: [], words: true },
];

export function unlockedKanaIds(unlockedCount: number): string[] {
  return UNLOCK_GROUPS.slice(0, unlockedCount).flatMap((g) => g.kana);
}

export function wordScrollsUnlocked(unlockedCount: number): boolean {
  return UNLOCK_GROUPS.slice(0, unlockedCount).some((g) => g.words);
}

/** Words whose every kana is unlocked. */
export function availableWords(unlocked: Set<string>): Vocab[] {
  return VOCAB.filter((v) => v.kana.every((k) => unlocked.has(k)));
}

export function isVoiced(kanaId: string): boolean {
  const g = KANA_BY_ID[kanaId]?.group;
  return g === 'dakuten' || g === 'handakuten';
}
