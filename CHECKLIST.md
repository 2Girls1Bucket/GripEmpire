# Implementation & acceptance checklist

How each item was verified:
- **U** = unit test (`npm test`)
- **B** = automated browser check (`npm run check:browser`, headless Chrome against the production build)
- **S** = balance sim (`npm run sim`)
- **V** = screenshot inspected by eye

## Systems
- [x] Shop: 9 categories, contracts, levels, milestones (self/global/sale), distinct named perks, visual shelf additions (U, V)
- [x] Shop upgrades: staff/automation, marketing, displays, margins, checkout, online store (U, B)
- [x] Buy ×1 / ×10 / Max / Next milestone, with a "+$/s" preview before buying (U, V)
- [x] Manual sales scale with the shop; 5/s cap; hold-to-serve; keyboard (Space/S/Enter) (U, B)
- [x] Opportunities: customer rush, bulk order, board-building order (U)
- [x] 12 skaters with portraits, specialties, bonuses, training and milestones; recruit / release / replace (U, V)
- [x] Assignments: demo, 4 contests (deterministic placement), 4 tours; repeat via Team Manager (U)
- [x] Filming projects (6 tiers), automated footage, release with royalties, audience fatigue, Producer automation (U)
- [x] Film a Line minigame: success, imperfect landings, bails, hammer/bank, replay, touch buttons, keys, mute, reduced motion (U, B, V)
- [x] Hosted events (6 tiers): demand vs capacity, vendors, sponsors, broadcast, headliner, optional crowd moments, auto-host (U, V)
- [x] Brand (L1): lines, focus choice, signature skaters (B renders, V)
- [x] Skatepark (L2): facilities with cross-system perks, admission, lessons, memberships (B renders)
- [x] Distribution (L3): regions, slots, logistics, fulfillment (B renders, V)
- [x] Manufacturing (L4): capacity allocation (B renders, V)
- [x] Empire HQ capstone (L5): five permanent phases, completion screen, endless Reputation (S reaches it)
- [x] Legacy: preview, accomplishments, next threshold, explicit resets/keeps, Founding Skater choice, unlock roadmap (U, V)
- [x] Legacy tree: 20 nodes in 7 branches (U)
- [x] Achievements (36, +1% each), lifetime and run stats (B renders)
- [x] District map with clickable buildings and lock requirements (V)
- [x] Contextual tutorial: next-goal bar plus dismissable tip cards per location (V)
- [x] Settings: volume/mute, motion, number notation, floaters, replay tips (V)

## Acceptance checks
- [x] A fresh save progresses from bushings to the first Legacy (S: every profile; B: fresh game flow)
- [x] Manual play stays financially relevant after automation (S: mixed bot has manual at 31–58% of income; U: bounded 1.5–5× band)
- [x] Every advertised system works once unlocked (B: saves at L1–L5 render every location with no errors; S: bots use every system)
- [x] Recruiting, training, assigning and replacing skaters (U)
- [x] Minigame success / imperfect / bail / replay (U for logic; B played twice in the real page via key events)
- [x] Rewards can't be duplicated by navigation or reload (U: attempt id, opportunities are transient and cleared on load; B: no double apply on re-render)
- [x] First Legacy resets and keeps exactly what the preview lists (U)
- [x] Later Legacies unlock real functionality (U: L1 scouts; B: L1–L5 locations)
- [x] Offline progress respects rate and cap (U; B shows the summary after 3h away)
- [x] Save reload, export/import, invalid import, migration, backup fallback (U; B: reload and invalid import via the UI)
- [x] Multiple tabs don't corrupt progress (B: the second tab pauses; take-over pauses the first)
- [x] Bulk buying can't overspend (U: 2,000 randomized cases)
- [x] Backgrounded browser doesn't break timers (U: elapsed-time ticks; B: a 120s gap earns ~120s of income; clock-backwards stays valid)
- [x] Layout works at desktop (1366) and narrow mobile (390) widths without horizontal scroll (B, V)
- [x] Production build succeeds (`npm run build`)

## Not done / partial
- Pure-idle balance in Legacy 3–5 is slower than intended (see DESIGN.md).
- Sound is a small set of synthesized effects; there's no music.
- The browser check script needs Google Chrome installed. Headless Edge failed to launch in this environment.
