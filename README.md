# Kana-Slayer ⚔️か

A mobile-first, offline PWA deckbuilder roguelike that teaches **hiragana and katakana**.
Your deck is moves; each turn they're labelled with kana and you cast one by typing its romaji on an in-game keyboard. Kana you miss come back 3× as often.

- Design spec: [`PLAN.md`](PLAN.md) · Coding & mobile rules: [`RULES.md`](RULES.md)
- Game data: [`data/`](data) (kana, vocab, enemies, relics) · Tunables: [`src/config.ts`](src/config.ts)

## Develop

```bash
npm install
npm run dev        # http://localhost:5173, also on your LAN (--host) for phone testing
npm test           # vitest: SRS, combat, statuses, gimmicks, art, map, storage
npm run sprites    # writes sprite-sheet.png + enemy-sheet.png to look at the pixel art
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

## Voice clips

Kana are read aloud from bundled recordings (`public/audio/<reading>.mp3`, Kuon via ElevenLabs v4; one
file per reading, shared by hiragana and katakana, 69 in total). If a file is missing the game uses the
device's Japanese voice. To (re)download the recordings on a machine with normal internet:

```bash
node scripts/fetch-voice.mjs     # Node 18+, writes public/audio/*.mp3, then commit them
```

The links live in `scripts/voice-urls.json` (job ids in `scripts/voice-jobs.json`).
