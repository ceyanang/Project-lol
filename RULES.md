# Kana-Slayer — Coding & Mobile Rules

Follow these in every change.

## Architecture
1. **Data is not code.** Kana, words, enemies and relics live in `data/*.json`. Logic never hard-codes a kana, enemy or relic list.
2. **Every tunable number lives in `src/config.ts`** (`CONFIG`). If you change one, update `PLAN.md`.
3. **Game logic is pure TypeScript** in `src/game/` — no React, no DOM, no `localStorage`. Functions take state and return new state (no mutation of inputs). Randomness goes through `src/game/rng.ts` so it can be seeded in tests.
4. **Side effects live at the edges**: `src/game/storage.ts` (localStorage), `src/game/speech.ts` (speechSynthesis). React components call them; game logic doesn't.
5. **UI** is in `src/screens/` (one file per screen) and `src/components/` (reusable bits). Screens get state + callbacks via props; `App.tsx` owns state.
6. Every `localStorage` read is wrapped in try/catch and validated; a bad save must never brick the app — fall back to a fresh profile.
7. Saved shapes carry a `version` field. Bump the key suffix (`.v2`) on breaking changes.
8. TypeScript `strict` on. No `any` unless commented why.
9. Unit tests (`*.test.ts`, Vitest) for SRS math, draw weighting, combat resolution and map generation. `npm test` must pass before committing.

## Mobile viewport rules
1. Portrait first. Design at **360×640** and check **390×844**; must not break at 320 wide. On wider screens the game is a centred column, `max-width: 480px`.
2. Viewport meta: `width=device-width, initial-scale=1, viewport-fit=cover`. Do **not** disable zoom with `user-scalable=no`; prevent accidental double-tap zoom with `touch-action: manipulation` instead.
3. Use `100dvh` (with `100vh` fallback) for full-height screens, never fixed pixel heights.
4. Respect notches: pad the app shell with `env(safe-area-inset-*)`.
5. **Tap targets ≥ 48×48 px** with ≥ 8 px between them. Primary actions (End Turn) sit in the bottom third, the thumb zone. Exception: the in-game QWERTY keyboard uses phone-keyboard-sized keys (≥ 40 px tall, full row width).
6. **Typing goes through `ReadingInput`.** By default that's the in-game keyboard (`src/components/Keyboard.tsx`), which never opens the OS keyboard; a physical keyboard is listened to via keydown. The one native `<input>` is the opt-in **📱 Phone keyboard** setting, and it must keep `autocomplete/autocorrect="off"`, `autocapitalize="none"`, `spellcheck=false`, font-size ≥ 16 px (or iOS zooms), and `enterkeyhint="go"`. Phone mode must never react to the keyboard opening (no visualViewport resizing, no focus-dependent layout): it uses a static top-half layout (`.layout-phone`, `.sheet-top`) that keeps the moves and the typed field above the keyboard on screens down to iPhone SE size.
7. No hover-only affordances. Every interaction works with a single tap; no long-press-only actions, no drag-only actions.
8. Base font size ≥ 16 px; kana on cards ≥ 40 px. Fonts are bundled subsets in `src/fonts/` (Yuji Syuku brush for kana, Shippori Mincho for headings; SIL OFL), precached by the service worker, never fetched from a CDN. Body/UI text uses the system font stack.
9. Disable text selection and the iOS tap highlight on game UI (`user-select: none; -webkit-tap-highlight-color: transparent`).
10. No horizontal scrolling. Lists scroll vertically inside their screen.
11. Colour is never the only signal: mastery levels also show a label/icon.
12. Animations ≤ 400 ms and honour `prefers-reduced-motion`.

## Visual identity (ink & paper)
1. Washi paper (`--bg`), sumi ink (`--ink`), shu seal red (`--red`), ai indigo (`--blue`), kin gold (`--gold`), moss (`--green`). Tokens live in `:root` in `src/styles.css`; don't hard-code colors.
2. The kana are the star: brushed (`--brush`) on paper slips. Keep everything around them quiet: ink lines, flat paper, no gradients or glows.
3. Red seal stamps are for things that matter (weakness, the logo); don't sprinkle them.
4. Buttons are flat print blocks with a hard ink offset; sentence-case labels, no emoji on primary menu buttons.

## Offline / PWA rules
1. Everything the game needs is bundled and precached by the service worker (`vite-plugin-pwa`, Workbox `generateSW`). No CDN links, no runtime fetches.
2. JSON data is imported at build time (bundled into JS), not fetched.
3. Any new asset type must be added to `workbox.globPatterns` in `vite.config.ts`.
4. Use relative-safe paths: the app is served from a sub-path on GitHub Pages (`BASE_PATH`).

## Git
- One commit per build step, message starts with `Step N:`.
- Never commit `dist/` or `node_modules/`.
