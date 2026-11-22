import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MOVE_BY_ID } from '../data';
import { makeBattle } from '../game/testkit';
import type { Fx } from '../game/battle';
import CastFx from './CastFx';
import ComboMeter from './ComboMeter';
import EnemySprite from './EnemySprite';
import MoveCard from './MoveCard';
import StatusChips from './StatusChips';
import TurnTimer from './TurnTimer';

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const clean = () => makeBattle(['strike', 'strike', 'strike', 'strike']).enemy;
const withStatus = (e: ReturnType<typeof clean>, s: Partial<ReturnType<typeof clean>['status']>) => ({ ...e, status: { ...e.status, ...s } });

describe('StatusChips', () => {
  it('renders nothing for a clean enemy', () => {
    expect(html(createElement(StatusChips, { enemy: clean() }))).toBe('');
  });

  it('renders one chip per active status with its count', () => {
    const out = html(createElement(StatusChips, { enemy: withStatus(clean(), { burn: 2, stun: 1 }) }));
    expect(out).toContain('data-status="burn"');
    expect(out).toContain('data-status="stun"');
    expect(out).not.toContain('data-status="soak"');
    expect(out).toMatch(/data-status="burn"[^>]*>.*?<b>2<\/b>/);
  });

  it('shows a shell chip until the shell is broken', () => {
    const kappa = makeBattle(['strike', 'strike', 'strike', 'strike'], 'kappa').enemy;
    expect(html(createElement(StatusChips, { enemy: kappa }))).toContain('data-status="shell"');
    expect(html(createElement(StatusChips, { enemy: { ...kappa, shellBroken: true } }))).not.toContain('data-status="shell"');
  });
});

describe('ComboMeter', () => {
  it('renders nothing at 0 and the tier class from the configured tiers', () => {
    expect(html(createElement(ComboMeter, { combo: 0 }))).toBe('');
    expect(html(createElement(ComboMeter, { combo: 1 }))).toContain('tier-0');
    expect(html(createElement(ComboMeter, { combo: 3 }))).toContain('tier-1');
    expect(html(createElement(ComboMeter, { combo: 6 }))).toContain('tier-2');
    expect(html(createElement(ComboMeter, { combo: 10 }))).toContain('tier-3');
    expect(html(createElement(ComboMeter, { combo: 6 }))).toContain('×6');
  });
});

describe('MoveCard art', () => {
  it('draws an element sprite instead of the emoji, and marks a frozen move', () => {
    const out = html(createElement(MoveCard, { move: MOVE_BY_ID.fire_talisman, label: 'き', frozen: true }));
    expect(out).toContain('<canvas');
    expect(out).not.toContain(MOVE_BY_ID.fire_talisman.emoji);
    expect(out).toContain('is-frozen');
  });

  it('is not frozen by default', () => {
    expect(html(createElement(MoveCard, { move: MOVE_BY_ID.guard, label: 'あ' }))).not.toContain('is-frozen');
  });
});

describe('EnemySprite', () => {
  it('draws two idle frames, plus a flash frame while hit', () => {
    const idle = html(createElement(EnemySprite, { enemyId: 'kappa', scale: 3, hit: false }));
    expect(idle.match(/<canvas/g)).toHaveLength(2);
    const hit = html(createElement(EnemySprite, { enemyId: 'kappa', scale: 3, hit: true }));
    expect(hit.match(/<canvas/g)).toHaveLength(3);
    expect(hit).toContain('frame-flash');
  });
});

describe('CastFx', () => {
  const hit = (element: Fx['element'], id = 1): Fx => ({ id, kind: 'enemyHit', text: '-9', element, amount: 9 });

  it('renders nothing with no fx', () => {
    expect(html(createElement(CastFx, { fx: [] }))).toBe('');
  });

  it('draws a different cast effect for each element', () => {
    for (const el of ['physical', 'fire', 'water', 'wind', 'thunder'] as const) {
      const out = html(createElement(CastFx, { fx: [hit(el)] }));
      expect(out).toContain(`cast-${el}`);
      expect(out).toContain('<canvas');
    }
  });

  it('only thunder flashes the whole screen', () => {
    expect(html(createElement(CastFx, { fx: [hit('thunder')] }))).toContain('screen-flash');
    expect(html(createElement(CastFx, { fx: [hit('fire')] }))).not.toContain('screen-flash');
  });

  it('pops a status icon when a status lands', () => {
    const out = html(createElement(CastFx, { fx: [{ id: 2, kind: 'status', text: 'Burn!', element: 'fire' }] }));
    expect(out).toContain('status-pop');
  });

  it('ignores hits with no element (e.g. a blocked or armor-only hit text)', () => {
    expect(html(createElement(CastFx, { fx: [{ id: 3, kind: 'enemyHit', text: 'Armor!' }] }))).toBe('');
  });
});

describe('TurnTimer', () => {
  it('renders a progressbar at full with the seconds as text', () => {
    const out = html(createElement(TurnTimer, { turnKey: 1, running: true, durationMs: 6000, onExpire: () => {} }));
    expect(out).toContain('role="progressbar"');
    expect(out).toContain('aria-valuenow="6000"');
    expect(out).toContain('6s');
    expect(out).toContain('width:100%');
  });
});
