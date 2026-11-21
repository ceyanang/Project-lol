# Kana-Slayer — Design Spec

A mobile-first, offline-capable, turn-based deckbuilder roguelike that teaches
hiragana and katakana. Every card is a kana. Playing a card means **reading** it.
Kana you miss come back more often (spaced repetition baked into the draw math).

> **Every number in this file lives in `src/config.ts`.** Change it there and
> update the table here. Game content (kana, words, enemies, relics) lives in `data/*.json`.

---

## 1. Core combat loop

1. Start of turn: refill energy, clear your block, draw a hand (SRS-weighted, see §3).
2. The enemy telegraphs its **intent** (attack / multi-hit / defend / buff) plus three kinds of prompt:
   | Prompt | Shown as | Answer | Bonus |
   |---|---|---|---|
   | 🛡 **Guard** | romaji, e.g. `ka` | play a **Block** card showing か | **Perfect Guard**: block ×2 |
   | 🎯 **Weak spot** (×2) | romaji, e.g. `ne`, `su` | play an **Attack** card showing that kana | **Weak-spot hit**: damage ×2 |
   | 💬 **Word** (sometimes) | English, e.g. `"cat"` | chain cards into that word (ね+こ) | extra ×1.5 on the combo |
3. Tap one card, or tap 2+ cards to **chain** them. If the chained kana can be ordered into a vocab word (any order you tap them), it becomes a **word combo**.
4. Press **Play** → the **reading check**: for each kana in the play, tap the correct romaji tile out of 4.
   - ✅ correct → card resolves, kana marked correct.
   - ❌ wrong → lose **2 HP**, that card fizzles, kana marked missed. In a chain, one miss breaks the combo multiplier (the other correct cards still resolve at base value).
5. **End Turn** → hand is discarded, enemy acts, repeat.

### Prompt generation (keeps hands playable)
- The guard prompt is taken from a Block card in your hand with probability `guardFromHandChance` (0.8), otherwise it is a decoy from your unlocked kana — so you have to actually read, not just pattern-match.
- Weak spots: up to 2; at least one comes from an Attack card in hand when possible.
- Prompts are chosen with SRS weights, so kana you miss are asked about more.

### Matching rule
The original pitch says a card *must* match a prompt (or be in a word) to be played.
In testing that produced dead hands, so the default is **`requireMatch: false`**:
unmatched cards still play at base value; matching doubles them. Set `requireMatch: true`
in `src/config.ts` for the strict variant (unmatched single cards are greyed out).

### Numbers
| Thing | Value |
|---|---|
| Player start HP | 50 |
| Energy per turn | 3 |
| Hand size | 5 |
| Kana card cost | 1 energy |
| Attack card | 6 damage |
| Block card | 5 block |
| Weak-spot / Perfect Guard | ×2 |
| Word combo multiplier | `1 + 0.5 × (length − 1)` → 2 kana ×1.5, 3 kana ×2, 4 kana ×2.5 |
| Word combo cost | `max(1, length − 1)` energy (a chain is cheaper than its cards) |
| English word prompt bonus | ×1.5 on top of the combo |
| Wrong reading | −2 HP, card fizzles |
| Word Scroll (late unlock) | cost 2, `5 × length` damage, check = pick the English meaning |
| Enemy armor | subtracted from every hit (dakuten relic pierces it) |
| Player block | resets each turn |

### Enemy HP / damage scaling
```
enemyHp     = base.hp    × (1 + 0.30 × (floor − 1))
enemyDamage = base.value × (1 + 0.20 × (floor − 1))   (rounded)
```
Bosses don't scale on their "home" floor beyond this formula — e.g. Oni Lord (70 HP) on floor 1.

---

## 2. SRS (the learning engine)

Per kana we store (in `localStorage`, profile key `kanaslayer.profile.v1`):

| Field | Meaning |
|---|---|
| `seen` | times it was asked in a reading check |
| `correct` | times answered correctly |
| `lastSeen` | timestamp (ms) |
| `streak` | consecutive correct answers |
| `missDebt` | "missed" boost counter: set to 3 on a miss, −1 on each correct |
| `bucket` | `new` → `learning` → `known` → `mastered` |
| `reviewStage` | index into the review interval list |
| `nextReview` | timestamp a mastered kana is due for review |

### Buckets
- `new`: never seen.
- `learning`: seen, streak < 3.
- `known`: streak ≥ 3.
- `mastered`: streak ≥ 6.
- A miss resets streak to 0 and drops `known`/`mastered` back to `learning`.

