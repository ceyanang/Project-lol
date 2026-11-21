import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { endTurn, resolvePlay, type PlayPlan } from './game/battle';
import { defaultRng } from './game/rng';
import { enterNode, finishBattle, newRun, noteAnswers, parseRun, pickEnemy, popReward, restHeal, runCtx, studyReward, takeCard, takeRelic, type RunState } from './game/run';
import { makeWeightOf, recordAnswers, type Answer } from './game/srs';
import { type Profile, loadProfile, loadRunRaw, saveProfile, saveRunRaw } from './game/storage';
import { VOICE_HELP, initSpeech, speak as speakJa, voicesKnown } from './game/speech';
import Battle from './screens/Battle';
import Library from './screens/Library';
import MapScreen from './screens/MapScreen';
import Rest from './screens/Rest';
import Reward from './screens/Reward';
import RunOver from './screens/RunOver';
import Title from './screens/Title';

type View = 'title' | 'library' | 'run';

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
  useEffect(() => saveRunRaw(run), [run]);

  const weightOf = useMemo(() => makeWeightOf(profile.srs, Date.now()), [profile.srs]);
  const ctx = useMemo(() => runCtx(profile, defaultRng, weightOf), [profile, weightOf]);
  const missed = useMemo(() => new Set(Object.keys(profile.srs).filter((k) => profile.srs[k].missDebt > 0)), [profile.srs]);

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

  function startNewRun() {
    setRun(newRun(profile, ctx, Date.now()));
    setView('run');
  }

  function onPlay(plan: PlayPlan, results: boolean[]) {
    if (!run?.battle) return;
    const r = resolvePlay(run.battle, plan, results);
    recordSrs(r.answers);
    setRun(noteAnswers({ ...run, battle: r.battle }, r.answers));
  }

  function onEndTurn() {
    if (!run?.battle) return;
    setRun({ ...run, battle: endTurn(run.battle, ctx) });
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
      const res = finishBattle(r, p, runCtx(p, defaultRng, makeWeightOf(p.srs, Date.now())));
      setProfile(res.profile);
      setRun(res.run);
    }, 900);
    return () => window.clearTimeout(t);
  }, [battleOver, setProfile]);

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
  } else if (view === 'title' || !run) {
    screen = (
      <Title
        profile={profile}
        canContinue={!!run && run.phase !== 'over'}
        continueLabel={run ? `Floor ${run.floor}` : undefined}
        onNewRun={startNewRun}
        onContinue={() => setView('run')}
        onLibrary={() => setView('library')}
      />
    );
  } else if (run.phase === 'map') {
    const bossNode = run.map.find((n) => n.type === 'boss');
    screen = (
      <MapScreen
        run={run}
        bossEmoji={bossNode ? pickEnemy('boss', run.floor, defaultRng).emoji : '👹'}
        onEnter={(id) => setRun(enterNode(run, id, profile.srs, ctx, Date.now()))}
        onMenu={() => setView('title')}
      />
    );
  } else if (run.phase === 'battle' && run.battle) {
    screen = (
      <Battle
        key={run.battleNode ?? 'battle'}
        battle={run.battle}
        words={ctx.words}
        unlocked={ctx.unlocked}
        floor={run.floor}
        missed={missed}
        onPlay={onPlay}
        onEndTurn={onEndTurn}
        onSpeak={speakAuto}
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
        onRest={() => setRun(restHeal(run))}
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
        relics={run.relics}
        onSpeak={speak}
        onTakeCard={(card) => claim((r) => takeCard(r, card))}
        onTakeRelic={(id) => claim((r) => takeRelic(r, id))}
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
