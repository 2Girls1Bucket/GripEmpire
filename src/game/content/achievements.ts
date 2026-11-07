// Achievements (+1% all income each, permanent) and the guided goal chain.
import type { GameState } from '../state';
import { PRODUCTS } from './products';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  check: (s: GameState) => boolean;
}

const lt = (s: GameState) => s.meta.stats;
const anyProductAt = (s: GameState, lvl: number) => PRODUCTS.some((p) => (s.run.products[p.id] ?? 0) >= lvl);
const allProductsAt = (s: GameState, lvl: number) => PRODUCTS.every((p) => (s.run.products[p.id] ?? 0) >= lvl);

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'firstSale', name: 'Open For Business', desc: 'Make your first sale.', check: (s) => lt(s).totalServes >= 1 },
  { id: 'serves1k', name: 'Counter Culture', desc: 'Serve 1,000 customers (lifetime).', check: (s) => lt(s).totalServes >= 1000 },
  { id: 'serves10k', name: 'Retail Legend', desc: 'Serve 10,000 customers (lifetime).', check: (s) => lt(s).totalServes >= 10_000 },
  { id: 'staff', name: 'Delegation', desc: 'Hire your first staff.', check: (s) => (s.run.tracks.staff ?? 0) >= 1 },
  { id: 'lvl100', name: 'Century', desc: 'Get any product to level 100.', check: (s) => anyProductAt(s, 100) },
  { id: 'lvl300', name: 'Overstocked', desc: 'Get any product to level 300.', check: (s) => anyProductAt(s, 300) },
  { id: 'decks', name: 'Wall of Wood', desc: 'Sign the deck contract.', check: (s) => (s.run.products.decks ?? 0) > 0 },
  { id: 'shoes', name: 'Suede Shoes', desc: 'Sign the footwear contract.', check: (s) => (s.run.products.shoes ?? 0) > 0 },
  { id: 'apparel', name: 'Full Catalog', desc: 'Sign every supplier contract.', check: (s) => (s.run.products.apparel ?? 0) > 0 },
  { id: 'all50', name: 'Balanced Inventory', desc: 'Every product at level 50 in one run.', check: (s) => allProductsAt(s, 50) },
  { id: 'firstSkater', name: 'Sponsor Me', desc: 'Sign your first skater.', check: (s) => lt(s).skatersSigned >= 1 },
  { id: 'fullTeam', name: 'Full Squad', desc: 'Have 4 skaters on the team at once.', check: (s) => s.run.team.length >= 4 },
  { id: 'trained25', name: 'Coached Up', desc: 'Train a skater to level 25.', check: (s) => s.run.team.some((t) => t.training >= 25) },
  { id: 'trained100', name: 'Living Legend', desc: 'Train a skater to level 100.', check: (s) => s.run.team.some((t) => t.training >= 100) },
  { id: 'podium', name: 'Podium Finish', desc: 'Win a contest (1st place).', check: (s) => lt(s).contestWins >= 1 },
  { id: 'tour', name: 'On The Road', desc: 'Complete a tour.', check: (s) => lt(s).toursDone >= 1 },
  { id: 'video', name: 'Premiere Night', desc: 'Release your first video.', check: (s) => lt(s).videosReleased >= 1 },
  { id: 'video10', name: 'Video Archive', desc: 'Release 10 videos (lifetime).', check: (s) => lt(s).videosReleased >= 10 },
  { id: 'line', name: 'Got The Clip', desc: 'Finish a Film a Line attempt.', check: (s) => lt(s).minigameRuns >= 1 },
  { id: 'lineBig', name: 'Banger', desc: 'Score 15,000+ in Film a Line.', check: (s) => lt(s).bestLineScore >= 15000 },
  { id: 'event', name: 'Throw A Jam', desc: 'Host your first event.', check: (s) => lt(s).eventsHosted >= 1 },
  { id: 'cityjam', name: 'Downtown Takeover', desc: 'Unlock the City Jam.', check: (s) => s.run.eventsUnlocked.includes('cityjam') },
  { id: 'fans10k', name: 'Fan Club', desc: 'Reach 10,000 fans in a run.', check: (s) => s.run.fans >= 10_000 },
  { id: 'fans1m', name: 'Household Name', desc: 'Reach 1,000,000 fans in a run.', check: (s) => s.run.fans >= 1_000_000 },
  { id: 'opps', name: 'Opportunist', desc: 'Complete 25 shop opportunities.', check: (s) => lt(s).oppsCompleted >= 25 },
  { id: 'legacy1', name: 'Legacy', desc: 'Perform your first Legacy.', check: (s) => s.meta.legacyCount >= 1 },
  { id: 'brand', name: 'House Brand', desc: 'Design a brand line.', check: (s) => Object.keys(s.run.brand).length >= 1 },
  { id: 'signature', name: 'Pro Model', desc: 'Launch a signature product.', check: (s) => Object.values(s.run.brand).some((b) => !!b?.signature) },
  { id: 'park', name: 'Park Life', desc: 'Open your skatepark.', check: (s) => s.run.facilities.includes('miniramp') },
  { id: 'parkAll', name: 'Destination Park', desc: 'Build every skatepark facility.', check: (s) => s.run.facilities.length >= 6 },
  { id: 'distro', name: 'Shipping Out', desc: 'Open a distribution region.', check: (s) => s.run.regions.length >= 1 },
  { id: 'global', name: 'Worldwide', desc: 'Open Global Distribution.', check: (s) => s.run.regions.includes('global') },
  { id: 'factory', name: 'Made In-House', desc: 'Allocate factory capacity.', check: (s) => Object.values(s.run.factory).some((v) => (v ?? 0) > 0) },
  { id: 'majors', name: 'Major League', desc: 'Unlock the National Championship.', check: (s) => s.run.eventsUnlocked.includes('national') },
  { id: 'legacy5', name: 'Dynasty', desc: 'Perform 5 Legacies.', check: (s) => s.meta.legacyCount >= 5 },
  { id: 'empire', name: 'Grip Empire', desc: 'Complete the Empire Tower. You did it.', check: (s) => s.meta.hqPhase >= 5 },
];

