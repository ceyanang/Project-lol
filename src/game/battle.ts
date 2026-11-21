import { CONFIG } from '../config';
import { KANA_BY_ID, VOCAB_BY_ID, isVoiced } from '../data';
import type { Card, EnemyDef, EnemyTier, Intent, Vocab } from '../types';
import { cardCost, cardRomaji, formableWords, makeCard, matchWord, weightedDraw, wordAssist } from './deck';
import { type Rng, chance, pick, shuffle, weightedPick } from './rng';
import type { Answer } from './srs';

export interface EnemyState {
  defId: string;
  name: string;
  emoji: string;
  tier: EnemyTier;
  hp: number;
  maxHp: number;
  armor: number;
  block: number;
  strength: number;
  intentIndex: number;
  dmgScale: number;
  pattern: Intent[];
}

export interface Prompts {
  /** Romaji the enemy's attack can be guarded with. */
  guard: string | null;
  /** Romaji weak spots for attack cards. */
  weak: string[];
  /** Vocab id shown as an English word prompt. */
  word: string | null;
}

export type FxKind = 'enemyHit' | 'playerHit' | 'block' | 'miss' | 'combo' | 'enemyBlock' | 'buff' | 'reveal';
export interface Fx {
  id: number;
  kind: FxKind;
  text: string;
}

export interface BattleState {
  enemy: EnemyState;
  hand: Card[];
  drawPile: Card[];
  discard: Card[];
  energy: number;
  playerHp: number;
  playerMaxHp: number;
  playerBlock: number;
  turn: number;
  prompts: Prompts;
  relics: string[];
  freeMissUsed: boolean;
  reviewKana: string[];
  outcome: 'ongoing' | 'won' | 'lost';
  log: string[];
  fx: Fx[];
  fxSeq: number;
  stats: { correct: number; wrong: number; words: number };
}

/** Everything battle logic needs from the outside world. */
export interface BattleCtx {
  weightOf: (kanaId: string) => number;
  unlocked: readonly string[];
  words: readonly Vocab[];
  rng: Rng;
}

const has = (b: { relics: string[] }, id: string) => b.relics.includes(id);

// ---------------------------------------------------------------- setup

export function scaleFor(floor: number) {
  const s = CONFIG.scaling;
  return { hp: 1 + s.hpPerFloor * (floor - 1), dmg: 1 + s.damagePerFloor * (floor - 1) };
}

export function createEnemy(def: EnemyDef, floor: number): EnemyState {
  const sc = scaleFor(floor);
  const hp = Math.round(def.hp * sc.hp);
  return {
    defId: def.id,
    name: def.name,
    emoji: def.emoji,
    tier: def.tier,
    hp,
    maxHp: hp,
    armor: def.armor,
    block: 0,
    strength: 0,
    intentIndex: 0,
    dmgScale: sc.dmg,
    pattern: def.pattern,
  };
}

export function currentIntent(e: EnemyState): Intent {
  return e.pattern[e.intentIndex % e.pattern.length];
}

/** Damage per hit of the current intent, including floor scaling and strength. */
export function intentDamage(e: EnemyState, intent: Intent = currentIntent(e)): number {
  return Math.round(intent.value * e.dmgScale) + e.strength;
}

export function isAttackIntent(i: Intent): boolean {
  return i.type === 'attack' || i.type === 'multi';
}

export function maxEnergy(relics: string[]): number {
  return CONFIG.player.energyPerTurn + (relics.includes('kitsune_mask') ? CONFIG.relics.energyPlus : 0);
}

export function handSize(relics: string[]): number {
  return CONFIG.player.handSize + (relics.includes('chochin') ? CONFIG.relics.extraDraw : 0);
}

export function createBattle(opts: {
  enemy: EnemyDef;
  floor: number;
  deck: Card[];
  hp: number;
  maxHp: number;
  relics: string[];
  reviewKana?: string[];
  ctx: BattleCtx;
}): BattleState {
  const { ctx } = opts;
  const reviewKana = (opts.reviewKana ?? []).slice(0, CONFIG.run.maxEchoCards);
  const echoes = reviewKana.map((k, i) => makeCard(k, i % 2 ? 'block' : 'attack', true));
  const base: BattleState = {
    enemy: createEnemy(opts.enemy, opts.floor),
    hand: [],
    drawPile: shuffle(ctx.rng, [...opts.deck, ...echoes]),
    discard: [],
    energy: 0,
    playerHp: opts.hp,
    playerMaxHp: opts.maxHp,
    playerBlock: 0,
    turn: 0,
    prompts: { guard: null, weak: [], word: null },
    relics: opts.relics,
    freeMissUsed: false,
    reviewKana,
    outcome: 'ongoing',
    log: [`A wild ${opts.enemy.name} appears!`],
    fx: [],
    fxSeq: 0,
    stats: { correct: 0, wrong: 0, words: 0 },
  };
  let b = startPlayerTurn(base, ctx);
  if (has(b, 'torii')) b = { ...b, energy: b.energy + CONFIG.relics.firstTurnEnergy };
  if (has(b, 'suzu')) b = { ...b, playerBlock: b.playerBlock + CONFIG.relics.startBlock };
  return b;
}

