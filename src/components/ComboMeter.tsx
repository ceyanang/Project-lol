import { CONFIG } from '../config';
import { comboBonus } from '../game/battle';

/** Streak of correct readings: grows louder at each configured tier. Renders nothing at 0. */
export default function ComboMeter({ combo }: { combo: number }) {
  if (combo <= 0) return null;
  const tier = CONFIG.combo.tiers.filter((t) => combo >= t.at).length;
  const bonus = Math.round(comboBonus(combo) * 100);
  return (
    <div className={`combo tier-${tier}`} aria-label={`Combo ${combo}${bonus ? `, +${bonus}% power` : ''}`}>
      <span className="combo-n">COMBO ×{combo}</span>
      {bonus > 0 && <span className="combo-bonus">+{bonus}%</span>}
    </div>
  );
}
