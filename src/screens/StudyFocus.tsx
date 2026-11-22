import { useState } from 'react';
import { FAMILIES, KANA_BY_ID, MIN_STUDY_READINGS, UNLOCK_GROUPS, canSwitchOff, distinctReadings, latestGroups, studyGroups, unlockedKanaIds } from '../data';
import { playSfx } from '../game/sfx';
import type { Profile } from '../game/storage';

interface Props {
  profile: Profile;
  onChange: (studyOff: string[]) => void;
  onBack: () => void;
}

const groupById = (id: string) => UNLOCK_GROUPS.find((g) => g.id === id)!;

export default function StudyFocus({ profile, onChange, onBack }: Props) {
  const [note, setNote] = useState<string | null>(null);
  const unlocked = profile.unlocked.filter((g) => g !== 'words');
  const off = new Set(profile.studyOff);
  const active = studyGroups(unlocked, profile.studyOff);
  const kana = unlockedKanaIds(active);
  const sounds = distinctReadings(kana);

  function toggle(id: string) {
    if (off.has(id)) {
      setNote(null);
      onChange(profile.studyOff.filter((g) => g !== id));
    } else if (canSwitchOff(unlocked, profile.studyOff, id)) {
      setNote(null);
      onChange([...profile.studyOff, id]);
    } else {
      playSfx('wrong');
      setNote(`Keep at least ${MIN_STUDY_READINGS} different sounds on, so every turn can deal its moves.`);
    }
  }

  function only(keep: (id: string) => boolean) {
    const keepIds = unlocked.filter(keep);
    if (distinctReadings(unlockedKanaIds(keepIds)) < MIN_STUDY_READINGS) {
      playSfx('wrong');
      setNote(`That needs at least ${MIN_STUDY_READINGS} different sounds unlocked.`);
      return;
    }
    setNote(null);
    onChange(unlocked.filter((g) => !keepIds.includes(g)));
  }

  const hasKatakana = unlocked.some((g) => g.startsWith('k-'));
  const latest = latestGroups(unlocked);

  return (
    <main className="screen study-screen">
      <header className="run-header-row">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Back">
          ←
        </button>
        <h2 className="grow lib-title">Study focus</h2>
      </header>
      <p className="muted small study-intro">Choose which unlocked rows to practice. Only rows that are on label your moves and fill Study drills and review fights.</p>

      <div className="study-presets" role="group" aria-label="Presets">
        <button type="button" className="pill pill-btn" onClick={() => (setNote(null), onChange([]))}>
          All
        </button>
        <button type="button" className="pill pill-btn" onClick={() => only((g) => g.startsWith('h-'))}>
          Hiragana only
        </button>
        <button type="button" className="pill pill-btn" disabled={!hasKatakana} onClick={() => only((g) => g.startsWith('k-'))}>
          Katakana only
        </button>
        <button type="button" className="pill pill-btn" onClick={() => only((g) => latest.includes(g))}>
          Latest rows
        </button>
      </div>

      <div className="study-list">
        {FAMILIES.map((fam) => {
          const open = fam.groups.filter((g) => unlocked.includes(g));
          return (
            <section key={fam.id} className="quiz-family">
              <div className="quiz-family-head">
                <div>
                  <b>{fam.label}</b>
                  <div className="small muted">
                    {open.filter((g) => !off.has(g)).length}/{open.length} rows on · {fam.groups.length - open.length} locked
                  </div>
                </div>
              </div>
              <div className="quiz-rows">
                {fam.groups.map((g) => {
                  const isOpen = unlocked.includes(g);
                  const on = isOpen && !off.has(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      role="switch"
                      aria-checked={on}
                      disabled={!isOpen}
                      className={`study-chip jp ${on ? 'is-on' : ''}`}
                      onClick={() => toggle(g)}
                      aria-label={`${KANA_BY_ID[groupById(g).kana[0]].char} row, ${isOpen ? (on ? 'on' : 'off') : 'locked'}`}
                    >
                      {isOpen ? KANA_BY_ID[groupById(g).kana[0]].char : '🔒'}
                      <small>{on ? 'on' : isOpen ? 'off' : ''}</small>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <footer className="study-foot" aria-live="polite">
        {note ? <span className="c-attack">{note}</span> : <span>{kana.length} kana · {sounds} different sounds in play</span>}
      </footer>
    </main>
  );
}