export interface GoalDef {
  id: string;
  text: string;
  hint: string;
  location: string;
  done: (s: GameState) => boolean;
  /** Only shown when this returns true. */
  when?: (s: GameState) => boolean;
}

export const GOALS: GoalDef[] = [
  { id: 'serve', text: 'Serve 10 customers', hint: 'Click SERVE, or hold Space / Enter.', location: 'shop', done: (s) => s.run.stats.serves >= 10 || s.meta.legacyCount > 0 },
  { id: 'bushing', text: 'Buy more bushings', hint: 'Product levels raise your sale value and passive income.', location: 'shop', done: (s) => s.run.products.bushings >= 3 },
  { id: 'staff', text: 'Hire your first staff', hint: 'Shop Upgrades → Staff & Automation. Turns on passive income.', location: 'shop', done: (s) => (s.run.tracks.staff ?? 0) >= 1 },
  { id: 'bearings', text: 'Sign the bearings contract', hint: 'New categories add a big chunk of income.', location: 'shop', done: (s) => s.run.products.bearings > 0 },
  { id: 'bush25', text: 'Get bushings to level 25', hint: 'Milestones double a category\'s income.', location: 'shop', done: (s) => s.run.products.bushings >= 25 },
  { id: 'grip', text: 'Sign the grip tape deal', hint: 'Keep expanding the catalog.', location: 'shop', done: (s) => s.run.products.grip > 0 },
  { id: 'skater', text: 'Sign your first skater', hint: 'Team HQ → Scouting. Skaters give permanent run bonuses.', location: 'team', done: (s) => s.run.team.length >= 1 },
  { id: 'job', text: 'Send a skater on a demo', hint: 'Team HQ → Assignments. Skaters keep their passive bonus while working.', location: 'team', done: (s) => s.run.stats.jobEarned > 0 || s.run.jobs.length > 0 },
  { id: 'film', text: 'Fund a filming project', hint: 'Skate Spot → fund a Phone Clip and assign a crew.', location: 'spot', done: (s) => !!s.run.film || s.run.videos.length > 0 },
  { id: 'video', text: 'Release your first video', hint: 'Footage builds automatically. Play Film a Line to speed it up.', location: 'spot', done: (s) => s.run.videos.length > 0 },
  { id: 'jam', text: 'Host a Parking-Lot Jam', hint: 'Event Venue. Events pay out every cycle.', location: 'venue', done: (s) => s.run.eventsUnlocked.length > 0 },
  { id: 'wheels', text: 'Sign the wheel contract', hint: 'Wheels also unlock the Online Store upgrade.', location: 'shop', done: (s) => s.run.products.wheels > 0 },
  { id: 'tour', text: 'Send two skaters on a Van Tour', hint: 'Tours are long but pay big and boost merch.', location: 'team', done: (s) => s.run.stats.toursDone > 0 || s.run.jobs.some((j) => j.assignmentId.startsWith('tour')) },
  { id: 'trucks', text: 'Sign the trucks contract', hint: 'Every system pays in proportion to shop income.', location: 'shop', done: (s) => s.run.products.trucks > 0 },
  { id: 'decks', text: 'Sign the deck contract', hint: 'The deck wall is the heart of a real shop.', location: 'shop', done: (s) => s.run.products.decks > 0 },
  { id: 'legacy', text: 'Perform your first Legacy', hint: 'Hall of Fame. Reset for Cred and unlock your own brand.', location: 'legacy', done: (s) => s.meta.legacyCount >= 1 },
  { id: 'brand', text: 'Design your first brand line', hint: 'Workshop. Brand lines boost a category and earn brand income.', location: 'workshop', done: (s) => Object.keys(s.run.brand).length > 0, when: (s) => s.meta.legacyCount >= 1 },
  { id: 'sig', text: 'Launch a signature product', hint: 'Workshop → pair a skater with a line. Matching specialty = bigger bonus.', location: 'workshop', done: (s) => Object.values(s.run.brand).some((b) => !!b?.signature), when: (s) => s.meta.legacyCount >= 1 },
  { id: 'legacy2', text: 'Perform your 2nd Legacy', hint: 'Unlocks skateparks and a 6th team slot.', location: 'legacy', done: (s) => s.meta.legacyCount >= 2, when: (s) => s.meta.legacyCount >= 1 },
  { id: 'park', text: 'Open your skatepark', hint: 'Skatepark → build the Mini Ramp.', location: 'park', done: (s) => s.run.facilities.includes('miniramp'), when: (s) => s.meta.legacyCount >= 2 },
  { id: 'legacy3', text: 'Perform your 3rd Legacy', hint: 'Unlocks distribution and bigger tours.', location: 'legacy', done: (s) => s.meta.legacyCount >= 3, when: (s) => s.meta.legacyCount >= 2 },
  { id: 'distro', text: 'Open a distribution region', hint: 'Warehouse → buy Local Distro, then slot categories.', location: 'warehouse', done: (s) => s.run.regions.length > 0, when: (s) => s.meta.legacyCount >= 3 },
  { id: 'legacy4', text: 'Perform your 4th Legacy', hint: 'Unlocks manufacturing and major events.', location: 'legacy', done: (s) => s.meta.legacyCount >= 4, when: (s) => s.meta.legacyCount >= 3 },
  { id: 'factory', text: 'Allocate factory capacity', hint: 'Factory → put points on your brand lines.', location: 'factory', done: (s) => Object.values(s.run.factory).some((v) => (v ?? 0) > 0), when: (s) => s.meta.legacyCount >= 4 },
  { id: 'legacy5', text: 'Perform your 5th Legacy', hint: 'Unlocks the Empire HQ capstone.', location: 'legacy', done: (s) => s.meta.legacyCount >= 5, when: (s) => s.meta.legacyCount >= 4 },
  { id: 'hq', text: 'Complete the Empire Tower', hint: 'Empire HQ → fund all five phases.', location: 'hq', done: (s) => s.meta.hqPhase >= 5, when: (s) => s.meta.legacyCount >= 5 },
];
