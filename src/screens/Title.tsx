import { useState } from 'react';
import { UNLOCK_GROUPS } from '../data';
import type { Profile } from '../game/storage';

interface Props {
  profile: Profile;
  canContinue: boolean;
  continueLabel?: string;
  onNewRun: () => void;
  onContinue: () => void;
  onLibrary: () => void;
  onToggleSfx: () => void;
  onToggleAutoSpeak: () => void;
}

export default function Title({ profile, canContinue, continueLabel, onNewRun, onContinue, onLibrary, onToggleSfx, onToggleAutoSpeak }: Props) {
  const next = UNLOCK_GROUPS[profile.unlockedCount];
  const [confirming, setConfirming] = useState(false);
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
        <button type="button" className={`btn btn-wide ${canContinue ? '' : 'btn-primary'}`} onClick={() => (canContinue ? setConfirming(true) : onNewRun())}>
          ⚔️ New Run
        </button>
        <button type="button" className="btn btn-wide btn-blue" onClick={onLibrary}>
          📚 Kana Library
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
          Unlocked {profile.unlockedCount}/{UNLOCK_GROUPS.length} groups
        </span>
        {next && <span className="jp">Next boss unlocks: {next.label}</span>}
        <span>
          Runs {profile.runs} · Wins {profile.wins} · Best floor {profile.bestFloor}
        </span>
      </div>
      {confirming && (
        <div className="sheet-backdrop" onClick={() => setConfirming(false)}>
          <div className="sheet center" onClick={(e) => e.stopPropagation()}>
            <h3 className="sheet-title">Abandon your current run?</h3>
            <p className="muted">Unlocked kana and kana stats are kept. Floor progress, deck and relics are lost.</p>
            <button type="button" className="btn btn-primary btn-wide" onClick={onNewRun}>
              Abandon and start fresh
            </button>
            <button type="button" className="btn btn-ghost btn-wide" onClick={() => setConfirming(false)}>
              Keep my run
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
