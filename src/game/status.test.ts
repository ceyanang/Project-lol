import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { MOVE_BY_ID } from '../data';
import { advanceBeat, confirmTurn, effectiveIntent, incomingDamage, intentDamage, playTurn, previewMove } from './battle';
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

describe('gust, stun and immunity', () => {
  const GUST = ['wind_slash', 'strike', 'guard', 'strike'];

  it('a wind hit trims one hit off a multi-hit intent', () => {
    const b = confirmTurn(typeFor(makeBattle(GUST, 'hitodama'), 'wind_slash')).battle; // intent 0: 3 hits
    expect(incomingDamage(b.enemy)).toBe(intentDamage(b.enemy) * 2);
  });

  it('a wind hit cancels a buff intent', () => {
    const ctx = ctxFor(3, 2);
    let b = confirmTurn(typeFor(makeBattle(GUST, 'bakeneko', ctx), 'wind_slash')).battle; // intent 0: buff
    b = advanceBeat(b, ctx);
    expect(b.enemy.strength).toBe(0);
    expect(b.enemy.status.gust).toBe(0);
  });

  it('a one-hit multi with gust is cancelled and deals nothing', () => {
    const ctx = ctxFor(3, 2);
    const b = makeBattle(GUST, 'kodama', ctx);
    const e = { ...b.enemy, pattern: [{ type: 'multi' as const, value: 3, times: 1 }], status: { ...b.enemy.status, gust: 1 } };
    expect(effectiveIntent(e)).toBeNull();
    expect(incomingDamage(e)).toBe(0);
    expect(advanceBeat({ ...confirmTurn({ ...b, enemy: e, typed: '' }).battle }, ctx).playerHp).toBe(HP);
  });

  it('a shocked enemy loses exactly one action', () => {
    const ctx = ctxFor(3, 3);
    let b = makeBattle(DECK, 'kodama', ctx);
    b = { ...playTurn(typeFor(b, 'water_jet'), ctx).battle, playerHp: HP };
    b = advanceBeat(confirmTurn(typeFor(b, 'lightning_seal')).battle, ctx); // enemy turn: kodama would defend
    expect(b.enemy.block).toBe(0);
    expect(b.enemy.status.stun).toBe(0);
    expect(b.playerHp).toBe(HP);
    b = advanceBeat(b, ctx); // deal
    b = advanceBeat(confirmTurn({ ...b, typed: '' }).battle, ctx); // next enemy turn: attacks again
    expect(b.playerHp).toBeLessThan(HP);
  });

  it('a burn-immune enemy never gains burn', () => {
    const e = { ...makeBattle(DECK).enemy, gimmicks: [{ type: 'immune' as const, to: ['burn' as const] }] };
    expect(applyElementStatus(e, 'fire').enemy.status.burn).toBe(0);
  });

  it('a stun-immune enemy is not stunned by shock', () => {
    const base = makeBattle(DECK).enemy;
    const e = { ...base, status: { ...base.status, soak: 2 }, gimmicks: [{ type: 'immune' as const, to: ['stun' as const] }] };
    const r = applyElementStatus(e, 'thunder');
    expect(r.reaction).toBe('shock');
    expect(r.enemy.status.stun).toBe(0);
  });
});
