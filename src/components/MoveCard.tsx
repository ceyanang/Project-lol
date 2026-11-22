import { ELEMENT_ICON, KIND_ICON, STATUS_ICON } from '../art/icons';
import type { Sprite } from '../art/sprite';
import type { MovePreview } from '../game/battle';
import type { MoveDef } from '../types';
import PixelSprite from './PixelSprite';

interface Props {
  move: MoveDef;
  /** This turn's kana (or word) label (battle only). */
  label?: string;
  /** Numbers against the current enemy; falls back to the move's base description. */
  preview?: MovePreview;
  count?: number;
  selected?: boolean;
  /** Frozen by an enemy: can't be cast this turn. */
  frozen?: boolean;
  onTap?: () => void;
}

/** The pixel icon that stands in for the move's emoji: its element, or what it does. */
function iconFor(move: MoveDef): Sprite {
  if (move.kind === 'attack' || move.kind === 'drain') return ELEMENT_ICON[move.element ?? 'physical'];
  return KIND_ICON[move.kind];
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
export default function MoveCard({ move, label, preview, count, selected, frozen, onTap }: Props) {
  const Tag = onTap ? 'button' : 'div';
  return (
    <Tag
      {...(onTap ? { type: 'button' as const, onClick: onTap, 'aria-pressed': selected } : {})}
      className={`move-card kind-${move.kind} ${selected ? 'is-selected' : ''} ${frozen ? 'is-frozen' : ''} ${preview?.matchup ? `is-${preview.matchup}` : ''}`}
    >
      {label !== undefined && <span className={`move-label jp ${label.length > 1 ? 'is-word' : ''}`}>{label}</span>}
      <span className="move-body">
        <span className="move-name">
          <PixelSprite sprite={iconFor(move)} scale={1} /> {move.name}
          {count && count > 1 ? <span className="move-count"> ×{count}</span> : null}
        </span>
        <span className="move-sum">
          {summary(move, preview)}
          {preview?.matchup === 'weak' && <span className="badge badge-weak" title="Hits its weakness">弱 ×2</span>}
          {preview?.matchup === 'resist' && <span className="badge badge-resist" title="It resists this">耐 ×½</span>}
        </span>
      </span>
      {frozen && <PixelSprite sprite={STATUS_ICON.frozen} scale={2} className="frozen-badge" />}
    </Tag>
  );
}
