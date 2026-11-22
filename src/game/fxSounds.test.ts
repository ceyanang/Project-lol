import { describe, expect, it } from 'vitest';
import type { Fx } from './battle';
import { castSfx, soundsFor } from './fxSounds';
import { type Sfx, playSfx, setSfxEnabled } from './sfx';

const fx = (kind: Fx['kind'], extra: Partial<Fx> = {}): Fx => ({ id: 1, kind, text: '', ...extra });

describe('castSfx', () => {
  it('has a sound per element, physical for none', () => {
    expect(castSfx('fire')).toBe('castFire');
    expect(castSfx('water')).toBe('castWater');
    expect(castSfx('wind')).toBe('castWind');
    expect(castSfx('thunder')).toBe('castThunder');
    expect(castSfx('physical')).toBe('castPhysical');
    expect(castSfx(undefined)).toBe('castPhysical');
  });
});

describe('soundsFor', () => {
  it('an elemental hit plays its cast sound instead of the generic hit and spell', () => {
    expect(soundsFor([fx('move'), fx('enemyHit', { element: 'fire', amount: 9 })])).toEqual(['castFire']);
  });

  it('an armor-only hit with no element still plays the plain hit', () => {
    expect(soundsFor([fx('enemyHit', { text: 'Armor!' })])).toEqual(['hit']);
  });

  it('combos and reactions get their own sounds on top of the cast', () => {
    const s = soundsFor([fx('enemyHit', { element: 'thunder', amount: 17 }), fx('react'), fx('combo')]);
    expect(s).toEqual(expect.arrayContaining(['castThunder', 'react', 'comboUp']));
    expect(s).not.toContain('spell');
  });

  it('non-attack moves keep their block and heal sounds', () => {
    expect(soundsFor([fx('move'), fx('block')])).toEqual(['block']);
    expect(soundsFor([fx('move'), fx('heal')])).toEqual(['heal']);
  });

  it('never repeats a sound', () => {
    const s = soundsFor([fx('enemyHit', { element: 'fire', amount: 5 }), fx('enemyHit', { element: 'fire', amount: 2 })]);
    expect(s).toEqual(['castFire']);
  });
});

describe('new sounds', () => {
  it('never throw without Web Audio', () => {
    setSfxEnabled(true);
    for (const s of ['castFire', 'castWater', 'castWind', 'castThunder', 'castPhysical', 'comboUp', 'react'] as Sfx[]) expect(() => playSfx(s)).not.toThrow();
  });
});
