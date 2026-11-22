import { describe, expect, it } from 'vitest';
import { ENEMIES, MOVE_BY_ID } from '../data';
import { confirmTurn, playTurn, previewMove } from './battle';
import { HP, ctxFor, makeBattle, typeFor } from './testkit';

const DECK = ['strike', 'lightning_seal', 'water_jet', 'fire_talisman'];
const dmg = (b: ReturnType<typeof makeBattle>, moveId: string) =>
  previewMove(MOVE_BY_ID[moveId], b.slots.find((s) => s.card.moveId === moveId)!.label, b).damagePerHit;

describe('shell (kappa)', () => {
  it('halves non-thunder damage until a thunder hit cracks it', () => {
    const ctx = ctxFor(3, 2);
    let b = makeBattle(DECK, 'kappa', ctx);
    expect(dmg(b, 'strike')).toBe(Math.round(MOVE_BY_ID.strike.value * 0.5));
    expect(dmg(b, 'lightning_seal')).toBe(MOVE_BY_ID.lightning_seal.value * 2); // weak thunder, full damage
    b = confirmTurn(typeFor(b, 'lightning_seal')).battle;
    expect(b.enemy.shellBroken).toBe(true);
    expect(dmg(b, 'strike')).toBe(MOVE_BY_ID.strike.value);
  });
});

describe('mimic (tanuki)', () => {
  it('starts resisting the element it was just hit with, but never its own weakness', () => {
    let b = makeBattle(DECK, 'tanuki');
    b = confirmTurn(typeFor(b, 'strike')).battle;
    expect(b.enemy.resist).toBe('physical');
    expect(previewMove(MOVE_BY_ID.strike, b.slots[0].label, b).matchup).toBe('resist');
    b = { ...b, typed: '' };
    const fire = confirmTurn(typeFor(b, 'fire_talisman')).battle;
    expect(fire.enemy.resist).toBe('physical'); // fire is tanuki's weakness: not copied
  });
});

describe('retaliate (tengu)', () => {
  const tengu = () => makeBattle(DECK, 'tengu');

  it('physical hits cost the player 3, absorbed by block', () => {
    const b = tengu();
    expect(confirmTurn(typeFor(b, 'strike')).battle.playerHp).toBe(HP - 3);
    expect(confirmTurn(typeFor({ ...b, playerBlock: 3 }, 'strike')).battle.playerHp).toBe(HP);
  });

  it('a hit that kills tengu triggers no retaliation', () => {
    const b = tengu();
    const r = confirmTurn(typeFor({ ...b, enemy: { ...b.enemy, hp: 5 } }, 'strike')).battle;
    expect(r.outcome).toBe('won');
    expect(r.playerHp).toBe(HP);
  });

  it('retaliation that drops the player to 0 loses the battle', () => {
    const r = confirmTurn(typeFor({ ...tengu(), playerHp: 2 }, 'strike')).battle;
    expect(r.playerHp).toBe(0);
    expect(r.outcome).toBe('lost');
    expect(r.pending).toBeNull();
  });
});

describe('harden (jorogumo)', () => {
  it('gains armor every time she defends', () => {
    const ctx = ctxFor(3, 2);
    const b = makeBattle(DECK, 'jorogumo', ctx); // pattern starts with defend
    const next = playTurn({ ...b, typed: '' }, ctx).battle;
    expect(next.enemy.armor).toBe(b.enemy.armor + 1);
  });
});

describe('enemy data', () => {
  it('every enemy still declares a weakness', () => {
    expect(ENEMIES.every((e) => !!e.weak)).toBe(true);
  });
});
