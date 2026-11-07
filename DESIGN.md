# Grip Empire — Design & Balance

Working title: **Grip Empire**. To rename it, edit `src/game/config.ts` and `index.html`.

## Pillars
1. **The shop is the spine.** Every secondary system pays in *seconds of shop base income*, so the shop never stops mattering.
2. **Frequent purchases early, meaningful choices later.** Early on you get product levels and milestones every few seconds; later you allocate team, brand focus, distribution slots and factory capacity.
3. **Active play pays, but has limits.** Manual selling, opportunities, crowd moments and Film a Line together give roughly 2–4× unattended income. Everything active is rate-capped or time-boxed.
4. **Each Legacy adds a new system**, not only bigger prices.

## Run structure and unlocks

| When | New |
|---|---|
| Run 1 | Shop (9 categories in sequence), Team HQ at $3K run earnings, Skate Spot at $6K, Event Venue at $20K, 6 scoutable skaters (3 at start, 1 at 2 team members, 1 at $400K) |
| Legacy 1 | Workshop (brand lines, focus, signature skaters), Pro Open contest, Regional Contest event, Brand Video, 3 more skaters |
| Legacy 2 | Skatepark (6 facilities with cross-system perks, admission, lessons, memberships), +1 team slot (6 max), 2 skaters, Shop Manager & Producer automation |
| Legacy 3 | Warehouse (distribution slots and regions), National and World tours, Feature Documentary, 1 skater, Founding Skater carryover |
| Legacy 4 | Factory (allocate capacity points to brand lines), National Championship & World Finals, World Championship contest, 1 skater |
| Legacy 5 | Empire HQ: five-phase capstone. Phase progress is permanent across Legacies. Finishing it = "main progression complete"; play then continues endlessly via the Reputation node |

Unlocks grant *availability*. Every run you still invest again (contracts, facilities, regions and so on).

## Core economy pipeline (`src/game/economy.ts`)

All income is computed in one function, `computeDerived(state)`. Stacking rules:
- Bonuses of the same kind **add** inside their bucket (for example, all skater "products" bonuses for a category). Separate buckets **multiply**.
- `shopBase` = Σ product income including permanent and run multipliers. It **excludes** staffing and **all temporary bonuses** (rush, streak, crowd hype).
- Secondary payouts (assignments, events, minigame, opportunities, royalties at release, park, brand) are expressed against `shopBase`. They never read their own totals, so there is no circular or self-referential income.
- Temporary multipliers are applied only at the moment of a manual or active reward.

```
globalMult  = credMult × 1.25^Reputation × (1 + 0.01×achievements) × 1.5^HQphases
credMult    = sqrt(1 + 0.1 × lifetimeCred)
fanMult     = (1 + fans/1000)^0.2
productMult[i] = milestoneSelf[i] × Π milestoneGlobal × marketing × displays × fanMult
               × (1 + skaterAll + skaterCategory[i]) × brandCat[i] × distro[i] × factoryCat[i]
               × merch(shoes/apparel) × 1.25^Loyal × annex
productIncome[i] = level[i] × baseIncome[i] × productMult[i] × globalMult
shopBase    = Σ productIncome
shopPassive = shopBase × staffFactor            (staffFactor = 0 with no staff, then 1.25^(L-1))
online      = shopPassive × (0.1×OnlineLv + 0.1×FulfillmentLv) × (1 + Ade bonus)
royalties   = Σ video.royaltyBase × (1 + Remy bonus)   (royaltyBase fixed at release)
brand[i]    = productIncome[i] × 0.03 × level × focus × signature × R&D × factory × distro
park        = shopBase × 0.00025 × visitors × admission × (1 + 0.25×lessons);  members = shopBase × 0.04 × lvl
passive     = shopPassive + online + royalties + brand + park + members
saleValue   = (1 + 0.12 × shopBase × max(1, staffFactor)) × checkout(1+0.15L) × milestoneSale × 1.12^SilverTongue
```

### Products

Costs: level L→L+1 = `baseCost × growth^(L-1) × costMult`. Contracts grant level 1.

