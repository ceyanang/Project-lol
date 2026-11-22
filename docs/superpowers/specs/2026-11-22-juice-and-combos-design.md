# Kana-Slayer: Juice, Elemental Combos & Pixel Art — Design

Date: 2026-11-22 · Status: draft for approval

## Intent and why

Playtesting verdict from the owner: spells feel samey, fights feel samey, and attacks "don't do
anything except lower numbers." They want flashiness and a more addictive loop. Today a cast is a
shake on the enemy emoji, a floating number, and a shrinking bar; every enemy is an
attack/defend/buff loop; the emoji art looks different per device and cannot animate.

Goal: every cast is a short, distinct, satisfying show, and spells interact with each other and
with enemies so decisions matter beyond "biggest number."

## Goals

1. **Per-element cast animations** (fire, water, wind, thunder, physical, plus heal/block/buff) with
   hit-stop, screen shake scaled to damage, enemy recoil, and a death animation.
2. **Combo streak**: consecutive correct readings grow a visible meter that boosts spell
   power and effect intensity, and breaks on a fizzle.
3. **Status effects and elemental combos** that make spells do something: burn, soak, bind/stun,
   wind interrupt, with cross-element reactions (e.g. soak then thunder).
4. **Enemy gimmicks and boss phases** so fights differ from each other.
5. **Pixel art** replacing emoji everywhere in battle: all 14 enemies at **32×32**, a player
   sprite, spell-effect sprites and status/element icons (16×16 or smaller).

## Non-goals

- Meta-progression (unlockables between runs, daily seed, collection book). Planned later as its
  own project; this design should not block it.
- Changing the kana-learning core: SRS, typing input, quiz, study drills stay as they are.
- AI-generated art and external art tools in this phase.
- Emoji on non-battle screens (map nodes, relics, rewards) is a follow-up unless trivially
  covered by the shared sprite renderer.

## Anti-goals (a failure even if it "works")

- Effects that slow down turns or make typing laggy (the repo has already trimmed lag twice).
- Animation that hides information: intents, weakness/resist and numbers must stay readable.
- Hurting the learning loop: flashiness must never reward guessing; combo only counts correct readings.
- Breaking offline PWA use or growing the bundle meaningfully (art is code, no image downloads).

## Constraints

- Mobile-first, offline PWA, React + Vite + TypeScript (existing stack; `RULES.md` applies).
- All tunables in `src/config.ts`; `PLAN.md` kept in sync; content in `data/*.json`.
- Respect `prefers-reduced-motion` (styles already shorten animation durations; shake and
  hit-stop must degrade the same way).
- Existing tests, `npm run sim` balance targets, and saved-run compatibility
  (`storage.ts`) must keep working; new battle state fields need defaults for old saves.
- Both keyboard layouts (game keyboard and phone top-half layout) must still fit.

## Approaches considered

| Option | What | Trade-off |
|---|---|---|
| A. Juice only | Animations, hit-stop, combo meter, no new mechanics | Cheapest, big wow, but "attacks only lower numbers" remains |
| B. Mechanics only | Statuses, combos, gimmicks, no new visuals | Fixes depth, but nothing to *see* |
| **A + B (chosen)** | Build statuses first, animate them as they land | Largest scope; same work serves both |
| C. Meta-progression | Unlocks, daily seed | Deferred; does not fix in-fight feel |

Art route: **hand-drawn pixel grids as code** (chosen) vs AI-generated PNGs. Chosen for offline
size, animation frames, palette consistency and free iteration. AI art may be used later for
title/boss portraits. A throwaway spike confirmed the style works at 16×16 (fire effect read
best); enemies move to 32×32 because faces need room.

## Design decisions (made with the owner)

- Do both A and B; start with juice plus the elemental-combo mechanics together, because
  you cannot animate "soak then zap" without it being a real mechanic.
- Pixel art, hand-drawn as code, **32×32 for every enemy**.
- Style: chunky pixels, dark ink outline, limited palette matching the ink-and-paper theme.

## Proposed details (my calls — change freely)

These are proposals, not agreed with the owner:

- **Sprite format**: each sprite is a string-grid plus palette in a TS module
  (`src/art/`), drawn to a `<canvas>` with `image-rendering: pixelated` at an integer scale.
  Enemies get 2 idle frames (slow bob) and a hit-flash variant (palette swap to white).
- **Statuses (first set)**: 🔥 Burn (damage at the enemy's turn end, stacks decay),
  💧 Soak (next thunder hit ×1.5 and removes soak; fire hit removes soak and does −damage),
  ⚡ Stun/Bind (enemy loses next action), 🌪️ Gust (delays/cancels a multi-hit intent).
  Exact numbers go in `config.ts` and the balance sim.
- **Combo meter**: +1 per correct reading, resets on fizzle/skip. Tiers at 3/6/10 give a power
  bonus (suggest +10/20/30%) and escalate effect size and sound. Capped so balance targets still hold.
- **Gimmicks (first pass, one or two per enemy tier)**: e.g. Kappa's dish shield (crack it with
  thunder), Tanuki copies your last element's resist, Tengu dodges physical, Yuki-onna freezes a
  move slot, bosses get a phase change at 50% HP.
- **Effects layer**: a single battle FX component driven by the existing `Fx` events from
  `battle.ts`, with new event kinds for statuses, combo and death.
- **Sound**: extend `sfx.ts` with per-element cast sounds and a combo rising tone.

## Left to the builder

- Exact sprite pixels for each of the 14 enemies, the player, and effects (iterate visually).
- Animation timings, as long as a turn is not slowed (`enemyDelayMs`/`dealDelayMs` stay the budget).
- Numeric tuning of statuses and combo, validated with `npm run sim`.
- Save-file migration details and new unit tests for statuses/combo.
- Delivery order within the project; a sensible split is (1) sprite renderer + enemies,
  (2) cast animations + combo, (3) statuses and reactions, (4) gimmicks/phases, (5) balance pass.

## Open questions for the owner

1. Should the player get a visible character sprite in battle (a small shrine-maiden/ninja at the
   bottom), or stay UI-only with just the HP bar?
2. Are gimmicks per enemy OK to invent myself, or do you want to veto/pick them?
