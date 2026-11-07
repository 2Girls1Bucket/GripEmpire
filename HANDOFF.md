# Handoff

## Status (2026-11-07)
The game is complete and playable from a fresh start through the capstone and into endless play. The production build passes, 50 unit tests pass, 29 headless-Chrome browser checks pass, and the balance sims run for three player profiles. Nothing has been published.

## Commands
```bash
npm install
npm run dev            # http://localhost:5173 (dev panel bottom-left: cash, time warp, Cred, away-3h)
npm run build          # tsc + vite build → dist/
npm run preview        # http://localhost:4173
npm test               # vitest
npm run sim -- mixed 6 # balance sim (active|mixed|idle, legacies, --verbose, --max=MIN)
npm run saves          # sample saves → .verify/*.json (used by browser checks)
npm run check:browser  # needs `npm run preview` running and Google Chrome installed
```

## Layout
```
src/game/            pure game logic (no DOM): shared by the UI, the tests and the sim
  config.ts          title, keys, caps, offline baseline
  content/           data only: products, tracks (all run upgrades), skaters, activities (jobs/videos/events),
                     business (brand/park/distro/factory/HQ), legacy tree + unlock schedule, achievements + goals
  economy.ts         computeDerived(): the single income pipeline + cost and estimate helpers
  actions.ts         every player action (all spending goes through spend())
  tick.ts            time advancement, periodic checks, simulateOffline()
  prestige.ts        Legacy formula / preview / reset, tree purchases, run accomplishments
  save.ts            migrate → validate → sanitize, backup, export/import
  unlocks.ts         location/product/track/skater availability
src/platform/        engine.ts (wall-clock loop, saves, tab lock), settings.ts, audio.ts (WebAudio synth)
src/ui/              React screens (App, Shop, Team, Spot, Venue, Workshop, Late, Legacy, Settings, District, Debug)
src/minigame/        line.ts (pure logic) + FilmALine.tsx (canvas renderer and controls)
sim/                 player.ts (bot strategies), simulate.ts (report)
tests/               vitest suites
scripts/             make-save.ts, browser-check.ts
```

## Where to tune
- Pacing of run 1: product numbers in `content/products.ts`; shop tracks in `content/tracks.ts`.
- Legacy rewards: `CRED_DIVISOR`, `CRED_EXPONENT`, `MIN_LEGACY_CRED` and `CRED_INCOME_BONUS` in `content/legacy.ts`.
- Active vs idle: `SALE_SEC` in `economy.ts`, the checkout track, and the Silver Tongue node.
- Late-content costs: `content/business.ts` and the park/distro/factory tracks.
- After any change, run `npm run sim -- mixed 6` and `npm test`. The test "manual sales stay within a bounded multiple" guards the active/idle balance.

## Known limitations
- Pure-idle progression slows around Legacy 3–5. The idle bot needs about 7h and doesn't reach the capstone within 7 runs; mixed play takes about 4.5h.
- Sim times are optimistic. A human first Legacy is probably 40–60 minutes; this was not measured with real players.
- Headless Edge would not launch here, so browser checks use Chrome (`BROWSER_CHANNEL=msedge` to try Edge).
- `window.__grip` (engine) and `window.__line` (minigame state) are exposed for the automated browser checks. They are harmless in a single-player game, but would let a curious player edit their own save from the console.
- Hosted at https://2girls1bucket.github.io/GripEmpire/ (repo `2Girls1Bucket/GripEmpire`, public). Every push to `main` runs tests, builds and redeploys via `.github/workflows/deploy.yml`. Commits in this repo use the GitHub noreply email (set in the repo's local git config only).

## Ideas if continuing
- Idle-friendly tree nodes or late-system cost tuning for pure-idle players.
- More Film a Line spots and obstacle types; a per-skater trick list.
- Music loop (synth), more shop scene animation, seasonal events.
