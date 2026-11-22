import { useEffect, useRef } from 'react';
import { type Sprite, drawSprite } from '../art/sprite';

interface Props {
  sprite: Sprite;
  /** Integer pixels per sprite pixel. */
  scale?: number;
  className?: string;
}

/** A pixel-art sprite drawn crisp on a canvas. */
export default function PixelSprite({ sprite, scale = 4, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) drawSprite(ctx, sprite, scale);
  }, [sprite, scale]);
  const px = sprite.size * scale;
  return <canvas ref={ref} className={`pixel ${className ?? ''}`} width={px} height={px} aria-hidden="true" />;
}
