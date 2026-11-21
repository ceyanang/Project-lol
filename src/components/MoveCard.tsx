import { ELEMENT_META } from '../data';
import type { MovePreview } from '../game/battle';
import type { MoveDef } from '../types';

interface Props {
  move: MoveDef;
  /** This turn's kana (or word) label (battle only). */
  label?: string;
  /** Numbers against the current enemy; falls back to the move's base description. */
  preview?: MovePreview;
  count?: number;
  selected?: boolean;
  onTap?: () => void;
}

function summary(move: MoveDef, p?: MovePreview): string {
  if (!p) return move.description;
  if (p.hits > 0) return `${p.hits > 1 ? `${p.damagePerHit}×${p.hits}` : p.damagePerHit} dmg${p.pierce ? ' · pierce' : ''}${move.kind === 'drain' ? ' · heal' : ''}`;
  if (p.block > 0) return `+${p.block} block`;
  if (move.kind === 'mirror') return 'block all incoming';
  if (p.heal > 0) return `heal ${p.heal}`;
  if (p.weaken > 0) return `enemy −${p.weaken} str`;
  return move.description;
}

/** A move from your deck. In battle it carries this turn's romaji label. */
export default function MoveCard({ move, label, preview, count, selected, onTap }: Props) {
  const el = move.element ? ELEMENT_META[move.element] : null;
  const Tag = onTap ? 'button' : 'div';
  return (
    <Tag
      {...(onTap ? { type: 'button' as const, onClick: onTap, 'aria-pressed': selected } : {})}
      className={`move-card kind-${move.kind} ${selected ? 'is-selected' : ''} ${preview?.matchup ? `is-${preview.matchup}` : ''}`}
    >
      {label !== undefined && <span className={`move-label jp ${label.length > 1 ? 'is-word' : ''}`}>{label}</span>}
      <span className="move-body">
        <span className="move-name">
          {move.emoji} {move.name}
          {count && count > 1 ? <span className="move-count"> ×{count}</span> : null}
        </span>
        <span className="move-sum">
          {summary(move, preview)}
          {el && <span className="move-el" title={el.label}> {el.emoji}</span>}
          {preview?.matchup === 'weak' && <span className="badge badge-weak">WEAK</span>}
          {preview?.matchup === 'resist' && <span className="badge badge-resist">resist</span>}
        </span>
      </span>
    </Tag>
  );
}
