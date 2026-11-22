# Turn timer — design (short)

## Intent
Players must genuinely *know* the kana, not stare at them. Each player turn has a 6 s meter; if no valid move is cast before it empties, the player is punished exactly like a mistype.

## Goals
- 6 s countdown per player turn, shown as a draining bar.
- Timeout = fizzle: `wrongHpCost` HP lost (Omamori still saves once), combo reset, `stats.wrong` +1.
- Empty ⏎ is also a fizzle (no free skip) — decided with the user.

## Non-goals / anti-goals
- No timer in Study drills, quiz or map (battle only).
- No free dodge: neither empty ⏎ nor spamming ⏎ may avoid the penalty.
- No timers or DOM in `src/game/` (RULES.md #3).

## Constraints
- Tunable lives in `CONFIG.combat.turnTimeMs = 6000`; update `PLAN.md`.
- Honour `prefers-reduced-motion` (bar steps/no animation; still readable). Colour not the only signal: show seconds left as text.
- Mobile rules unchanged (bar sits near the combo meter; no new tap targets).

## Approaches
1. **Timer in `Battle.tsx`, pure `confirmTurn` extended** (chosen): a `deadline` set when a turn is dealt; the screen runs the countdown and, on expiry, calls `confirmTurn(b, { timedOut: true })`. Keeps logic pure and testable; mirrors how `App.tsx` already drives beats.
2. Timer inside game state ticked by `App.tsx`: re-renders every frame through app state — heavier, no benefit.
3. CSS-animation-only timer: can't drive the penalty reliably (tab throttling).

Chosen: 1. A timed-out turn reuses the typo branch of `confirmTurn` (target guess, SRS miss, fizzle fx) with text "Time's up!". Typed text at expiry is discarded, even if correct.

## Behaviour
- Countdown starts when dealing finishes (`pending` becomes null) and stops while `pending`, outcome ≠ ongoing, menu open, or tab hidden (resumes with remaining time).
- Casting a valid move or any ⏎ resolves the turn and stops the meter; next deal restarts at full.
- Empty ⏎ → fizzle with text "You froze up!" (replaces "held back").

## Left to the builder
Exact bar styling/colour ramp near expiry, SFX on timeout (reuse `miss`), test layout. Existing tests that rely on empty ⏎ being free (`battle.test.ts`, `balance*.test.ts`, `sim.ts`) get updated.
