import type { Sprite } from '../art/sprite';
import { STATUS_ICON } from '../art/icons';
import type { EnemyState } from '../game/battle';
import { statusOf } from '../game/status';
import PixelSprite from './PixelSprite';

const LABEL = {
  burn: 'Burning: takes damage at the end of its turn',
  soak: 'Soaked: thunder shocks it, fire makes steam',
  stun: 'Stunned: loses its next action',
  gust: 'Gusted: its next attack is weakened',
  shell: 'Shell: takes reduced damage until thunder cracks it',
} as const;

interface Chip {
  key: keyof typeof LABEL;
  icon: Sprite;
  n?: number;
}

/** One chip per active status on the enemy (plus an intact shell). Renders nothing when clean. */
export default function StatusChips({ enemy, scale = 2 }: { enemy: EnemyState; scale?: number }) {
  const s = statusOf(enemy);
  const chips: Chip[] = [];
  for (const key of ['burn', 'soak', 'stun', 'gust'] as const) if (s[key] > 0) chips.push({ key, icon: STATUS_ICON[key], n: s[key] });
  if (!enemy.shellBroken && (enemy.gimmicks ?? []).some((g) => g.type === 'shell')) chips.push({ key: 'shell', icon: STATUS_ICON.shell });
  if (!chips.length) return null;
  return (
    <>
      {chips.map((c) => (
        <span key={c.key} className={`chip chip-${c.key}`} data-status={c.key} title={LABEL[c.key]}>
          <PixelSprite sprite={c.icon} scale={scale} />
          {c.n !== undefined && <b>{c.n}</b>}
        </span>
      ))}
    </>
  );
}
