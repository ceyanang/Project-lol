import { useEffect, useMemo, useRef, useState } from 'react';
import HpBar from '../components/HpBar';
import KanaCard from '../components/KanaCard';
import ReadingCheck from '../components/ReadingCheck';
import { RELIC_BY_ID, VOCAB_BY_ID, KANA_BY_ID } from '../data';
import {
  type BattleState,
  type Fx,
  type PlayPlan,
  type PlayStep,
  blindView,
  cardMatch,
  cardValue,
  currentIntent,
  intentDamage,
  isAttackIntent,
  planPlay,
  promptRomaji,
} from '../game/battle';
import { CONFIG } from '../config';
import { cardCost } from '../game/deck';
import type { Vocab } from '../types';

interface Props {
  battle: BattleState;
  words: readonly Vocab[];
  unlocked: readonly string[];
  floor: number;
  onPlay: (plan: PlayPlan, results: boolean[]) => void;
  onEndTurn: () => void;
  onSpeak: (text: string) => void;
  onMenu?: () => void;
  /** Kana ids currently flagged as missed by the SRS. */
  missed?: ReadonlySet<string>;
}

const FX_MS = 1000;

export default function Battle({ battle, words, unlocked, floor, onPlay, onEndTurn, onSpeak, onMenu, missed }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [checking, setChecking] = useState<PlayPlan | null>(null);
  const [fx, setFx] = useState<Fx[]>([]);
  const lastFx = useRef(battle.fxSeq);
  const e = battle.enemy;
  const intent = currentIntent(e);

  // spawn floating numbers for new fx entries
  useEffect(() => {
    const fresh = battle.fx.filter((f) => f.id > lastFx.current);
    lastFx.current = battle.fxSeq;
    if (!fresh.length) return;
    setFx((cur) => [...cur, ...fresh]);
    const t = window.setTimeout(() => setFx((cur) => cur.filter((f) => !fresh.includes(f))), FX_MS);
    return () => window.clearTimeout(t);
  }, [battle.fxSeq, battle.fx]);

  // drop selections that left the hand (new turn)
  useEffect(() => {
    setSelected((s) => s.filter((u) => battle.hand.some((c) => c.uid === u)));
  }, [battle.hand]);

  // The real plan is what gets resolved; the preview uses the blind view so it can't leak prompt matches.
  const plan = useMemo(() => planPlay(battle, selected, { words }), [battle, selected, words]);
  const seen = useMemo(() => blindView(battle), [battle]);
  const preview = useMemo(() => planPlay(seen, selected, { words }), [seen, selected, words]);
  const hints = CONFIG.combat.showMatchHints;
  const enemyHit = fx.some((f) => f.kind === 'enemyHit');
  const playerHit = fx.some((f) => f.kind === 'playerHit' || f.kind === 'miss');

  function toggle(uid: string) {
    setSelected((s) => (s.includes(uid) ? s.filter((u) => u !== uid) : [...s, uid]));
  }

  function startCheck() {
    if (!plan.valid) return;
    setChecking(plan);
  }

  function onAnswer(step: PlayStep, correct: boolean) {
    if (step.kind === 'romaji') onSpeak(KANA_BY_ID[step.ref].char);
    else if (correct) onSpeak(VOCAB_BY_ID[step.ref].reading);
  }

  function finishCheck(results: boolean[]) {
    const p = checking!;
    setChecking(null);
    setSelected([]);
    if (p.word && results.every(Boolean)) window.setTimeout(() => onSpeak(p.word!.reading), 250);
    onPlay(p, results);
  }

  const intentText =
    intent.type === 'attack'
      ? `⚔️ ${intentDamage(e, intent)}`
      : intent.type === 'multi'
        ? `⚔️ ${intentDamage(e, intent)}×${intent.times ?? 2}`
        : intent.type === 'defend'
          ? `🛡 ${Math.round(intent.value * e.dmgScale)}`
          : `💪 +${intent.value}`;
  const wordPrompt = battle.prompts.word ? VOCAB_BY_ID[battle.prompts.word] : null;
  const ongoing = battle.outcome === 'ongoing';

  return (
    <main className="screen battle">
      <header className="battle-top">
        <span className="pill">Floor {floor}</span>
        <span className="pill">Turn {battle.turn}</span>
        <span className="relic-strip">
          {battle.relics.map((r) => (
            <span key={r} title={RELIC_BY_ID[r]?.name}>
              {RELIC_BY_ID[r]?.emoji}
            </span>
          ))}
        </span>
        {onMenu && (
          <button type="button" className="icon-btn" onClick={onMenu} aria-label="Menu">
            ☰
          </button>
        )}
      </header>

      <section className={`enemy tier-${e.tier}`}>
        <div className="intent-bubble" aria-label="Enemy intent">
          {intentText}
        </div>
        <div className={`enemy-emoji ${enemyHit ? 'shake' : ''}`} key={enemyHit ? `hit${battle.fxSeq}` : 'idle'}>
          {e.emoji}
        </div>
        <div className="enemy-name">
          {e.name}
          {e.armor > 0 && <span className="armor" title="Armor: reduces every hit">⛨ {e.armor}</span>}
          {e.strength > 0 && <span className="armor">💪 {e.strength}</span>}
        </div>
        <HpBar hp={e.hp} max={e.maxHp} block={e.block} label="Enemy HP" />
        <div className="fx-layer">
          {fx
            .filter((f) => f.kind === 'enemyHit' || f.kind === 'enemyBlock' || f.kind === 'buff' || f.kind === 'combo' || f.kind === 'reveal')
            .map((f) => (
              <span key={f.id} className={`fx fx-${f.kind}`}>
                {f.text}
              </span>
            ))}
        </div>
      </section>

      <section className="prompts" aria-label="Enemy prompts">
        {battle.prompts.guard && isAttackIntent(intent) && (
          <span className="prompt prompt-guard" title="Play a Block card with this reading for a Perfect Guard">
            🛡 Guard <b>{battle.prompts.guard}</b>
          </span>
        )}
        {battle.prompts.weak.map((w) => (
          <span key={w} className="prompt prompt-weak" title="Play an Attack card with this reading for double damage">
            🎯 <b>{w}</b>
          </span>
        ))}
        {wordPrompt && (
          <span className="prompt prompt-word" title="Chain cards into this word">
            💬 “{wordPrompt.meaning}”
          </span>
        )}
        {!battle.prompts.guard && !battle.prompts.weak.length && !wordPrompt && <span className="muted small">No prompts left — play freely!</span>}
      </section>

      <section className="play-preview" aria-live="polite">
        {selected.length === 0 ? (
          <span className="muted small">Tap a card · tap several to spell a word</span>
        ) : plan.valid ? (
          <span>
            {preview.label && <b className="preview-label jp">{preview.label} </b>}
            {preview.damage > 0 && <span className="c-attack">⚔️ {preview.damage}{hints ? '' : '+'} </span>}
            {preview.block > 0 && <span className="c-block">🛡 {preview.block}{hints ? '' : '+'} </span>}
            <span className="muted">({plan.cost}⚡)</span>
          </span>
        ) : (
          <span className="muted small">{plan.reason}</span>
        )}
      </section>

      <section className={`player-bar ${playerHit ? 'shake' : ''}`}>
        <div className="player-hp">
          <span className="who">🧑‍🎤 You</span>
          <HpBar hp={battle.playerHp} max={battle.playerMaxHp} block={battle.playerBlock} color="var(--green)" label="Your HP" />
        </div>
        <div className="energy" aria-label={`Energy ${battle.energy}`}>
          ⚡<b>{battle.energy}</b>
        </div>
        <div className="fx-layer">
          {fx
            .filter((f) => f.kind === 'playerHit' || f.kind === 'block' || f.kind === 'miss')
            .map((f) => (
              <span key={f.id} className={`fx fx-${f.kind}`}>
                {f.text}
              </span>
            ))}
        </div>
      </section>

      <section className="hand" style={{ ['--n' as string]: battle.hand.length }}>
        {battle.hand.map((c) => {
          const idx = selected.indexOf(c.uid);
          const cost = cardCost(c);
          return (
            <KanaCard
              key={c.uid}
              card={c}
              cost={cost}
              value={cardValue(c, seen)}
              match={hints ? cardMatch(c, battle.prompts) : null}
              missed={c.type !== 'word' && !!missed?.has(c.ref)}
              selected={idx >= 0}
              order={selected.length > 1 && idx >= 0 ? idx + 1 : undefined}
              disabled={!ongoing || (idx < 0 && cost > battle.energy && selected.length === 0)}
              onTap={() => ongoing && toggle(c.uid)}
            />
          );
        })}
        {battle.hand.length === 0 && <span className="muted small">Hand empty — end your turn.</span>}
      </section>

      <footer className="battle-actions">
        <span className="pile" aria-label="Draw pile">
          🂠 {battle.drawPile.length}
        </span>
        <button type="button" className="btn btn-primary grow" disabled={!plan.valid || !ongoing} onClick={startCheck}>
          {plan.word ? `Cast ${plan.word.reading}` : 'Play'}
        </button>
        <button type="button" className="btn btn-blue" disabled={!ongoing} onClick={onEndTurn}>
          End Turn
        </button>
        <span className="pile" aria-label="Discard pile">
          ♻ {battle.discard.length}
        </span>
      </footer>

      {checking && (
        <ReadingCheck
          steps={checking.steps}
          unlocked={unlocked}
          title={checking.word ? `Spell ${checking.word.reading}` : undefined}
          decoys={CONFIG.combat.promptDecoysInCheck ? promptRomaji(battle.prompts) : []}
          onAnswer={onAnswer}
          onDone={finishCheck}
          onCancel={() => setChecking(null)}
        />
      )}
    </main>
  );
}
