# Grip Empire

A browser incremental game about growing a tiny skate shop that only sells bushings into a skateboarding empire, with skaters, videos, tours, events, your own brand, skateparks, distribution, manufacturing and a five-phase capstone.

You don't need an account, a server or any API keys. Everything runs in the browser, and saves stay in that browser's local storage.

## Quick start

```bash
npm install
npm run dev        # dev server at http://localhost:5173 (includes the dev-only debug panel)
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build at http://localhost:4173
```

Needs Node 18+ (built and tested on Node 24).

## How to play

- **Serve customers.** Click **SERVE**, or hold **Space** / **S**. Holding works exactly as well as clicking: sales are capped at 5 per second either way.
- **Buy stock levels and sign supplier contracts**, in this order: bushings → bearings → grip → wheels → trucks → decks → completes → shoes → apparel. Every 25/50/100… levels a category hits a milestone that multiplies its income. Some milestones also boost every product.
- **Hire staff** under Shop Upgrades to turn on automated income.
- **Team HQ.** Sign skaters. Their bonus applies all the time, even while they're out on a demo, contest or tour. Train them with cash.
- **Skate Spot.** Fund filming projects and give them a crew; footage builds automatically. Playing **Film a Line** adds footage faster and raises video quality. Released videos pay royalties for the rest of the run.
- **Event Venue.** Host jams and contests that pay out every cycle. Attendance is the lower of demand and capacity.
- **Legacy (Hall of Fame).** Reset the run for **Cred**, which you spend on a permanent upgrade tree. Each Legacy opens a new system: your brand, then skateparks, distribution, manufacturing, and finally Empire HQ.
- **Offline.** While the game is closed, automated income keeps running at a reduced rate (30% at first, up to an 8h cap). Both the rate and the cap can be upgraded.

Film a Line controls: **Z / X / C** (or ← ↑ →) pop an easy / medium / hard trick when the green POP zone reaches your skater. Press **Space** when the shrinking ring meets the target to land. At the end, press **B** to bank the line or **H** to try the hammer. Touch buttons are on screen.

Other keys: **M** toggles mute and **Esc** closes dialogs. Everything can be reached with Tab.

## Sharing with friends (static hosting)

`npm run build` produces a fully static `dist/` folder with relative paths, so it works from any URL or sub-folder. Some free options:

- **Netlify Drop**: drag the `dist/` folder onto https://app.netlify.com/drop and you get a share link.
- **GitHub Pages**: push the repo, then publish `dist/` with an action such as `actions/deploy-pages`, or commit it to a `gh-pages` branch.
- **itch.io**: zip the *contents* of `dist/` (with `index.html` at the zip root) and upload it as an HTML game.
- **Cloudflare Pages / Vercel**: use build command `npm run build` and output directory `dist`.

Each friend's progress is saved in their own browser. **Settings → Export save** creates a backup code or file, and **Import** restores it in another browser.

Nothing has been published anywhere; publishing is up to you.

## Changing the title

Change `GAME_TITLE` in `src/game/config.ts` and the `<title>` in `index.html`.

## Tests and tools

```bash
npm test                 # 50 unit tests: economy, bulk buying, actions, legacy, saves, offline, minigame
npm run sim -- mixed 6   # headless balance sim (profiles: active | mixed | idle; N legacies)
npm run saves            # writes sample saves at several progression points to .verify/
npm run check:browser    # browser checks against `npm run preview` (needs Chrome installed)
```

## Docs

- [DESIGN.md](DESIGN.md): design, formulas, stacking rules, balance notes and simulation results
- [CHECKLIST.md](CHECKLIST.md): implementation and acceptance checklist, with how each item was verified
- [HANDOFF.md](HANDOFF.md): current status, project layout, commands, known limitations
