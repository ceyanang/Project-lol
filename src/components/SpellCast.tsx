import { useMemo, useState } from 'react';
import { CONFIG } from '../config';
import { KANA_BY_ID, SPELL_BY_ID } from '../data';
import { type SpellInHand, isRightKana } from '../game/battle';
import { kanaOptions } from '../game/distractors';
import { defaultRng } from '../game/rng';
import { playSfx } from '../game/sfx';

interface Props {
  spell: SpellInHand;
  unlocked: readonly string[];
  onCast: (pickedKana: string) => void;
  onCancel: () => void;
}

/** Cast a spell: the spell shows a romaji reading, you tap the matching kana. */
export default function SpellCast({ spell, unlocked, onCast, onCancel }: Props) {
  const [picked, setPicked] = useState<string | null>(null);
  const def = SPELL_BY_ID[spell.spellId];
  const target = KANA_BY_ID[spell.kana];
  const options = useMemo(() => kanaOptions(spell.kana, unlocked, defaultRng, CONFIG.spells.kanaOptions), [spell.kana, unlocked]);
  const ok = picked !== null && isRightKana(spell.kana, picked);

  function choose(id: string) {
    if (picked) return;
    const right = isRightKana(spell.kana, id);
    setPicked(id);
    playSfx(right ? 'correct' : 'wrong');
    if (right) window.setTimeout(() => onCast(id), 380);
  }

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label={`Cast ${def.name}`}>
      <div className="sheet spell-cast">
        <div className="rc-head">
          <span className="rc-title">
            {def.emoji} {def.name}
          </span>
          <span className="small muted">{def.description}</span>
        </div>

        <div className={`spell-romaji ${picked ? (ok ? 'is-ok' : 'is-bad') : ''}`}>
          <span className="spell-romaji-text">{target.romaji}</span>
          <span className="script-tag jp">{target.script === 'hiragana' ? 'ひらがな' : 'カタカナ'}</span>
        </div>
        <p className="center muted small">Tap the {target.script} for “{target.romaji}”</p>

        <div className="kana-options">
          {options.map((id) => {
            const state = !picked ? '' : isRightKana(spell.kana, id) ? 'is-correct' : id === picked ? 'is-wrong' : 'is-faded';
            return (
              <button key={id} type="button" className={`tile kana-tile jp ${state}`} onClick={() => choose(id)} disabled={!!picked} aria-label={`Kana ${KANA_BY_ID[id].char}`}>
                {KANA_BY_ID[id].char}
              </button>
            );
          })}
        </div>

        {picked && !ok && (
          <div className="rc-feedback">
            <p>
              “{target.romaji}” is <span className="jp big-inline">{target.char}</span> — you picked <span className="jp big-inline">{KANA_BY_ID[picked].char}</span> ({KANA_BY_ID[picked].romaji}). The spell fizzles.
            </p>
            <p className="muted">💡 {target.mnemonic}</p>
            <button type="button" className="btn btn-gold btn-wide" onClick={() => onCast(picked)}>
              Got it
            </button>
          </div>
        )}

        {!picked && (
          <button type="button" className="btn btn-ghost btn-wide" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