// ---------------------------------------------------------------- turns

function drawCards(b: BattleState, n: number, ctx: BattleCtx): BattleState {
  let drawPile = b.drawPile;
  let discard = b.discard;
  let hand = b.hand.slice();
  if (drawPile.length < n) {
    drawPile = [...drawPile, ...shuffle(ctx.rng, discard)];
    discard = [];
  }
  const { drawn, rest } = weightedDraw(drawPile, n, ctx.weightOf, ctx.rng);
  hand = [...hand, ...drawn];
  const assisted = wordAssist(hand, rest, ctx.words, ctx.rng);
  return { ...b, hand: assisted.hand, drawPile: assisted.drawPile, discard };
}

function kanaOfRomaji(romaji: string, pool: readonly string[]): string | undefined {
  return pool.find((k) => KANA_BY_ID[k]?.romaji === romaji);
}

export function generatePrompts(b: BattleState, ctx: BattleCtx): Prompts {
  const C = CONFIG.combat;
  const { rng } = ctx;
  const intent = currentIntent(b.enemy);
  const kanaCards = b.hand.filter((c) => c.type !== 'word');
  const decoyPool = b.reviewKana.length && chance(rng, 0.6) ? b.reviewKana : ctx.unlocked;
  const romajiOfKana = (k: string) => KANA_BY_ID[k].romaji;

  let guard: string | null = null;
  if (isAttackIntent(intent)) {
    const blocks = kanaCards.filter((c) => c.type === 'block').map((c) => c.ref);
    const fromHand = blocks.length > 0 && chance(rng, C.guardFromHandChance);
    const k = weightedPick(rng, fromHand ? blocks : decoyPool, ctx.weightOf);
    guard = k ? romajiOfKana(k) : null;
  }

  const weak: string[] = [];
  const attacks = [...new Set(kanaCards.filter((c) => c.type === 'attack').map((c) => c.ref))];
  for (let i = 0; i < C.weakSpotCount; i++) {
    const remainingAttacks = attacks.filter((k) => !weak.includes(romajiOfKana(k)));
    const useHand = remainingAttacks.length > 0 && (i === 0 || chance(rng, 0.5));
    const pool = (useHand ? remainingAttacks : decoyPool).filter((k) => !weak.includes(romajiOfKana(k)));
    const k = weightedPick(rng, pool, ctx.weightOf);
    if (k) weak.push(romajiOfKana(k));
  }

  let word: string | null = null;
  const wordCards = b.hand.filter((c) => c.type === 'word').map((c) => VOCAB_BY_ID[c.ref]);
  const options = [...formableWords(b.hand, ctx.words), ...wordCards];
  if (options.length && chance(rng, C.wordPromptChance)) word = pick(rng, options).id;

  return { guard, weak, word };
}

export function startPlayerTurn(b: BattleState, ctx: BattleCtx): BattleState {
  let next: BattleState = {
    ...b,
    turn: b.turn + 1,
    playerBlock: 0,
    energy: maxEnergy(b.relics),
  };
  next = drawCards(next, handSize(b.relics), ctx);
  return { ...next, prompts: generatePrompts(next, ctx) };
}

function pushFx(b: BattleState, kind: FxKind, text: string): BattleState {
  const id = b.fxSeq + 1;
  return { ...b, fxSeq: id, fx: [...b.fx, { id, kind, text }].slice(-8) };
}

function log(b: BattleState, line: string): BattleState {
  return { ...b, log: [...b.log, line].slice(-30) };
}

