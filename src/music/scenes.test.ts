import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { makeBattle } from '../game/testkit';
import type { RunState } from '../game/run';
import { layersFor, sceneFor } from './scenes';

const DECK = ['strike', 'strike', 'strike', 'strike'];
const run = (phase: RunState['phase'], enemy?: string, patch: Record<string, unknown> = {}): RunState =>
  ({ phase, battle: enemy ? { ...makeBattle(DECK, enemy), ...patch } : null }) as unknown as RunState;

describe('sceneFor', () => {
  it('menus play the zen track, with or without a run', () => {
    for (const v of ['title', 'library', 'study', 'quiz']) {
      expect(sceneFor(v, null)).toBe('menu');
      expect(sceneFor(v, run('map'))).toBe('menu');
    }
    expect(sceneFor('run', null)).toBe('menu');
  });

  it('the map and rewards play the adventure track, rest sites the zen one', () => {
    expect(sceneFor('run', run('map'))).toBe('map');
    expect(sceneFor('run', run('reward'))).toBe('map');
    expect(sceneFor('run', run('rest'))).toBe('menu');
  });

  it('fights play battle music, bosses the boss track', () => {
    expect(sceneFor('run', run('battle', 'kodama'))).toBe('battle');
    expect(sceneFor('run', run('battle', 'tengu'))).toBe('battle');
    expect(sceneFor('run', run('battle', 'memorywraith'))).toBe('battle');
    expect(sceneFor('run', run('battle', 'oni'))).toBe('boss');
    expect(sceneFor('run', run('battle', 'ryujin'))).toBe('boss');
  });

  it('the run-over screen is silent so the win/lose sounds stand alone', () => {
    expect(sceneFor('run', run('over'))).toBeNull();
  });

  it('a battle phase with no battle loaded does not throw', () => {
    expect(sceneFor('run', run('battle'))).toBe('menu');
  });
});

describe('layersFor', () => {
  const tier = CONFIG.combo.tiers[0].at;

  it('the hook layer follows the combo in a normal fight', () => {
    expect(layersFor(run('battle', 'kodama', { combo: tier - 1 })).hook).toBe(false);
    expect(layersFor(run('battle', 'kodama', { combo: tier })).hook).toBe(true);
    expect(layersFor(run('battle', 'kodama', { combo: 0 })).hook).toBe(false);
  });

  it('elites have the hook on from the start', () => {
    expect(layersFor(run('battle', 'tengu', { combo: 0 })).hook).toBe(true);
  });

  it('a boss is enraged only after its phase change', () => {
    const b = makeBattle(DECK, 'oni');
    expect(layersFor({ phase: 'battle', battle: b } as unknown as RunState).enraged).toBe(false);
    expect(layersFor({ phase: 'battle', battle: { ...b, enemy: { ...b.enemy, phaseDone: true } } } as unknown as RunState).enraged).toBe(true);
  });

  it('outside a battle there are no layers', () => {
    expect(layersFor(null)).toEqual({ hook: false, enraged: false });
    expect(layersFor(run('map'))).toEqual({ hook: false, enraged: false });
  });
});
