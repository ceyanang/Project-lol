import { KANA, KANA_BY_ID, VOCAB } from '../data';
import { type Rng, pick, shuffle } from './rng';

/** Visually confusable kana. Distractors prefer these so the check teaches discrimination. */
const CONFUSABLE_SETS = [
  'さちき', 'ねれわ', 'ぬめ', 'るろ', 'はほけ', 'いりこに', 'あおめぬ', 'くへ', 'つう', 'たな', 'しもり', 'まよほ', 'そろ', 'ゆや',
  'シツ', 'ソンリ', 'クタケ', 'ウワフラ', 'コユロ', 'ノメ', 'チテ', 'ナメ', 'ヌス', 'ヲラ', 'ホオ', 'マア', 'ルレ', 'セサ', 'ニエ',
];

function confusablesOf(char: string): string[] {
  return CONFUSABLE_SETS.filter((s) => s.includes(char)).flatMap((s) => [...s]).filter((c) => c !== char);
}

const vowelOf = (r: string) => r.slice(-1);

/** n romaji options for a kana: the correct one + distractors, shuffled. */
export function romajiOptions(kanaId: string, unlocked: readonly string[], rng: Rng, n = 4): string[] {
  const k = KANA_BY_ID[kanaId];
  const correct = k.romaji;
  const chosen = new Set<string>([correct]);
  const add = (r: string | undefined) => {
    if (r && chosen.size < n) chosen.add(r);
  };
  const unlockedSet = new Set(unlocked);
  const romajiOf = (c: string) => KANA_BY_ID[c]?.romaji;

  const conf = shuffle(rng, confusablesOf(k.char)).map(romajiOf).filter((r): r is string => !!r && r !== correct);
  add(conf[0]);
  const sameRow = KANA.filter((o) => o.row === k.row && o.romaji !== correct).map((o) => o.romaji);
  if (sameRow.length) add(pick(rng, sameRow));
  const sameVowel = KANA.filter((o) => o.script === k.script && vowelOf(o.romaji) === vowelOf(correct) && o.romaji !== correct).map((o) => o.romaji);
  if (sameVowel.length) add(pick(rng, sameVowel));
  const fromUnlocked = shuffle(rng, KANA.filter((o) => unlockedSet.has(o.id)).map((o) => o.romaji));
  for (const r of fromUnlocked) add(r);
  for (const r of shuffle(rng, KANA.map((o) => o.romaji))) add(r);
  return shuffle(rng, [...chosen]);
}

/** n English meaning options for a vocab word. */
export function meaningOptions(vocabId: string, rng: Rng, n = 4): string[] {
  const correct = VOCAB.find((v) => v.id === vocabId)!.meaning;
  const others = shuffle(rng, [...new Set(VOCAB.map((v) => v.meaning))].filter((m) => m !== correct)).slice(0, n - 1);
  return shuffle(rng, [correct, ...others]);
}
