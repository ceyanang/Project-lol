# Kana-Slayer ⚔️か

A mobile-first, offline PWA deckbuilder roguelike that teaches **hiragana and katakana**.
Your deck is moves; each turn they're labelled with romaji and you cast one by tapping the matching kana. Kana you miss come back 3× as often.

- Design spec: [`PLAN.md`](PLAN.md) · Coding & mobile rules: [`RULES.md`](RULES.md)
- Game data: [`data/`](data) (kana, vocab, enemies, relics) · Tunables: [`src/config.ts`](src/config.ts)

## Develop

```bash
npm install
npm run dev        # http://localhost:5173, also on your LAN (--host) for phone testing
npm test           # vitest: SRS, combat, map, storage
npm run sim        # balance sim: turns, HP lost, death rate per enemy → balance-report.txt
npm run build      # type-check + production build with service worker
npm run preview    # serve the production build (needed to test offline/PWA)
```

To try it on a phone on the same Wi-Fi: `npm run build && npm run preview`, then open
`http://<your-computer-ip>:4173`. (Service workers need HTTPS or localhost to install, so for the
real "Add to Home Screen" offline test use the GitHub Pages deploy below.)

## Deploy (GitHub Pages)

1. Merge to `main` (the workflow in `.github/workflows/deploy.yml` runs on every push to `main`,
   or run it manually from the Actions tab).
2. One-time: repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The site appears at `https://<user>.github.io/<repo>/`.

## Offline check on a phone

1. Open the Pages URL on Wi-Fi and wait a few seconds (the service worker precaches everything).
2. **iPhone (Safari):** Share → *Add to Home Screen*. **Android (Chrome):** ⋮ → *Install app* / *Add to Home screen*.
3. Turn on airplane mode / Wi-Fi off.
4. Launch from the home-screen icon → the title screen loads, runs and the Kana Library work.
5. Speech offline needs an **on-device** Japanese voice (iOS: Settings › Accessibility › Spoken Content › Voices › Japanese).