| Category | Contract | Lvl-2 cost | Growth | $/s per level |
|---|---|---|---|---|
| Bushings | free | 5 | 1.16 | 0.6 |
| Bearings | 150 | 50 | 1.17 | 2.5 |
| Grip | 4K | 1.2K | 1.17 | 9 |
| Wheels | 100K | 30K | 1.18 | 32 |
| Trucks | 2.5M | 750K | 1.18 | 110 |
| Decks | 60M | 18M | 1.19 | 380 |
| Completes | 1.5B | 450M | 1.19 | 1.3K |
| Shoes | 40B | 12B | 1.20 | 4.5K |
| Apparel | 1T | 300B | 1.20 | 15K |

Each category costs about 25× the previous for about 3.5× the income per level. Milestones: ×2 at 25, 50, 150, 250; ×3 at 100, 200, 300, 400; ×4 at 500; ×3 every 100 to 1500. Each category's Lv25 also gives manual sales +10%, and Lv100 and Lv300 give **all products +10%**. That is why old categories stay worth levelling.

### Why these curves (the key balancing lesson)
Early prototypes blew up within minutes (e.g. $1e72 in 25 min). The cause was **total income elasticity above 1**: the sum, over every multiplicative upgrade source, of how much income grows per decade of cash spent. When that sum exceeds 1, growth is faster than exponential. The fixes:
- Shop tracks are exponential but mild (`marketing ×1.15 per ×7 cost`, `displays ×1.08 per ×8`, `staff ×1.25 per ×13`).
- **Secondary-system upgrades are linear** (venue, promotion, tours, camera, admission, logistics, R&D: `1 + k×L` against exponential cost). These systems stay relevant through tiers and through `shopBase`, not by compounding on their own.
- Event bonuses add up (vendors + sponsors + broadcast) instead of multiplying each other.
- Skater business bonuses scale with `√(training scale)`; stats scale with the full training scale.
- Video royalties apply **audience fatigue**: ×0.75 per earlier release of the same tier in the run, so the total is bounded.
- Cred bonus is `√(1 + 0.1·Cred)` rather than linear. Combined with Cred ∝ lifetime^0.3, the feedback exponent between runs is about 1, so growth per run is steady.

## Active play (bounded by design)
- **Serve cap: 5 per second**, enforced in game logic (`run.sinceServe`) so auto-clickers can't beat it. Holding Space/S or the button serves at exactly the cap, so mashing is never required.
- **Streak:** +2% per consecutive sale, max 20 (+2 per Checkout level, +10 per In The Zone level). Fades slowly after 2.5s idle.
- **Opportunities** (only while engaged: tab visible and input within 2 min), about every 90–150s:
  - Rush: ×3 sale value for 12s.
  - Bulk order: 25 sales in 35s pays 40s of shopBase; half pay pro-rata on timeout.
  - Board order (after wheels): pick wheels/trucks/bushings for a street, bowl or cruiser setup; pays 50s of shopBase × (0.4 + 0.2 per correct part).
- **Crowd moments** at events: +15% payout per hit, max +30% per cycle. Optional.
- **Film a Line:** pays `(0.1 + grade) × 40s` of shopBase plus footage worth `22% of the project × grade × lens/instinct`. Grade = score / 10,000, capped at 1.5. A 30-second line is comparable to 30 seconds of good manual selling, so it is valuable but never the only sensible thing to do. Bails cost combo and points only; earned money is never removed.
- Unit test: at a mid-run state, (manual at cap + passive) / passive must sit between 1.5 and 5.

## Team
- 12 skaters: 3 tech, 3 transition, 3 charisma, 3 all-round. Each has stats (Tech/Flow/Hype), one business bonus, a signature category and a portrait.
- Slots: 2 at start, +2 from Team Space (cash), +1 from Extra Seat (Cred), +1 at Legacy 2. Six max.
- Training costs `trainBase × 1.3^L`. Stats scale `(1+0.05L) × 1.25^milestones` (milestones at 10/25/50/100/150/200/300); the business bonus scales with the square root of that.
- **Rule shown in the UI:** a skater's bonus applies **all the time**, even on an assignment. Each skater does one activity at a time: assignment, filming crew, or event headliner.
- Assignments:
  - Demo: 60s, uses Hype.
  - Contests: 3–15 min, deterministic placement from Flow + ¼ Tech vs field strength, shown before you start.
  - Tours: 8–40 min, 2–6 skaters, all stats. Each completion adds +5–20% shoe & apparel income for the run (capped at +300%).
  - Payout = `payoutSec × shopBase × strength factor (capped 2.5) × promo/bonuses`.
  - A Team Manager (cash, or Back Office from the tree) enables Repeat.

