import { useEffect, useRef, useState } from 'react';
import HpBar from '../components/HpBar';
import MoveCard from '../components/MoveCard';
import { ELEMENT_META, MOVE_BY_ID, RELIC_BY_ID } from '../data';
import { type BattleState, type Fx, currentIntent, intentDamage, previewMove } from '../game/battle';
import { type Sfx, playSfx } from '../game/sfx';

interface Props {
  battle: BattleState;
  floor: number;
  onPick: (tileId: string) => void;
  onConfirm: () => void;
  onMenu?: () => void;
}

const FX_MS = 1100;

const FX_SOUND: Partial<Record<Fx['kind'], Sfx>> = {
  move: 'spell',
  enemyHit: 'hit',
  playerHit: 'hurt',
  block: 'block',
  enemyBlock: 'block',
  buff: 'buff',
  heal: 'heal',
  weak: 'combo',
};
const ENEMY_FX: Fx['kind'][] = ['enemyHit', 'enemyBlock', 'buff', 'move', 'weak', 'resist'];
const PLAYER_FX: Fx['kind'][] = ['playerHit', 'block', 'miss', 'heal'];

export default function Battle({ battle, floor, onPick, onConfirm, onMenu }: Props) {
  const [fx, setFx] = useState<Fx[]>([]);
  const lastFx = useRef(battle.fxSeq);
  const e = battle.enemy;
  const intent = currentIntent(e);
  const ongoing = battle.outcome === 'ongoing';

  // floating numbers + sounds for new fx entries
  useEffect(() => {
    const fresh = battle.fx.filter((f) => f.id > lastFx.current);
    lastFx.current = battle.fxSeq;
    if (!fresh.length) return;
    [...new Set(fresh.map((f) => FX_SOUND[f.kind]).filter((s): s is Sfx => !!s))].forEach((s, i) => window.setTimeout(() => playSfx(s), i * 120));
    setFx((cur) => [...cur, ...fresh]);
    const t = window.setTimeout(() => setFx((cur) => cur.filter((f) => !fresh.includes(f))), FX_MS);
    return () => window.clearTimeout(t);
  }, [battle.fxSeq, battle.fx]);

  useEffect(() => {
    if (battle.outcome === 'won') window.setTimeout(() => playSfx('victory'), 300);
    if (battle.outcome === 'lost') window.setTimeout(() => playSfx('defeat'), 300);
  }, [battle.outcome]);

  const enemyHit = fx.some((f) => f.kind === 'enemyHit');
  const playerHit = fx.some((f) => f.kind === 'playerHit' || f.kind === 'miss');
  const intentText =
    intent.type === 'attack'
      ? `⚔️ ${intentDamage(e, intent)}`
      : intent.type === 'multi'
        ? `⚔️ ${intentDamage(e, intent)}×${intent.times ?? 2}`
        : intent.type === 'defend'
          ? `🛡 ${Math.round(intent.value * e.dmgScale)}`
          : `💪 +${intent.value}`;
  const weak = e.weak ? ELEMENT_META[e.weak] : null;
  const resist = e.resist ? ELEMENT_META[e.resist] : null;

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
          {e.strength !== 0 && <span className="armor">💪 {e.strength}</span>}
        </div>
        <HpBar hp={e.hp} max={e.maxHp} block={e.block} label="Enemy HP" />
        <div className="matchups">
          {weak && (
            <span className="matchup matchup-weak">
              Weak {weak.emoji} {weak.label}
            </span>
          )}
          {resist && (
            <span className="matchup matchup-resist">
              Resists {resist.emoji} {resist.label}
            </span>
          )}
        </div>
        <div className="fx-layer">
          {fx
            .filter((f) => ENEMY_FX.includes(f.kind))
            .map((f) => (
              <span key={f.id} className={`fx fx-${f.kind}`}>
                {f.text}
              </span>
            ))}
        </div>
      </section>

      <p className={`turn-result ${battle.lastResult ? (battle.lastResult.ok ? 'is-ok' : 'is-bad') : ''}`} aria-live="polite">
        {battle.lastResult ? (
          <>
            {battle.lastResult.ok ? '✅ ' : battle.lastResult.tileText ? '❌ ' : '… '}
            <span className="jp">{battle.lastResult.text}</span>
          </>
        ) : (
          <span className="muted">Find the kana for the move you want, then End Turn.</span>
        )}
      </p>

      <section className="moves" aria-label="Your moves this turn">
        {battle.slots.map((s) => {
          const move = MOVE_BY_ID[s.card.moveId];
          return <MoveCard key={s.uid} move={move} romaji={s.label.romaji} preview={previewMove(move, s.label, battle)} />;
        })}
      </section>

      <section className={`player-bar ${playerHit ? 'shake' : ''}`}>
        <div className="player-hp">
          <HpBar hp={battle.playerHp} max={battle.playerMaxHp} block={battle.playerBlock} color="var(--green)" label="Your HP" />
        </div>
        <div className="fx-layer">
          {fx
            .filter((f) => PLAYER_FX.includes(f.kind))
            .map((f) => (
              <span key={f.id} className={`fx fx-${f.kind}`}>
                {f.text}
              </span>
            ))}
        </div>
      </section>

      <section className="tiles" aria-label="Kana tiles">
        {battle.tiles.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`kana-pick jp ${t.text.length > 1 ? 'is-word' : ''} ${battle.picked === t.id ? 'is-picked' : ''}`}
            onClick={() => {
              if (!ongoing) return;
              playSfx('select');
              onPick(t.id);
            }}
            aria-pressed={battle.picked === t.id}
            disabled={!ongoing}
          >
            {t.text}
          </button>
        ))}
      </section>

      <footer className="battle-actions">
        <span className="pile" aria-label="Draw pile">
          🂠 {battle.drawPile.length}
        </span>
        <button type="button" className={`btn grow ${battle.picked ? 'btn-primary' : 'btn-ghost'}`} disabled={!ongoing} onClick={onConfirm}>
          {battle.picked ? 'End Turn · do it!' : 'End Turn (skip move)'}
        </button>
        <span className="pile" aria-label="Discard pile">
          ♻ {battle.discard.length}
        </span>
      </footer>
    </main>
  );
}
