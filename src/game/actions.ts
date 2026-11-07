// All player actions. Each mutates state in place and returns a Result.
// Every spend goes through `spend`, which refuses if cash is insufficient (no overspending, no negatives).
import type { GameState, RunStats, Opportunity } from './state';
import { SERVE_RATE_CAP } from './config';
import { PRODUCT_BY_ID, describeMilestone, type ProductId } from './content/products';
import { TRACK_BY_ID } from './content/tracks';
import { SKATER_BY_ID } from './content/skaters';
import { ASSIGNMENT_BY_ID, EVENT_BY_ID, EVENT_TIERS, VIDEO_BY_ID } from './content/activities';
import { BRAND_LEVEL_GROWTH, BRAND_LINES, FACILITIES, HQ_PHASES, REGIONS, type BrandFocus } from './content/business';
import {
  brandLevelCost,
  computeDerived,
  estimateJob,
  milestoneMults,
  nextMilestone,
  node,
  productBulkCost,
  productMaxAffordable,
  RUSH_DURATION,
  RUSH_MULT,
  safe,
  signingCost,
  STREAK_PER_STACK,
  trackCost,
  TRAINING_GROWTH,
  trainingCost,
  videoFundCost,
  videoQuality,
  type Derived,
} from './economy';
import { assignmentLock, busySkaters, eventLock, productOffered, trackLock, videoLock } from './unlocks';
import { feedback } from './feedback';

export interface Result {
  ok: boolean;
  msg?: string;
}
const ok = (msg?: string): Result => ({ ok: true, msg });
const fail = (msg: string): Result => ({ ok: false, msg });

type EarnSource = keyof Pick<RunStats, 'manualEarned' | 'passiveEarned' | 'jobEarned' | 'eventEarned' | 'minigameEarned' | 'oppEarned'>;

export function earn(s: GameState, amount: number, source: EarnSource) {
  const a = safe(amount);
  if (a <= 0) return 0;
  s.run.cash = safe(s.run.cash + a);
  s.run.earnings = safe(s.run.earnings + a);
  s.meta.stats.totalEarned = safe(s.meta.stats.totalEarned + a);
  s.run.stats[source] = safe(s.run.stats[source] + a);
  return a;
}

export function spend(s: GameState, cost: number): boolean {
  if (!Number.isFinite(cost) || cost < 0) return false;
  if (s.run.cash + 1e-9 * Math.max(1, cost) < cost) return false;
  s.run.cash = Math.max(0, s.run.cash - cost);
  return true;
}

// ---------------- MANUAL SALES ----------------
export const SERVE_INTERVAL = 1 / SERVE_RATE_CAP;

/** Serve one customer. Returns cash earned (0 if on cooldown). */
export function serve(s: GameState, d: Derived = computeDerived(s)): number {
  const r = s.run;
  if (r.sinceServe < SERVE_INTERVAL - 1e-6) return 0;
  r.sinceServe = 0;
  r.streak = Math.min(d.streakMax, r.streak + 1);
  const value = d.saleValue * (1 + STREAK_PER_STACK * Math.floor(r.streak)) * (r.rushLeft > 0 ? RUSH_MULT : 1);
  const got = earn(s, value, 'manualEarned');
  r.stats.serves++;
  s.meta.stats.totalServes++;
  const o = r.opp;
  if (o && o.kind === 'bulk' && o.accepted) {
    o.progress++;
    if (o.progress >= o.need) {
      const reward = o.rewardSec * d.shopBase * d.oppReward;
      earn(s, reward, 'oppEarned');
      s.meta.stats.oppsCompleted++;
      feedback.emit({ kind: 'opp', text: `${o.label} delivered!`, amount: reward, big: true });
      r.opp = null;
      r.nextOppIn = 90 + Math.random() * 60;
    }
  }
  return got;
}

// ---------------- OPPORTUNITIES ----------------
export function openRush(s: GameState): Result {
  const o = s.run.opp;
  if (!o || o.kind !== 'rush') return fail('No rush waiting');
  s.run.rushLeft = RUSH_DURATION * (1 + 0.25 * node(s, 'rush'));
  s.run.opp = null;
  s.run.nextOppIn = 90 + Math.random() * 60;
  s.meta.stats.oppsCompleted++;
  feedback.emit({ kind: 'opp', text: `Customer rush! Sales ×${RUSH_MULT}`, big: true });
  return ok();
}