## Videos
Fund a tier (repeats cost `fundGrowth^n` more), assign a crew, and footage accrues at `Σ crew Tech × 0.12 × camera × bonuses` per second.
`quality = 0.5 + 0.5·min(1.5, avgTech/techNorm) + editing + 0.4·bestLineGrade`.
On release, royalties are fixed at `shopBase × royaltyFrac × quality × fatigue`, and fans are added. The Producer node can automate funding and releasing.

## Events
Attendance = min(demand, capacity), where demand = base × promotion × fans^0.12 × headliner, and capacity = base × venue × Indoor Hall.
Revenue per cycle = `shopBase × revenueSec × attendance/baseDemand × (1 + 0.15·vendors + 0.2·sponsors + 0.3·broadcast[City+])`.
The UI shows which one is the bottleneck. Event Crew auto-re-hosts.

## Late systems
- **Brand:** each line multiplies its category by `1 + 0.05×level×focus×signature`, earns `3% × level` of that category's income, and Hype focus generates fans.
  - Focus options: Quality (category ×2, income ×0.4), Volume (×0.6 / ×1.8), Hype (×0.9 / ×0.6 + fans).
  - Signature multiplier: ×2 for the skater's own signature category, ×1.5 if the category fits their specialty, ×1.3 for all-rounders, ×1.15 otherwise; +2% per training level.
- **Skatepark:** each facility adds visitors plus a perk elsewhere (filming, contests and transition training, tour fans, event capacity, product income). Memberships run at full speed offline.
- **Distribution:** 2–6 slots. Each slotted category and its brand line earns `×(1 + 0.1 × reach × logistics)`; reach comes from 5 regions.
- **Factory:** 3–15 capacity points. A line with p points gets brand ×(1+0.5p)^0.7 and category ×(1+0.25p)^0.6, so spreading points out competes with stacking them.

## Legacy
- `credTotal(E) = (E / 2.5e6)^0.3`, where E is the summed earnings of completed runs. A run's reward = `floor((credTotal(E_prior + runEarnings) − credTotal(E_prior)) × (1 + 0.05×accomplishments))`. There are 14 per-run accomplishments.
- Minimum 5 Cred to Legacy. Because the formula is based on lifetime earnings, a quick reset right after a Legacy yields almost nothing (tested), which prevents reset farming. Spending cash never affects the reward (tested).
- The UI shows the threshold, the run earnings needed for the next Cred, the accomplishments, the next unlock, and explicit Resets / Keeps lists before you confirm.
- Tree: 20 nodes across 7 branches: Shop, Active, Team, Automation, Offline, Head Start, and Empire (Reputation, endless ×1.25 per level at 40×2^L Cred). Costs grow 2–4× per level, so no single branch dominates.

## Online, unattended, offline
- Time always comes from wall-clock deltas, never frame counts. The engine processes gaps of up to 180s as normal online time in 1-second steps; this covers background-tab throttling. A gap longer than 180s (sleep, closed tab) is handled as **offline**.
- Offline rules: simulated time = min(elapsed, cap). Cap is 8h, +4h per Long Weekend (24h max).
  - Automated income, assignments, filming and events progress at the **offline efficiency**: 30%, +10% per Night Shift (80% max), +5% per Robotics level.
  - Online store sales run at 2× efficiency and memberships at 100%.
  - Completion payouts are granted normally, but because they progress at the reduced speed, there are no free extra repeats.
  - No active bonuses, opportunities or crowd moments happen offline. A summary appears on return.
