import { BASE_PALETTE } from './palette';

/** A pixel sprite: a square grid of palette letters ('.' = transparent). */
export interface Sprite {
  size: 16 | 32;
  rows: string[];
  palette: Record<string, string>;
}

/** Build a sprite, validating its shape and that every letter has a colour. */
export function defineSprite(size: 16 | 32, rows: string[], palette: Record<string, string> = {}): Sprite {
  const merged = { ...BASE_PALETTE, ...palette };
  if (rows.length !== size) throw new Error(`sprite needs ${size} rows, got ${rows.length}`);
  rows.forEach((row, y) => {
    if (row.length !== size) throw new Error(`sprite row ${y} has length ${row.length}, expected ${size}`);
    for (const ch of row) if (ch !== '.' && !merged[ch]) throw new Error(`sprite row ${y} uses unknown letter "${ch}"`);
  });
  return { size, rows, palette: merged };
}

/** Hit-flash frame: everything but the ink outline turns paper white. */
export function flashSprite(s: Sprite): Sprite {
  return { ...s, rows: s.rows.map((r) => r.replace(/[^.K]/g, 'W')) };
}

/** Idle frame B: the whole sprite one pixel lower (the bottom row falls off). */
export function bobSprite(s: Sprite): Sprite {
  return { ...s, rows: ['.'.repeat(s.size), ...s.rows.slice(0, s.size - 1)] };
}

/** Paint a sprite onto a canvas at an integer scale. */
export function drawSprite(ctx: CanvasRenderingContext2D, s: Sprite, scale: number): void {
  ctx.clearRect(0, 0, s.size * scale, s.size * scale);
  s.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      ctx.fillStyle = s.palette[ch];
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  });
}
