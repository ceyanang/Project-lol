import { useState } from 'react';
import KanaCard from './components/KanaCard';
import { CONFIG } from './config';
import { KANA } from './data';
import type { Card } from './types';

// Step 2 preview: render a single Spirit Card from kana.json. Tap to cycle.
export default function App() {
  const [i, setI] = useState(0);
  const [reveal, setReveal] = useState(false);
  const kana = KANA[i % KANA.length];
  const card: Card = { uid: 'preview', ref: kana.id, type: i % 2 ? 'block' : 'attack' };
  return (
    <div className="app">
      <main className="screen title-screen">
        <KanaCard
          card={card}
          size="big"
          cost={CONFIG.cards.kanaCost}
          value={card.type === 'attack' ? CONFIG.cards.attackDamage : CONFIG.cards.blockAmount}
          revealRomaji={reveal}
          onTap={() => setReveal((r) => !r)}
        />
        <p className="muted">{kana.mnemonic}</p>
        <button type="button" className="btn" onClick={() => { setI(i + 1); setReveal(false); }}>Next kana ({KANA.length} total)</button>
      </main>
    </div>
  );
}