/** Player hit by `dmg`, absorbed by block first. */
function hitPlayer(b: BattleState, dmg: number): BattleState {
  const absorbed = Math.min(b.playerBlock, dmg);
  const through = dmg - absorbed;
  let next = { ...b, playerBlock: b.playerBlock - absorbed, playerHp: Math.max(0, b.playerHp - through) };
  next = pushFx(next, through > 0 ? 'playerHit' : 'block', through > 0 ? `-${through}` : 'Blocked!');
  if (next.playerHp <= 0) next = { ...next, outcome: 'lost' };
  return next;
}

export function endTurn(b: BattleState, ctx: BattleCtx): BattleState {
  if (b.outcome !== 'ongoing') return b;
  let next: BattleState = { ...b, discard: [...b.discard, ...b.hand], hand: [] };
  const e = { ...next.enemy, block: 0 };
  next = { ...next, enemy: e };
  const intent = currentIntent(e);
  switch (intent.type) {
    case 'attack': {
      const dmg = intentDamage(e, intent);
      next = log(next, `${e.name} attacks for ${dmg}.`);
      next = hitPlayer(next, dmg);
      break;
    }
    case 'multi': {
      const dmg = intentDamage(e, intent);
      const times = intent.times ?? 2;
      next = log(next, `${e.name} strikes ${times}× for ${dmg}.`);
      for (let i = 0; i < times && next.outcome === 'ongoing'; i++) next = hitPlayer(next, dmg);
      break;
    }
    case 'defend': {
      const amt = Math.round(intent.value * e.dmgScale);
      next = { ...next, enemy: { ...next.enemy, block: amt } };
      next = pushFx(log(next, `${e.name} braces (+${amt} block).`), 'enemyBlock', `+${amt} 🛡`);
      break;
    }
    case 'buff': {
      next = { ...next, enemy: { ...next.enemy, strength: next.enemy.strength + intent.value } };
      next = pushFx(log(next, `${e.name} powers up (+${intent.value} strength).`), 'buff', `+${intent.value} 💪`);
      break;
    }
  }
  next = { ...next, enemy: { ...next.enemy, intentIndex: next.enemy.intentIndex + 1 } };
  if (next.outcome !== 'ongoing') return next;
  return startPlayerTurn(next, ctx);
}

// ---------------------------------------------------------------- playing cards

export interface PlayStep {
  /** Kana id (or vocab id when `kind` is 'meaning'). */
  ref: string;
  kind: 'romaji' | 'meaning';
}

export interface PlayPlan {
  cards: Card[];
  word: Vocab | null;
  cost: number;
  valid: boolean;
  reason?: string;
  damage: number;
  block: number;
  multiplier: number;
  steps: PlayStep[];
  label: string;
}

function relicCardBonus(card: Card, relics: string[]): number {
  let bonus = 0;
  if (card.type === 'word') return 0;
  const k = KANA_BY_ID[card.ref];
  if (relics.includes('maru_ring') && k.group === 'handakuten') bonus += CONFIG.relics.handakutenBonus;
  if (card.type === 'attack' && relics.includes('dakuten_blade') && isVoiced(card.ref)) bonus += CONFIG.relics.dakutenPierceBonus;
  return bonus;
}

export function weakMultiplier(relics: string[]): number {
  return relics.includes('katana') ? CONFIG.relics.weakSpotMultiplier : CONFIG.combat.weakSpotMultiplier;
}
export function guardMultiplier(relics: string[]): number {
  return relics.includes('fude') ? CONFIG.relics.perfectGuardMultiplier : CONFIG.combat.perfectGuardMultiplier;
}

/** Which prompt (if any) a card matches right now. */
export function cardMatch(card: Card, prompts: Prompts): 'weak' | 'guard' | null {
  if (card.type === 'word') return prompts.word === card.ref ? 'weak' : null;
  const r = cardRomaji(card);
  if (card.type === 'attack' && prompts.weak.includes(r)) return 'weak';
  if (card.type === 'block' && prompts.guard === r) return 'guard';
  return null;
}

/** Value a single card would deal/block right now (before combo multiplier). */
export function cardValue(card: Card, b: Pick<BattleState, 'prompts' | 'relics'>): number {
  const C = CONFIG.cards;
  if (card.type === 'word') {
    const w = VOCAB_BY_ID[card.ref];
    const base = C.wordScrollDamagePerKana * w.kana.length;
    return Math.round(base * (b.prompts.word === card.ref ? CONFIG.combat.wordPromptBonus : 1));
  }
  const base = (card.type === 'attack' ? C.attackDamage : C.blockAmount) + relicCardBonus(card, b.relics);
  const m = cardMatch(card, b.prompts);
  if (m === 'weak') return Math.round(base * weakMultiplier(b.relics));
  if (m === 'guard') return Math.round(base * guardMultiplier(b.relics));
  return base;
}

