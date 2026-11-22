import { describe, expect, it } from 'vitest';
import { ENEMIES, ENEMY_BY_ID, MOVE_BY_ID } from '../data';
import { advanceBeat, confirmTurn, playTurn, previewMove } from './battle';
import { HP, ctxFor, makeBattle, typeFor } from './testkit';

const DECK = ['strike', 'lightning_seal', 'water_jet', 'fire_talisman'];
const dmg = (b: ReturnType<typeof makeBattle>, moveId: string) =>
  previewMove(MOVE_BY_ID[moveId], b.slots.find((s) => s.card.moveId === moveId)!.label, b).damagePerHit;

describe('shell (kappa)', () => {
  it('halves non-thunder damage until a thunder hit cracks it', () => {
    const ctx = ctxFor(3, 2);
    let b = makeBattle(DECK, 'kappa', ctx);
    const shell = ENEMY_BY_ID.kappa.gimmicks!.find((g) => g.type === 'shell')!;
    const reduction = shell.type === 'shell' ? shell.reduction : 1;
    expect(reduction).toBeLessThan(1);
    expect(dmg(b, 'strike')).toBe(Math.round(MOVE_BY_ID.strike.value * reduction));
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

describe('boss phases', () => {
  const PH = ['water_jet', 'lightning_seal', 'wind_slash', 'strike'];
  const withHp = (b: ReturnType<typeof makeBattle>, hp: number, maxHp = b.enemy.maxHp) => ({ ...b, enemy: { ...b.enemy, hp, maxHp } });

  it('oni enrages below half HP: new pattern, +1 strength, intent restarts', () => {
    const b = withHp(makeBattle(PH, 'oni'), 42); // maxHp 81, half is 40.5
    const r = confirmTurn(typeFor(b, 'water_jet')).battle; // weak water: big hit
    expect(r.enemy.phaseDone).toBe(true);
    expect(r.enemy.strength).toBe(1);
    expect(r.enemy.pattern).not.toEqual(b.enemy.pattern);
    expect(r.enemy.intentIndex).toBe(0);
    expect(r.fx.some((f) => f.text === 'Enraged!')).toBe(true);
  });

  it('a phase fires only once', () => {
    const ctx = ctxFor(3, 2);
    let b = withHp(makeBattle(PH, 'oni', ctx), 42);
    b = { ...playTurn(typeFor(b, 'water_jet'), ctx).battle, playerHp: HP };
    expect(b.enemy.strength).toBeGreaterThanOrEqual(1);
    const str = b.enemy.strength;
    const before = b.enemy.pattern;
    b = playTurn(typeFor(b, 'lightning_seal'), ctx).battle;
    expect(b.enemy.pattern).toBe(before);
    expect(b.enemy.strength).toBeGreaterThanOrEqual(str);
    expect(b.enemy.phaseDone).toBe(true);
  });

  it('a killing blow from above the threshold ends the fight with no phase change', () => {
    const b = withHp(makeBattle(PH, 'oni'), 20, 30); // 67% of max, water_jet deals 21
    const r = confirmTurn(typeFor(b, 'water_jet')).battle;
    expect(r.outcome).toBe('won');
    expect(r.enemy.phaseDone).toBe(false);
    expect(r.enemy.strength).toBe(0);
  });

  it("ryujin's phase flips its weakness to thunder", () => {
    const b = withHp(makeBattle(PH, 'ryujin'), 40); // maxHp 65, wind_slash 3x(10-2)=24 -> 16
    const r = confirmTurn(typeFor(b, 'wind_slash')).battle;
    expect(r.enemy.phaseDone).toBe(true);
    expect(r.enemy.weak).toBe('thunder');
    expect(previewMove(MOVE_BY_ID.lightning_seal, r.slots[0].label, r).matchup).toBe('weak');
  });

  it('burn ticking across the threshold triggers the phase too', () => {
    const ctx = ctxFor(3, 2);
    let b = withHp(makeBattle(PH, 'oni', ctx), 41);
    b = { ...b, enemy: { ...b.enemy, status: { ...b.enemy.status, burn: 3 } } };
    b = advanceBeat(confirmTurn({ ...b, typed: '' }).battle, ctx);
    expect(b.enemy.hp).toBeLessThan(40.5);
    expect(b.enemy.phaseDone).toBe(true);
  });
});

describe('retaliate vs drain (review finding)', () => {
  it('the drain heal lands before tengu hits back, so a 2 HP player survives vampire ink', () => {
    const b = { ...makeBattle(['vampire_ink', 'strike', 'guard', 'guard'], 'tengu'), playerHp: 2 };
    const r = confirmTurn(typeFor(b, 'vampire_ink')).battle;
    expect(r.outcome).toBe('ongoing');
    expect(r.playerHp).toBe(2 + 9 - 3); // armor 1 → 9 dealt → heal 9, then the feathers sting for 3
  });

  it('a player who still dies to the retaliation is shown at 0 HP, never healed back up', () => {
    const b = { ...makeBattle(['vampire_ink', 'strike', 'guard', 'guard'], 'tengu'), playerHp: 1 };
    const r = confirmTurn(typeFor({ ...b, playerBlock: 0, enemy: { ...b.enemy, armor: 99 } }, 'vampire_ink')).battle; // armor 99 → 0 dealt → no heal
    expect(r.outcome).toBe('lost');
    expect(r.playerHp).toBe(0);
  });
});
