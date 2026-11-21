# Kana-Slayer — Design Spec

A mobile-first, offline-capable, turn-based deckbuilder roguelike that teaches
hiragana and katakana. Your deck is **moves** (attacks, blocks, spells). Each turn
the moves you're dealt are labelled with **romaji**, and you cast one by tapping
the matching **kana**. Kana you miss come back more often (spaced repetition).

> **Every number in this file lives in `src/config.ts`.** Change it there and
> update the table here. Game content (kana, words, moves, enemies, relics) lives in `data/*.json`.

---

## 1. Core combat loop

1. **Deal.** At the start of your turn, **4 moves** are dealt from your deck
   (`movesPerTurn`). A move is not tied to any kana: each one gets a fresh label every
   turn, the **romaji of a different kana** (e.g. `ka`, `mi`, `su`, `te`).
2. **Tiles.** Below the moves sits a grid of **kana tiles**: the 4 right answers plus
   **2 decoys** (`decoyTiles`): look-alikes (シ/ツ, ね/れ/わ…) or same-row / same-vowel
   kana, drawn from kana you've unlocked. A decoy never shares a reading with any move,
   so exactly one tile fits each label.
3. **Pick.** Tap the kana for the move you want. Tapping does **nothing visible**
   except highlight the tile: the game never shows which move a tile belongs to
   before you confirm (no audio either), so you can't probe for the answer.
