# Turn Timer, Phone Fit & Lingering FX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 6 s per-turn timer whose expiry (and an empty ⏎) is punished as a typo, make the battle screen fit phones without scrolling, and stop attack effects lingering after their animation ends.

**Architecture:** `confirmTurn` stays pure and gains a `timedOut` option; a small `TurnTimer` component in `Battle.tsx` owns the countdown and calls `onTimeout` (wired in `App.tsx` next to `onConfirm`). Effects get per-kind lifetimes instead of one shared 1100 ms. Phone fit is CSS-only, verified with Playwright screenshots.

**Tech Stack:** React + TypeScript (strict), Vitest, plain CSS in `src/styles.css`, Playwright (pre-installed) for viewport checks.

**Spec:** `docs/superpowers/specs/2026-11-22-turn-timer-design.md` (phone fit and lingering fx were added by the user afterwards; no spec section, scoped in Tasks 3–4).

## Global Constraints

- Turn limit is `CONFIG.combat.turnTimeMs = 6000`; update `PLAN.md` in the same commit (RULES.md Architecture #2).
- No timers/DOM in `src/game/` (RULES #3); randomness untouched.
- Timeout and empty ⏎ = typo path: `CONFIG.combat.wrongHpCost` HP, combo → 0, `stats.wrong` +1, Omamori absorbs once, SRS miss on the guessed target kana.
- Typed text at expiry is discarded even if correct. Texts: timeout `"Time's up!"`, empty ⏎ `"You froze up!"`.
- Mobile rules: no tap target < 48 px except keyboard keys ≥ 40 px tall; animations ≤ 400 ms and `prefers-reduced-motion` honoured; no hard-coded colours (use tokens); no horizontal scroll.
- Test viewports: 320×568, 360×640, 390×844 (portrait).
- One commit per task; message ends with the Co-Authored-By / Claude-Session lines from the session attribution reminder.

## Review Focus

- Timer must not tick during `pending` beats, after `won`/`lost`, or with the menu open (`onMenu`): test remaining time is unchanged across a pause.
- Backgrounded tab: returning must not fire a stale timeout instantly after a long absence — remaining time is preserved while hidden.
- Double resolution: pressing ⏎ in the same tick the timer fires must resolve the turn once (guard on `battle.pending`).
- Timeout at 1 HP kills the player (`outcome: 'lost'`) exactly like a typo.
- Reduced motion: bar and seconds text remain readable with animation disabled.

---

### Task 1: Pure timeout / empty-⏎ fizzle

**Files:**
- Modify: `src/config.ts` (add `combat.turnTimeMs: 6000`), `src/game/battle.ts` (`confirmTurn`, ~line 513), `PLAN.md`
- Modify tests: `src/game/battle.test.ts`, `src/game/balance.test.ts`, `src/game/balance.fast.test.ts`, `src/game/sim.ts` (anything relying on empty ⏎ being free — find with `grep -rn "held back\|setTyped(.*''" src`)
- Test: `src/game/battle.test.ts`

**Interfaces:**
- Produces: `confirmTurn(b: BattleState, opts?: { timedOut?: boolean }): PlayResult`; `CONFIG.combat.turnTimeMs: number`.

- [ ] **Step 1: Write failing tests** in `battle.test.ts` (use the existing `battle()` / `typeFor` helpers):
  - `empty enter is a fizzle`: `confirmTurn(battle([...]))` → `playerHp === H - CONFIG.combat.wrongHpCost`, `combo === 0`, `stats.wrong === 1`, `lastResult.text === 'You froze up!'`, `pending === 'enemy'`.
  - `timeout discards a correct typed answer`: `typeFor(...)` then `confirmTurn(b, { timedOut: true })` → HP lost, no damage to enemy, `lastResult.text === "Time's up!"`.
  - `timeout resets combo and is absorbed by omamori once` (second timeout in same battle costs HP).
  - `timeout at 1 HP loses`: `outcome === 'lost'`.
  - `timeout guesses the aimed kana`: with a near-miss typed string, `answers` contains `{ correct: false }` for that kana; with nothing typed, `answers` is empty.
- [ ] **Step 2: Run** `npx vitest run src/game/battle.test.ts` → new tests FAIL.
- [ ] **Step 3: Implement**: add the config value; in `confirmTurn`, route `!typed` and `opts.timedOut` into the existing typo branch (extract the fizzle/omamori/HP/lost block into a local helper so there is one copy), with the texts above and the target-guess only when something was typed and not timed out… *except* on timeout with partial text, which still guesses the target and records the SRS miss.
- [ ] **Step 4: Fix existing tests and `sim.ts`** that assumed a free skip (sim should type a reading instead of skipping). Run `npm test` → all PASS.
- [ ] **Step 5: Update `PLAN.md`** (config table + combat rules: timer and "no free skip"). Commit: `feat: timeout and empty enter fizzle`.

### Task 2: Timer meter in the battle screen

**Files:**
- Create: `src/components/TurnTimer.tsx`, `src/components/TurnTimer.test.tsx`
- Modify: `src/screens/Battle.tsx`, `src/App.tsx` (add `onTimeout`), `src/styles.css`

**Interfaces:**
- Consumes: `confirmTurn(b, { timedOut: true })`, `CONFIG.combat.turnTimeMs`.
- Produces: `TurnTimer({ turnKey: string; running: boolean; durationMs: number; onExpire: () => void })` — `turnKey` change (use `` `${battle.turn}` ``) restarts at full; `running=false` freezes remaining time. `Battle` gains prop `onTimeout: () => void`.

- [ ] **Step 1: Write failing tests** (`TurnTimer.test.tsx`, Vitest fake timers):
  - fires `onExpire` exactly once after `durationMs` of running time;
  - `running=false` for 10 s then `true` still needs the full remaining time;
  - changing `turnKey` resets to full;
  - hidden document (`visibilitychange`) pauses; no expiry while hidden;
  - renders `role="progressbar"` with `aria-valuenow` and visible text like `4s`.
- [ ] **Step 2: Run** `npx vitest run src/components/TurnTimer.test.tsx` → FAIL.
- [ ] **Step 3: Implement `TurnTimer`** with `requestAnimationFrame`/`setInterval(100)` accumulating elapsed running time (not wall-clock deadline) so pauses and hidden tabs preserve remaining time. Bar width from remaining ratio; under 2 s turns red via `var(--red)`. Place under `<ComboMeter>` in `Battle.tsx`; `running = ongoing && !battle.pending && !menuOpen`. Pass `menuOpen` from the existing menu state in `App.tsx` (add a prop if none exists).
- [ ] **Step 4: Wire `onTimeout` in `App.tsx`** mirroring `onConfirm` (guard on `run.battle.pending`/`outcome`, `playSfx('wrong')`, `recordSrs`, `noteAnswers`) using `confirmTurn(run.battle, { timedOut: true })`.
- [ ] **Step 5: CSS**: `.turn-timer` bar uses existing tokens, ≤ 400 ms transitions; under `prefers-reduced-motion` no width transition (text still counts down).
- [ ] **Step 6: Run** `npm test && npm run build` → PASS. Commit: `feat: 6s turn timer meter`.

### Task 3: Effects no longer linger

**Files:**
- Modify: `src/screens/Battle.tsx` (`FX_MS`, fx cleanup ~line 28–55), `src/components/CastFx.tsx`, `src/components/EnemySprite.tsx`, `src/styles.css` (~786–854)
- Test: `src/components/battle-ui.test.tsx`

**Interfaces:**
- Produces: `FX_LIFETIME_MS: Record<Fx['kind'], number>` exported from `src/components/CastFx.tsx` (cast sprites match their CSS: fire 700, water 650, wind 520, thunder 520, physical 380; status pop 900; floating text 1000).

- [ ] **Step 1: Reproduce** with Playwright against `npm run dev`: cast each element, record from screenshots/`getAnimations()` how long `.cast`, `.frame-flash`, `.status-pop` and `.fx` stay mounted vs. their animation end; write the findings into the commit message. Suspected cause: all fx (including the `enemyHit` flag that keeps `.is-hit` and the white `frame-flash` overlay mounted) live a flat `FX_MS = 1100` ms, longer than every animation.
- [ ] **Step 2: Write failing test** in `battle-ui.test.tsx`: with fake timers, after an `enemyHit` fx the `.cast` node is gone at its element's lifetime (e.g. physical at 380 ms + small slack) and `.is-hit` is gone by the hit-shake length (`--stop` + 320 ms), not 1100 ms.
- [ ] **Step 3: Implement**: replace the single `setTimeout(…, FX_MS)` with per-fx expiry using `FX_LIFETIME_MS`; ensure each element's `animation-fill-mode` ends invisible (`forwards` to opacity 0) so nothing sits on screen between animation end and unmount; trim `enemyHit` flag lifetime to hit-shake length.
- [ ] **Step 4: Verify** in Playwright that nothing from a cast remains visible after its animation; run `npm test` → PASS. Commit: `fix: attack effects clear when their animation ends`.

### Task 4: Battle fits the phone

**Files:**
- Modify: `src/styles.css` (battle rules ~133–160, 333–391, 429–466; phone layout 468–552), `src/screens/Battle.tsx` (`scale` choice)
- Create: `scripts/battle-fit.mjs` (Playwright check, not part of `npm test`)

- [ ] **Step 1: Write `scripts/battle-fit.mjs`**: for each of 320×568, 360×640, 390×844 and both keyboard modes (game / phone), start a battle (use the dev server and the title → new run flow), assert `.battle.scrollHeight <= .battle.clientHeight` and `document.documentElement.scrollWidth <= innerWidth`, and save screenshots to the scratchpad. Run it first to record the current failures.
- [ ] **Step 2: Scale the layout down** until every viewport passes: smaller enemy sprite scale on short screens (adjust `scale` in `Battle.tsx`), tighter gaps/paddings via `@media (max-height: …)`, compact `.kbd-dock` and keyboard key height (keys stay ≥ 40 px tall; End Turn stays ≥ 48 px), timer bar slim (~6 px) with the seconds text inline in the combo row. Keep tokens, no new hard-coded colours.
- [ ] **Step 3: Re-run** `node scripts/battle-fit.mjs` → all viewports pass; eyeball screenshots (kana ≥ 40 px on cards, nothing clipped, timer visible). Run `npm test && npm run build`.
- [ ] **Step 4: Commit**: `fix: battle screen fits phone viewports`; push the branch.
