interface Props {
  hp: number;
  max: number;
  block?: number;
  color?: string;
  label?: string;
}

export default function HpBar({ hp, max, block = 0, color = 'var(--red)', label }: Props) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  return (
    <div className="hpbar" aria-label={`${label ?? 'HP'} ${hp} of ${max}${block ? `, block ${block}` : ''}`}>
      <div className="hpbar-fill" style={{ width: `${pct}%`, background: color }} />
      <span className="hpbar-text">
        {hp}/{max}
      </span>
      {block > 0 && <span className="hpbar-block">🛡 {block}</span>}
    </div>
  );
}