export function acceptBulk(s: GameState): Result {
  const o = s.run.opp;
  if (!o || o.kind !== 'bulk' || o.accepted) return fail('No bulk order waiting');
  o.accepted = true;
  return ok();
}

export const BOARD_PARTS = {
  wheels: ['52mm 99a', '56mm 99a', '60mm 78a'],
  trucks: ['Narrow 8.0', 'Mid 8.25', 'Wide 8.75'],
  bushings: ['Soft 87a', 'Medium 92a', 'Hard 97a'],
} as const;

export const BOARD_STYLES = {
  street: { label: 'Street', hint: 'Small, hard wheels for flip tricks. Trucks to match an 8.25" deck. Tight, hard bushings.', answer: { wheels: 0, trucks: 1, bushings: 2 } },
  bowl: { label: 'Bowl / Park', hint: 'Bigger hard wheels for speed. Wide, stable trucks. Medium bushings for carving.', answer: { wheels: 1, trucks: 2, bushings: 1 } },
  cruiser: { label: 'Cruiser', hint: 'Big soft wheels for rough roads. Mid trucks. Soft bushings for easy turning.', answer: { wheels: 2, trucks: 1, bushings: 0 } },
} as const;

export function completeBoard(s: GameState, pick: { wheels: number; trucks: number; bushings: number }, d: Derived = computeDerived(s)): Result & { matches?: number } {
  const o = s.run.opp;
  if (!o || o.kind !== 'board') return fail('No board order waiting');
  const ans = BOARD_STYLES[o.style].answer;
  const matches = (pick.wheels === ans.wheels ? 1 : 0) + (pick.trucks === ans.trucks ? 1 : 0) + (pick.bushings === ans.bushings ? 1 : 0);
  const reward = o.rewardSec * d.shopBase * d.oppReward * (0.4 + 0.2 * matches);
  earn(s, reward, 'oppEarned');
  s.meta.stats.oppsCompleted++;
  feedback.emit({ kind: 'opp', text: matches === 3 ? `Perfect setup for ${o.customer}!` : `${o.customer} took the board (${matches}/3 right)`, amount: reward, big: matches === 3 });
  s.run.opp = null;
  s.run.nextOppIn = 90 + Math.random() * 60;
  return { ok: true, matches };
}

export function dismissOpp(s: GameState): Result {
  if (!s.run.opp) return fail('Nothing to dismiss');
  s.run.opp = null;
  s.run.nextOppIn = 60 + Math.random() * 60;
  return ok();
}

const CUSTOMERS = ['Dana', 'Marco', 'Tess', 'Jordy', 'Kai', 'Nell', 'Ozzie', 'Rina', 'Sol', 'Bex'];
const BULK_LABELS = ['Skate camp order', 'School club order', 'Youth center order', 'Contest goodie bags', 'Rental fleet refit'];

export function spawnOpportunity(s: GameState, rand: () => number = Math.random): Opportunity {
  const r = s.run;
  const cats = Object.values(r.products).filter((l) => l > 0).length;
  const kinds: Opportunity['kind'][] = ['rush'];
  if (cats >= 3) kinds.push('bulk');
  if (r.products.wheels > 0) kinds.push('board');
  const kind = kinds[Math.floor(rand() * kinds.length)];
  if (kind === 'bulk') {
    return { kind, expires: 30, accepted: false, need: 25, progress: 0, timeLeft: 35, rewardSec: 40, label: BULK_LABELS[Math.floor(rand() * BULK_LABELS.length)] };
  }
  if (kind === 'board') {
    const styles = ['street', 'bowl', 'cruiser'] as const;
    return { kind, expires: 40, style: styles[Math.floor(rand() * 3)], customer: CUSTOMERS[Math.floor(rand() * CUSTOMERS.length)], rewardSec: 50 };
  }
  return { kind: 'rush', expires: 25 };
}