### Draw weight (used for hand draws, prompts, rewards, distractors)
```
weight = bucketWeight[bucket] × (missDebt > 0 ? 3 : 1) × (isDue ? 2 : 1)
```
| Bucket | Weight |
|---|---|
| new | 1.5 |
| learning | 2.0 |
| known | 1.0 |
| mastered | 0.35 (never 0 — mastered kana never disappear) |
| **missed multiplier** | **×3** |
| due-for-review multiplier | ×2 |

Hands are drawn **without replacement from the draw pile, weighted** (not a uniform shuffle), so a missed か in your deck shows up ~3× as often as a comparable kana.

### Review schedule
When a kana reaches `mastered`, it is scheduled for review **1 day** later. Each correct
answer once it is due advances the schedule: **1 → 3 → 7 → 14 days** (stays at 14).
A miss demotes it to `learning` and clears the schedule.

Due kana:
- make the map spawn a 📜 **Review** node (Memory Wraith fight) on the current floor,
- are shuffled into your draw pile as temporary "echo" cards during that fight,
- are preferred for prompts in that fight.

---

## 3. Deck & words

- First run deck: あ い う え お, each once as Attack and once as Block (10 cards).
- Later runs: 12 cards from your unlocked kana — all kana of the newest unlocked row,
  the rest SRS-weighted, plus the kana for 2 random vocab words so combos are possible.
- **Word assist**: when a hand is drawn, with 50% chance the game swaps a card or two
  from the draw pile so a vocab word is formable. Keeps combos showing up.
- Vocab words count as usable once every kana in them is unlocked (`data/vocab.json`).

---

## 4. Run structure

- A run = **3 floors**. Beat the floor-3 boss → victory.
- Each floor is a branching map: **4 rows of choices + a boss row**, 2–3 nodes per row.
  | Node | Odds (rows 2–4) | |
  |---|---|---|
  | ⚔️ Fight | 55% | normal enemy |
  | 💀 Elite | 15% | tougher enemy, card + relic reward |
  | 🔥 Rest | 15% | heal 30% **or** Study drill (5 kana; each correct = +1 max HP, heal 3) |
  | 📜 Review | 15% (only if kana are due) | Memory Wraith review fight |
  Row 1 is always fights. The row before the boss always has at least one rest.
- Rewards:
  - Fight → pick 1 of 3 kana cards (or skip). Offers are SRS-weighted and favour your newest row.
  - Elite → card pick + pick 1 of 2 relics.
  - Boss → **unlock the next kana group** + pick 1 of 3 relics + heal 50% of missing HP.
- **Permadeath**: dying ends the run (map, deck, relics, HP gone). Unlocked kana and SRS stats are kept forever.

---

## 5. Unlock order (one group per boss kill, persistent)

| # | Group |
|---|---|
| 1 | あ row (start) |
| 2–10 | か, さ, た, な, は, ま, や, ら, わ rows (わ row includes を ん) |
| 11–15 | dakuten/handakuten: が, ざ, だ, ば, ぱ |
| 16–25 | katakana rows ア … ワ |
| 26–30 | katakana dakuten ガ … パ |
| 31 | 📜 Word Scrolls (vocab cards) |

---

## 6. Relics (`data/relics.json`)

| Relic | Effect |
|---|---|
| 🗡️ Dakuten Blade | が/ぱ-type attacks pierce armor, +2 dmg |
| 🎎 Daruma Doll | +12 max HP |
| 🧧 Omamori | first wrong reading per fight is free |
| 🖋️ Suzuri Inkstone | word combo multiplier +0.5 |
| 🏮 Paper Lantern | draw 6 instead of 5 |
| 🍵 Matcha Bowl | heal 5 after every fight |
| 🔔 Shrine Bell | start fights with 8 block |
| ⛩️ Tiny Torii | +2 energy on turn 1 |
| 🖌️ Calligraphy Brush | Perfect Guard ×3 |
| ⚔️ Katana | weak spots ×2.5 |
| ⭕ Maru Ring | handakuten cards +4 |
| 🦊 Kitsune Mask | +1 energy per turn |

---

## 7. Screens
Title (New Run / Continue / Kana Library) → Map → Battle → Reward → … → Run Over.
Kana Library: every kana by row with its mastery colour, tap to hear it, stats and mnemonic.

## 8. Pronunciation
`window.speechSynthesis`, `lang = "ja-JP"`, the first voice whose `lang` starts with `ja`.
If none exists we still try (some browsers speak without listing voices) and show a
one-time hint on how to install a Japanese voice.

## 9. Persistence keys
| Key | Content |
|---|---|
| `kanaslayer.profile.v1` | unlocks, SRS stats, settings, lifetime stats |
| `kanaslayer.run.v1` | current run incl. in-progress battle (deleted on run end) |
