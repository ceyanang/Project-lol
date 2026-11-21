import { UNLOCK_GROUPS } from '../data';
import type { Profile } from '../game/storage';

interface Props {
  profile: Profile;
  canContinue: boolean;
  continueLabel?: string;
  onNewRun: () => void;
  onContinue: () => void;
  onLibrary: () => void;
}

export default function Title({ profile, canContinue, continueLabel, onNewRun, onContinue, onLibrary }: Props) {
  const next = UNLOCK_GROUPS[profile.unlockedCount];
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
        <button type="button" className={`btn btn-wide ${canContinue ? '' : 'btn-primary'}`} onClick={onNewRun}>
          ⚔️ New Run
        </button>
        <button type="button" className="btn btn-wide btn-blue" onClick={onLibrary}>
          📚 Kana Library
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
    </main>
  );
}
