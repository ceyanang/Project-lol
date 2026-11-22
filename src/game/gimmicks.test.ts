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

describe('freeze (yuki-onna)', () => {
  const afterDefend = (deck = ['strike', 'strike', 'guard', 'guard']) => {
    const ctx = ctxFor(3, 6);
    const b = makeBattle(deck, 'yukionna', ctx); // pattern starts with defend
    return { b: playTurn({ ...b, typed: '' }, ctx).battle, ctx };
  };

  it('freezes exactly one slot on the deal after her defend', () => {
    const { b } = afterDefend();
    expect(b.frozen).toHaveLength(1);
    expect(b.slots.map((s) => s.uid)).toContain(b.frozen[0]);
  });

  it('typing a frozen reading costs nothing: no damage, no HP, no SRS answers', () => {
    const { b } = afterDefend();
    const frozen = b.slots.find((s) => s.uid === b.frozen[0])!;
    const r = confirmTurn({ ...b, typed: frozen.label.romaji });
    expect(r.answers).toHaveLength(0);
    expect(r.battle.playerHp).toBe(b.playerHp);
    expect(r.battle.enemy.hp).toBe(b.enemy.hp);
    expect(r.battle.lastResult?.text).toContain('frozen');
    expect(r.battle.combo).toBe(0);
  });

  it('other slots still work while one is frozen', () => {
    const { b } = afterDefend();
    const free = b.slots.find((s) => s.uid !== b.frozen[0])!;
    const r = confirmTurn({ ...b, typed: free.label.romaji });
    expect(r.answers.length).toBeGreaterThan(0);
    expect(r.battle.lastResult?.ok).toBe(true);
  });

  it('the freeze lasts one turn', () => {
    const { b, ctx } = afterDefend();
    expect(playTurn({ ...b, typed: '' }, ctx).battle.frozen).toEqual([]);
  });

  it('nothing is frozen when fewer than two moves are dealt', () => {
    expect(afterDefend(['strike']).b.frozen).toEqual([]);
  });
});
