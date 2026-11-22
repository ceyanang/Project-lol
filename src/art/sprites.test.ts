import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import PixelSprite from '../components/PixelSprite';
import { writeFileSync } from 'node:fs';
import { CAST_SPRITE } from './effects';
import { ELEMENT_ICON, KIND_ICON, STATUS_ICON } from './icons';
import { type Sprite, bobSprite, defineSprite, flashSprite } from './sprite';
import { renderSheet } from './sheet';

const blank = (size: number) => Array.from({ length: size }, () => '.'.repeat(size));
const withPixel = (size: 16 | 32, row: number, col: number, ch: string) => {
  const rows = blank(size);
  rows[row] = rows[row].slice(0, col) + ch + rows[row].slice(col + 1);
  return rows;
};

describe('defineSprite', () => {
  it('rejects a wrong row count, a wrong row length and unknown letters', () => {
    expect(() => defineSprite(16, blank(15))).toThrow(/rows/);
    expect(() => defineSprite(16, [...blank(15), '.'.repeat(15)])).toThrow(/length/);
    expect(() => defineSprite(16, withPixel(16, 3, 3, '?'))).toThrow(/\?/);
  });

  it('merges the base palette with sprite-specific letters', () => {
    const s = defineSprite(16, withPixel(16, 0, 0, 'Z'), { Z: '#123456' });
    expect(s.palette.Z).toBe('#123456');
    expect(s.palette.K).toBeDefined();
  });
});

describe('derived frames', () => {
  it('flashSprite keeps the ink outline and turns everything else paper white', () => {
    const rows = withPixel(16, 2, 2, 'K');
    rows[2] = rows[2].slice(0, 3) + 'G' + rows[2].slice(4);
    const f = flashSprite(defineSprite(16, rows));
    expect(f.rows[2].slice(2, 4)).toBe('KW');
  });

  it('bobSprite shifts everything down one row and drops the bottom row', () => {
    const b = bobSprite(defineSprite(16, withPixel(16, 0, 5, 'K')));
    expect(b.rows).toHaveLength(16);
    expect(b.rows[0]).toBe('.'.repeat(16));
    expect(b.rows[1][5]).toBe('K');
    const bottom = bobSprite(defineSprite(16, withPixel(16, 15, 5, 'K')));
    expect(bottom.rows.join('')).not.toContain('K');
  });
});

describe('rendering', () => {
  it('PixelSprite draws a canvas of size × scale pixels', () => {
    const html = renderToStaticMarkup(createElement(PixelSprite, { sprite: defineSprite(32, blank(32)), scale: 3 }));
    expect(html).toContain('<canvas');
    expect(html).toContain('width="96"');
    expect(html).toContain('height="96"');
  });

  it('renderSheet produces a PNG', () => {
    const png = renderSheet([defineSprite(16, withPixel(16, 1, 1, 'K'))], { scale: 4, columns: 2 });
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });
});

describe('icons and effects', () => {
  const records: Record<string, Record<string, Sprite>> = { ELEMENT_ICON, KIND_ICON, STATUS_ICON, CAST_SPRITE };
  const elements = ['physical', 'fire', 'water', 'wind', 'thunder'];

  it('has an element icon and a cast sprite for every element', () => {
    expect(Object.keys(ELEMENT_ICON).sort()).toEqual([...elements].sort());
    expect(Object.keys(CAST_SPRITE).sort()).toEqual([...elements].sort());
  });

  it('has kind and status icons for everything the UI shows', () => {
    expect(Object.keys(KIND_ICON).sort()).toEqual(['block', 'heal', 'mirror', 'weaken']);
    expect(Object.keys(STATUS_ICON).sort()).toEqual(['burn', 'frozen', 'gust', 'shell', 'soak', 'stun']);
  });

  it('every icon is a non-blank 16×16 sprite and no two in a record look alike', () => {
    for (const [name, rec] of Object.entries(records)) {
      const seen = new Set<string>();
      for (const [key, s] of Object.entries(rec)) {
        expect(s.size, `${name}.${key}`).toBe(16);
        expect(s.rows.join('').replace(/\./g, '').length, `${name}.${key} blank`).toBeGreaterThan(20);
        const sig = s.rows.join('/');
        expect(seen.has(sig), `${name}.${key} duplicates another`).toBe(false);
        seen.add(sig);
      }
    }
  });
});

it.skipIf(!process.env.SPRITES)('writes sprite-sheet.png for a human to look at', () => {
  const all = [ELEMENT_ICON, CAST_SPRITE, KIND_ICON, STATUS_ICON].flatMap((r) => Object.values(r));
  writeFileSync('sprite-sheet.png', renderSheet(all, { scale: 8, columns: 5 }));
});
