import { describe, expect, it } from 'vitest';
import { playSfx, setSfxEnabled } from './sfx';

describe('sfx', () => {
  it('never throws without Web Audio (e.g. tests, old browsers)', () => {
    setSfxEnabled(true);
    for (const s of ['tap', 'hit', 'combo', 'victory'] as const) expect(() => playSfx(s)).not.toThrow();
  });
});