// ---------------- PRODUCTS ----------------
export function unlockProduct(s: GameState, id: ProductId): Result {
  const def = PRODUCT_BY_ID[id];
  if (!def) return fail('Unknown product');
  if (s.run.products[id] > 0) return fail('Already signed');
  if (!productOffered(s, id)) return fail('Sign the previous contract first');
  if (!spend(s, def.unlockCost)) return fail('Not enough cash');
  s.run.products[id] = 1;
  feedback.emit({ kind: 'unlock', text: `${def.contract} signed — ${def.name} on the shelves!`, big: true });
  return ok();
}

export type BuyMode = number | 'max' | 'next';

export function productBuyPlan(s: GameState, id: ProductId, mode: BuyMode, d: Derived = computeDerived(s)) {
  const def = PRODUCT_BY_ID[id];
  const lvl = s.run.products[id];
  const cm = d.costMult[id];
  let n: number;
  if (mode === 'max') n = Math.max(1, productMaxAffordable(def, lvl, s.run.cash, cm));
  else if (mode === 'next') n = (nextMilestone(def, lvl)?.level ?? lvl + 1) - lvl;
  else n = mode;
  return { n, cost: productBulkCost(def, lvl, n, cm) };
}

export function buyProduct(s: GameState, id: ProductId, mode: BuyMode = 1, d: Derived = computeDerived(s)): Result {
  const lvl = s.run.products[id];
  if (!lvl) return fail('Sign the contract first');
  const { n, cost } = productBuyPlan(s, id, mode, d);
  if (n <= 0) return fail('Nothing to buy');
  if (!spend(s, cost)) return fail('Not enough cash');
  const def = PRODUCT_BY_ID[id];
  const before = milestoneMults(def, lvl);
  s.run.products[id] = lvl + n;
  const crossed = def.milestones.filter((m) => m.level > lvl && m.level <= lvl + n);
  for (const m of crossed) {
    feedback.emit({ kind: 'milestone', text: `${def.name} Lv ${m.level}! ${describeMilestone(m)}`, big: true });
  }
  void before;
  return ok();
}

// ---------------- TRACKS ----------------
export function buyTrack(s: GameState, id: string): Result {
  const t = TRACK_BY_ID[id];
  if (!t) return fail('Unknown upgrade');
  const lock = trackLock(s, id);
  if (lock) return fail(lock);
  const lvl = s.run.tracks[id] ?? 0;
  if (t.maxLevel !== undefined && lvl >= t.maxLevel) return fail('Maxed');
  if (!spend(s, trackCost(id, lvl))) return fail('Not enough cash');
  s.run.tracks[id] = lvl + 1;
  if (id === 'staff' && lvl === 0) feedback.emit({ kind: 'unlock', text: 'Staff hired — the shop now earns while you do other things!', big: true });
  return ok();
}

// ---------------- SKATERS ----------------
export function recruit(s: GameState, id: string, d: Derived = computeDerived(s)): Result {
  const def = SKATER_BY_ID[id];
  if (!def) return fail('Unknown skater');
  if (!s.meta.unlockedSkaters.includes(id)) return fail('Not scouted yet');
  if (s.run.team.some((t) => t.id === id)) return fail('Already on the team');
  if (s.run.team.length >= d.teamSlots) return fail('Team is full — release someone or expand Team Space');
  if (!spend(s, signingCost(d, def))) return fail('Not enough cash');
  s.run.team.push({ id, training: 0 });
  s.meta.stats.skatersSigned++;
  feedback.emit({ kind: 'unlock', text: `${def.name} joined the team!`, big: true });
  return ok();
}

/** Remove a skater from every activity they are part of. */
function unassign(s: GameState, id: string) {
  const r = s.run;
  r.jobs = r.jobs.filter((j) => {
    if (!j.skaters.includes(id)) return true;
    j.skaters = j.skaters.filter((x) => x !== id);
    const a = ASSIGNMENT_BY_ID[j.assignmentId];
    return j.skaters.length >= a.minSkaters;
  });
  if (r.film) r.film.crew = r.film.crew.filter((x) => x !== id);
  if (r.eventHeadliner === id) r.eventHeadliner = null;
  for (const line of Object.values(r.brand)) if (line && line.signature === id) line.signature = null;
}

