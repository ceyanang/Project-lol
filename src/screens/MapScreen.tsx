import { useState } from 'react';
import HpBar from '../components/HpBar';
import MoveCard from '../components/MoveCard';
import { CONFIG } from '../config';
import { MOVE_BY_ID, RELIC_BY_ID } from '../data';
import { deckCounts } from '../game/deck';
import { type MapNode, NODE_ICON, NODE_LABEL, reachableNodes } from '../game/map';
import type { RunState } from '../game/run';

interface Props {
  run: RunState;
  bossEmoji: string;
  onEnter: (nodeId: string) => void;
  onMenu: () => void;
}

const ROW_H = 86;

export default function MapScreen({ run, bossEmoji, onEnter, onMenu }: Props) {
  const [showDeck, setShowDeck] = useState(false);
  const [relicInfo, setRelicInfo] = useState<string | null>(null);
  const reachable = new Set(reachableNodes(run.map, run.position).map((n) => n.id));
  const rows = Math.max(...run.map.map((n) => n.row)) + 1;
  const height = rows * ROW_H;
  // boss at the top, start at the bottom
  const y = (n: MapNode) => height - (n.row + 0.5) * ROW_H;
  const byId = new Map(run.map.map((n) => [n.id, n]));

  return (
    <main className="screen map-screen">
      <header className="run-header">
        <div className="run-header-row">
          <span className="pill">
            Floor {run.floor}/{CONFIG.run.floors}
          </span>
          <span className="pill" title="Difficulty">
            {CONFIG.difficulty[run.difficulty].emoji} {CONFIG.difficulty[run.difficulty].label}
          </span>
          <button type="button" className="pill pill-btn" onClick={() => setShowDeck(true)}>
            🎴 Deck {run.deck.length}
          </button>
          <span className="grow" />
          <button type="button" className="icon-btn" onClick={onMenu} aria-label="Menu">
            ☰
          </button>
        </div>
        <HpBar hp={run.hp} max={run.maxHp} color="var(--green)" label="Your HP" />
        {run.relics.length > 0 && (
          <div className="relic-row">
            {run.relics.map((r) => (
              <button key={r} type="button" className="relic-chip" onClick={() => setRelicInfo(relicInfo === r ? null : r)}>
                {RELIC_BY_ID[r]?.emoji}
              </button>
            ))}
          </div>
        )}
        {relicInfo && (
          <p className="small relic-info">
            <b>{RELIC_BY_ID[relicInfo].name}:</b> {RELIC_BY_ID[relicInfo].description}
          </p>
        )}
      </header>

      <div className="map-scroll">
        <div className="map" style={{ height }}>
          <svg className="map-lines" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
            {run.map.flatMap((n) =>
              n.next.map((id) => {
                const m = byId.get(id)!;
                const active = run.position === n.id || (run.visited.includes(n.id) && run.visited.includes(m.id));
                return (
                  <line
                    key={`${n.id}-${id}`}
                    x1={n.x * 100}
                    y1={y(n)}
                    x2={m.x * 100}
                    y2={y(m)}
                    className={active ? 'is-active' : ''}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              }),
            )}
          </svg>
          {run.map.map((n) => {
            const canGo = reachable.has(n.id);
            const visited = run.visited.includes(n.id);
            return (
              <button
                key={n.id}
                type="button"
                className={`map-node node-${n.type} ${canGo ? 'is-reachable' : ''} ${visited ? 'is-visited' : ''} ${run.position === n.id ? 'is-current' : ''}`}
                style={{ left: `${n.x * 100}%`, top: y(n) }}
                disabled={!canGo}
                onClick={() => onEnter(n.id)}
                aria-label={`${NODE_LABEL[n.type]}${canGo ? ' (available)' : ''}`}
              >
                <span className="node-icon">{n.type === 'boss' ? bossEmoji : NODE_ICON[n.type]}</span>
                <span className="node-label">{NODE_LABEL[n.type]}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="muted small center">Tap a glowing node to travel. Boss waits at the top.</p>

      {showDeck && (
        <div className="sheet-backdrop" onClick={() => setShowDeck(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3 className="sheet-title">Your deck ({run.deck.length} moves)</h3>
            <p className="muted small">Each turn {CONFIG.combat.movesPerTurn} moves are dealt. More copies = dealt more often.</p>
            <div className="deck-list">
              {deckCounts(run.deck).map(({ moveId, count }) => (
                <MoveCard key={moveId} move={MOVE_BY_ID[moveId]} count={count} />
              ))}
            </div>
            <button type="button" className="btn btn-wide" onClick={() => setShowDeck(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
