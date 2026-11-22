import { it } from 'vitest';
import { ENEMIES } from '../data';
import { simulate } from './sim';

// Balance sim: a perfect reader with a simple policy (see sim.ts). Run with SIM=1.
const run = process.env.SIM ? it : it.skip;
run('balance sim', () => {
  const extra = process.env.SIM_EXTRA ? process.env.SIM_EXTRA.split(',') : [];
  const rows: string[] = [];
  for (const e of ENEMIES) {
    for (const floor of [1, 2, 3]) {
      if (e.minFloor > floor) continue;
      const r = simulate(e, floor, 300, extra);
      rows.push(`${e.tier.padEnd(6)} ${e.name.padEnd(18)} f${floor}  turns ${r.turns.toFixed(1).padStart(4)}  hpLost ${r.hpLost.toFixed(1).padStart(5)}  deaths ${(r.deathRate * 100).toFixed(0).padStart(3)}%`);
    }
  }
  require('node:fs').writeFileSync(process.env.SIM_OUT ?? 'balance-report.txt', rows.join('\n') + '\n');
});