export function release(s: GameState, id: string): Result {
  const i = s.run.team.findIndex((t) => t.id === id);
  if (i < 0) return fail('Not on the team');
  unassign(s, id);
  s.run.team.splice(i, 1);
  return ok();
}

export function trainPlan(s: GameState, id: string, mode: number | 'max', d: Derived = computeDerived(s)) {
  const t = s.run.team.find((x) => x.id === id);
  const def = SKATER_BY_ID[id];
  if (!t || !def) return { n: 0, cost: Infinity };
  const first = trainingCost(s, d, def, t.training);
  const g = TRAINING_GROWTH;
  const total = (n: number) => (first * (Math.pow(g, n) - 1)) / (g - 1);
  let n: number;
  if (mode === 'max') {
    n = Math.floor(Math.log(1 + (s.run.cash * (g - 1)) / first) / Math.log(g));
    n = Math.max(1, Math.min(n, 10_000));
    while (n > 1 && total(n) > s.run.cash) n--;
  } else n = mode;
  return { n, cost: total(n) };
}

export function train(s: GameState, id: string, mode: number | 'max' = 1, d: Derived = computeDerived(s)): Result {
  const t = s.run.team.find((x) => x.id === id);
  if (!t) return fail('Not on the team');
  const { n, cost } = trainPlan(s, id, mode, d);
  if (!spend(s, cost)) return fail('Not enough cash');
  const before = t.training;
  t.training += n;
  for (const m of [10, 25, 50, 100, 150, 200, 300]) {
    if (before < m && t.training >= m) feedback.emit({ kind: 'milestone', text: `${SKATER_BY_ID[id].name} hit training Lv ${m}! Stats & bonus ×1.25`, big: true });
  }
  return ok();
}

// ---------------- ASSIGNMENTS ----------------
export function startJob(s: GameState, assignmentId: string, skaterIds: string[], repeat = false, d: Derived = computeDerived(s)): Result {
  const a = ASSIGNMENT_BY_ID[assignmentId];
  if (!a) return fail('Unknown assignment');
  const lock = assignmentLock(s, a);
  if (lock) return fail(lock);
  const ids = [...new Set(skaterIds)];
  if (ids.length < a.minSkaters || ids.length > a.maxSkaters) return fail(`Needs ${a.minSkaters}–${a.maxSkaters} skaters`);
  const busy = busySkaters(s);
  for (const id of ids) {
    if (!s.run.team.some((t) => t.id === id)) return fail('Skater not on the team');
    if (busy.has(id)) return fail(`${SKATER_BY_ID[id].name} is busy`);
  }
  const est = estimateJob(s, d, a, ids);
  s.run.jobs.push({ uid: s.run.nextUid++, assignmentId, skaters: ids, elapsed: 0, duration: est.duration, repeat: repeat && (s.run.tracks.manager ?? 0) > 0 });
  return ok();
}

export function cancelJob(s: GameState, uid: number): Result {
  const before = s.run.jobs.length;
  s.run.jobs = s.run.jobs.filter((j) => j.uid !== uid);
  return before === s.run.jobs.length ? fail('No such job') : ok();
}

export function setJobRepeat(s: GameState, uid: number, repeat: boolean): Result {
  const j = s.run.jobs.find((x) => x.uid === uid);
  if (!j) return fail('No such job');
  if (repeat && !(s.run.tracks.manager ?? 0)) return fail('Hire a Team Manager first');
  j.repeat = repeat;
  return ok();
}

// ---------------- FILMING ----------------
export function fundFilm(s: GameState, tierId: string, crew: string[] = []): Result {
  const tier = VIDEO_BY_ID[tierId];
  if (!tier) return fail('Unknown project');
  if (s.run.film) return fail('Finish or drop the current project first');
  const lock = videoLock(s, tier);
  if (lock) return fail(lock);
  if (!spend(s, videoFundCost(s, tier))) return fail('Not enough cash');
  s.run.videoCounts[tierId] = (s.run.videoCounts[tierId] ?? 0) + 1;
  s.run.film = { tierId, footage: 0, required: tier.footage, crew: [], bestGrade: 0, linesPlayed: 0 };
  if (crew.length) setFilmCrew(s, crew);
  return ok();
}

