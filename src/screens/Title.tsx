import { useState } from 'react';
import { CONFIG } from '../config';
import { UNLOCK_GROUPS, nextLockedGroup, unlockedKanaIds } from '../data';
import type { Difficulty, Profile } from '../game/storage';

interface Props {
  profile: Profile;
  canContinue: boolean;
  continueLabel?: string;
  onNewRun: (difficulty: Difficulty) => void;
  onContinue: () => void;
  onLibrary: () => void;
  onQuiz: () => void;
  onToggleSfx: () => void;
  onToggleAutoSpeak: () => void;
}

const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];

export default function Title({ profile, canContinue, continueLabel, onNewRun, onContinue, onLibrary, onQuiz, onToggleSfx, onToggleAutoSpeak }: Props) {
  const next = nextLockedGroup(profile.unlocked);
  const [sheet, setSheet] = useState<null | 'abandon' | 'difficulty'>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>(profile.difficulty);
  const kanaCount = unlockedKanaIds(profile.unlocked).length;

  return (
    <main className="screen title-screen">
      <h1 className="logo">
        <span className="logo-kana jp">か</span>
        Kana-Slayer
      </h1>
      <p className="muted tagline">Read kana. Slay yokai. Remember forever.</p>

      <div className="menu">
        {canContinue && (
          <button type="button" className="btn btn-gold btn-wide" onClick={onContinue}>
            ▶ Continue{continueLabel ? ` · ${continueLabel}` : ''}
          </button>
        )}
        <button type="button" className={`btn btn-wide ${canContinue ? '' : 'btn-primary'}`} onClick={() => setSheet(canContinue ? 'abandon' : 'difficulty')}>
          ⚔️ New Run
        </button>
        <button type="button" className="btn btn-wide btn-blue" onClick={onLibrary}>
          📚 Kana Library
        </button>
        <button type="button" className="btn btn-wide" onClick={onQuiz}>
          🎓 Skip-ahead Quiz
          <br />
          <span className="small muted">Already know some kana? Test out to unlock them.</span>
        </button>
      </div>

      <div className="settings-row">
        <button type="button" className="pill pill-btn" onClick={onToggleSfx} aria-pressed={profile.settings.sfx}>
          {profile.settings.sfx ? '🔊 Sound on' : '🔇 Sound off'}
        </button>
        <button type="button" className="pill pill-btn" onClick={onToggleAutoSpeak} aria-pressed={profile.settings.autoSpeak}>
          {profile.settings.autoSpeak ? '🗣️ Read aloud on' : '🤐 Read aloud off'}
        </button>
      </div>

      <div className="title-stats muted small">
        <span>
          Unlocked {profile.unlocked.length}/{UNLOCK_GROUPS.length} groups · {kanaCount} kana
        </span>
        {next && <span className="jp">Next boss unlocks: {next.label}</span>}
        <span>
          Runs {profile.runs} · Wins {profile.wins} · Best floor {profile.bestFloor}
        </span>
      </div>

      {sheet === 'abandon' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet center" onClick={(e) => e.stopPropagation()}>
            <h3 className="sheet-title">Abandon your current run?</h3>
            <p className="muted">Unlocked kana and kana stats are kept. Floor progress, deck and relics are lost.</p>
            <button type="button" className="btn btn-primary btn-wide" onClick={() => setSheet('difficulty')}>
              Abandon and start fresh
            </button>
            <button type="button" className="btn btn-ghost btn-wide" onClick={() => setSheet(null)}>
              Keep my run
            </button>
          </div>
        </div>
      )}

      {sheet === 'difficulty' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3 className="sheet-title center">Choose a difficulty</h3>
            <p className="muted small center">How many kana tiles you pick from each turn.</p>
            <div className="diff-options" role="radiogroup" aria-label="Difficulty">
              {DIFFS.map((d) => {
                const meta = CONFIG.difficulty[d];
                return (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={difficulty === d}
                    className={`diff-option ${difficulty === d ? 'is-chosen' : ''}`}
                    onClick={() => setDifficulty(d)}
                  >
                    <span className="diff-emoji">{meta.emoji}</span>
                    <span>
                      <b>{meta.label}</b>
                      <br />
                      <span className="small muted">
                        {meta.blurb}
                        {d === 'hard' ? ` (${kanaCount} now)` : ''}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <button type="button" className="btn btn-primary btn-wide" onClick={() => onNewRun(difficulty)}>
              ⚔️ Start {CONFIG.difficulty[difficulty].label} run
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
