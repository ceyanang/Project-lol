import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { MOVE_BY_ID } from '../data';
import { advanceBeat, confirmTurn, playTurn, previewMove } from './battle';
import { applyElementStatus } from './status';
import { HP, ctxFor, makeBattle, typeFor } from './testkit';

const DECK = ['water_jet', 'fire_talisman', 'lightning_seal', 'strike'];

describe('burn', () => {
  it('a fire hit adds burn that ticks at the end of the enemy turn and decays', () => {
    const ctx = ctxFor(3, 2);
    let b = makeBattle(DECK, 'kodama', ctx);
    b = confirmTurn(typeFor(b, 'fire_talisman')).battle;
    expect(b.enemy.status.burn).toBe(CONFIG.status.burnStacksPerHit);
    const hpBefore = b.enemy.hp;
    b = advanceBeat(b, ctx);
    expect(b.enemy.hp).toBe(hpBefore - 2);
    expect(b.enemy.status.burn).toBe(1);
  });

  it('burn is capped at burnMax', () => {
    let e = makeBattle(DECK).enemy;
    for (let i = 0; i < 4; i++) e = applyElementStatus(e, 'fire').enemy;
    expect(e.status.burn).toBe(CONFIG.status.burnMax);
  });

  it('a burn tick that kills the enemy ends the battle as won', () => {
    const ctx = ctxFor(3, 2);
    let b = makeBattle(DECK, 'kodama', ctx);
    b = { ...b, enemy: { ...b.enemy, hp: 2, status: { ...b.enemy.status, burn: 3 } } };
    b = advanceBeat(confirmTurn({ ...b, typed: '' }).battle, ctx);
    expect(b.enemy.hp).toBe(0);
    expect(b.outcome).toBe('won');
  });

  it('an enemy saved without a status field still plays a turn', () => {
    const ctx = ctxFor(3, 2);
    const b = makeBattle(DECK, 'kodama', ctx);
    const { status: _s, ...old } = b.enemy;
    const next = playTurn({ ...b, enemy: old as typeof b.enemy }, ctx).battle;
    expect(next.enemy.status).toEqual({ burn: 0, soak: 0, stun: 0, gust: 0 });
  });
});

describe('soak and reactions', () => {
  const soaked = () => {
    const ctx = ctxFor(3, 3);
    let b = makeBattle(DECK, 'kodama', ctx);
    b = playTurn(typeFor(b, 'water_jet'), ctx).battle;
    return { b: { ...b, playerHp: HP }, ctx };
  };

  it('a water hit soaks for soakTurns and one enemy turn wears one off', () => {
    const ctx = ctxFor(3, 3);
    let b = confirmTurn(typeFor(makeBattle(DECK, 'kodama', ctx), 'water_jet')).battle;
    expect(b.enemy.status.soak).toBe(CONFIG.status.soakTurns);
    b = advanceBeat(b, ctx);
    expect(b.enemy.status.soak).toBe(CONFIG.status.soakTurns - 1);
  });

  it('thunder on a soaked enemy hits x1.5, clears soak and stuns', () => {
    const { b } = soaked();
    const fresh = makeBattle(DECK);
    expect(previewMove(MOVE_BY_ID.lightning_seal, b.slots[0].label, b).damagePerHit).toBe(Math.round(11 * CONFIG.status.shockMultiplier));
    expect(previewMove(MOVE_BY_ID.lightning_seal, fresh.slots[0].label, fresh).damagePerHit).toBe(11);
    const after = confirmTurn(typeFor(b, 'lightning_seal')).battle;
    expect(after.fx.filter((f) => f.kind === 'enemyHit').at(-1)!.amount).toBe(Math.round(11 * CONFIG.status.shockMultiplier));
    expect(after.fx.some((f) => f.kind === 'react' && f.text === 'Shock!')).toBe(true);
    expect(after.enemy.status.soak).toBe(0);
    expect(after.enemy.status.stun).toBe(CONFIG.status.shockStun);
  });

  it('fire on a soaked enemy is steam: x0.75, clears soak, no burn', () => {
    const { b } = soaked();
    const after = confirmTurn(typeFor(b, 'fire_talisman')).battle;
    expect(after.fx.filter((f) => f.kind === 'enemyHit').at(-1)!.amount).toBe(Math.round(11 * CONFIG.combat.weaknessMultiplier * CONFIG.status.steamMultiplier));
    expect(after.fx.some((f) => f.kind === 'react' && f.text === 'Steam!')).toBe(true);
    expect(after.enemy.status.soak).toBe(0);
    expect(after.enemy.status.burn).toBe(0);
  });
});