4. **Confirm.** Press **End Turn**. The pick is revealed (`き = ki → 🛡 Guard`):
   - the tile belongs to a move → that move happens (even if it's not the one you meant!);
   - the tile is a decoy → **fizzle**, you take **3 damage** (`decoyHpCost`), and the kana
     it imitates is marked missed in your SRS;
   - no tile picked → you skip your move.
5. **Enemy acts** (its intent was shown all turn), then a new turn is dealt.

**One move per turn.** Attacks, blocks and spells all work the same way. There is no energy.

### Moves (`data/moves.json`)
Copies of a move in your deck make it more likely to be dealt.

| Move | Rarity | Effect |
|---|---|---|
| ⚔️ Strike | starter ×3 | 9 physical |
| 🛡️ Guard | starter ×3 | +9 block |
| 🔥 Fire Talisman | starter | 11 fire |
| 💧 Water Jet | starter | 11 water |
| 🌪️ Wind Slash | starter | 5 wind ×3 |
| ⚡ Lightning Seal | common | 11 thunder, ignores armor |
| 🌟 Shuriken | common | 3 physical ×4 |
| 🪨 Stone Ward | common | +15 block |
| 🍵 Spring Water | common | heal 10 |
| 🪢 Binding Charm | common | enemy −3 strength |
| 🪞 Yata Mirror | common | block equal to the incoming attack |
| ☄️ Blaze · 🌊 Tidal Wave · 🥁 Thunder Drum | rare | 18 fire / water / thunder |
| 🪭 Iron Fan | rare | 7 wind ×3 |
| 🖋️ Vampire Ink | rare | 10 physical, heal what you deal |

### Enemy weaknesses (fixed for the whole fight)
Every enemy has one **weakness** and usually one **resistance**, shown under its HP bar
the whole fight. They never rotate.
- Hitting the weakness: **×2** damage (Katana relic: ×2.5).
- Hitting the resistance: **×½**.
- Move cards show the real numbers against the current enemy, with a WEAK / resist badge.
  That's static information, not a hint about which kana to tap.

### Word moves
After the Word moves unlock (the last unlock), each move has a 25% chance to be labelled
with a **whole word's romaji** (`neko`) instead of a single kana; its tile shows the word
(ねこ). Word moves get **×1.5 power** (Suzuri: ×2).

### Other numbers
| Thing | Value |
|---|---|
| Player start HP | 50 |
| Enemy armor | subtracted from every hit unless it pierces |
| Player block | lasts until the enemy's attack this turn, then resets |
| Enemy HP scaling | `hp × (1 + 0.25 × (floor − 1))` |
| Enemy damage scaling | `value × (1 + 0.15 × (floor − 1))` |

### Balance
`npm run sim` (or `SIM=1 npx vitest run src/game/balance.test.ts`) plays 300 fights per enemy and
floor with a perfect reader and a greedy policy, and prints turns, HP lost and death rate.
Targets with the starter deck: normal fights lose < 15 HP, elites < 30 HP on their own floor,
the floor-1 boss ~20 HP. Add `SIM_EXTRA=blaze,stone_ward,…` to simulate a deck with rewards.

---

## 2. SRS (the learning engine)

Per kana (profile key `kanaslayer.profile.v1`): `seen`, `correct`, `lastSeen`, `streak`,
`missDebt`, `bucket` (new → learning → known → mastered), `reviewStage`, `nextReview`.

- **Correct**: you confirm a tile that belongs to a move → its kana are marked correct.
- **Miss**: you confirm a decoy → the kana that decoy imitates is marked missed.
- Study drills at rest sites (kana → romaji, 4 options) also count.

Buckets: `learning` once seen; `known` at a streak of 3; `mastered` at a streak of 6.
A miss resets the streak and drops known/mastered back to learning.

### Label weight (which kana label your moves)
```
weight = bucketWeight[bucket] × (missDebt > 0 ? 3 : 1) × (isDue ? 2 : 1)
```
| Bucket | Weight |
|---|---|
| new | 1.5 |
| learning | 2.0 |
| known | 1.0 |
| mastered | 0.35 (never 0, so mastered kana never disappear) |
| **missed multiplier** | **×3** (decays: −1 missDebt per correct answer) |
| due-for-review multiplier | ×2 |

### Review schedule
Mastered → review due after **1 → 3 → 7 → 14 days** (each correct answer once due advances it).
Due kana spawn a 📜 **Review** node (Memory Wraith); in that fight due kana are ×3 more likely
to label your moves.

---

## 3. Run structure

- A run = **3 floors**; beat the floor-3 boss → victory.
- Each floor: 4 rows of choices + a boss (fights 55%, elites 15%, rest 15%, review 15% if due).
  Row 1 is all fights; the row before the boss always has a rest.
- Starting deck: Strike ×3, Guard ×3, Fire Talisman, Water Jet, Wind Slash.
- Rewards:
  - Fight → add 1 of 3 moves (75% common / 25% rare) or skip.
  - Elite → add 1 of 3 moves (45% common / 55% rare) + pick 1 of 2 relics.
  - Boss → **unlock the next kana group** (they start labelling moves immediately) + pick 1 of 3 relics + heal 50% of missing HP.
  - Rest → heal 30% **or** Study drill (5 kana; each correct = +1 max HP, heal 3).
- **Permadeath**: dying ends the run. Unlocked kana and SRS stats are kept forever.

## 4. Unlock order (one group per boss kill, persistent)
| # | Group |
|---|---|
| 1 | あ row (start) |
| 2–10 | か, さ, た, な, は, ま, や, ら, わ rows |
| 11–15 | が, ざ, だ, ば, ぱ |
| 16–25 | katakana rows ア … ワ |
| 26–30 | katakana dakuten ガ … パ |
| 31 | 📜 Word moves |

## 5. Relics (`data/relics.json`)
| Relic | Effect |
|---|---|
| 🗡️ Dakuten Blade | moves labelled with a voiced kana (ga, za, pa…) +5 dmg and pierce |
| 🎎 Daruma Doll | +12 max HP |
| 🧧 Omamori | first decoy pick per fight costs no HP |
| 🖋️ Suzuri Inkstone | word moves ×2 instead of ×1.5 |
| 🏮 Paper Lantern | 5 moves per turn instead of 4 |
| 🍵 Matcha Bowl | heal 5 after every fight |
| 🔔 Shrine Bell | start fights with 8 block |
| ⛩️ Tiny Torii | first move each fight has double power |
| 🖌️ Calligraphy Brush | block moves +5 |
| ⚔️ Katana | weakness hits ×2.5 |
| ⭕ Maru Ring | heal moves +5 |
| 🦊 Kitsune Mask | attacks +2 per hit |

## 6. Screens
Title (Continue / New Run / Kana Library, sound + read-aloud toggles) → Map → Battle →
Reward → … → Run Over. Kana Library: every kana by row with mastery, tap to hear.

## 7. Pronunciation & sound
`speechSynthesis` with a Japanese voice when present (hint shown if missing). In battle the
picked kana is spoken **after** End Turn, never on tap. Sound effects are synthesized with
Web Audio (no files).

## 8. Persistence keys
| Key | Content |
|---|---|
| `kanaslayer.profile.v1` | unlocks, SRS stats, settings, lifetime stats |
| `kanaslayer.run.v2` | current run incl. in-progress battle (v1 runs from the old card combat are dropped) |