export function comboMultiplier(word: Vocab, b: Pick<BattleState, 'prompts' | 'relics'>): number {
  let m = 1 + CONFIG.combat.comboPerExtraKana * (word.kana.length - 1);
  if (b.relics.includes('suzuri')) m += CONFIG.relics.comboBoost;
  if (b.prompts.word === word.id) m *= CONFIG.combat.wordPromptBonus;
  return m;
}

export function planPlay(b: BattleState, selectedUids: readonly string[], ctx: Pick<BattleCtx, 'words'>): PlayPlan {
  const picked = selectedUids.map((u) => b.hand.find((c) => c.uid === u)).filter((c): c is Card => !!c);
  const empty: PlayPlan = { cards: [], word: null, cost: 0, valid: false, damage: 0, block: 0, multiplier: 1, steps: [], label: '' };
  if (!picked.length) return { ...empty, reason: 'Tap a card to select it' };

  if (picked.length === 1) {
    const card = picked[0];
    const cost = cardCost(card);
    const value = cardValue(card, b);
    const match = cardMatch(card, b.prompts);
    const plan: PlayPlan = {
      ...empty,
      cards: [card],
      cost,
      valid: true,
      damage: card.type === 'block' ? 0 : value,
      block: card.type === 'block' ? value : 0,
      steps: [{ ref: card.ref, kind: card.type === 'word' ? 'meaning' : 'romaji' }],
      label: match === 'weak' ? '🎯 Weak spot!' : match === 'guard' ? '✨ Perfect Guard!' : '',
    };
    if (CONFIG.combat.requireMatch && card.type !== 'word' && !match) return { ...plan, valid: false, reason: 'Match a prompt or chain a word' };
    if (cost > b.energy) return { ...plan, valid: false, reason: 'Not enough energy' };
    return plan;
  }

  const matched = matchWord(picked, ctx.words);
  if (!matched) return { ...empty, cards: picked, reason: picked.some((c) => c.type === 'word') ? 'Scrolls can’t be chained' : 'Not a word — keep tapping or deselect' };
  const { word, ordered } = matched;
  const multiplier = comboMultiplier(word, b);
  const cost = Math.max(1, word.kana.length - 1) * CONFIG.cards.kanaCost;
  let damage = 0;
  let block = 0;
  for (const c of ordered) {
    const v = cardValue(c, b) * multiplier;
    if (c.type === 'attack') damage += v;
    else block += v;
  }
  const plan: PlayPlan = {
    cards: ordered,
    word,
    cost,
    valid: cost <= b.energy,
    reason: cost <= b.energy ? undefined : 'Not enough energy',
    damage: Math.round(damage),
    block: Math.round(block),
    multiplier,
    steps: ordered.map((c) => ({ ref: c.ref, kind: 'romaji' as const })),
    label: `${word.reading} = “${word.meaning}” ×${multiplier.toFixed(multiplier % 1 ? 2 : 0).replace(/0$/, '')}`,
  };
  return plan;
}

/** Deal damage to the enemy: block first, then armor (unless piercing), then HP. */
function hitEnemy(b: BattleState, raw: number, pierce: boolean): { b: BattleState; dealt: number } {
  const e = { ...b.enemy };
  let dmg = Math.round(raw);
  const absorbed = Math.min(e.block, dmg);
  e.block -= absorbed;
  dmg -= absorbed;
  if (dmg > 0 && !pierce) dmg = Math.max(0, dmg - e.armor);
  e.hp = Math.max(0, e.hp - dmg);
  return { b: { ...b, enemy: e }, dealt: dmg };
}

export interface PlayResult {
  battle: BattleState;
  answers: Answer[];
}

/**
 * Resolve a play after the reading check. `results[i]` is whether step i was answered correctly.
 */
