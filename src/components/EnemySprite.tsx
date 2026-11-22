import { useMemo } from 'react';
import { spriteFor } from '../art';
import { bobSprite, flashSprite } from '../art/sprite';
import PixelSprite from './PixelSprite';

interface Props {
  enemyId: string;
  /** Integer pixels per sprite pixel (32px sprite → 32×scale). */
  scale: number;
  /** True for a moment after a hit: overlays the white flash frame. */
  hit: boolean;
}

/** An enemy's 32×32 sprite with a two-frame idle bob (CSS-swapped) and a hit flash. */
export default function EnemySprite({ enemyId, scale, hit }: Props) {
  const base = spriteFor(enemyId);
  const bob = useMemo(() => bobSprite(base), [base]);
  const flash = useMemo(() => flashSprite(base), [base]);
  const px = base.size * scale;
  return (
    <div className="enemy-sprite" style={{ width: px, height: px }}>
      <PixelSprite sprite={base} scale={scale} className="frame-a" />
      <PixelSprite sprite={bob} scale={scale} className="frame-b" />
      {hit && <PixelSprite sprite={flash} scale={scale} className="frame-flash" />}
    </div>
  );
}
