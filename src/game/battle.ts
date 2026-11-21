import { CONFIG } from '../config';
import { KANA_BY_ID, MOVE_BY_ID, isVoiced } from '../data';
import type { Difficulty } from './storage';
import type { Card, EnemyDef, EnemyTier, Intent, MoveDef, Vocab } from '../types';
import { confusablesOf, kanaOptions } from './distractors';
import { type Rng, chance, shuffle, weightedPick } from './rng';
import type { Answer as SrsAnswer } from './srs';

/*
 * Combat (see PLAN.md §1):
 * each turn N moves are dealt from your deck, each labelled with the romaji of a different kana
 * (or a whole word). Below them is a row of kana tiles: the right ones plus look-alike decoys.
 * Tap the kana for the move you want, then End Turn confirms it. One move per turn.
 */

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
  weak: MoveDef['element'];
  resist?: MoveDef['element'];
}

/** What a move is labelled with this turn: a kana or a whole word. */
export interface Label {
  kind: 'kana' | 'word';
  /** Kana id or vocab id. */
  ref: string;
  /** The kana text shown on the tile. */
  text: string;
  romaji: string;
  /** Kana ids involved (for SRS). */
  kana: string[];
}

export interface Slot {
  uid: string;
  card: Card;
  label: Label;
}

export interface Tile {
  id: string;
  text: string;
  romaji: string;
  kana: string[];
  /** Slot this tile casts, or null for a decoy. */
  slot: string | null;
  /** For decoys: the slot whose kana it imitates. */
  decoyOf: string | null;
}

export interface TurnResult {
  ok: boolean;
  tileText: string;
  tileRomaji: string;
  text: string;
}

export type FxKind = 'enemyHit' | 'playerHit' | 'block' | 'miss' | 'enemyBlock' | 'buff' | 'move' | 'heal' | 'weak' | 'resist';
export interface Fx {
  id: number;
  kind: FxKind;
  text: string;
}

export interface BattleState {
  enemy: EnemyState;
  drawPile: Card[];
  discard: Card[];
  slots: Slot[];
  tiles: Tile[];
  /** Tile id the player tapped; resolved on End Turn. */
  picked: string | null;
  playerHp: number;
  playerMaxHp: number;
  playerBlock: number;
  turn: number;
  relics: string[];
  freeMissUsed: boolean;
  movesMade: number;
  reviewKana: string[];
  outcome: 'ongoing' | 'won' | 'lost';
  /**
   * Turn beats, so things don't all happen at once:
   * your move resolves → 'enemy' (pause) → enemy acts → 'deal' (pause) → next moves are dealt.
   * While a beat is pending the player can't tap anything.
   */
  pending: null | 'enemy' | 'deal';
  lastResult: TurnResult | null;
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
  wordsUnlocked: boolean;
  difficulty: Difficulty;
  rng: Rng;
}

export interface PlayResult {
  battle: BattleState;
  answers: SrsAnswer[];
}

const has = (b: { relics: string[] }, id: string) => b.relics.includes(id);

// ---------------------------------------------------------------- enemies

export function scaleFor(floor: number) {
  const s = CONFIG.scaling;
  return { hp: 1 + s.hpPerFloor * (floor - 1), dmg: 1 + s.damagePerFloor * (floor - 1) };
}

export function createEnemy(def: EnemyDef, floor: number): EnemyState {
  const sc = scaleFor(floor);
  const hp = Math.round(def.hp * CONFIG.scaling.tierHp[def.tier] * sc.hp);
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
    dmgScale: sc.dmg * CONFIG.scaling.enemyDamage,
    pattern: def.pattern,
    weak: def.weak,
    resist: def.resist,
  };
}

export function currentIntent(e: EnemyState): Intent {
  return e.pattern[e.intentIndex % e.pattern.length];
}

/** Damage per hit of the current intent, including floor scaling and strength. */
export function intentDamage(e: EnemyState, intent: Intent = currentIntent(e)): number {
  return Math.max(0, Math.round(intent.value * e.dmgScale) + e.strength);
}

export function isAttackIntent(i: Intent): boolean {
  return i.type === 'attack' || i.type === 'multi';
}

