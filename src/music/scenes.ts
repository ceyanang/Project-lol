import { CONFIG } from '../config';
import type { RunState } from '../game/run';

export type Scene = 'menu' | 'map' | 'battle' | 'boss';

/** Extra layers that react to the fight. */
export interface Layers {
  /** The battle hook melody (combo going, or an elite). */
  hook: boolean;
  /** A boss past its phase change: faster and denser. */
  enraged: boolean;
}

const NO_LAYERS: Layers = { hook: false, enraged: false };

/** Which track should play. `view` is App's view state ('title' | 'library' | 'study' | 'quiz' | 'run'); null = silence. */
export function sceneFor(view: string, run: RunState | null): Scene | null {
  if (view !== 'run' || !run) return 'menu';
  switch (run.phase) {
    case 'map':
    case 'reward':
      return 'map';
    case 'rest':
      return 'menu';
    case 'battle':
      if (!run.battle) return 'menu';
      return run.battle.enemy.tier === 'boss' ? 'boss' : 'battle';
    case 'over':
      return null;
    default:
      return 'menu';
  }
}

/** Layers for the current fight; none outside a battle. */
export function layersFor(run: RunState | null): Layers {
  const b = run?.phase === 'battle' ? run.battle : null;
  if (!b) return NO_LAYERS;
  return {
    hook: b.enemy.tier === 'elite' || b.combo >= CONFIG.combo.tiers[0].at,
    enraged: !!b.enemy.phaseDone,
  };
}
