import { useState } from 'react';
import KanaCard from '../components/KanaCard';
import { KANA_BY_ID, RELIC_BY_ID, UNLOCK_GROUPS, VOCAB_BY_ID } from '../data';
import { cardValue } from '../game/battle';
import { cardCost } from '../game/deck';
import type { RewardStep } from '../game/run';
import type { Card } from '../types';

interface Props {
  step: RewardStep;
  relics: string[];
  onSpeak: (text: string) => void;
  onTakeCard: (card: Card) => void;
  onTakeRelic: (relicId: string) => void;
  onSkip: () => void;
}

const noPrompts = { guard: null, weak: [], word: null };

export default function Reward({ step, relics, onSpeak, onTakeCard, onTakeRelic, onSkip }: Props) {
  const [chosen, setChosen] = useState<string | null>(null);

  if (step.kind === 'unlock') {
    const g = UNLOCK_GROUPS.find((x) => x.id === step.groupId)!;
    return (
      <main className="screen reward-screen">
        <div className="big-emoji">🔓</div>
        <h2 className="center">New kana unlocked!</h2>
        <p className="center muted">They join your deck now and every future run. Tap to hear.</p>
        <div className="kana-chips">
          {g.kana.map((k) => (
            <button key={k} type="button" className="kana-chip jp big" onClick={() => onSpeak(KANA_BY_ID[k].char)}>
              {KANA_BY_ID[k].char}
              <small>{KANA_BY_ID[k].romaji}</small>
            </button>
          ))}
          {g.words && <p className="center">📜 Word Scrolls: whole-word cards. Pick the right meaning to unleash them.</p>}
        </div>
        <button type="button" className="btn btn-gold btn-wide" onClick={onSkip}>
          Continue
        </button>
      </main>
    );
  }

  if (step.kind === 'cards') {
    const picked = step.options.find((c) => c.uid === chosen);
    return (
      <main className="screen reward-screen">
        <div className="big-emoji">🎴</div>
        <h2 className="center">Choose a card</h2>
        <p className="center muted small">Tap a card to hear it, then add it to your deck.</p>
        <div className="reward-cards">
          {step.options.map((c) => (
            <div key={c.uid} className="reward-option-wrap">
              <KanaCard
                card={c}
                size="big"
                cost={cardCost(c)}
                value={cardValue(c, { prompts: noPrompts, relics })}
                revealRomaji
                selected={chosen === c.uid}
                onTap={() => {
                  setChosen(c.uid);
                  onSpeak(c.type === 'word' ? VOCAB_BY_ID[c.ref].reading : KANA_BY_ID[c.ref].char);
                }}
              />
              {c.type === 'word' && <span className="small muted center">“{VOCAB_BY_ID[c.ref].meaning}”</span>}
            </div>
          ))}
        </div>
        <div className="menu">
          <button type="button" className="btn btn-gold btn-wide" disabled={!picked} onClick={() => picked && onTakeCard(picked)}>
            {picked ? `Take ${picked.type === 'word' ? VOCAB_BY_ID[picked.ref].reading : KANA_BY_ID[picked.ref].char}` : 'Pick a card'}
          </button>
          <button type="button" className="btn btn-ghost btn-wide" onClick={onSkip}>
            Skip
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="screen reward-screen">
      <div className="big-emoji">🏺</div>
      <h2 className="center">Choose a relic</h2>
      <div className="relic-options">
        {step.options.map((id) => {
          const r = RELIC_BY_ID[id];
          return (
            <button key={id} type="button" className={`reward-option relic-option ${chosen === id ? 'is-chosen' : ''}`} onClick={() => setChosen(id)}>
              <span className="relic-emoji">{r.emoji}</span>
              <span>
                <b>{r.name}</b>
                <br />
                <span className="small">{r.description}</span>
              </span>
            </button>
          );
        })}
        {step.options.length === 0 && <p className="muted center">You own every relic already!</p>}
      </div>
      <div className="menu">
        <button type="button" className="btn btn-gold btn-wide" disabled={!chosen} onClick={() => chosen && onTakeRelic(chosen)}>
          {chosen ? `Take ${RELIC_BY_ID[chosen].name}` : 'Pick a relic'}
        </button>
        <button type="button" className="btn btn-ghost btn-wide" onClick={onSkip}>
          Skip
        </button>
      </div>
    </main>
  );
}
