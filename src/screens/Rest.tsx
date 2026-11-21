import { useMemo, useState } from 'react';
import ReadingCheck from '../components/ReadingCheck';
import { CONFIG } from '../config';
import { KANA_BY_ID } from '../data';
import type { PlayStep } from '../game/battle';
import { defaultRng, weightedSample } from '../game/rng';
import type { RunState } from '../game/run';

interface Props {
  run: RunState;
  unlocked: readonly string[];
  weightOf: (id: string) => number;
  onRest: () => void;
  onStudyDone: (answers: { id: string; correct: boolean }[]) => void;
  onSpeak: (text: string) => void;
}

export default function Rest({ run, unlocked, weightOf, onRest, onStudyDone, onSpeak }: Props) {
  const [studying, setStudying] = useState(false);
  const steps: PlayStep[] = useMemo(
    () => weightedSample(defaultRng, unlocked, CONFIG.run.studyKana, weightOf).map((ref) => ({ ref, kind: 'romaji' as const })),
    [unlocked, weightOf],
  );
  const heal = Math.min(run.maxHp - run.hp, Math.round(run.maxHp * CONFIG.run.restHealPct));
  const R = CONFIG.run;

  return (
    <main className="screen rest-screen">
      <div className="campfire">🔥</div>
      <h2 className="center">Campfire</h2>
      <p className="center muted">
        HP {run.hp}/{run.maxHp}
      </p>
      <div className="menu">
        <button type="button" className="btn btn-primary btn-wide" onClick={onRest}>
          😴 Rest — heal {heal} HP
        </button>
        <button type="button" className="btn btn-gold btn-wide" onClick={() => setStudying(true)}>
          📖 Study — read {R.studyKana} kana
          <br />
          <span className="small">each correct: +{R.studyMaxHpPerCorrect} max HP, heal {R.studyHealPerCorrect}</span>
        </button>
      </div>
      {studying && (
        <ReadingCheck
          steps={steps}
          unlocked={unlocked}
          title="Study session"
          onAnswer={(s) => onSpeak(KANA_BY_ID[s.ref].char)}
          onDone={(results) => onStudyDone(steps.map((s, i) => ({ id: s.ref, correct: results[i] })))}
        />
      )}
    </main>
  );
}
