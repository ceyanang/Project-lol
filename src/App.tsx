import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { advanceBeat, confirmTurn, pickTile } from './game/battle';
import { CONFIG } from './config';
import { defaultRng } from './game/rng';
import { enterNode, finishBattle, newRun, noteAnswers, parseRun, pickEnemy, popReward, restHeal, runCtx, studyReward, takeCard, takeRelic, type RunState } from './game/run';
import { makeWeightOf, recordAnswers, type Answer } from './game/srs';
import { type Difficulty, type Profile, loadProfile, loadRunRaw, saveProfile, saveRunRaw } from './game/storage';
import { VOICE_HELP, initSpeech, speak as speakJa, voicesKnown } from './game/speech';
import { playSfx, setSfxEnabled } from './game/sfx';
import Battle from './screens/Battle';
import Library from './screens/Library';
import Quiz from './screens/Quiz';
import { applyQuizUnlock } from './game/quiz';
import MapScreen from './screens/MapScreen';
import Rest from './screens/Rest';
import Reward from './screens/Reward';
import RunOver from './screens/RunOver';
import Title from './screens/Title';

type View = 'title' | 'library' | 'quiz' | 'run';

export default function App() {
  const [profile, setProfileState] = useState<Profile>(() => loadProfile());
  // Handlers read/write the latest profile through this ref so delayed callbacks never clobber SRS updates.
  const profileRef = useRef(profile);
  const setProfile = useCallback((p: Profile) => {
    profileRef.current = p;
    setProfileState(p);
  }, []);
  const [run, setRun] = useState<RunState | null>(() => parseRun(loadRunRaw()));
  const [view, setView] = useState<View>('title');

  useEffect(() => saveProfile(profile), [profile]);
  useEffect(() => setSfxEnabled(profile.settings.sfx), [profile.settings.sfx]);

  // Universal button tick. Cards, answer tiles and map nodes have their own sounds.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as Element | null)?.closest?.('button');
      if (!btn || btn.disabled || btn.closest('.card, .tile, .map-node')) return;
      playSfx('tap');
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  useEffect(() => saveRunRaw(run), [run]);

  const weightOf = useMemo(() => makeWeightOf(profile.srs, Date.now()), [profile.srs]);
  const runDifficulty = run?.difficulty;
  const ctx = useMemo(() => runCtx(profile, defaultRng, weightOf, runDifficulty), [profile, weightOf, runDifficulty]);

  const [toast, setToast] = useState<string | null>(null);
  const voiceHintShown = useRef(false);
  useEffect(() => initSpeech(), []);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 9000);
    return () => window.clearTimeout(t);
  }, [toast]);

  /** Explicit taps always speak. */
  const speak = useCallback((text: string) => {
    const res = speakJa(text);
    if (res !== 'ok' && !voiceHintShown.current && (res === 'unsupported' || voicesKnown())) {
      voiceHintShown.current = true;
      setToast(res === 'unsupported' ? 'This browser has no speech support, so kana can’t be read aloud.' : VOICE_HELP);
    }
  }, []);
  /** Automatic speech during battle respects the auto-speak setting. */
  const speakAuto = useCallback(
    (text: string) => {
      if (profileRef.current.settings.autoSpeak) speak(text);
    },
    [speak],
  );

  const recordSrs = useCallback((answers: Answer[]) => {
    if (!answers.length) return;
    const p = profileRef.current;
    setProfile({ ...p, srs: recordAnswers(p.srs, answers, Date.now()) });
  }, [setProfile]);

  function startNewRun(difficulty: Difficulty) {
    const p = { ...profileRef.current, difficulty };
    setProfile(p);
    setRun(newRun(p, runCtx(p, defaultRng, weightOf, difficulty), Date.now()));
    setView('run');
  }

  function onPick(tileId: string) {
    if (!run?.battle) return;
    setRun({ ...run, battle: pickTile(run.battle, tileId) });
  }

  /** End Turn: the picked kana is revealed and its move resolves, then the enemy acts. */
  function onConfirm() {
    if (!run?.battle) return;
    const picked = run.battle.tiles.find((t) => t.id === run.battle!.picked);
    const r = confirmTurn(run.battle);
    if (picked) {
      playSfx(r.battle.lastResult?.ok ? 'correct' : 'wrong');
      // speak only after confirming, so audio never gives the reading away early
      speakAuto(picked.text);
    }
    recordSrs(r.answers);
    setRun(noteAnswers({ ...run, battle: r.battle }, r.answers));
  }

  // When a battle has an outcome, let the last hit animate, then move on.
  // Also recovers a save made in that short window (app closed right after a kill).
  const runRef = useRef(run);
  runRef.current = run;
  const battleOver = run?.phase === 'battle' && run.battle !== null && run.battle.outcome !== 'ongoing';
  useEffect(() => {
    if (!battleOver) return;
    const t = window.setTimeout(() => {
      const r = runRef.current;
      if (!r || r.phase !== 'battle' || !r.battle || r.battle.outcome === 'ongoing') return;
      const p = profileRef.current;
      const res = finishBattle(r, p, runCtx(p, defaultRng, makeWeightOf(p.srs, Date.now()), r.difficulty));
      setProfile(res.profile);
      setRun(res.run);
    }, 900);
    return () => window.clearTimeout(t);
  }, [battleOver, setProfile]);

  // Turn beats: after your move, pause → enemy acts → pause → next moves are dealt.
  // Keyed on the beat itself, so a save made mid-pause resumes correctly.
  const beat = run?.phase === 'battle' && run.battle?.outcome === 'ongoing' ? run.battle.pending : null;
  const beatKey = beat ? `${beat}-${run?.battle?.turn}` : null;
  useEffect(() => {
    if (!beat) return;
    const t = window.setTimeout(
      () => {
        const r = runRef.current;
        if (!r?.battle || r.phase !== 'battle' || r.battle.pending !== beat) return;
        const p = profileRef.current;
        setRun({ ...r, battle: advanceBeat(r.battle, runCtx(p, defaultRng, makeWeightOf(p.srs, Date.now()), r.difficulty)) });
      },
      beat === 'enemy' ? CONFIG.combat.enemyDelayMs : CONFIG.combat.dealDelayMs,
    );
    return () => window.clearTimeout(t);
  }, [beatKey]);

  function claim(fn?: (r: RunState) => RunState) {
    if (!run) return;
    const res = popReward(fn ? fn(run) : run, profileRef.current, ctx);
    setProfile(res.profile);
    setRun(res.run);
  }

  let screen: React.ReactNode = null;
  if (view === 'library') {
    screen = (
      <Library
        profile={profile}
        onSpeak={speak}
        onBack={() => setView('title')}
        onToggleAutoSpeak={() => {
          const p = profileRef.current;
          setProfile({ ...p, settings: { ...p.settings, autoSpeak: !p.settings.autoSpeak } });
        }}
      />
    );
  } else if (view === 'quiz') {
    screen = (
      <Quiz
        profile={profile}
        onBack={() => setView('title')}
        onSpeak={speakAuto}
        onFinish={(plan, answers, passed) => {
          const p = profileRef.current;
          const withSrs = { ...p, srs: recordAnswers(p.srs, answers, Date.now()) };
          setProfile(passed ? applyQuizUnlock(withSrs, plan) : withSrs);
        }}
      />
    );
  } else if (view === 'title' || !run) {
    screen = (
      <Title
        profile={profile}
        canContinue={!!run && run.phase !== 'over'}
        continueLabel={run ? `Floor ${run.floor}` : undefined}
        onNewRun={startNewRun}
        onContinue={() => setView('run')}
        onLibrary={() => setView('library')}
        onQuiz={() => setView('quiz')}
        onToggleSfx={() => {
          const p = profileRef.current;
          setProfile({ ...p, settings: { ...p.settings, sfx: !p.settings.sfx } });
        }}
        onToggleAutoSpeak={() => {
          const p = profileRef.current;
          setProfile({ ...p, settings: { ...p.settings, autoSpeak: !p.settings.autoSpeak } });
        }}
      />
    );
  } else if (run.phase === 'map') {
    const bossNode = run.map.find((n) => n.type === 'boss');
    screen = (
      <MapScreen
        run={run}
        bossEmoji={bossNode ? pickEnemy('boss', run.floor, defaultRng).emoji : '👹'}
        onEnter={(id) => {
          playSfx('step');
          setRun(enterNode(run, id, profile.srs, ctx, Date.now()));
        }}
        onMenu={() => setView('title')}
      />
    );
  } else if (run.phase === 'battle' && run.battle) {
    screen = (
      <Battle
        key={run.battleNode ?? 'battle'}
        battle={run.battle}
        floor={run.floor}
        onPick={onPick}
        onConfirm={onConfirm}
        onMenu={() => setView('title')}
      />
    );
  } else if (run.phase === 'rest') {
    screen = (
      <Rest
        run={run}
        unlocked={ctx.unlocked}
        weightOf={weightOf}
        onSpeak={speakAuto}
        onRest={() => {
          playSfx('heal');
          setRun(restHeal(run));
        }}
        onStudyDone={(answers) => {
          recordSrs(answers);
          setRun(studyReward(noteAnswers(run, answers), answers.filter((a) => a.correct).length));
        }}
      />
    );
  } else if (run.phase === 'reward' && run.rewards.length) {
    screen = (
      <Reward
        key={`${run.position}-${run.rewards.length}`}
        step={run.rewards[0]}
        deck={run.deck}
        onSpeak={speak}
        onTakeCard={(card) => {
          playSfx('pickup');
          claim((r) => takeCard(r, card));
        }}
        onTakeRelic={(id) => {
          playSfx('pickup');
          claim((r) => takeRelic(r, id));
        }}
        onSkip={() => claim()}
      />
    );
  } else if (run.phase === 'over') {
    screen = (
      <RunOver
        run={run}
        onSpeak={speak}
        onDone={() => {
          setRun(null);
          setView('title');
        }}
      />
    );
  }

  return (
    <div className="app">
      {screen}
      {toast && (
        <button type="button" className="toast" onClick={() => setToast(null)}>
          🔇 {toast}
          <br />
          <span className="muted small">Tap to dismiss</span>
        </button>
      )}
    </div>
  );
}
