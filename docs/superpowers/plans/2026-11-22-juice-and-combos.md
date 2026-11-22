# Juice, Elemental Combos & Pixel Art Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every cast a distinct, flashy event backed by real mechanics (combo meter, statuses, elemental reactions, enemy gimmicks, boss phases) and replace battle emoji with hand-drawn pixel art.

**Architecture:** The pure battle engine (`src/game/battle.ts`) gains combo, status and gimmick state and emits richer `Fx` events. A new `src/art/` module holds sprites as string grids drawn to a pixelated canvas. `Battle.tsx` consumes the new state/events to render sprites, statuses, combo, and per-element cast effects.

**Tech Stack:** React 19, Vite, TypeScript, vitest (existing). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-22-juice-and-combos-design.md`

## Global Constraints

- Tunables live in `src/config.ts`; keep `PLAN.md` in sync; content in `data/*.json`.
- Offline PWA: art is code, no image downloads. Sprites are string grids drawn to `<canvas>` with `image-rendering: pixelated`.
- Enemy sprites are **32×32**; effect/status/element icons are **16×16**. Dark ink outline, limited palette matching the ink-and-paper theme.
- Do not slow turns: `enemyDelayMs` (1300) and `dealDelayMs` (900) stay the budget; animations never block input beyond them.
- Respect `prefers-reduced-motion` (shake, hit-stop and cast animations must degrade; the game must be fully playable with them off).
- Combo counts **correct readings only**; a fizzle or held turn resets it.
- Existing tests, `npm run sim` balance targets (PLAN.md §1 Balance) and saved-run compatibility (`parseRun`, version 3) must keep working; new state needs defaults for old saves.
- Both keyboard layouts (game keyboard, phone top-half) must still fit.
- Player sprite and non-battle emoji (map, rewards, relics) are out of scope.

## Review Focus

1. Old saved battle (no `combo`/`status`/`frozen` fields) loads and plays — Task 1 and Task 2 tests.
2. Burn damage that kills the enemy at end of its turn ends the battle as `won` — Task 2.
3. Typing the reading of a frozen slot costs no HP and records no SRS miss — Task 5.
4. A boss phase change fires once, and not when the killing blow lands — Task 6.
5. Retaliate (Tengu) damage that would kill the player ends the battle as `lost`, and never fires when the hit kills the enemy — Task 4.

---

## File Structure

- Modify `src/types.ts`: `StatusKind`, `Gimmick`, `Phase`, `EnemyDef.gimmicks/phase`, `Fx` fields live in `battle.ts`.
- Modify `src/config.ts`: `CONFIG.combo`, `CONFIG.status`.
- Modify `src/game/battle.ts`: combo, statuses, gimmicks, phases, freeze, richer `Fx`. (Already 468 lines; put new pure helpers in `src/game/status.ts` and `src/game/gimmicks.ts`, keep `battle.ts` as the orchestrator.)
- Create `src/game/status.ts`, `src/game/gimmicks.ts`.
- Modify `data/enemies.json`: gimmicks and phases.
- Create `src/art/{sprite.ts,palette.ts,icons.ts,effects.ts,enemies-normal.ts,enemies-elite.ts,enemies-boss.ts,index.ts,sprites.test.ts}` and `src/components/PixelSprite.tsx`, `src/components/CastFx.tsx`, `src/components/StatusChips.tsx`, `src/components/ComboMeter.tsx`.
- Modify `src/screens/Battle.tsx`, `src/components/MoveCard.tsx`, `src/styles.css`, `src/game/sfx.ts`, `src/game/run.ts` (parseRun defaults), `src/game/balance.test.ts`, `PLAN.md`.

---

### Task 1: Richer Fx events and the combo meter

**Files:** Modify `src/types.ts`, `src/config.ts`, `src/game/battle.ts`, `src/game/run.ts`; Test `src/game/battle.test.ts`.

**Interfaces:**
- Produces: `Fx` becomes `{ id: number; kind: FxKind; text: string; element?: Element; amount?: number }`; `FxKind` gains `'status' | 'combo' | 'react'`. `BattleState.combo: number`. `export function comboBonus(combo: number): number` (0, 0.1, 0.2, 0.3 per `CONFIG.combo.tiers`). `MovePreview` gains `combo: number` (the current bonus). `parseRun` defaults `battle.combo ?? 0`.
- Config: `CONFIG.combo = { tiers: [{ at: 3, bonus: 0.1 }, { at: 6, bonus: 0.2 }, { at: 10, bonus: 0.3 }] }`.

- [ ] **Step 1: Write failing tests** in `battle.test.ts`: (a) three correct strikes in a row → `comboBonus(3) === 0.1`, `comboBonus(2) === 0`, `comboBonus(10) === 0.3`; (b) after 3 correct casts `b.combo === 3` and the 4th cast's `previewMove(...).damagePerHit` equals `Math.round(9 * 1.1)` for strike vs a non-weak/resist enemy; (c) a fizzle sets `combo` to 0, and so does a held (empty) turn; (d) the `enemyHit` fx of a fire move has `element: 'fire'` and `amount` equal to damage dealt; (e) `parseRun` of a v3 save whose battle lacks `combo` returns `battle.combo === 0`.
- [ ] **Step 2: Run** `npx vitest run src/game/battle.test.ts` — expect FAIL (undefined exports/fields).
- [ ] **Step 3: Implement** `comboBonus` and add `combo` to `BattleState` (init 0 in `createBattle`); apply `(1 + comboBonus(b.combo))` inside `powerMultiplier` (attacks, block, heal, weaken all scale); increment on a matched reading in `confirmTurn`, reset on fizzle/held turn; extend `pushFx` to accept `{element, amount}`; pass them in `performMove`'s `enemyHit`. Emit `pushFx(..., 'combo', 'x3')` when the combo reaches a tier threshold. Default `combo` in `parseRun`.
- [ ] **Step 4: Run** `npm test` — expect all PASS.
- [ ] **Step 5: Commit** `feat: combo meter and element-tagged fx`.

### Task 2: Burn and Soak with elemental reactions

**Files:** Create `src/game/status.ts`; Modify `src/types.ts`, `src/config.ts`, `src/game/battle.ts`; Test `src/game/status.test.ts`.

**Interfaces:**
- Produces: `type StatusKind = 'burn' | 'soak' | 'stun' | 'gust'`; `EnemyState.status: { burn: number; soak: number; stun: number; gust: number }` (all 0 at spawn; old saves default to zeros). In `status.ts`: `applyElementStatus(e: EnemyState, element: Element | undefined): { enemy: EnemyState; reaction: null | 'steam' | 'shock' }` and `tickStatuses(e: EnemyState): { enemy: EnemyState; burnDamage: number }`, plus `reactionMultiplier(e: EnemyState, element: Element | undefined): number`.
- Config: `CONFIG.status = { burnStacksPerHit: 2, burnMax: 6, soakTurns: 2, shockMultiplier: 1.5, steamMultiplier: 0.75, shockStun: 1, gustHits: 1 }`.
- Rules: an **attack** move applies its element's status once per move (not per hit): fire → `burn += burnStacksPerHit` (cap `burnMax`), water → `soak = soakTurns`, wind → `gust = gustHits`. Reactions use the status the enemy had **before** the hit: thunder on a soaked enemy → damage ×`shockMultiplier`, clears soak, `stun = shockStun`, emits `react` fx "Shock!"; fire on a soaked enemy → damage ×`steamMultiplier`, clears soak, applies no burn, emits `react` fx "Steam!". The multiplier also appears in `previewMove` (`matchup` badge unchanged). At the end of the enemy's action, `tickStatuses`: burn deals `burn` damage ignoring block and armor then `burn -= 1`; soak `-= 1`. Burn damage emits `enemyHit` fx with `element: 'fire'`.

- [ ] **Step 1: Write failing tests** in `status.test.ts`: fire hit on kodama sets `status.burn === 2`; after the enemy turn the enemy lost exactly 2 HP extra and `burn === 1`; water hit sets `soak === 2`, which becomes 1 after one enemy turn; thunder after water deals `Math.round(11 * 1.5 * weaknessMult)`-consistent damage (assert ratio 1.5 against a soak-free hit on the same enemy), clears soak and sets `stun === 1`; fire after water deals ×0.75 and leaves `burn === 0`; burn is capped at 6 after four fire hits; **burn tick that takes the enemy to 0 HP sets `outcome: 'won'`**; an old-shaped enemy without `status` still plays a turn (defaults applied in `enemyTurn`).
- [ ] **Step 2: Run** `npx vitest run src/game/status.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** `status.ts` per the rules above and wire into `performMove` (apply + reaction multiplier on `hitEnemy` raw damage) and `enemyTurn` (tick at the end, then check death). Emit `status` fx ("Burn!", "Soaked!") with `element`.
- [ ] **Step 4: Run** `npm test` — expect PASS.
- [ ] **Step 5: Commit** `feat: burn, soak and shock/steam reactions`.

### Task 3: Stun, Gust and status immunity

**Files:** Modify `src/game/status.ts`, `src/game/battle.ts`, `src/types.ts`; Test `src/game/status.test.ts`.

**Interfaces:**
- Produces: `export function effectiveIntent(e: EnemyState): Intent | null` in `battle.ts` (null when the current intent is cancelled by gust or the enemy is stunned); `incomingDamage` and `intentDamage` consume it. A stunned enemy skips its action (`intentIndex` still advances, `stun -= 1`, fx "Stunned!"). Gust: a `buff` intent is cancelled (returns null) and a `multi` intent loses `CONFIG.status.gustHits` hits (a result of 0 hits returns null); `gust` resets to 0 after the enemy's action. Immunity: `EnemyState.gimmicks: Gimmick[]` and helper `isImmune(e, kind: StatusKind): boolean` (Gimmick type added in Task 4; define `immune` first here).

- [ ] **Step 1: Write failing tests**: wind hit on a `multi 3×3` intent makes `incomingDamage` equal 2 hits; wind hit before `buff` makes the buff not apply (`strength` unchanged after the enemy turn); multi with 1 hit + gust → `effectiveIntent === null` and the player takes no damage; thunder-on-soak stun makes the enemy deal no damage that turn and then act normally the next; an enemy with `immune: ['burn']` never gains burn; an enemy with `immune: ['stun']` is not stunned by Shock.
- [ ] **Step 2: Run** `npx vitest run src/game/status.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** `effectiveIntent`, the stun skip and gust consumption in `enemyTurn`, `isImmune` checks inside `applyElementStatus`.
- [ ] **Step 4: Run** `npm test` — expect PASS.
- [ ] **Step 5: Commit** `feat: stun, gust and status immunity`.

### Task 4: Gimmicks — shell, mimic, retaliate, harden, immune (data + engine)

**Files:** Create `src/game/gimmicks.ts`; Modify `src/types.ts`, `data/enemies.json`, `src/game/battle.ts`; Test `src/game/gimmicks.test.ts`.

**Interfaces:**
- Produces in `types.ts`: `type Gimmick = { type: 'shell'; breaker: Element; reduction: number } | { type: 'mimic' } | { type: 'retaliate'; element: Element; damage: number } | { type: 'harden'; armor: number } | { type: 'freeze' } | { type: 'immune'; to: StatusKind[] }`; `EnemyDef.gimmicks?: Gimmick[]`; `EnemyState.gimmicks: Gimmick[]`, `EnemyState.shellBroken: boolean`.
- Data (builder may tune numbers): hitodama `immune burn`; kappa `shell breaker thunder reduction 0.5`; tanuki `mimic`; tengu `retaliate physical damage 3`; jorogumo `harden armor 1`; yukionna `freeze` (Task 5); oni, gashadokuro, ryujin `immune stun`.
- Rules: **shell** — until a hit of the `breaker` element lands, all damage to the enemy is multiplied by `reduction`; the breaker hit itself deals full damage and sets `shellBroken`; preview shows the reduction. **mimic** — after each attack move with an element, `enemy.resist` becomes that element (so the next hit of the same element is ×½; `previewMove` already reads `enemy.resist`). **retaliate** — after a hit of `element` that does not kill the enemy, the player takes `damage` through `hitPlayer` (block applies). **harden** — each time the enemy resolves a `defend` intent, `armor += armor`.

- [ ] **Step 1: Write failing tests**: kappa takes ×0.5 from strike until a thunder hit, which deals full and breaks the shell so the next strike is full; tanuki hit by fire resists fire next (`enemy.resist === 'fire'`) and the preview shows `matchup: 'resist'`; tengu retaliation deals 3 to a player with 0 block and 0 with 3+ block; **a physical hit that kills tengu triggers no retaliation; retaliation that drops the player to 0 sets `outcome: 'lost'`**; jorogumo `armor` goes 2 → 3 after her defend turn; every enemy in `data/enemies.json` still validates (`ENEMIES.every` has `weak`).
- [ ] **Step 2: Run** `npx vitest run src/game/gimmicks.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** `gimmicks.ts` helpers (`damageAfterShell`, `onEnemyHit`, `onEnemyDefend`) and call them from `performMove`/`enemyTurn`; copy gimmicks into state in `createEnemy`; edit the JSON.
- [ ] **Step 4: Run** `npm test` — expect PASS.
- [ ] **Step 5: Commit** `feat: enemy gimmicks`.

### Task 5: Yuki-onna freeze (locked move slot)

**Files:** Modify `src/game/battle.ts`, `src/game/gimmicks.ts`; Test `src/game/gimmicks.test.ts`.

**Interfaces:**
- Produces: `BattleState.frozen: string[]` (slot uids; default `[]`, defaulted in `parseRun`); `EnemyState.freezeNext: boolean`. A `freeze` enemy sets `freezeNext = true` when it resolves a `defend` intent; `startPlayerTurn` then freezes one random dealt slot (via `ctx.rng`) and clears the flag. `matchSlot` ignores frozen slots. In `confirmTurn`, if the typed reading matches a frozen slot: no move, no HP cost, **no SRS answers**, `lastResult.text` "❄️ That move is frozen", turn proceeds to the enemy beat and combo resets.

- [ ] **Step 1: Write failing tests**: after yukionna's defend turn the next deal has exactly one frozen slot; typing its reading yields `answers.length === 0`, `playerHp` unchanged, enemy HP unchanged; typing another slot's reading works normally; slots dealt the turn after are unfrozen; with fewer than 2 slots dealt nothing is frozen.
- [ ] **Step 2: Run** `npx vitest run src/game/gimmicks.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** as specified.
- [ ] **Step 4: Run** `npm test` — expect PASS.
- [ ] **Step 5: Commit** `feat: yuki-onna freezes a move`.

### Task 6: Boss phases

**Files:** Modify `src/types.ts`, `data/enemies.json`, `src/game/battle.ts`; Test `src/game/gimmicks.test.ts`.

**Interfaces:**
- Produces: `Phase = { atHpPct: number; label: string; pattern?: Intent[]; strength?: number; armor?: number; block?: number; weak?: Element; resist?: Element }`; `EnemyDef.phase?: Phase`; `EnemyState.phase?: Phase`, `EnemyState.phaseDone: boolean`. `checkPhase(e: EnemyState): { enemy: EnemyState; fired: boolean }` in `gimmicks.ts`, called after every point the enemy's HP can drop (player move, burn tick, retaliate none).
- Data (builder tunes): oni at 0.5 — `Enraged!`, new faster pattern with a `multi 3×3`, `strength +1`; gashadokuro at 0.5 — `Reassembles!`, `block 15`, `armor +1`; ryujin at 0.5 — `Storm rises!`, `weak: 'thunder'`, `resist: 'fire'`. On firing: replace the fields given, reset `intentIndex` to 0, emit `buff` fx with the label.

- [ ] **Step 1: Write failing tests**: oni below 50% HP changes `pattern`, `strength` and sets `phaseDone`; a second dip does not fire again; **a single hit that takes the boss from above 50% straight to 0 ends the battle with no phase change**; ryujin's phase swaps `weak` so `previewMove` for thunder shows `matchup: 'weak'` afterwards; burn tick crossing 50% also triggers the phase.
- [ ] **Step 2: Run** `npx vitest run src/game/gimmicks.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** `checkPhase` and the JSON.
- [ ] **Step 4: Run** `npm test` — expect PASS.
- [ ] **Step 5: Commit** `feat: boss phase changes`.

### Task 7: Balance pass

**Files:** Modify `src/config.ts`, `src/game/balance.test.ts`; Create `src/game/balance.fast.test.ts`.

- [ ] **Step 1: Write a failing fast regression test** `balance.fast.test.ts`: 60 seeded fights per enemy at its `minFloor` with the starter deck and the sim's greedy policy extended to prefer burn/soak/thunder reactions (`score` + 4 when the move would react); assert normal enemies average 2.5–6 turns and lose < 20 HP, elites 5–8 turns and < 30 HP, bosses 6–9 turns, floor-1 boss ~22 HP lost.
- [ ] **Step 2: Run** `npx vitest run src/game/balance.fast.test.ts` — expect FAIL or out of range because statuses shorten fights.
- [ ] **Step 3: Tune** `CONFIG.scaling.tierHp`, `CONFIG.status` and gimmick data until the targets hold; run `npm run sim` and with `SIM_EXTRA=blaze,stone_ward` confirm Ryūjin kills a perfect reader < 10%. Update `PLAN.md` §1 Balance and the new mechanics table.
- [ ] **Step 4: Run** `npm test` and `npm run sim` — expect PASS and targets met.
- [ ] **Step 5: Commit** `balance: retune for statuses and combo`.

### Task 8: Pixel sprite core

**Files:** Create `src/art/sprite.ts`, `src/art/palette.ts`, `src/components/PixelSprite.tsx`, `src/art/sprites.test.ts`.

**Interfaces:**
- Produces: `interface Sprite { size: 16 | 32; rows: string[]; palette: Record<string, string> }`; `defineSprite(size: 16 | 32, rows: string[], palette?: Record<string, string>): Sprite` (throws if row count or any row length ≠ size, or a letter is neither `.` nor in the palette); `flashSprite(s: Sprite): Sprite` (every opaque pixel except outline becomes paper white); `bobSprite(s: Sprite): Sprite` (shift all rows down 1, dropping the bottom row); `BASE_PALETTE` (K ink `#1c1a17`, W paper white, R/O/Y fire reds-oranges-yellows, G/g greens, B/b blues, S/s browns, P pink, plus greys); `<PixelSprite sprite: Sprite scale?: number className?: string />` draws a canvas of `size*scale` px with `image-rendering: pixelated`, `scale` default 4.
- Verification helper: `SPRITES=1 npx vitest run src/art/sprites.test.ts` writes `sprite-sheet.png` (all sprites on a paper background, 8× scale) so a human can look at them; add npm script `"sprites": "SPRITES=1 npx vitest run src/art/sprites.test.ts"`.

- [ ] **Step 1: Write failing tests**: `defineSprite(32, rows31, …)` throws; unknown letter throws; `flashSprite` keeps `K` pixels and turns others white; `bobSprite` moves a pixel at row 0 to row 1; `PixelSprite` renders a `<canvas>` with the expected width.
- [ ] **Step 2: Run** `npx vitest run src/art/sprites.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** `sprite.ts`, `palette.ts`, `PixelSprite.tsx` (draw in `useEffect`; no SSR assumptions) and the sheet-writing test helper (manual PNG encoding with `node:zlib`, as in the existing spike approach).
- [ ] **Step 4: Run** `npm test` — expect PASS.
- [ ] **Step 5: Commit** `feat: pixel sprite renderer`.

### Task 9: Effect, element, status and kind icons (16×16)

**Files:** Create `src/art/icons.ts`, `src/art/effects.ts`; Modify `src/art/sprites.test.ts`.

**Interfaces:**
- Produces: `ELEMENT_ICON: Record<Element, Sprite>` (physical slash, fire, water, wind, thunder); `KIND_ICON: Record<'block' | 'heal' | 'weaken' | 'mirror', Sprite>`; `STATUS_ICON: Record<StatusKind | 'shell' | 'frozen', Sprite>`; `CAST_SPRITE: Record<Element, Sprite>` (the larger-looking burst drawn at 16×16 and scaled up when cast: fire burst, water splash, wind slashes, thunder bolt, slash streak).
- The fire burst from the design spike is the reference for style: red outer, orange mid, yellow core, white-hot centre, dark outline.

- [ ] **Step 1: Write failing tests**: every key of each record exists and is a valid 16×16 sprite; no sprite is blank; sprites within one record are pairwise different.
- [ ] **Step 2: Run** `npx vitest run src/art/sprites.test.ts` — expect FAIL.
- [ ] **Step 3: Draw** all icons (≈20) with `defineSprite`; run `npm run sprites` and view `sprite-sheet.png`; redraw anything unreadable at 3× scale (each must read as its meaning at a glance).
- [ ] **Step 4: Run** `npm test` — expect PASS.
- [ ] **Step 5: Commit** `art: element, kind, status and cast sprites`.

### Task 10: Normal enemy sprites (kodama, hitodama, bakeneko, kappa, kasaobake, tanuki, chochin)

**Files:** Create `src/art/enemies-normal.ts`; Modify `src/art/sprites.test.ts`.

**Interfaces:** Produces `NORMAL_SPRITES: Record<string, Sprite>` keyed by enemy id, each 32×32, each recognisable as its yokai from the name and `flavor` in `data/enemies.json` (kappa: water dish + beak + shell; tanuki: round belly + leaf; chochin: paper lantern with tongue; etc.).

- [ ] **Step 1: Write failing test**: `Object.keys(NORMAL_SPRITES)` equals those 7 ids; each is 32×32 with at least 150 opaque pixels and an outline pixel on every edge row/column that has content (no clipped sprites).
- [ ] **Step 2: Run** `npx vitest run src/art/sprites.test.ts` — expect FAIL.
- [ ] **Step 3: Draw** the 7 sprites; run `npm run sprites`, look at the sheet, iterate until each reads clearly.
- [ ] **Step 4: Run** `npm test` — expect PASS.
- [ ] **Step 5: Commit** `art: normal enemy sprites`.

### Task 11: Elite and boss/review sprites (tengu, yukionna, jorogumo, oni, gashadokuro, ryujin, memorywraith)

**Files:** Create `src/art/enemies-elite.ts`, `src/art/enemies-boss.ts`, `src/art/index.ts`; Modify `src/art/sprites.test.ts`.

**Interfaces:** Produces `ENEMY_SPRITES: Record<string, Sprite>` merging all three files, and `spriteFor(enemyId: string): Sprite` in `src/art/index.ts` (throws on an unknown id). Bosses should feel bigger: use the full 32×32 and a heavier outline/silhouette.

- [ ] **Step 1: Write failing test**: `Object.keys(ENEMY_SPRITES)` equals `ENEMIES.map(e => e.id)` exactly (a new enemy without art fails CI); same size/opaque/clipping checks as Task 10.
- [ ] **Step 2: Run** `npx vitest run src/art/sprites.test.ts` — expect FAIL.
- [ ] **Step 3: Draw** the 7 sprites, `npm run sprites`, iterate.
- [ ] **Step 4: Run** `npm test` — expect PASS.
- [ ] **Step 5: Commit** `art: elite, boss and review enemy sprites`.

### Task 12: Battle UI — sprites, statuses, combo, frozen slot

**Files:** Create `src/components/StatusChips.tsx`, `src/components/ComboMeter.tsx`; Modify `src/screens/Battle.tsx`, `src/components/MoveCard.tsx`, `src/styles.css`; Test `src/components/battle-ui.test.tsx` (vitest + `react-dom/server` render, no new dependency).

**Interfaces:**
- Consumes: `spriteFor`, `PixelSprite`, `ELEMENT_ICON`, `KIND_ICON`, `STATUS_ICON`, `effectiveIntent`, `BattleState.combo/frozen`, `EnemyState.status/gimmicks`.
- Produces: `<StatusChips enemy={EnemyState} />` (icon + stack number per active status, shell/frozen chips from gimmick state); `<ComboMeter combo={number} />` (renders nothing at 0, tier styling at 3/6/10); `MoveCard` gets prop `frozen?: boolean` and shows the element/kind sprite instead of `move.emoji`.
- Battle: enemy shown via `<PixelSprite sprite={spriteFor(e.defId)} scale={…}>` with a 2-frame idle (CSS-toggled `bobSprite` canvas), hit flash via `flashSprite` for 120 ms on `enemyHit`; intent bubble uses `effectiveIntent` (cancelled intent shows "✖"); matchup pills use `ELEMENT_ICON`; both keyboard layouts keep their current heights.

- [ ] **Step 1: Write failing tests**: `StatusChips` renders one chip per active status with its count and none when all are 0; `ComboMeter` renders nothing for 0 and a `tier-2` class for 6; `MoveCard` with `frozen` has class `is-frozen` and an element sprite canvas for an attack.
- [ ] **Step 2: Run** `npx vitest run src/components/battle-ui.test.tsx` — expect FAIL.
- [ ] **Step 3: Implement** the components and wire `Battle.tsx`/CSS; keep `.enemy-emoji` sizing logic for the canvas (`clamp(64px, 18dvh, 110px)` equivalent via integer scale).
- [ ] **Step 4: Run** `npm test` and `npm run build` — expect PASS, then take a Playwright screenshot of a fight at phone width (390×844) in both keyboard layouts and check nothing overlaps.
- [ ] **Step 5: Commit** `feat: pixel art battle UI with statuses and combo`.

### Task 13: Cast animations, hit-stop and death

**Files:** Create `src/components/CastFx.tsx`; Modify `src/screens/Battle.tsx`, `src/styles.css`.

**Interfaces:** `<CastFx fx={Fx[]} />` renders one effect per fresh `enemyHit`/`status`/`react` fx using `CAST_SPRITE[fx.element]` with a per-element CSS animation: fire = burst scales up with flicker, water = splash arcs down, wind = three diagonal slashes, thunder = bolt drop + 80 ms full-screen white flash, physical = slash streak. Shake amplitude and hit-stop duration scale with `fx.amount` (cap ~12 px / ~110 ms); hit-stop is a CSS freeze on the enemy sprite only (never a timer that delays game logic). `react` fx show a big label ("Shock!", "Steam!"). On `outcome === 'won'` the enemy sprite plays a dissolve for ~800 ms (inside the existing 900 ms end-of-battle delay). All of it is wrapped in `@media (prefers-reduced-motion: reduce)` fallbacks to a simple flash.

- [ ] **Step 1: Write failing test** (`battle-ui.test.tsx`): `CastFx` with an `enemyHit` fx of `element: 'thunder'` renders an element with class `cast-thunder`; with no fx renders nothing.
- [ ] **Step 2: Run** `npx vitest run src/components/battle-ui.test.tsx` — expect FAIL.
- [ ] **Step 3: Implement** `CastFx`, keyframes and the won-state dissolve.
- [ ] **Step 4: Run** `npm test` and `npm run build`; capture Playwright frame sequences of one cast per element and check each is visibly different; check reduced motion via `page.emulateMedia({ reducedMotion: 'reduce' })`.
- [ ] **Step 5: Commit** `feat: per-element cast animations and death effect`.

### Task 14: Sound

**Files:** Modify `src/game/sfx.ts`, `src/screens/Battle.tsx`, `src/game/sfx.test.ts`.

**Interfaces:** `Sfx` gains `'castFire' | 'castWater' | 'castWind' | 'castThunder' | 'castPhysical' | 'comboUp' | 'react'`; `export function castSfx(element: Element | undefined): Sfx`. Battle maps `enemyHit` fx with an element to `castSfx(element)` instead of the generic `hit`, and a `combo` fx to `comboUp`.

- [ ] **Step 1: Write failing test**: `castSfx('fire') === 'castFire'`, `castSfx(undefined) === 'castPhysical'`.
- [ ] **Step 2: Run** `npx vitest run src/game/sfx.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** the new tones with the existing synth helper (rising pitch for `comboUp`).
- [ ] **Step 4: Run** `npm test` — expect PASS.
- [ ] **Step 5: Commit** `feat: element cast sounds and combo tone`.

### Task 15: Docs and final verification

**Files:** Modify `PLAN.md`, `README.md`.

- [ ] **Step 1:** Update `PLAN.md` §1 with combo tiers, statuses/reactions table, gimmick list, phases, and a new "Art" section (sprite sizes, how to add an enemy sprite, `npm run sprites`); note `README.md` develop commands.
- [ ] **Step 2: Run** `npm run typecheck && npm test && npm run build && npm run sim` — expect all green, sim targets met.
- [ ] **Step 3:** Play a full run in Playwright (phone viewport): verify each of the 14 enemies shows its own sprite, every element animates differently, a soak→thunder shock stuns, and a saved mid-fight run reloads.
- [ ] **Step 4: Commit** `docs: combo, statuses, gimmicks and art`.