export function setFilmCrew(s: GameState, crew: string[]): Result {
  const f = s.run.film;
  if (!f) return fail('No project');
  const tier = VIDEO_BY_ID[f.tierId];
  const ids = [...new Set(crew)].slice(0, tier.maxCrew);
  const busy = busySkaters(s);
  for (const id of ids) {
    if (!s.run.team.some((t) => t.id === id)) return fail('Skater not on the team');
    if (busy.has(id) && !f.crew.includes(id)) return fail(`${SKATER_BY_ID[id].name} is busy`);
  }
  f.crew = ids;
  return ok();
}

/** Audience fatigue: each earlier release of the same tier this run reduces royalties & fans by 25%. Keeps the total bounded. */
export const VIDEO_FATIGUE = 0.75;
export const videoFatigue = (s: GameState, tierId: string) => Math.pow(VIDEO_FATIGUE, s.run.videos.filter((v) => v.tierId === tierId).length);

const VIDEO_TITLES = ['Concrete Jungle', 'Push Harder', 'Kickturn Diaries', 'Slam City', 'No Cones', 'Grip It', 'Late Session', 'Bust Out', 'Coping Mechanisms', 'Wax On', 'Street Prayers', 'Roll Call', 'After Hours', 'Bearings Off', 'Hardflip Heaven', 'Spot Check'];

export function releaseVideo(s: GameState, d: Derived = computeDerived(s)): Result {
  const f = s.run.film;
  if (!f) return fail('No project');
  if (f.footage < f.required - 1e-9) return fail('Not enough footage yet');
  const tier = VIDEO_BY_ID[f.tierId];
  const quality = videoQuality(s, d, tier, f.crew, f.bestGrade);
  const fatigue = videoFatigue(s, f.tierId);
  const royaltyBase = safe(d.shopBase * tier.royaltyFrac * quality * fatigue);
  const title = `${VIDEO_TITLES[(s.meta.stats.videosReleased * 7 + s.run.videos.length) % VIDEO_TITLES.length]}${s.run.videos.length >= VIDEO_TITLES.length ? ' ' + (s.run.videos.length + 1) : ''}`;
  s.run.videos.push({ tierId: f.tierId, title, quality, royaltyBase });
  s.run.fans = safe(s.run.fans + tier.fans * quality * fatigue);
  s.run.stats.videosReleased++;
  s.meta.stats.videosReleased++;
  s.run.film = null;
  feedback.emit({ kind: 'video', text: `"${title}" released! Quality ${quality.toFixed(2)} — royalties flowing`, amount: royaltyBase, big: true });
  return ok();
}

export function dropFilm(s: GameState): Result {
  if (!s.run.film) return fail('No project');
  s.run.film = null;
  return ok();
}

// ---------------- FILM A LINE ----------------
export const LINE_CASH_SEC = 40;
export const LINE_FOOTAGE_FRAC = 0.22;

export interface LineResult {
  attemptId: string;
  score: number;
  /** 0 (all bails) – 1.5 (flawless with hammer). */
  grade: number;
  perfects: number;
}

export function lineRewardPreview(s: GameState, grade: number, d: Derived = computeDerived(s)) {
  const g = Math.max(0, Math.min(1.5, grade));
  const cash = (0.1 + g) * LINE_CASH_SEC * d.shopBase + 25 * (0.1 + g);
  const f = s.run.film;
  const footage = f ? Math.min(f.required - f.footage, f.required * LINE_FOOTAGE_FRAC * g * d.lineFootageMult) : 0;
  return { cash, footage };
}

