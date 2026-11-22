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
   turn, a **kana** (or, later, a whole word), all with different readings.
2. **Type.** Type the **romaji** of the move you want. Two keyboard options (title screen toggle):
   - **⌨️ Game keyboard** (default): in-game QWERTY docked at the bottom (a physical keyboard
     works too: letters, Backspace, Enter). The phone's own keyboard never opens.
   - **📱 Phone keyboard**: a real text field with autocorrect, autocapitalize, spellcheck and
     autofill off; its Go key ends the turn. Phone mode uses a **fixed top-half layout**: compact
     enemy bar, moves, typed field (with ❤️ HP) all in the top ~45% of the screen, and the bottom
     is left empty for the keyboard. Nothing resizes or moves when the keyboard opens or closes
     (no viewport tricks), and focus stays in the field between turns. The Skip-ahead Quiz opens
     as a short panel from the top in this mode.
     Use an English/latin keyboard layout (a Japanese IME would turn letters into kana). Hepburn and common alternates are
   accepted: `shi/si`, `chi/ti`, `tsu/tu`, `fu/hu`, `ji/zi/di`, `zu/du`, `n/nn`, `wo/o`.
   Nothing is highlighted while you type, so you can't probe for the answer.
3. **Confirm.** Press **⏎** on the keyboard (it's End Turn; ⏎ with nothing typed skips your move). The keyboard
   is docked at the bottom like the quiz's. What you typed is revealed
   (`き = ki → 🛡 Guard`):
   - it reads as one of the moves → that move happens (even if it's not the one you meant!);
   - it matches no move → **fizzle**, you take **3 damage** (`wrongHpCost`). If it was a near
     miss of one move's reading (edit distance), that kana is marked missed in your SRS;
   - nothing typed → you skip your move.
4. **Beat, then the enemy acts.** After your move resolves there's a pause (1.3 s,
   `enemyDelayMs`), then the enemy acts (its intent was shown all turn), then another
   pause (0.9 s, `dealDelayMs`) before your next moves are dealt. Nothing is typeable
   during the pauses, and a save made mid-pause resumes correctly.

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
with a **whole word** instead of a single kana
(the card shows ねこ, you type `neko`). Word moves get **×1.5 power** (Suzuri: ×2).

### Other numbers
| Thing | Value |
|---|---|
| Player start HP | 70 |
| Enemy armor | subtracted from every hit unless it pierces |
| Player block | lasts until the enemy's attack this turn, then resets |
| Enemy HP | `hp × tierHp × (1 + 0.25 × (floor − 1))`, tierHp: normal ×2, elite ×1.6, boss ×1.35, review ×1.8 |
| Enemy damage / block | `value × 0.75 × (1 + 0.15 × (floor − 1))` |

### Combo, statuses and reactions
Numbers live in `CONFIG.combo` and `CONFIG.status`.

- **Combo**: every correct reading adds 1; a fizzle or a held turn resets it. Tiers: 3 → +10% power, 6 → +20%, 10 → +30% (attacks, blocks, heals).
- **Statuses** (an attack move leaves its element's status once per move, not per hit):

| Element | Status | Effect |
|---|---|---|
| 🔥 Fire | Burn +2 (max 6) | At the end of the enemy's action it takes `burn` damage (ignores block and armor), then burn −1 |
| 💧 Water | Soak (2 turns) | Wears off one per enemy action |
| 🌪️ Wind | Gust | The enemy's next action loses a hit (multi-hit) or is cancelled (buff) |
| ⚡ Thunder on a soaked enemy | Shock | ×1.5 damage, soak cleared, enemy loses its next action |
| 🔥 Fire on a soaked enemy | Steam | ×0.75 damage, soak cleared, no burn |

### Enemy gimmicks (`data/enemies.json`)
| Enemy | Gimmick |
|---|---|
| Hitodama | Immune to burn |
| Kappa | Shell: ×0.75 damage from everything except thunder, until a thunder hit cracks it |
| Tanuki | Mimic: resists the element it was just hit with (never its own weakness) |
| Tengu | Retaliate: each surviving physical hit costs you 3 HP (block applies) |
| Yuki-onna | Freeze: after she defends, one of your moves is frozen next turn (can't be cast, costs nothing) |
| Jorōgumo | Harden: +1 armor every time she defends |
| Oni · Gashadokuro · Ryūjin | Stun-proof; at 50% HP a one-time **phase**: Oni enrages (+1 strength, faster pattern), Gashadokuro reassembles (heals 15%, +1 armor), Ryūjin's weakness flips to thunder (resists fire) |

### Balance
`npm run sim` (or `SIM=1 npx vitest run src/game/balance.test.ts`) plays 300 fights per enemy and
floor with a perfect reader and a greedy policy, and prints turns, HP lost and death rate.
`npm test` runs a fast regression (`src/game/balance.fast.test.ts`): 60 fights per enemy must stay within +25% of the pre-status turn counts. Targets with the starter deck: normal fights last 2.5–6 turns and cost < 20 HP; elites 5–8 turns
and < 30 HP on their own floor; bosses 6–9 turns (floor-1 boss ~22 HP). With a few reward moves
the final boss (Ryūjin) should kill a perfect reader < 10% of the time. Add `SIM_EXTRA=blaze,stone_ward,…` to simulate a deck with rewards.

---

## Music

Four looping tracks, **generated by code** (Web Audio) so they cost no download and work offline. Source: `src/music/`.

| Track | Where it plays | Feel |
|---|---|---|
| Menu (54 bpm) | title, library, study, quiz, rest sites | zen: in-scale (D E♭ G A B♭) koto plucks, drone pad, shakuhachi, wind chimes |
| Map (112 bpm) | the map and reward screens | calm but upbeat: yo pentatonic, bouncy bass, melody enters after 4 bars |
| Battle (156 bpm) | normal, elite and review fights | exciting: driving bass, fast arpeggios, four-on-the-floor, fills |
| Boss (126 bpm) | boss fights | dangerous: taiko, E–B♭ drone, low horn melody in E phrygian |

- The run-over screen is silent so the win/lose sounds stand alone.
- **Reactive layers**: the battle **hook melody** plays while the combo is at tier 1 (3 correct in a row) or higher, and from the start in elite fights; it drops when the combo breaks. The boss goes **enraged** at its 50% phase change (+8% tempo, extra taiko roll, extra drone note). Layer changes land on the next bar.
- **Mix**: music master gain 0.12 (sound effects are 0.22) and it **ducks to 40%** while a kana voice clip plays (`duckMusic` in `speech.ts`). Music pauses when the tab is hidden.
- **Toggle**: title screen, "Music on/off", saved in `profile.settings.music` (separate from Sound; default on). Music starts on the first tap or key (browsers block audio before one).
- **How it works**: `scenes.ts` picks the track and layers from app state; `score.ts` turns a track into note events per bar; `scheduler.ts` queues bars slightly ahead of the audio clock; `voices.ts` plays each voice (pluck, bell, breath, pad, bass, pulse leads, horn, drums, taiko); `music.ts` owns the bus, crossfades (1.2 s), mute, ducking and a level meter; `useMusic.ts` connects it to `App.tsx`. Tunables are in `CONFIG.music`.
- **Changing or adding a track**: edit the note data in `score.ts` (the approved samples that these were ported from are in `docs/superpowers/specs/music-reference/`), add the scene to `sceneFor` in `scenes.ts`, and extend the tests in `src/music/`.
- **Checking it in a browser**: the page exposes `window.__music.level()` (output RMS, -1 before the first tap) and `window.__music.scene()`.

## Art (pixel sprites)

Battle art is pixel art stored as code: no image files, so it works offline and costs nothing to download.

- A sprite is a square grid of letters (`.` = transparent) plus a palette (`src/art/palette.ts`), built with `defineSprite(size, rows)` (it throws on a wrong size or an unknown letter).
- **Enemies are 32×32** (`src/art/enemies-normal.ts`, `enemies-elite.ts`, `enemies-boss.ts`, keyed by enemy id). **Icons and effects are 16×16** (`icons.ts`: element, move-kind and status icons; `effects.ts`: cast bursts).
- Drawn crisply on a `<canvas>` by `PixelSprite` at an integer scale. `EnemySprite` shows two idle frames (the second is the first shifted down 1px, swapped by CSS) and a white hit-flash frame, both derived (`bobSprite`, `flashSprite`), so each enemy is drawn once.
- Dark ink outline (`K`), limited palette matching the ink-and-paper theme.
- **Adding an enemy**: add it to `data/enemies.json` and draw a 32×32 sprite under its id; `npm test` fails until `ENEMY_SPRITES` covers every enemy id.
- **Looking at sprites**: `npm run sprites` writes `sprite-sheet.png` (icons/effects) and `enemy-sheet.png` (all enemies) to the repo root (git-ignored).
- Cast effects (`CastFx`): one burst per element over the enemy, hit-stop and shake scaled by damage, a screen flash for thunder, a status-icon pop, and a dissolve on death. All motion degrades under `prefers-reduced-motion`.
- Not yet pixel art: the player (UI-only HP bar), relic icons, map and reward screens (still emoji).

## 2. SRS (the learning engine)

Per kana (profile key `kanaslayer.profile.v1`): `seen`, `correct`, `lastSeen`, `streak`,
`missDebt`, `bucket` (new → learning → known → mastered), `reviewStage`, `nextReview`.

- **Correct**: you type a move's reading and confirm → its kana are marked correct.
- **Miss**: you type a near miss of a move's reading → that kana is marked missed.
- Study drills at rest sites (kana → romaji, 4 options) and the Skip-ahead Quiz also count.

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

## 4. Unlocks

Unlocks are stored as a list of group ids (`profile.unlocked`; old saves with a count migrate).

**Bosses** unlock the next group you don't have yet, in this order:
| # | Group |
|---|---|
| 1 | あ row (start) |
| 2–10 | か, さ, た, な, は, ま, や, ら, わ rows |
| 11–15 | が, ざ, だ, ば, ぱ |
| 16–25 | katakana rows ア … ワ |
| 26–30 | katakana dakuten ガ … パ |
| 31 | 📜 Word moves |

**🎯 Study focus** (home menu): pick which unlocked rows to practice. Each unlocked row has an
on/off chip; only rows that are **on** label your moves, fill Study drills and review fights
(`profile.studyOff` stores the ones switched off, so new unlocks start on). Presets: All,
Hiragana only, Katakana only, Latest rows (newest rows until there are ≥ 8 sounds). You can't
switch off so much that fewer than **5 different sounds** (`MIN_STUDY_READINGS`) remain, since a
turn deals up to 5 moves with different readings. Hiragana and katakana share sounds, so
katakana-only is enough on its own. The Library and the Skip-ahead Quiz still show everything.

**🎓 Skip-ahead Quiz** (home menu): if you already know some kana, test out of them.
- **A row** (e.g. か row): every kana in it, no misses → that row unlocks.
- **A family** (Hiragana, Hiragana dakuten, Katakana, Katakana dakuten): 14 questions with at
  least one per row, at most 1 miss → every row in the family unlocks.
- Kana → **type the romaji** on the in-game keyboard (Enter to submit). Answers count toward SRS.
- Word moves can't be quizzed; they unlock from a boss once every kana group is unlocked.

## 5. Relics (`data/relics.json`)
| Relic | Effect |
|---|---|
| 🗡️ Dakuten Blade | moves labelled with a voiced kana (ga, za, pa…) +5 dmg and pierce |
| 🎎 Daruma Doll | +12 max HP |
| 🧧 Omamori | first misread per fight costs no HP |
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
**When it speaks.** Never while typing. On submit (⏎ / Go) the game reads aloud the kana of the
move you matched; on a misread it reads the kana of the move you were closest to, so you hear the
right answer; skipping says nothing. The quiz reads each kana as you answer.

**No lag.** Clips are fetched and decoded into memory at startup (`preloadClips`, for the rows you're studying), and played through the shared Web Audio context, so they start ~1 ms after ⏎; sound effects fire on the same frame (extra effects follow 70 ms apart). If no clips are bundled, the loader gives up after a few misses instead of requesting all 69 files.

**How it speaks.** `speakKana` first plays a bundled recording `public/audio/<romaji>.mp3` (one
file per reading, shared by hiragana and katakana, e.g. `ka.mp3`, `shi.mp3`; 69 files cover all
kana) so it sounds identical on every phone and works offline. If the file is missing, or for whole
words, it falls back to `speechSynthesis` with a Japanese voice (hint shown if none is installed).
Recordings are precached by the service worker (`mp3` is in `globPatterns`).

Sound effects are synthesized with Web Audio (no files).

## 8. Persistence keys
| Key | Content |
|---|---|
| `kanaslayer.profile.v1` | unlocks, SRS stats, settings, lifetime stats |
| `kanaslayer.run.v3` | current run incl. in-progress battle (older runs from previous combat versions are dropped) |
