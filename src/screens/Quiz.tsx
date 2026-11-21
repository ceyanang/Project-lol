import { useState } from 'react';
import TypingCheck from '../components/TypingCheck';
import { CONFIG } from '../config';
import { FAMILIES, KANA_BY_ID, UNLOCK_GROUPS } from '../data';
import { type QuizPlan, familyQuiz, quizPassed, rowQuiz } from '../game/quiz';
import { defaultRng } from '../game/rng';
import { playSfx } from '../game/sfx';
import type { Answer } from '../game/srs';
import type { Profile } from '../game/storage';

interface Props {
  profile: Profile;
  onBack: () => void;
  onSpeak: (text: string) => void;
  /** Record answers and, if passed, unlock the quiz's groups. */
  onFinish: (plan: QuizPlan, answers: Answer[], passed: boolean) => void;
}

interface Result {
  plan: QuizPlan;
  results: boolean[];
  passed: boolean;
}

const groupById = (id: string) => UNLOCK_GROUPS.find((g) => g.id === id)!;
const rowName = (id: string) => `${KANA_BY_ID[groupById(id).kana[0]].char} row`;

export default function Quiz({ profile, onBack, onSpeak, onFinish }: Props) {
  const [plan, setPlan] = useState<QuizPlan | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const unlocked = new Set(profile.unlocked);

  function finish(results: boolean[]) {
    const p = plan!;
    const passed = quizPassed(p, results);
    playSfx(passed ? 'unlock' : 'defeat');
    onFinish(
      p,
      p.kana.map((k, i) => ({ id: k, correct: results[i] })),
      passed,
    );
    setPlan(null);
    setResult({ plan: p, results, passed });
  }

  return (
    <main className="screen quiz-screen">
      <header className="run-header-row">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Back">
          ←
        </button>
        <h2 className="grow lib-title">Skip-ahead Quiz</h2>
      </header>
      <p className="muted small">
        Know some kana already? Type their readings to unlock them right away. A row: get all {groupById('h-ka').kana.length} right. A whole family:{' '}
        {CONFIG.quiz.familyQuestions} questions, at most {CONFIG.quiz.familyMaxMisses} miss.
      </p>

      <div className="quiz-list">
        {FAMILIES.map((fam) => {
          const done = fam.groups.filter((g) => unlocked.has(g)).length;
          const all = done === fam.groups.length;
          return (
            <section key={fam.id} className="quiz-family">
              <div className="quiz-family-head">
                <div>
                  <b>{fam.label}</b>
                  <div className="small muted">
                    {done}/{fam.groups.length} rows unlocked
                  </div>
                </div>
                <button type="button" className="btn btn-gold quiz-family-btn" disabled={all} onClick={() => setPlan(familyQuiz(fam.id, defaultRng))}>
                  {all ? '✓ All unlocked' : 'Test all'}
                </button>
              </div>
              <div className="quiz-rows">
                {fam.groups.map((g) => {
                  const has = unlocked.has(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      className={`quiz-row jp ${has ? 'is-unlocked' : ''}`}
                      disabled={has}
                      onClick={() => setPlan(rowQuiz(g, defaultRng))}
                      aria-label={`${has ? 'Unlocked' : 'Test'} ${rowName(g)}`}
                    >
                      {has ? '✓ ' : ''}
                      {KANA_BY_ID[groupById(g).kana[0]].char}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
        <p className="small muted center">📜 Word moves unlock after the last kana group, by beating bosses.</p>
      </div>

      {plan && (
        <TypingCheck
          key={plan.title + plan.kana.join('')}
          kana={plan.kana}
          title={`Quiz: ${plan.title}`}
          onAnswer={(k) => onSpeak(KANA_BY_ID[k].char)}
          onDone={finish}
          onCancel={() => setPlan(null)}
        />
      )}

      {result && (
        <div className="sheet-backdrop" onClick={() => setResult(null)}>
          <div className="sheet center" onClick={(e) => e.stopPropagation()}>
            <div className="big-emoji">{result.passed ? '🔓' : '📖'}</div>
            <h3 className="sheet-title">{result.passed ? 'Unlocked!' : 'Not quite yet'}</h3>
            <p>
              {result.results.filter(Boolean).length}/{result.results.length} correct.{' '}
              {result.passed
                ? `${result.plan.groups.length > 1 ? 'The whole family' : rowName(result.plan.groups[0])} is yours: these kana can now label your moves.`
                : `You can miss at most ${result.plan.maxMisses}.`}
            </p>
            {!result.passed && (
              <div className="kana-chips">
                {result.plan.kana
                  .filter((_, i) => !result.results[i])
                  .map((k) => (
                    <button key={k} type="button" className="kana-chip jp" onClick={() => onSpeak(KANA_BY_ID[k].char)}>
                      {KANA_BY_ID[k].char}
                      <small>{KANA_BY_ID[k].romaji}</small>
                    </button>
                  ))}
              </div>
            )}
            {!result.passed && (
              <button
                type="button"
                className="btn btn-gold btn-wide"
                onClick={() => {
                  const g = result.plan.groups;
                  setResult(null);
                  setPlan(g.length > 1 ? familyQuiz(FAMILIES.find((f) => f.groups[0] === g[0])!.id, defaultRng) : rowQuiz(g[0], defaultRng));
                }}
              >
                Try again
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-wide" onClick={() => setResult(null)}>
              {result.passed ? 'Nice!' : 'Back to quizzes'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
