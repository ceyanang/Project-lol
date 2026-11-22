import { BOSS_SPRITES } from './enemies-boss';
import { ELITE_SPRITES } from './enemies-elite';
import { NORMAL_SPRITES } from './enemies-normal';
import type { Sprite } from './sprite';

/** Every enemy's 32×32 sprite, keyed by enemy id. */
export const ENEMY_SPRITES: Record<string, Sprite> = { ...NORMAL_SPRITES, ...ELITE_SPRITES, ...BOSS_SPRITES };

/** The sprite for an enemy id; throws for an unknown id so missing art can't ship silently. */
export function spriteFor(enemyId: string): Sprite {
  const s = ENEMY_SPRITES[enemyId];
  if (!s) throw new Error(`no sprite for enemy "${enemyId}"`);
  return s;
}
