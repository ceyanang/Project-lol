import type { Card } from '../types';
import { KANA_BY_ID, VOCAB_BY_ID } from '../data';

interface Props {
  card: Card;
  /** Damage or block this card would do right now (already includes bonuses). */
  value: number;
  cost: number;
  selected?: boolean;
  /** 1-based position in the current chain, if selected. */
  order?: number;
  /** This card matches an enemy prompt. */
  match?: 'weak' | 'guard' | null;
  disabled?: boolean;
  revealRomaji?: boolean;
  /** Kana was recently misread (SRS missDebt > 0): shows a marker. */
  missed?: boolean;
  size?: 'hand' | 'big' | 'mini';
  onTap?: () => void;
}

const ICON = { attack: '⚔️', block: '🛡️', word: '📜' } as const;

export default function KanaCard({ card, value, cost, selected, order, match, disabled, revealRomaji, missed, size = 'hand', onTap }: Props) {
  const word = card.type === 'word' ? VOCAB_BY_ID[card.ref] : undefined;
  const kana = word ? undefined : KANA_BY_ID[card.ref];
  const glyph = word ? word.reading : kana?.char ?? '?';
  const classes = [
    'card',
    `card-${card.type}`,
    `card-${size}`,
    selected ? 'is-selected' : '',
    match ? `is-match-${match}` : '',
    disabled ? 'is-disabled' : '',
    card.echo ? 'is-echo' : '',
  ].join(' ');

  return (
    <button
      type="button"
      className={classes}
      onClick={onTap}
      aria-pressed={selected}
      aria-label={`${card.type} card ${glyph}`}
    >
      <span className="card-cost" aria-label={`cost ${cost}`}>{cost}</span>
      {order ? <span className="card-order">{order}</span> : null}
      <span className={`card-glyph jp ${glyph.length > 2 ? 'is-long' : ''}`}>{glyph}</span>
      {revealRomaji && <span className="card-romaji">{word ? word.romaji : kana?.romaji}</span>}
      <span className="card-value">
        {ICON[card.type]} {value}
      </span>
      {match && <span className="card-match">{match === 'weak' ? '🎯' : '✨'}</span>}
      {card.echo && <span className="card-echo">echo</span>}
      {missed && <span className="card-missed" title="Recently missed — shows up more often">!</span>}
    </button>
  );
}