/** Total damage the enemy will deal this turn if unblocked. */
export function incomingDamage(e: EnemyState): number {
  const i = currentIntent(e);
  if (!isAttackIntent(i)) return 0;
  return intentDamage(e, i) * (i.type === 'multi' ? (i.times ?? 2) : 1);
}

// ---------------------------------------------------------------- setup

let uidSeq = 0;
const uid = (p: string) => `${p}${(++uidSeq).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

export function movesPerTurn(relics: string[]): number {
  return CONFIG.combat.movesPerTurn + (relics.includes('chochin') ? CONFIG.relics.extraMove : 0);
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
  const base: BattleState = {
    enemy: createEnemy(opts.enemy, opts.floor),
    drawPile: shuffle(ctx.rng, opts.deck),
    discard: [],
    slots: [],
    tiles: [],
    picked: null,
    playerHp: opts.hp,
    playerMaxHp: opts.maxHp,
    playerBlock: 0,
    turn: 0,
    relics: opts.relics,
    freeMissUsed: false,
    movesMade: 0,
    reviewKana: opts.reviewKana ?? [],
    outcome: 'ongoing',
    lastResult: null,
    pending: null,
    log: [`A wild ${opts.enemy.name} appears!`],
    fx: [],
    fxSeq: 0,
    stats: { correct: 0, wrong: 0, words: 0 },
  };
  let b = startPlayerTurn(base, ctx);
  if (has(b, 'suzu')) b = { ...b, playerBlock: b.playerBlock + CONFIG.relics.startBlock };
  return b;
}

// ---------------------------------------------------------------- dealing moves

/** Labels with distinct romaji: SRS-weighted kana, sometimes a whole word. */
export function makeLabels(n: number, b: Pick<BattleState, 'reviewKana'>, ctx: BattleCtx): Label[] {
  const used = new Set<string>();
  const labels: Label[] = [];
  const review = new Set(b.reviewKana);
  const wordsOk = ctx.wordsUnlocked;
  const kanaWeight = (k: string) => ctx.weightOf(k) * (review.has(k) ? CONFIG.srs.reviewFightBoost : 1);
  for (let i = 0; i < n; i++) {
    if (wordsOk && chance(ctx.rng, CONFIG.combat.wordMoveChance)) {
      const pool = ctx.words.filter((w) => w.kana.length >= 2 && w.kana.length <= CONFIG.combat.maxWordLength && !used.has(w.romaji));
      const w = weightedPick(ctx.rng, pool, (v) => v.kana.reduce((s, k) => s + kanaWeight(k), 0) / v.kana.length);
      if (w) {
        used.add(w.romaji);
        labels.push({ kind: 'word', ref: w.id, text: w.reading, romaji: w.romaji, kana: w.kana });
        continue;
      }
    }
    const pool = ctx.unlocked.filter((k) => !used.has(KANA_BY_ID[k].romaji));
    const k = weightedPick(ctx.rng, pool, kanaWeight);
    if (!k) break;
    used.add(KANA_BY_ID[k].romaji);
    labels.push({ kind: 'kana', ref: k, text: KANA_BY_ID[k].char, romaji: KANA_BY_ID[k].romaji, kana: [k] });
  }
  return labels;
}

/**
 * Kana tiles for this turn, by difficulty:
 * easy = just the answers; normal = answers + look-alike decoys; hard = every unlocked kana
 * (kana that read the same as a label, e.g. か/カ for "ka", also cast that move).
 */
export function makeTiles(slots: Slot[], ctx: BattleCtx): Tile[] {
  const tiles: Tile[] = slots.map((s) => ({ id: uid('t'), text: s.label.text, romaji: s.label.romaji, kana: s.label.kana, slot: s.uid, decoyOf: null }));
  const decoys = CONFIG.difficulty[ctx.difficulty]?.decoys ?? CONFIG.difficulty.normal.decoys;
  const usedText = new Set(tiles.map((t) => t.text));

  if (decoys === 'all') {
    const bySlotRomaji = new Map(slots.map((s) => [s.label.romaji, s.uid]));
    const kanaSlots = slots.filter((s) => s.label.kind === 'kana');
    for (const k of ctx.unlocked) {
      const kana = KANA_BY_ID[k];
      if (usedText.has(kana.char)) continue;
      usedText.add(kana.char);
      const slot = bySlotRomaji.get(kana.romaji) ?? null;
      // a wrong pick that looks like a move's kana counts as missing that kana; otherwise the tapped one
      const lookalikeOf = slot ? null : (kanaSlots.find((s) => confusablesOf(s.label.text).includes(kana.char))?.uid ?? null);
      tiles.push({ id: uid('t'), text: kana.char, romaji: kana.romaji, kana: [k], slot, decoyOf: lookalikeOf });
    }
    // chart order keeps a big grid searchable; whole-word tiles go first
    const order = new Map(ctx.unlocked.map((k, i) => [k, i]));
    return tiles.sort((x, y) => (x.kana.length > 1 ? -1 : y.kana.length > 1 ? 1 : (order.get(x.kana[0]) ?? 0) - (order.get(y.kana[0]) ?? 0)));
  }

  const usedRomaji = new Set(tiles.map((t) => t.romaji));
  const kanaSlots = shuffle(ctx.rng, slots.filter((s) => s.label.kind === 'kana'));
  for (let i = 0; i < decoys && kanaSlots.length; i++) {
    const target = kanaSlots[i % kanaSlots.length];
    const decoy = kanaOptions(target.label.ref, ctx.unlocked, ctx.rng, 10).find(
      (k) => !usedRomaji.has(KANA_BY_ID[k].romaji) && !usedText.has(KANA_BY_ID[k].char),
    );
    if (!decoy) continue;
    usedRomaji.add(KANA_BY_ID[decoy].romaji);
    usedText.add(KANA_BY_ID[decoy].char);
    tiles.push({ id: uid('t'), text: KANA_BY_ID[decoy].char, romaji: KANA_BY_ID[decoy].romaji, kana: [decoy], slot: null, decoyOf: target.uid });
  }
  return shuffle(ctx.rng, tiles);
}

export function startPlayerTurn(b: BattleState, ctx: BattleCtx): BattleState {
  // last turn's moves go to the discard; reshuffle when the pile runs low
  const n = movesPerTurn(b.relics);
  let pile = b.drawPile;
  let discard = [...b.discard, ...b.slots.map((s) => s.card)];
  if (pile.length < n) {
    pile = [...pile, ...shuffle(ctx.rng, discard)];
    discard = [];
  }
  const cards = pile.slice(0, n);
  const labels = makeLabels(cards.length, b, ctx);
  const slots: Slot[] = labels.map((label, i) => ({ uid: uid('s'), card: cards[i], label }));
  return {
    ...b,
    turn: b.turn + 1,
    playerBlock: 0,
    picked: null,
    drawPile: pile.slice(n),
    discard: [...discard, ...cards.slice(labels.length)],
    slots,
    tiles: makeTiles(slots, ctx),
  };
}

// ---------------------------------------------------------------- move values

export interface MovePreview {
  damagePerHit: number;
  hits: number;
  block: number;
  heal: number;
  weaken: number;
  pierce: boolean;
  matchup: 'weak' | 'resist' | null;
}

function powerMultiplier(b: Pick<BattleState, 'relics' | 'movesMade'>, label: Label | null): number {
  let m = 1;
  if (label?.kind === 'word') m *= has(b, 'suzuri') ? CONFIG.relics.wordMultiplier : CONFIG.combat.wordMultiplier;
  if (has(b, 'torii') && b.movesMade === 0) m *= CONFIG.relics.firstMoveMultiplier;
  return m;
}

/** What a move would do right now with this label. Static info, safe to show before picking. */
export function previewMove(move: MoveDef, label: Label | null, b: Pick<BattleState, 'relics' | 'movesMade' | 'enemy'>): MovePreview {
  const power = powerMultiplier(b, label);
  const voiced = !!label && has(b, 'dakuten_blade') && label.kana.some(isVoiced);
  const isAttack = move.kind === 'attack' || move.kind === 'drain';
  const matchup = isAttack && move.element ? (move.element === b.enemy.weak ? 'weak' : move.element === b.enemy.resist ? 'resist' : null) : null;
  let elem = 1;
  if (matchup === 'weak') elem = has(b, 'katana') ? CONFIG.relics.weaknessMultiplier : CONFIG.combat.weaknessMultiplier;
  if (matchup === 'resist') elem = CONFIG.combat.resistMultiplier;
  const base = move.value + (isAttack && has(b, 'kitsune_mask') ? CONFIG.relics.attackBonus : 0) + (isAttack && voiced ? CONFIG.relics.voicedBonus : 0);
  return {
    damagePerHit: isAttack ? Math.max(1, Math.round(base * elem * power)) : 0,
    hits: isAttack ? (move.hits ?? 1) : 0,
    block:
      move.kind === 'block'
        ? Math.round((move.value + (has(b, 'fude') ? CONFIG.relics.blockBonus : 0)) * power)
        : move.kind === 'mirror'
          ? incomingDamage(b.enemy)
          : 0,
    heal: move.kind === 'heal' ? Math.round((move.value + (has(b, 'maru_ring') ? CONFIG.relics.healBonus : 0)) * power) : 0,
    weaken: move.kind === 'weaken' ? Math.round(move.value * power) : 0,
    pierce: !!move.pierce || voiced,
    matchup,
  };
}

// ---------------------------------------------------------------- resolving a turn

function pushFx(b: BattleState, kind: FxKind, text: string): BattleState {
  const id = b.fxSeq + 1;
  return { ...b, fxSeq: id, fx: [...b.fx, { id, kind, text }].slice(-8) };
}

function log(b: BattleState, line: string): BattleState {
  return { ...b, log: [...b.log, line].slice(-30) };
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

function hitPlayer(b: BattleState, dmg: number): BattleState {
  const absorbed = Math.min(b.playerBlock, dmg);
  const through = dmg - absorbed;
  let next = { ...b, playerBlock: b.playerBlock - absorbed, playerHp: Math.max(0, b.playerHp - through) };
  next = pushFx(next, through > 0 ? 'playerHit' : 'block', through > 0 ? `-${through}` : 'Blocked!');
  if (next.playerHp <= 0) next = { ...next, outcome: 'lost' };
  return next;
}

/** Tap a kana tile (tap again to un-pick). Nothing happens until End Turn. */
export function pickTile(b: BattleState, tileId: string | null): BattleState {
  if (b.outcome !== 'ongoing' || b.pending) return b;
  return { ...b, picked: b.picked === tileId ? null : tileId };
}

function performMove(b: BattleState, slot: Slot): BattleState {
  const move = MOVE_BY_ID[slot.card.moveId];
  const p = previewMove(move, slot.label, b);
  let next = pushFx(b, 'move', `${move.emoji} ${move.name}!`);
  if (p.hits > 0) {
    let dealt = 0;
    for (let i = 0; i < p.hits && next.enemy.hp > 0; i++) {
      const r = hitEnemy(next, p.damagePerHit, p.pierce);
      next = r.b;
      dealt += r.dealt;
    }
    next = pushFx(next, 'enemyHit', dealt > 0 ? `-${dealt}` : 'Armor!');
    if (p.matchup === 'weak') next = pushFx(next, 'weak', 'Weakness!');
    if (p.matchup === 'resist') next = pushFx(next, 'resist', 'Resisted…');
    if (move.kind === 'drain' && dealt > 0) {
      const heal = Math.min(dealt, next.playerMaxHp - next.playerHp);
      next = pushFx({ ...next, playerHp: next.playerHp + heal }, 'heal', `+${heal} ❤️`);
    }
  }
  if (p.block > 0) next = pushFx({ ...next, playerBlock: next.playerBlock + p.block }, 'block', `+${p.block} 🛡`);
  if (p.heal > 0) {
    const heal = Math.min(p.heal, next.playerMaxHp - next.playerHp);
    next = pushFx({ ...next, playerHp: next.playerHp + heal }, 'heal', `+${heal} ❤️`);
  }
  if (p.weaken > 0) next = pushFx({ ...next, enemy: { ...next.enemy, strength: next.enemy.strength - p.weaken } }, 'enemyBlock', `-${p.weaken} 💪`);
  return log(next, `You used ${move.name}.`);
}

function enemyTurn(b: BattleState): BattleState {
  const e = { ...b.enemy, block: 0 };
  let next: BattleState = { ...b, enemy: e };
  const intent = currentIntent(e);
  switch (intent.type) {
    case 'attack': {
      const dmg = intentDamage(e, intent);
      next = hitPlayer(log(next, `${e.name} attacks for ${dmg}.`), dmg);
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
      next = pushFx(log({ ...next, enemy: { ...next.enemy, block: amt } }, `${e.name} braces (+${amt} block).`), 'enemyBlock', `+${amt} 🛡`);
      break;
    }
    case 'buff':
      next = pushFx(
        log({ ...next, enemy: { ...next.enemy, strength: next.enemy.strength + intent.value } }, `${e.name} powers up.`),
        'buff',
        `+${intent.value} 💪`,
      );
      break;
  }
  return { ...next, enemy: { ...next.enemy, intentIndex: next.enemy.intentIndex + 1 } };
}

/** End Turn: resolve the picked tile (if any), then the enemy acts, then a new turn is dealt. */
export function confirmTurn(b: BattleState): PlayResult {
  if (b.outcome !== 'ongoing' || b.pending) return { battle: b, answers: [] };
  const tile = b.tiles.find((t) => t.id === b.picked) ?? null;
  const answers: SrsAnswer[] = [];
  let next: BattleState = b;

  if (!tile) {
    next = { ...next, lastResult: { ok: false, tileText: '', tileRomaji: '', text: 'You held back this turn.' } };
  } else if (tile.slot) {
    const slot = b.slots.find((s) => s.uid === tile.slot)!;
    const move = MOVE_BY_ID[slot.card.moveId];
    tile.kana.forEach((k) => answers.push({ id: k, correct: true }));
    next = performMove(next, slot);
    next = {
      ...next,
      movesMade: next.movesMade + 1,
      stats: { ...next.stats, correct: next.stats.correct + 1, words: next.stats.words + (slot.label.kind === 'word' ? 1 : 0) },
      lastResult: { ok: true, tileText: tile.text, tileRomaji: tile.romaji, text: `${tile.text} = ${tile.romaji} → ${move.emoji} ${move.name}` },
    };
  } else {
    const target = b.slots.find((s) => s.uid === tile.decoyOf);
    (target ? target.label.kana : tile.kana).forEach((k) => answers.push({ id: k, correct: false }));
    next = { ...next, movesMade: next.movesMade + 1, stats: { ...next.stats, wrong: next.stats.wrong + 1 } };
    if (has(next, 'omamori') && !next.freeMissUsed) {
      next = pushFx({ ...next, freeMissUsed: true }, 'miss', 'Omamori saves you!');
    } else {
      next = pushFx({ ...next, playerHp: Math.max(0, next.playerHp - CONFIG.combat.decoyHpCost) }, 'miss', `Fizzle! -${CONFIG.combat.decoyHpCost}`);
    }
    const hint = target ? ` (“${target.label.romaji}” was ${target.label.text})` : '';
    next = {
      ...next,
      lastResult: { ok: false, tileText: tile.text, tileRomaji: tile.romaji, text: `${tile.text} = ${tile.romaji}: no move has that reading${hint}` },
    };
    if (next.playerHp <= 0) return { battle: { ...next, outcome: 'lost' }, answers };
  }

  if (next.enemy.hp <= 0) return { battle: log({ ...next, outcome: 'won' }, `${next.enemy.name} is slain!`), answers };
  // the enemy acts on the next beat (see advanceBeat)
  return { battle: { ...next, pending: 'enemy', picked: null }, answers };
}

/** Run the next pending beat: the enemy's action, then dealing the next turn. */
export function advanceBeat(b: BattleState, ctx: BattleCtx): BattleState {
  if (b.outcome !== 'ongoing' || !b.pending) return b;
  if (b.pending === 'enemy') {
    const next = enemyTurn(b);
    return next.outcome === 'ongoing' ? { ...next, pending: 'deal' } : { ...next, pending: null };
  }
  return { ...startPlayerTurn(b, ctx), pending: null };
}

/** Confirm and play out the whole turn immediately (tests and the balance sim). */
export function playTurn(b: BattleState, ctx: BattleCtx): PlayResult {
  const r = confirmTurn(b);
  let battle = r.battle;
  while (battle.pending && battle.outcome === 'ongoing') battle = advanceBeat(battle, ctx);
  return { battle, answers: r.answers };
}
