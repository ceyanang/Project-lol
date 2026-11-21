import { CONFIG } from '../config';
import { KANA_BY_ID, VOCAB_BY_ID } from '../data';
import type { Card, CardType, Vocab } from '../types';
import { type Rng, chance, shuffle, weightedIndex, weightedSample, pick } from './rng';

let uidCounter = 0;
export function makeCard(ref: string, type: CardType, echo = false): Card {
  uidCounter += 1;
  return { uid: `c${Date.now().toString(36)}${uidCounter.toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`, ref, type, ...(echo ? { echo } : {}) };
}

export function cardCost(card: Card): number {
  return card.type === 'word' ? CONFIG.cards.wordScrollCost : CONFIG.cards.kanaCost;
}

export function cardRomaji(card: Card): string {
  return card.type === 'word' ? VOCAB_BY_ID[card.ref].romaji : KANA_BY_ID[card.ref].romaji;
}

/** Weight of a card for drawing: the SRS weight of its kana (words: average of their kana). */
export function cardWeight(card: Card, weightOf: (kanaId: string) => number): number {
  if (card.type === 'word') {
    const ks = VOCAB_BY_ID[card.ref].kana;
    return ks.reduce((s, k) => s + weightOf(k), 0) / ks.length;
  }
  return weightOf(card.ref);
}

/** SRS-weighted draw without replacement. */
export function weightedDraw(pile: readonly Card[], count: number, weightOf: (kanaId: string) => number, rng: Rng): { drawn: Card[]; rest: Card[] } {
  const rest = pile.slice();
  const drawn: Card[] = [];
  while (drawn.length < count && rest.length) {
    const i = weightedIndex(rng, rest.map((c) => cardWeight(c, weightOf)));
    drawn.push(rest.splice(i, 1)[0]);
  }
  return { drawn, rest };
}

function multisetKey(ids: readonly string[]): string {
  return ids.slice().sort().join('');
}

/**
 * If the selected kana cards can be ordered into a vocab word, return it plus the cards in word order.
 * Prefers a word matching the tap order exactly.
 */
export function matchWord(cards: readonly Card[], words: readonly Vocab[]): { word: Vocab; ordered: Card[] } | null {
  if (cards.length < 2 || cards.some((c) => c.type === 'word')) return null;
  const ids = cards.map((c) => c.ref);
  const exact = words.find((w) => w.kana.join('') === ids.join(''));
  const word = exact ?? words.find((w) => w.kana.length === ids.length && multisetKey(w.kana) === multisetKey(ids));
  if (!word) return null;
  const pool = cards.slice();
  const ordered = word.kana.map((k) => pool.splice(pool.findIndex((c) => c.ref === k), 1)[0]);
  return { word, ordered };
}

/** Words that can be spelled from a set of kana cards. */
export function formableWords(cards: readonly Card[], words: readonly Vocab[]): Vocab[] {
  const counts = new Map<string, number>();
  for (const c of cards) if (c.type !== 'word') counts.set(c.ref, (counts.get(c.ref) ?? 0) + 1);
  return words.filter((w) => {
    if (w.kana.length < 2) return false;
    const need = new Map<string, number>();
    for (const k of w.kana) need.set(k, (need.get(k) ?? 0) + 1);
    for (const [k, n] of need) if ((counts.get(k) ?? 0) < n) return false;
    return true;
  });
}

/**
 * Word assist: sometimes swap cards from the draw pile into the hand so a word is formable.
 * Keeps combos showing up without stacking the whole deck.
 */
export function wordAssist(hand: Card[], drawPile: Card[], words: readonly Vocab[], rng: Rng): { hand: Card[]; drawPile: Card[] } {
  if (!chance(rng, CONFIG.combat.wordAssistChance)) return { hand, drawPile };
  if (formableWords(hand, words).length) return { hand, drawPile };
  const all = [...hand, ...drawPile];
  const candidates = formableWords(all, words).filter(
    (w) => w.kana.length <= CONFIG.combat.maxWordAssistLength && w.kana.some((k) => hand.some((c) => c.ref === k)),
  );
  if (!candidates.length) return { hand, drawPile };
  const word = pick(rng, candidates);
  const newHand = hand.slice();
  const newPile = drawPile.slice();
  const used = new Set<string>();
  for (const k of word.kana) {
    const inHand = newHand.find((c) => c.ref === k && !used.has(c.uid));
    if (inHand) {
      used.add(inHand.uid);
      continue;
    }
    const pi = newPile.findIndex((c) => c.ref === k);
    const hi = newHand.findIndex((c) => !used.has(c.uid));
    if (pi < 0 || hi < 0) return { hand, drawPile };
    const incoming = newPile.splice(pi, 1)[0];
    const outgoing = newHand.splice(hi, 1, incoming)[0];
    newPile.push(outgoing);
    used.add(incoming.uid);
  }
  return { hand: newHand, drawPile: newPile };
}

/** Alternate attack/block so every kana shows up in both roles across a deck. */
function typedCards(kanaIds: readonly string[], startWith: CardType = 'attack'): Card[] {
  return kanaIds.map((k, i) => makeCard(k, (i % 2 === 0) === (startWith === 'attack') ? 'attack' : 'block'));
}

export function buildStartingDeck(
  unlocked: readonly string[],
  newestGroup: readonly string[],
  words: readonly Vocab[],
  weightOf: (kanaId: string) => number,
  isFirstRun: boolean,
  rng: Rng,
): Card[] {
  const P = CONFIG.player;
  if (isFirstRun) {
    return [...typedCards(P.firstRunDeck, 'attack'), ...typedCards(P.firstRunDeck, 'block')];
  }
  const picks: string[] = [...newestGroup];
  const usable = words.filter((w) => w.kana.length <= 3);
  for (const w of shuffle(rng, usable).slice(0, P.starterWords)) picks.push(...w.kana);
  const remaining = P.laterRunDeckSize - picks.length;
  if (remaining > 0) picks.push(...weightedSample(rng, unlocked, remaining, weightOf));
  return shuffle(rng, typedCards(picks.slice(0, Math.max(P.laterRunDeckSize, picks.length))));
}
