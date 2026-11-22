import { CAST_SPRITE } from '../art/effects';
import { STATUS_ICON } from '../art/icons';
import type { Fx } from '../game/battle';
import type { Element, StatusKind } from '../types';
import PixelSprite from './PixelSprite';

const STATUS_OF: Partial<Record<Element, StatusKind>> = { fire: 'burn', water: 'soak', wind: 'gust' };

/**
 * The show when a move lands: a big pixel burst per element over the enemy, a status icon popping
 * up when a status is applied, and a screen flash for thunder. Driven entirely by fresh `Fx` events.
 */
export default function CastFx({ fx, scale = 8 }: { fx: Fx[]; scale?: number }) {
  const hits = fx.filter((f) => f.kind === 'enemyHit' && f.element);
  const pops = fx.filter((f) => f.kind === 'status' && f.element && STATUS_OF[f.element]);
  const thunder = hits.find((f) => f.element === 'thunder');
  if (!hits.length && !pops.length) return null;
  return (
    <>
      {hits.map((f) => (
        <PixelSprite key={f.id} sprite={CAST_SPRITE[f.element!]} scale={scale} className={`cast cast-${f.element}`} />
      ))}
      {pops.map((f) => (
        <PixelSprite key={f.id} sprite={STATUS_ICON[STATUS_OF[f.element!]!]} scale={Math.max(2, scale / 2)} className="status-pop" />
      ))}
      {thunder && <div key={`flash${thunder.id}`} className="screen-flash" aria-hidden="true" />}
    </>
  );
}
