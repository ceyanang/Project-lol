import type { Element } from '../types';
import type { Fx } from './battle';
import type { Sfx } from './sfx';

/** The cast sound for an element (physical when a move has none). */
export function castSfx(element: Element | undefined): Sfx {
  switch (element) {
    case 'fire':
      return 'castFire';
    case 'water':
      return 'castWater';
    case 'wind':
      return 'castWind';
    case 'thunder':
      return 'castThunder';
    default:
      return 'castPhysical';
  }
}

/** Sounds for a batch of fresh fx: elemental hits use their cast sound, never the generic hit/spell. */
export function soundsFor(fresh: Fx[]): Sfx[] {
  const out: Sfx[] = [];
  for (const f of fresh) {
    switch (f.kind) {
      case 'enemyHit':
        out.push(f.element ? castSfx(f.element) : 'hit');
        break;
      case 'playerHit':
        out.push('hurt');
        break;
      case 'block':
      case 'enemyBlock':
        out.push('block');
        break;
      case 'buff':
        out.push('buff');
        break;
      case 'heal':
        out.push('heal');
        break;
      case 'weak':
        out.push('combo');
        break;
      case 'combo':
        out.push('comboUp');
        break;
      case 'react':
        out.push('react');
        break;
    }
  }
  return [...new Set(out)];
}