export function applyLineResult(s: GameState, res: LineResult, d: Derived = computeDerived(s)): Result & { cash?: number; footage?: number } {
  if (!res.attemptId || res.attemptId === s.run.lastLineAttempt) return fail('Already rewarded');
  s.run.lastLineAttempt = res.attemptId;
  const { cash, footage } = lineRewardPreview(s, res.grade, d);
  earn(s, cash, 'minigameEarned');
  const f = s.run.film;
  if (f) {
    f.footage = Math.min(f.required, f.footage + footage);
    f.bestGrade = Math.max(f.bestGrade, Math.min(1.5, res.grade));
    f.linesPlayed++;
  }
  s.meta.stats.minigameRuns++;
  s.meta.stats.perfectLandings += res.perfects;
  s.meta.stats.bestLineScore = Math.max(s.meta.stats.bestLineScore, Math.floor(res.score));
  return { ok: true, cash, footage };
}

// ---------------- EVENTS ----------------
export function unlockEvent(s: GameState, tierId: string): Result {
  const t = EVENT_BY_ID[tierId];
  if (!t) return fail('Unknown event');
  if (s.run.eventsUnlocked.includes(tierId)) return fail('Already unlocked');
  const idx = EVENT_TIERS.findIndex((e) => e.id === tierId);
  if (idx > 0 && !s.run.eventsUnlocked.includes(EVENT_TIERS[idx - 1].id)) return fail('Unlock the previous event first');
  const lock = eventLock(s, t);
  if (lock) return fail(lock);
  if (!spend(s, t.unlockCost)) return fail('Not enough cash');
  s.run.eventsUnlocked.push(tierId);
  feedback.emit({ kind: 'unlock', text: `${t.name} unlocked!`, big: true });
  if (!s.run.event) hostEvent(s, tierId);
  return ok();
}

export function hostEvent(s: GameState, tierId: string): Result {
  const t = EVENT_BY_ID[tierId];
  if (!t || !s.run.eventsUnlocked.includes(tierId)) return fail('Event not unlocked');
  if (s.run.event && s.run.event.tierId === tierId) return fail('Already running');
  s.run.event = { tierId, elapsed: 0, duration: t.duration, hypeBonus: 0, momentIn: t.duration * (0.25 + Math.random() * 0.3), momentLeft: 0 };
  return ok();
}

export function stopEvent(s: GameState): Result {
  if (!s.run.event) return fail('No event running');
  s.run.event = null;
  return ok();
}

export function setHeadliner(s: GameState, id: string | null): Result {
  if (id === null) {
    s.run.eventHeadliner = null;
    return ok();
  }
  if (!s.run.team.some((t) => t.id === id)) return fail('Not on the team');
  const busy = busySkaters(s);
  if (busy.has(id) && s.run.eventHeadliner !== id) return fail(`${SKATER_BY_ID[id].name} is busy`);
  s.run.eventHeadliner = id;
  return ok();
}

export function hypeCrowd(s: GameState): Result {
  const e = s.run.event;
  if (!e || e.momentLeft <= 0) return fail('No crowd moment right now');
  e.hypeBonus = Math.min(0.3, e.hypeBonus + 0.15);
  e.momentLeft = 0;
  e.momentIn = e.hypeBonus < 0.3 ? e.duration * (0.2 + Math.random() * 0.2) : Infinity;
  feedback.emit({ kind: 'event', text: `Crowd goes wild! Event payout +${Math.round(e.hypeBonus * 100)}%` });
  return ok();
}

// ---------------- BRAND ----------------
export function designLine(s: GameState, product: ProductId): Result {
  if (s.meta.legacyCount < 1) return fail('Requires Legacy 1');
  const bl = BRAND_LINES.find((b) => b.product === product);
  if (!bl) return fail('Unknown line');
  if (s.run.brand[product]) return fail('Already designed');
  if (!(s.run.products[product] > 0)) return fail('Sign that supplier contract first');
  if (!spend(s, bl.unlockCost)) return fail('Not enough cash');
  s.run.brand[product] = { level: 1, focus: 'quality', signature: null };
  feedback.emit({ kind: 'unlock', text: `${bl.name} launched!`, big: true });
  return ok();
}