- Note: offline totals can be higher than `efficiency × passive × time`, because assignments and events still complete and their fans/merch bonuses keep compounding.
- Clock moved backwards: the delta is clamped to 0 and `lastTick` resets, so time is never negative. Clock jumped forward: the offline cap applies.

## Saves and tabs
- localStorage key `gripEmpire.save`. On every write, the previous valid save is copied to `gripEmpire.save.backup`. If the main save is corrupt, the backup loads automatically and a notice appears.
- Schema version 2 with a migration table. v1 is the pre-release prototype shape (`run.money`, `meta.legacyUpgrades`); its migration is covered by tests.
- Loading **sanitizes** onto fresh defaults: unknown ids are dropped, numbers clamped to finite ≥ 0, transient opportunities discarded (so they can't be re-claimed).
- Export format: `GRIPEMPIRE1:` + base64(JSON with FNV checksum). Import validates and shows a summary before replacing anything.
- Saving: autosave every 10s, 0.6s after any action, on hide/close, and around Legacy.
- **Multiple tabs:** a heartbeat lock in localStorage plus BroadcastChannel. A second tab pauses with "Play in this tab instead". Taking over makes the old tab save and pause, then the new tab reloads the save. Only the owning tab advances time or writes.
- The dev-only debug panel (`npm run dev`) marks a save `tainted`, and a red DEBUG SAVE badge appears.

## Balance targets vs. simulation (sim/simulate.ts)
The bots below use the same game code. They are **optimistic**: perfect payback-based buying and no hesitation. Expect human runs to take about 1.3–2× longer.

| Profile (assumptions) | 1st Legacy available | Run 1 (40 min) | Cred per run (runs 1–6) | Capstone |
|---|---|---|---|---|
| **Active**: serves 75% of the time at 4.5/s, takes opportunities, a line every 4 min at grade 0.9, decides every 3s | 24 min | $5.4B, 13 Cred | 13, 20, 50, 142, 587, 6.6K | run 7, about 4h total |
| **Mixed**: serves 35% of the time, opportunities, a line every 10 min at grade 0.7, decides every 5s | 32 min | $0.84B, 7 Cred | 7, 11, 27, 68, 170, 426 | run 7, about 4.5h total |
| **Idle**: never serves after a 2.5-min bootstrap, decides once a minute | 52 min | $0.29B (52 min), 5 Cred | 5, 8, 16, 27, 22, 36 | not within 7 runs |

- **Typical first-run timeline (mixed bot):** staff 0:18, bearings 1:17, Team HQ 1:27, first skater 2:05, first video 3:00, grip 3:50, first jam 5:40, wheels 10:40, trucks 22:00, Legacy available 31:30, decks 38:35.
- **Rebuilding after Legacy is fast:** in run 2 the mixed bot reaches wheels by 5:40 and the first brand line by 6:50. New systems appear within the first 5 minutes of each run.
- **Income mix (mixed, run 1):** manual 31%, automated 48%, assignments 15%, events 3%, opportunities 3%, minigame 1%. No single source dominates. Active players lean on manual sales (about 50–75%), but automated income is never negligible.
- **Longest stretch without an affordable purchase:** 3–6.5 min in normal runs, usually while saving for a contract. 12–15 min only when saving for Empire HQ phases.
- **Known balance limitation:** pure-idle play stalls somewhat around Legacy 3–5, because the factory and distribution costs sit at the active curve and Cred gains flatten when run earnings stop growing. Offline progress (not modeled by the idle bot) and occasional active play close the gap. This is a candidate for future tuning.

## Assumptions and decisions log
- Earnings are always **net spendable** income. Stock replenishment is abstracted into level costs.
- Contest results are deterministic (shown in advance) rather than random, so assignments are a decision rather than a gamble.
- One filming project and one event at a time keep the attention load low. Repeat and auto-host remove babysitting.
- Single-player and local, so there is no anti-cheat beyond sane clamping. Debug use is visibly flagged.
- Original fictional skaters, brands, contests and procedural art (SVG/canvas). Fonts (Bungee, Permanent Marker) are bundled locally via @fontsource, so nothing is loaded from remote URLs.
