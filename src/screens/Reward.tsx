import { useEffect, useState } from 'react';
import MoveCard from '../components/MoveCard';
import { KANA_BY_ID, MOVE_BY_ID, RELIC_BY_ID, UNLOCK_GROUPS } from '../data';
import type { RewardStep } from '../game/run';
import { playSfx } from '../game/sfx';
import type { Card } from '../types';

interface Props {
  step: RewardStep;
  deck: Card[];
  onSpeak: (text: string) => void;
  onTakeCard: (card: Card) => void;
  onTakeRelic: (relicId: string) => void;
  onSkip: () => void;
}

export default function Reward({ step, deck, onSpeak, onTakeCard, onTakeRelic, onSkip }: Props) {
  const [chosen, setChosen] = useState<string | null>(null);
  useEffect(() => {
    if (step.kind === 'unlock') playSfx('unlock');
  }, [step.kind]);

  if (step.kind === 'unlock') {
    const g = UNLOCK_GROUPS.find((x) => x.id === step.groupId)!;
    return (
      <main className="screen reward-screen">
        <div className="big-emoji">🔓</div>
        <h2 className="center">New kana unlocked!</h2>
        <p className="center muted">From now on these can label your moves, in this run and every future one. Tap to hear.</p>
        <div className="kana-chips">
          {g.kana.map((k) => (
            <button key={k} type="button" className="kana-chip jp big" onClick={() => onSpeak(KANA_BY_ID[k].char)}>
              {KANA_BY_ID[k].char}
              <small>{KANA_BY_ID[k].romaji}</small>
            </button>
          ))}
          {g.words && <p className="center">📜 Word moves: sometimes a move is labelled with a whole word. Find the word’s tile for ×1.5 power.</p>}
        </div>
        <button type="button" className="btn btn-gold btn-wide" onClick={onSkip}>
          Continue
        </button>
      </main>
    );
  }

  if (step.kind === 'moves') {
    const picked = step.options.find((c) => c.uid === chosen);
    return (
      <main className="screen reward-screen">
        <div className="big-emoji">🎴</div>
        <h2 className="center">Add a move to your deck</h2>
        <p className="center muted small">More copies of a move = it gets dealt more often.</p>
        <div className="reward-moves">
          {step.options.map((c) => {
            const owned = deck.filter((d) => d.moveId === c.moveId).length;
            return (
              <div key={c.uid} className="reward-move">
                <MoveCard move={MOVE_BY_ID[c.moveId]} selected={chosen === c.uid} onTap={() => setChosen(c.uid)} />
                <span className="small muted">
                  {MOVE_BY_ID[c.moveId].rarity === 'rare' ? '✨ rare · ' : ''}
                  {owned ? `you have ${owned}` : 'new'}
                </span>
              </div>
            );
          })}
        </div>
        <div className="menu">
          <button type="button" className="btn btn-gold btn-wide" disabled={!picked} onClick={() => picked && onTakeCard(picked)}>
            {picked ? `Take ${MOVE_BY_ID[picked.moveId].name}` : 'Pick a move'}
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