export function brandLevelPlan(s: GameState, product: ProductId, mode: number | 'max') {
  const bl = BRAND_LINES.find((b) => b.product === product)!;
  const line = s.run.brand[product];
  if (!line) return { n: 0, cost: Infinity };
  const g = BRAND_LEVEL_GROWTH;
  const first = brandLevelCost(bl.unlockCost, line.level);
  const total = (n: number) => (first * (Math.pow(g, n) - 1)) / (g - 1);
  let n: number;
  if (mode === 'max') {
    n = Math.floor(Math.log(1 + (s.run.cash * (g - 1)) / first) / Math.log(g));
    n = Math.max(1, Math.min(n, 10_000));
    while (n > 1 && total(n) > s.run.cash) n--;
  } else n = mode;
  return { n, cost: total(n) };
}

export function levelLine(s: GameState, product: ProductId, mode: number | 'max' = 1): Result {
  const line = s.run.brand[product];
  if (!line) return fail('Design the line first');
  const { n, cost } = brandLevelPlan(s, product, mode);
  if (!spend(s, cost)) return fail('Not enough cash');
  line.level += n;
  return ok();
}

export function setFocus(s: GameState, product: ProductId, focus: BrandFocus): Result {
  const line = s.run.brand[product];
  if (!line) return fail('Design the line first');
  line.focus = focus;
  return ok();
}

export function setSignature(s: GameState, product: ProductId, skaterId: string | null): Result {
  const line = s.run.brand[product];
  if (!line) return fail('Design the line first');
  if (skaterId && !s.run.team.some((t) => t.id === skaterId)) return fail('Not on the team');
  if (skaterId) for (const l of Object.values(s.run.brand)) if (l && l.signature === skaterId) l.signature = null;
  line.signature = skaterId;
  if (skaterId) feedback.emit({ kind: 'unlock', text: `${SKATER_BY_ID[skaterId].name} signature line launched!` });
  return ok();
}

// ---------------- SKATEPARK ----------------
export function buyFacility(s: GameState, id: string): Result {
  if (s.meta.legacyCount < 2) return fail('Requires Legacy 2');
  const f = FACILITIES.find((x) => x.id === id);
  if (!f) return fail('Unknown facility');
  if (s.run.facilities.includes(id)) return fail('Already built');
  if (id !== 'miniramp' && !s.run.facilities.includes('miniramp')) return fail('Build the Mini Ramp first');
  if (!spend(s, f.cost)) return fail('Not enough cash');
  s.run.facilities.push(id);
  feedback.emit({ kind: 'unlock', text: `${f.name} built!`, big: true });
  return ok();
}

// ---------------- DISTRIBUTION ----------------
export function buyRegion(s: GameState, id: string): Result {
  if (s.meta.legacyCount < 3) return fail('Requires Legacy 3');
  const idx = REGIONS.findIndex((x) => x.id === id);
  if (idx < 0) return fail('Unknown region');
  if (s.run.regions.includes(id)) return fail('Already open');
  if (idx > 0 && !s.run.regions.includes(REGIONS[idx - 1].id)) return fail('Open the previous region first');
  if (!spend(s, REGIONS[idx].cost)) return fail('Not enough cash');
  s.run.regions.push(id);
  feedback.emit({ kind: 'unlock', text: `${REGIONS[idx].name} open!`, big: true });
  return ok();
}

export function toggleSlot(s: GameState, product: ProductId, d: Derived = computeDerived(s)): Result {
  if (s.meta.legacyCount < 3) return fail('Requires Legacy 3');
  const slots = s.run.distroSlots;
  if (slots.includes(product)) {
    s.run.distroSlots = slots.filter((p) => p !== product);
    return ok();
  }
  if (!(s.run.products[product] > 0)) return fail('Sign that contract first');
  if (slots.length >= d.distroSlots) return fail('All distribution slots are full');
  slots.push(product);
  return ok();
}

// ---------------- FACTORY ----------------
export function allocate(s: GameState, product: ProductId, delta: number, d: Derived = computeDerived(s)): Result {
  if (s.meta.legacyCount < 4) return fail('Requires Legacy 4');
  if (!s.run.brand[product]) return fail('Design that brand line first');
  const cur = s.run.factory[product] ?? 0;
  const used = Object.values(s.run.factory).reduce((a: number, b) => a + (b ?? 0), 0);
  const next = cur + delta;
  if (next < 0) return fail('Nothing allocated');
  if (delta > 0 && used + delta > d.factoryPoints) return fail('No free capacity');
  s.run.factory[product] = next;
  return ok();
}

