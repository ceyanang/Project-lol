import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { newProfile } from './storage';
import { enterNode, finishBattle, newRun } from './run';
import { ctxFor } from './testkit';

function wonRun(hp: number) {
  const ctx = ctxFor();
  const profile = newProfile();
  const start = newRun(profile, ctx, 0);
  const fight = start.map.flat().find((n) => n.type === 'fight')!;
  const run = enterNode(start, fight.id, profile.srs, ctx, 0);
  const battle = { ...run.battle!, outcome: 'won' as const, playerHp: hp };
  return { ctx, profile, run: { ...run, battle } };
}

describe('healing between fights', () => {
  it('heals a quarter of max HP after a won fight', () => {
    const { ctx, profile, run } = wonRun(30);
    const res = finishBattle(run, profile, ctx);
    expect(res.run.hp).toBe(30 + Math.round(run.maxHp * CONFIG.run.fightHealPct));
    expect(CONFIG.run.fightHealPct).toBe(0.25);
  });
  it('never heals above max HP', () => {
    const { ctx, profile, run } = wonRun(run0().maxHp - 2);
    expect(finishBattle(run, profile, ctx).run.hp).toBe(run.maxHp);
  });
});

function run0() {
  return newRun(newProfile(), ctxFor(), 0);
}
