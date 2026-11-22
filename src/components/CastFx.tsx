import { CAST_SPRITE } from '../art/effects';
import { STATUS_ICON } from '../art/icons';
import type { Fx } from '../game/battle';
import type { Element, StatusKind } from '../types';
import PixelSprite from './PixelSprite';

/** How long each cast burst plays (keep in step with the `.cast-*` animation lengths in styles.css). */
const CAST_MS: Record<Element, number> = { fire: 700, water: 650, wind: 520, thunder: 520, physical: 380 };
/** Longest the enemy's hit shake can run (`--stop` max 110 ms + 320 ms shake). */
const HIT_SHAKE_MS = 430;
const STATUS_POP_MS = 900;
const FLOATING_TEXT_MS = 1000;

/** How long an fx entry should stay mounted: exactly as long as its animation, no longer. */
export function fxLifetime(f: Pick<Fx, 'kind' | 'element'>): number {
  if (f.kind === 'enemyHit') return Math.max(HIT_SHAKE_MS, f.element ? CAST_MS[f.element] : 0);
  if (f.kind === 'status') return STATUS_POP_MS;
  return FLOATING_TEXT_MS;
}

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
