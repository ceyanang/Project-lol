import { KANA_BY_ID, UNLOCK_GROUPS } from '../data';
import type { RunState } from '../game/run';

interface Props {
  run: RunState;
  onSpeak: (text: string) => void;
  onDone: () => void;
}

export default function RunOver({ run, onSpeak, onDone }: Props) {
  const won = run.result === 'victory';
  const total = run.stats.correct + run.stats.wrong;
  const acc = total ? Math.round((run.stats.correct / total) * 100) : 0;
  return (
    <main className="screen runover-screen">
      <div className="big-emoji">{won ? '🏆' : '🪦'}</div>
      <h2 className="center">{won ? 'Victory!' : 'Your run has ended'}</h2>
      <p className="center muted">{won ? 'Every floor cleared. The yokai bow to your reading.' : `Fell on floor ${run.floor}. Unlocked kana and SRS progress are kept.`}</p>

      <div className="stat-grid">
        <div>
          <b>{run.stats.fights}</b>
          <span>fights</span>
        </div>
        <div>
          <b>{acc}%</b>
          <span>accuracy</span>
        </div>
        <div>
          <b>{run.stats.words}</b>
          <span>words cast</span>
        </div>
      </div>

      {run.stats.unlocked.length > 0 && (
        <section>
          <h3>Unlocked this run</h3>
          {run.stats.unlocked.map((g) => (
            <p key={g} className="jp">
              ✨ {UNLOCK_GROUPS.find((x) => x.id === g)?.label}
            </p>
          ))}
        </section>
      )}

      {run.stats.missed.length > 0 && (
        <section>
          <h3>Practice these (tap to hear)</h3>
          <div className="kana-chips">
            {run.stats.missed.map((k) => (
              <button key={k} type="button" className="kana-chip jp" onClick={() => onSpeak(KANA_BY_ID[k].char)}>
                {KANA_BY_ID[k].char}
                <small>{KANA_BY_ID[k].romaji}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      <button type="button" className="btn btn-gold btn-wide" onClick={onDone}>
        Back to title
      </button>
    </main>
  );
}
