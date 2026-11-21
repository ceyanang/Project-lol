import { useState } from 'react';
import type { SrsBucket } from '../config';
import { KANA_BY_ID, UNLOCK_GROUPS, VOCAB, unlockedKanaIds } from '../data';
import { DAY_MS, getStat, isDue } from '../game/srs';
import type { Profile } from '../game/storage';
import type { Script } from '../types';

interface Props {
  profile: Profile;
  onSpeak: (text: string) => void;
  onBack: () => void;
  onToggleAutoSpeak: () => void;
}

type Tab = Script | 'words';

export const BUCKET_META: Record<SrsBucket, { icon: string; label: string }> = {
  new: { icon: '🌱', label: 'New' },
  learning: { icon: '📖', label: 'Learning' },
  known: { icon: '✅', label: 'Known' },
  mastered: { icon: '⭐', label: 'Mastered' },
};

function when(ts: number | null, now: number): string {
  if (ts === null) return '—';
  const d = Math.round((ts - now) / DAY_MS);
  if (ts <= now) return 'due now';
  return d <= 0 ? 'later today' : d === 1 ? 'tomorrow' : `in ${d} days`;
}

export default function Library({ profile, onSpeak, onBack, onToggleAutoSpeak }: Props) {
  const [tab, setTab] = useState<Tab>('hiragana');
  const [selected, setSelected] = useState<string | null>(null);
  const unlocked = new Set(unlockedKanaIds(profile.unlockedCount));
  const now = Date.now();
  const counts: Record<SrsBucket, number> = { new: 0, learning: 0, known: 0, mastered: 0 };
  for (const k of unlocked) counts[getStat(profile.srs, k).bucket]++;
  const groups = UNLOCK_GROUPS.map((g, i) => ({ g, i })).filter(({ g }) => g.kana.length && KANA_BY_ID[g.kana[0]].script === tab);
  const sel = selected ? KANA_BY_ID[selected] : null;
  const selStat = selected ? getStat(profile.srs, selected) : null;

  return (
    <main className="screen library">
      <header className="run-header-row">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Back">
          ←
        </button>
        <h2 className="grow lib-title">Kana Library</h2>
        <button type="button" className="pill pill-btn" onClick={onToggleAutoSpeak} aria-pressed={profile.settings.autoSpeak}>
          {profile.settings.autoSpeak ? '🔊 Auto' : '🔇 Auto'}
        </button>
      </header>

      <div className="bucket-summary">
        {(Object.keys(counts) as SrsBucket[]).map((b) => (
          <span key={b} className={`bucket-pill b-${b}`}>
            {BUCKET_META[b].icon} {counts[b]} <small>{BUCKET_META[b].label}</small>
          </span>
        ))}
      </div>

      <nav className="tabs" role="tablist">
        {(['hiragana', 'katakana', 'words'] as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`tab ${tab === t ? 'is-active' : ''}`} onClick={() => setTab(t)}>
            {t === 'hiragana' ? 'ひらがな' : t === 'katakana' ? 'カタカナ' : 'Words'}
          </button>
        ))}
      </nav>

      <div className="lib-scroll">
        {tab !== 'words' &&
          groups.map(({ g, i }) => (
            <section key={g.id} className="lib-row">
              <h4 className="lib-row-title">
                {i < profile.unlockedCount ? '' : '🔒 '}
                <span className="jp">{KANA_BY_ID[g.kana[0]].char}</span> row <small className="muted">· {i === 0 ? 'starter' : `boss unlock #${i}`}</small>
              </h4>
              <div className="lib-grid">
                {g.kana.map((k) => {
                  const st = getStat(profile.srs, k);
                  const locked = !unlocked.has(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      className={`lib-kana b-${st.bucket} ${locked ? 'is-locked' : ''} ${selected === k ? 'is-selected' : ''} ${st.missDebt > 0 ? 'is-missed' : ''}`}
                      onClick={() => {
                        setSelected(k);
                        onSpeak(KANA_BY_ID[k].char);
                      }}
                      aria-label={`${KANA_BY_ID[k].char} ${KANA_BY_ID[k].romaji}, ${locked ? 'locked' : BUCKET_META[st.bucket].label}`}
                    >
                      <span className="jp lib-char">{KANA_BY_ID[k].char}</span>
                      <span className="lib-romaji">{KANA_BY_ID[k].romaji}</span>
                      <span className="lib-badge">{locked ? '🔒' : BUCKET_META[st.bucket].icon}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

        {tab === 'words' && (
          <div className="word-list">
            {VOCAB.map((v) => {
              const ok = v.kana.every((k) => unlocked.has(k));
              return (
                <button key={v.id} type="button" className={`word-row ${ok ? '' : 'is-locked'}`} onClick={() => onSpeak(v.reading)}>
                  <span className="jp word-reading">{v.reading}</span>
                  <span className="word-romaji">{v.romaji}</span>
                  <span className="word-meaning">{ok ? v.meaning : '🔒 ' + v.meaning}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {sel && selStat && (
        <div className="lib-detail" role="region" aria-label="Kana details">
          <button type="button" className="lib-detail-char jp" onClick={() => onSpeak(sel.char)} aria-label={`Hear ${sel.char}`}>
            {sel.char}
          </button>
          <div className="lib-detail-body">
            <div>
              <b className="big-romaji">{sel.romaji}</b> · {BUCKET_META[selStat.bucket].icon} {BUCKET_META[selStat.bucket].label}
              {selStat.missDebt > 0 && <span className="c-attack"> · missed ×3</span>}
            </div>
            <div className="small muted">💡 {sel.mnemonic}</div>
            <div className="small">
              Seen {selStat.seen} · Correct {selStat.correct}
              {selStat.seen ? ` (${Math.round((selStat.correct / selStat.seen) * 100)}%)` : ''} · Streak {selStat.streak}
            </div>
            {selStat.bucket === 'mastered' && (
              <div className="small">Next review: {isDue(selStat, now) ? '📜 due now' : when(selStat.nextReview, now)}</div>
            )}
          </div>
          <button type="button" className="icon-btn" onClick={() => setSelected(null)} aria-label="Close details">
            ✕
          </button>
        </div>
      )}
    </main>
  );
}