export function resolvePlay(b: BattleState, plan: PlayPlan, results: readonly boolean[]): PlayResult {
  if (!plan.valid || b.outcome !== 'ongoing') return { battle: b, answers: [] };
  const C = CONFIG.combat;
  const uids = new Set(plan.cards.map((c) => c.uid));
  let next: BattleState = {
    ...b,
    energy: b.energy - plan.cost,
    hand: b.hand.filter((c) => !uids.has(c.uid)),
    discard: [...b.discard, ...plan.cards.filter((c) => !c.echo)],
  };
  const answers: Answer[] = [];
  const allCorrect = results.length === plan.steps.length && results.every(Boolean);
  let totalDamage = 0;
  let totalBlock = 0;
  let misses = 0;

  let weakHits = 0;
  let guards = 0;
  plan.cards.forEach((card, i) => {
    const ok = !!results[i];
    const m = ok ? cardMatch(card, b.prompts) : null;
    if (m === 'weak' && card.type !== 'word') weakHits++;
    if (m === 'guard') guards++;
    if (card.type === 'word') {
      VOCAB_BY_ID[card.ref].kana.forEach((k) => answers.push({ id: k, correct: ok }));
    } else {
      answers.push({ id: card.ref, correct: ok });
    }
    if (!ok) {
      misses++;
      return;
    }
    const mult = plan.word && allCorrect ? plan.multiplier : 1;
    const value = cardValue(card, next) * mult;
    if (card.type === 'block') totalBlock += value;
    else {
      const pierce = card.type === 'attack' && next.relics.includes('dakuten_blade') && isVoiced(card.ref);
      const r = hitEnemy(next, value, pierce);
      next = r.b;
      totalDamage += r.dealt;
    }
  });

  // consume matched prompts
  const playedRomaji = plan.cards.filter((_, i) => results[i]).map((c) => ({ c, r: cardRomaji(c) }));
  const prompts = { ...next.prompts, weak: next.prompts.weak.slice() };
  for (const { c, r } of playedRomaji) {
    if (c.type === 'attack' && prompts.weak.includes(r)) prompts.weak.splice(prompts.weak.indexOf(r), 1);
    if (c.type === 'block' && prompts.guard === r) prompts.guard = null;
    if (c.type === 'word' && prompts.word === c.ref) prompts.word = null;
  }
  if (plan.word && allCorrect && prompts.word === plan.word.id) prompts.word = null;
  next = { ...next, prompts };

  if (totalBlock > 0) {
    next = { ...next, playerBlock: next.playerBlock + Math.round(totalBlock) };
    next = pushFx(next, 'block', `+${Math.round(totalBlock)} 🛡`);
  }
  if (totalDamage > 0 || plan.damage > 0) next = pushFx(next, 'enemyHit', totalDamage > 0 ? `-${totalDamage}` : 'Armor!');
  if (weakHits) next = pushFx(next, 'combo', weakHits > 1 ? `🎯 Weak spots ×${weakHits}!` : '🎯 Weak spot!');
  if (guards) next = pushFx(next, 'reveal', '✨ Perfect Guard!');
  if (plan.word && allCorrect) {
    next = pushFx(next, 'combo', `${plan.word.reading}! ×${plan.multiplier.toFixed(1).replace(/\.0$/, '')}`);
    next = log(next, `Combo ${plan.word.reading} (${plan.word.meaning})!`);
  }

  for (let i = 0; i < misses; i++) {
    if (next.relics.includes('omamori') && !next.freeMissUsed) {
      next = pushFx({ ...next, freeMissUsed: true }, 'miss', 'Omamori saves you!');
    } else {
      next = { ...next, playerHp: Math.max(0, next.playerHp - C.wrongReadingHpCost) };
      next = pushFx(next, 'miss', `Misread! -${C.wrongReadingHpCost}`);
    }
  }

  next = {
    ...next,
    stats: {
      correct: next.stats.correct + results.filter(Boolean).length,
      wrong: next.stats.wrong + misses,
      words: next.stats.words + (plan.word && allCorrect ? 1 : 0),
    },
  };
  if (next.enemy.hp <= 0) next = log({ ...next, outcome: 'won' }, `${next.enemy.name} is slain!`);
  else if (next.playerHp <= 0) next = { ...next, outcome: 'lost' };
  return { battle: next, answers };
}

/** The battle as the player is allowed to see it when match hints are off: no prompt matching. */
export function blindView(b: BattleState): BattleState {
  if (CONFIG.combat.showMatchHints) return b;
  return { ...b, prompts: { guard: null, weak: [], word: null } };
}

/** Readings currently shown as prompts (used as decoys in the reading check). */
export function promptRomaji(p: Prompts): string[] {
  return [...(p.guard ? [p.guard] : []), ...p.weak];
}

/** Kana id whose romaji is shown in a prompt — handy for speech. */
export function promptKana(romaji: string, ctx: Pick<BattleCtx, 'unlocked'>): string | undefined {
  return kanaOfRomaji(romaji, ctx.unlocked);
}
