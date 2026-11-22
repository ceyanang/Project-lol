import { useEffect, useRef, useState } from 'react';
import { ELEMENT_ICON } from '../art/icons';
import CastFx from '../components/CastFx';
import ComboMeter from '../components/ComboMeter';
import EnemySprite from '../components/EnemySprite';
import HpBar from '../components/HpBar';
import PixelSprite from '../components/PixelSprite';
import StatusChips from '../components/StatusChips';
import ReadingInput from '../components/ReadingInput';
import MoveCard from '../components/MoveCard';
import { ELEMENT_META, MOVE_BY_ID, RELIC_BY_ID } from '../data';
import { type BattleState, type Fx, effectiveIntent, intentDamage, previewMove } from '../game/battle';
import { statusOf } from '../game/status';
import { soundsFor } from '../game/fxSounds';
import { playSfx } from '../game/sfx';
import type { KeyboardMode } from '../game/storage';

interface Props {
  battle: BattleState;
  floor: number;
  onType: (typed: string) => void;
  onConfirm: () => void;
  keyboardMode: KeyboardMode;
  onMenu?: () => void;
}

const FX_MS = 1100;

const ENEMY_FX: Fx['kind'][] = ['enemyHit', 'enemyBlock', 'buff', 'move', 'weak', 'resist', 'combo', 'react'];
const PLAYER_FX: Fx['kind'][] = ['playerHit', 'block', 'miss', 'heal'];

export default function Battle({ battle, floor, onType, onConfirm, onMenu, keyboardMode }: Props) {
  const [fx, setFx] = useState<Fx[]>([]);
  const lastFx = useRef(battle.fxSeq);
  const e = battle.enemy;
  const intent = effectiveIntent(e);
  const scale = keyboardMode === 'phone' ? 2 : window.innerHeight >= 780 ? 4 : 3;
  const ongoing = battle.outcome === 'ongoing';
  // during a beat (enemy acting / dealing) nothing is tappable
  const busy = !ongoing || !!battle.pending;

  // floating numbers + sounds for new fx entries
  useEffect(() => {
    const fresh = battle.fx.filter((f) => f.id > lastFx.current);
    lastFx.current = battle.fxSeq;
    if (!fresh.length) return;
    soundsFor(fresh).forEach((s, i) => (i === 0 ? playSfx(s) : window.setTimeout(() => playSfx(s), i * 70)));
    setFx((cur) => [...cur, ...fresh]);
    const t = window.setTimeout(() => setFx((cur) => cur.filter((f) => !fresh.includes(f))), FX_MS);
    return () => window.clearTimeout(t);
  }, [battle.fxSeq, battle.fx]);

  useEffect(() => {
    if (battle.outcome === 'won') window.setTimeout(() => playSfx('victory'), 300);
    if (battle.outcome === 'lost') window.setTimeout(() => playSfx('defeat'), 300);
  }, [battle.outcome]);

  const enemyHit = fx.some((f) => f.kind === 'enemyHit');
  const hitAmount = fx.filter((f) => f.kind === 'enemyHit').at(-1)?.amount ?? 0;
  // bigger hits shake harder and freeze the sprite a little longer before the shake
  const hitStyle = { '--shake': `${Math.min(12, 3 + hitAmount / 3)}px`, '--stop': `${Math.min(110, 40 + hitAmount * 3)}ms` } as React.CSSProperties;
  const playerHit = fx.some((f) => f.kind === 'playerHit' || f.kind === 'miss');
  const intentText = !intent
    ? statusOf(e).stun > 0
      ? 'Stunned'
      : '✖'
    : intent.type === 'attack'
      ? `⚔️ ${intentDamage(e, intent)}`
      : intent.type === 'multi'
        ? `⚔️ ${intentDamage(e, intent)}×${intent.times ?? 2}`
        : intent.type === 'defend'
          ? `🛡 ${Math.round(intent.value * e.dmgScale)}`
          : `💪 +${intent.value}`;
  const weak = e.weak ? ELEMENT_META[e.weak] : null;
  const resist = e.resist ? ELEMENT_META[e.resist] : null;

  return (
    <main className={`screen battle ${keyboardMode === 'phone' ? 'layout-phone' : ''}`}>
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
        <div className={`intent-bubble ${battle.pending === 'enemy' ? 'is-acting' : ''}`} aria-label="Enemy intent">
          {intentText}
        </div>
        <div className={`enemy-art ${enemyHit ? 'is-hit' : ''} ${battle.outcome === 'won' ? 'is-dead' : ''}`} style={hitStyle} key={enemyHit ? `hit${battle.fxSeq}` : 'idle'}>
          <EnemySprite enemyId={e.defId} scale={scale} hit={enemyHit} />
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
              Weak <PixelSprite sprite={ELEMENT_ICON[e.weak!]} scale={1} /> {weak.label}
            </span>
          )}
          {resist && (
            <span className="matchup matchup-resist">
              Resists <PixelSprite sprite={ELEMENT_ICON[e.resist!]} scale={1} /> {resist.label}
            </span>
          )}
          <StatusChips enemy={e} scale={keyboardMode === 'phone' ? 1 : 2} />
        </div>
        <CastFx fx={fx} scale={keyboardMode === 'phone' ? 4 : 8} />
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
          <span className="muted">Type a move's reading, then ⏎ to end your turn.</span>
        )}
      </p>

      <ComboMeter combo={battle.combo} />

      <section className={`moves ${battle.pending ? 'is-waiting' : ''}`} aria-label="Your moves this turn">
        {battle.slots.map((s) => {
          const move = MOVE_BY_ID[s.card.moveId];
          return <MoveCard key={s.uid} move={move} label={s.label.text} frozen={battle.frozen?.includes(s.uid)} preview={previewMove(move, s.label, battle)} />;
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

      {/* Docked like the quiz's keyboard sheet: ⏎ is End Turn (empty ⏎ skips your move). */}
      <section className={`kbd-dock ${battle.pending ? 'is-waiting' : ''}`} aria-label="Type the reading">
        <ReadingInput
          mode={keyboardMode}
          value={battle.typed}
          onChange={onType}
          onEnter={onConfirm}
          disabled={busy}
          keepFocus
          placeholder={
            battle.pending === 'enemy'
              ? "Enemy's turn…"
              : battle.pending === 'deal'
                ? 'Dealing your moves…'
                : keyboardMode === 'phone'
                  ? 'type the reading'
                  : 'type a reading · ⏎ ends turn'
          }
          left={
            keyboardMode === 'phone' ? (
              <span className="pile dock-hp" aria-label={`Your HP ${battle.playerHp}${battle.playerBlock ? `, block ${battle.playerBlock}` : ''}`}>
                ❤️ {battle.playerHp}
                {battle.playerBlock > 0 && <small> 🛡{battle.playerBlock}</small>}
              </span>
            ) : (
              <span className="pile" aria-label="Draw pile">
                🂠 {battle.drawPile.length}
              </span>
            )
          }
          right={
            <span className="pile" aria-label="Discard pile">
              ♻ {battle.discard.length}
            </span>
          }
        />
      </section>
      {keyboardMode === 'phone' && (
        <div className="keyboard-space" aria-hidden="true">
          <span>📱 your keyboard opens here</span>
        </div>
      )}
    </main>
  );
}