// ---------------- CAPSTONE ----------------
export function fundHQ(s: GameState): Result {
  if (s.meta.legacyCount < 5) return fail('Requires Legacy 5');
  const phase = s.meta.hqPhase;
  if (phase >= HQ_PHASES.length) return fail('The Empire Tower is complete');
  if (!spend(s, HQ_PHASES[phase].cost)) return fail('Not enough cash');
  s.meta.hqPhase++;
  if (s.meta.hqPhase >= HQ_PHASES.length) {
    s.meta.capstoneAt = Date.now();
    feedback.emit({ kind: 'achievement', text: 'THE EMPIRE TOWER IS COMPLETE. You built a Grip Empire.', big: true });
  } else feedback.emit({ kind: 'unlock', text: `HQ phase complete: ${HQ_PHASES[phase].name}`, big: true });
  return ok();
}

// ---------------- AUTOMATION TOGGLES ----------------
export function setAutoBuy(s: GameState, on: boolean): Result {
  if (on && !node(s, 'autobuy')) return fail('Unlock Shop Manager in the Legacy tree');
  s.run.autoBuy = on;
  return ok();
}
export function setAutoProduce(s: GameState, on: boolean): Result {
  if (on && !node(s, 'producer')) return fail('Unlock Producer in the Legacy tree');
  s.run.autoProduce = on;
  return ok();
}

/** Spend up to (1-reserve) of cash on the best-value product levels. Returns purchases made. */
export function runAutoBuyer(s: GameState, maxBuys = 20): number {
  let buys = 0;
  for (let k = 0; k < maxBuys; k++) {
    const d = computeDerived(s);
    const budget = s.run.cash * (1 - s.run.autoBuyReserve);
    let best: { id: ProductId; score: number; cost: number; unlock: boolean } | null = null;
    for (const id of Object.keys(s.run.products) as ProductId[]) {
      const lvl = s.run.products[id];
      const def = PRODUCT_BY_ID[id];
      if (lvl <= 0) {
        if (productOffered(s, id) && def.unlockCost <= budget) {
          const score = (def.incomePerLevel * d.productMult[id] * d.globalMult) / Math.max(1, def.unlockCost);
          if (!best || score * 3 > best.score) best = { id, score: score * 3, cost: def.unlockCost, unlock: true };
        }
        continue;
      }
      const cost = productBulkCost(def, lvl, 1, d.costMult[id]);
      if (cost > budget) continue;
      const gain = d.productIncome[id] / lvl;
      const ms = nextMilestone(def, lvl);
      const msBoost = ms && ms.level - lvl <= 5 ? 2 : 1;
      const score = (gain * msBoost) / cost;
      if (!best || score > best.score) best = { id, score, cost, unlock: false };
    }
    if (!best) break;
    const r = best.unlock ? unlockProduct(s, best.id) : buyProduct(s, best.id, 1, d);
    if (!r.ok) break;
    buys++;
  }
  return buys;
}

/** Producer automation: release finished projects and start the best affordable next one. */
export function runProducer(s: GameState) {
  const f = s.run.film;
  if (f && f.footage >= f.required) releaseVideo(s);
  if (!s.run.film) {
    const busy = busySkaters(s);
    const free = s.run.team.map((t) => t.id).filter((id) => !busy.has(id));
    if (!free.length) return;
    const tiers = Object.values(VIDEO_BY_ID).filter((t) => !videoLock(s, t));
    const affordable = tiers.filter((t) => videoFundCost(s, t) <= s.run.cash * 0.3);
    const tier = affordable[affordable.length - 1];
    if (!tier) return;
    const d = computeDerived(s);
    const crew = free.sort((a, b) => (d.skaters[b]?.tech ?? 0) - (d.skaters[a]?.tech ?? 0)).slice(0, tier.maxCrew);
    fundFilm(s, tier.id, crew);
  }
}

export { estimateJob };
