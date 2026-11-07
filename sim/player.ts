// Simulated player strategies driving the real game logic (no UI).
// Assumptions are explicit in PROFILES below. Results are optimistic: the bot buys with perfect
// payback math and never hesitates, so human runs should take noticeably longer.
import type { GameState } from '../src/game/state';
import { PRODUCTS, type ProductId } from '../src/game/content/products';
import { TRACKS } from '../src/game/content/tracks';
import { SKATERS, SKATER_BY_ID } from '../src/game/content/skaters';
import { ASSIGNMENTS, EVENT_TIERS, VIDEO_TIERS } from '../src/game/content/activities';
import { BRAND_LINES, FACILITIES, REGIONS, HQ_PHASES } from '../src/game/content/business';
import { LEGACY_NODES } from '../src/game/content/legacy';
import * as A from '../src/game/actions';
import { computeDerived, estimateEvent, estimateJob, trackCost, videoFundCost, type Derived } from '../src/game/economy';
import { tick, periodic } from '../src/game/tick';
import { legacyPreview, performLegacy, buyNode, nodeCost, nodeLock } from '../src/game/prestige';
import { assignmentLock, busySkaters, eventLock, isLocationOpen, productOffered, trackLock, videoLock } from '../src/game/unlocks';

export interface Profile {
  name: string;
  /** Fraction of time the player is at the counter serving (0–1). */
  serveUptime: number;
  /** Serves per second while serving (cap is 5). */
  serveRate: number;
  /** Seconds between management decisions. */
  decisionEvery: number;
  /** Responds to opportunities (rush/bulk/board). */
  engaged: boolean;
  /** Plays Film a Line every N seconds while a project is active (0 = never), with this grade. */
  lineEvery: number;
  lineGrade: number;
  /** For the first N seconds of a run the player serves regardless (bootstrapping). */
  bootstrapSec: number;
}

export const PROFILES: Record<string, Profile> = {
  active: { name: "active", serveUptime: 0.75, serveRate: 4.5, decisionEvery: 3, engaged: true, lineEvery: 240, lineGrade: 0.9, bootstrapSec: 0 },
  mixed: { name: 'mixed', serveUptime: 0.35, serveRate: 4, decisionEvery: 5, engaged: true, lineEvery: 600, lineGrade: 0.7, bootstrapSec: 120 },
  idle: { name: 'idle', serveUptime: 0, serveRate: 0, decisionEvery: 60, engaged: false, lineEvery: 0, lineGrade: 0, bootstrapSec: 150 },
};

const clone = (s: GameState): GameState => ({ ...s, run: structuredClone(s.run), meta: { ...s.meta, stats: { ...s.meta.stats } } });

/** Value function: estimated total income/s including active play for this profile. */
export function effectiveIncome(s: GameState, p: Profile, d: Derived = computeDerived(s)): number {
  let e = d.passive;
  e += p.serveUptime * Math.min(5, p.serveRate) * d.saleValue * 1.3;
  // Jobs: assume every skater is kept busy at roughly demo/contest efficiency
  for (const t of s.run.team) {
    const sk = d.skaters[t.id];
    if (!sk) continue;
    const best = ASSIGNMENTS.filter((a) => a.maxSkaters >= 1 && a.minSkaters <= 1 && !assignmentLock(s, a)).map((a) => {
      const est = estimateJob(s, d, a, [t.id]);
      return est.payout / est.duration;
    });
    e += Math.max(0, ...best) * 0.8;
  }
  if (s.run.event) {
    const t = EVENT_TIERS.find((x) => x.id === s.run.event!.tierId)!;
    e += estimateEvent(s, d, t).total / t.duration;
  }
  return e;
}

interface Candidate {
  label: string;
  cost: number;
  apply: (s: GameState) => A.Result;
}

function candidates(s: GameState, d: Derived): Candidate[] {
  const c: Candidate[] = [];
  const r = s.run;
  for (const def of PRODUCTS) {
    const lvl = r.products[def.id];
    if (lvl <= 0) {
      if (productOffered(s, def.id)) c.push({ label: `contract:${def.id}`, cost: def.unlockCost, apply: (x) => A.unlockProduct(x, def.id) });
      continue;
    }
    const one = A.productBuyPlan(s, def.id, 1, d);
    c.push({ label: `lvl:${def.id}`, cost: one.cost, apply: (x) => A.buyProduct(x, def.id, 1) });
    const nx = A.productBuyPlan(s, def.id, 'next', d);
    if (nx.n > 1 && nx.n <= 30) c.push({ label: `next:${def.id}`, cost: nx.cost, apply: (x) => A.buyProduct(x, def.id, 'next') });
    if (lvl < 40) {
      const ten = A.productBuyPlan(s, def.id, 10, d);
      c.push({ label: `ten:${def.id}`, cost: ten.cost, apply: (x) => A.buyProduct(x, def.id, 10) });
    }
  }
  for (const t of TRACKS) {
    if (['manager', 'eventCrew', 'teamVan'].includes(t.id)) continue; // handled by script
    if (trackLock(s, t.id)) continue;
    const lvl = r.tracks[t.id] ?? 0;
    if (t.maxLevel !== undefined && lvl >= t.maxLevel) continue;
    c.push({ label: `track:${t.id}`, cost: trackCost(t.id, lvl), apply: (x) => A.buyTrack(x, t.id) });
  }
  for (const t of r.team) {
    const plan = A.trainPlan(s, t.id, 1, d);
    c.push({ label: `train:${t.id}`, cost: plan.cost, apply: (x) => A.train(x, t.id, 1) });
  }
  if (isLocationOpen(s, 'workshop')) {
    for (const bl of BRAND_LINES) {
      const line = r.brand[bl.product];
      if (!line) {
        if (r.products[bl.product] > 0) c.push({ label: `brand:${bl.product}`, cost: bl.unlockCost, apply: (x) => A.designLine(x, bl.product) });
      } else {
        const plan = A.brandLevelPlan(s, bl.product, 1);
        c.push({ label: `brandlvl:${bl.product}`, cost: plan.cost, apply: (x) => A.levelLine(x, bl.product, 1) });
      }
    }
  }
  if (isLocationOpen(s, 'park')) {
    for (const f of FACILITIES) if (!r.facilities.includes(f.id)) c.push({ label: `fac:${f.id}`, cost: f.cost, apply: (x) => A.buyFacility(x, f.id) });
  }
  if (isLocationOpen(s, 'warehouse')) {
    const next = REGIONS.find((g) => !r.regions.includes(g.id));
    if (next) c.push({ label: `region:${next.id}`, cost: next.cost, apply: (x) => A.buyRegion(x, next.id) });
  }
  for (const e of EVENT_TIERS) {
    if (r.eventsUnlocked.includes(e.id) || eventLock(s, e)) continue;
    const idx = EVENT_TIERS.indexOf(e);
    if (idx > 0 && !r.eventsUnlocked.includes(EVENT_TIERS[idx - 1].id)) continue;
    if (!isLocationOpen(s, 'venue')) continue;
    c.push({
      label: `event:${e.id}`,
      cost: e.unlockCost,
      apply: (x) => {
        const res = A.unlockEvent(x, e.id);
        if (res.ok) A.hostEvent(x, e.id);
        return res;
      },
    });
  }
  return c;
}

export interface SimLog {
  t: number;
  what: string;
}

export class SimPlayer {
  log: SimLog[] = [];
  firsts = new Map<string, number>();
  lastPurchaseAt = 0;
  maxGap = 0;
  maxGapAt = 0;
  sinceLine = 0;
  lineBusy = 0;
  activeEarned = 0;
  passiveEarned = 0;
  constructor(public s: GameState, public p: Profile) {}

  mark(what: string) {
    if (!this.firsts.has(what)) {
      this.firsts.set(what, this.s.run.time);
      this.log.push({ t: this.s.run.time, what });
    }
  }

  manage() {
    const s = this.s;
    let d = computeDerived(s);
    const r = s.run;
    // Script: essentials
    if ((r.tracks.manager ?? 0) === 0 && r.team.length >= 1 && !trackLock(s, 'manager') && r.cash > trackCost('manager', 0) * 1.5) A.buyTrack(s, 'manager');
    if ((r.tracks.eventCrew ?? 0) === 0 && r.eventsUnlocked.length && r.cash > trackCost('eventCrew', 0) * 1.5) A.buyTrack(s, 'eventCrew');
    // Team: recruit best available if slot free and fee <= 40% cash
    if (isLocationOpen(s, 'team')) {
      if (r.team.length >= d.teamSlots && (r.tracks.teamVan ?? 0) < 2 && r.cash > trackCost('teamVan', r.tracks.teamVan ?? 0) * 1.2) A.buyTrack(s, 'teamVan');
      d = computeDerived(s);
      const pool = SKATERS.filter((k) => s.meta.unlockedSkaters.includes(k.id) && !r.team.some((t) => t.id === k.id));
      pool.sort((a, b) => b.signingFee - a.signingFee);
      for (const k of pool) {
        if (r.team.length >= d.teamSlots) break;
        if (k.signingFee * d.signingMult <= r.cash * 0.5) {
          if (A.recruit(s, k.id).ok) this.mark(`recruit:${k.id}`);
        }
      }
    }
    d = computeDerived(s);
    // Film
    if (isLocationOpen(s, 'spot') && r.team.length) {
      if (r.film && r.film.footage >= r.film.required) {
        A.releaseVideo(s);
        this.mark('first video');
      }
      if (!r.film) {
        const tiers = VIDEO_TIERS.filter((t) => !videoLock(s, t) && videoFundCost(s, t) <= r.cash * 0.35);
        const tier = tiers[tiers.length - 1];
        if (tier) {
          const busy = busySkaters(s);
          const crew = r.team.map((t) => t.id).filter((id) => !busy.has(id)).sort((a, b) => d.skaters[b].tech - d.skaters[a].tech).slice(0, Math.max(1, Math.min(tier.maxCrew, r.team.length - 1)));
          if (crew.length && A.fundFilm(s, tier.id, crew).ok) this.mark(`fund:${tier.id}`);
        }
      }
    }
    // Jobs for idle skaters (keep at least nothing reserved)
    if (isLocationOpen(s, 'team')) {
      const busy = busySkaters(s);
      let idle = r.team.map((t) => t.id).filter((id) => !busy.has(id));
      // tours first if >=2 idle
      const tours = ASSIGNMENTS.filter((a) => a.kind === 'tour' && !assignmentLock(s, a)).reverse();
      for (const a of tours) {
        if (idle.length >= a.minSkaters) {
          const pick = idle.slice(0, a.maxSkaters);
          if (A.startJob(s, a.id, pick, true).ok) {
            idle = idle.filter((x) => !pick.includes(x));
            this.mark('first tour');
          }
        }
      }
      for (const id of idle) {
        const opts = ASSIGNMENTS.filter((a) => a.minSkaters <= 1 && !assignmentLock(s, a));
        let best = opts[0];
        let bestRate = -1;
        for (const a of opts) {
          const est = estimateJob(s, d, a, [id]);
          if (est.payout / est.duration > bestRate) {
            bestRate = est.payout / est.duration;
            best = a;
          }
        }
        if (best && A.startJob(s, best.id, [id], true).ok) this.mark('first job');
      }
    }
    // Brand signatures & focus: pair best skaters to biggest lines
    if (isLocationOpen(s, 'workshop')) {
      const lines = Object.entries(r.brand).sort((a, b) => (d.productIncome[b[0] as ProductId] ?? 0) - (d.productIncome[a[0] as ProductId] ?? 0));
      const used = new Set<string>();
      for (const [pid, line] of lines) {
        if (!line) continue;
        if (line.signature && r.team.some((t) => t.id === line.signature)) {
          used.add(line.signature);
          continue;
        }
        const sk = r.team.find((t) => !used.has(t.id) && !Object.values(r.brand).some((l) => l?.signature === t.id));
        if (sk) {
          A.setSignature(s, pid as ProductId, sk.id);
          used.add(sk.id);
        }
      }
    }
    // Distribution: slot top-income categories
    if (isLocationOpen(s, 'warehouse')) {
      d = computeDerived(s);
      const top = (Object.keys(d.productIncome) as ProductId[]).filter((p) => r.products[p] > 0).sort((a, b) => d.productIncome[b] - d.productIncome[a]);
      r.distroSlots = top.slice(0, d.distroSlots);
    }
    // Factory: spread points over top brand lines
    if (isLocationOpen(s, 'factory')) {
      d = computeDerived(s);
      const lines = (Object.keys(r.brand) as ProductId[]).sort((a, b) => (d.brandByLine[b]?.income ?? 0) - (d.brandByLine[a]?.income ?? 0));
      if (lines.length) {
        r.factory = {};
        for (let i = 0; i < d.factoryPoints; i++) {
          const p = lines[i % Math.min(3, lines.length)];
          r.factory[p] = (r.factory[p] ?? 0) + 1;
        }
      }
    }
    // HQ
    if (s.meta.legacyCount >= 5 && s.meta.hqPhase < 5 && r.cash >= HQ_PHASES[s.meta.hqPhase].cost) {
      A.fundHQ(s);
      this.mark(`hq:${s.meta.hqPhase}`);
    }
    // Greedy payback purchases
    for (let k = 0; k < 10; k++) {
      d = computeDerived(s);
      const base = effectiveIncome(s, this.p, d);
      let best: { c: Candidate; payback: number } | null = null;
      for (const c of candidates(s, d)) {
        if (!Number.isFinite(c.cost) || c.cost <= 0) continue;
        if (c.cost > r.cash * 4 + base * 300) continue; // ignore far-off things
        const x = clone(s);
        x.run.cash = c.cost * 2 + 1;
        if (!c.apply(x).ok) continue;
        const gain = effectiveIncome(x, this.p) - base;
        if (gain <= 0) continue;
        const payback = c.cost / gain + c.cost / Math.max(base, 1e-9) * 0.15;
        if (!best || payback < best.payback) best = { c, payback };
      }
      if (!best || best.c.cost > r.cash) break;
      if (best.c.apply(s).ok) {
        this.mark(best.c.label);
        const gap = r.time - this.lastPurchaseAt;
        if (gap > this.maxGap) {
          this.maxGap = gap;
          this.maxGapAt = this.lastPurchaseAt;
        }
        this.lastPurchaseAt = r.time;
      } else break;
    }
  }

  serveAcc = 0;
  /** Advance one second of play. */
  step() {
    const s = this.s;
    const p = this.p;
    const r = s.run;
    const boot = r.time < p.bootstrapSec;
    const serving = boot || (this.lineBusy <= 0 && p.serveUptime > 0);
    const rate = boot ? 4 : p.serveRate * p.serveUptime;
    const engaged = p.engaged || boot;
    const before = r.earnings;
    tick(s, 1, { mode: 'online', engaged, quiet: true });
    this.passiveEarned += r.earnings - before;
    if (serving) {
      this.serveAcc += rate;
      const d = computeDerived(s);
      const b2 = r.earnings;
      while (this.serveAcc >= 1) {
        this.serveAcc -= 1;
        r.sinceServe = A.SERVE_INTERVAL;
        A.serve(s, d);
      }
      this.activeEarned += r.earnings - b2;
    }
    // Opportunities
    if (engaged && r.opp) {
      if (r.opp.kind === 'rush') A.openRush(s);
      else if (r.opp.kind === 'bulk' && !r.opp.accepted && serving) A.acceptBulk(s);
      else if (r.opp.kind === 'board') {
        const ans = A.BOARD_STYLES[r.opp.style].answer;
        const ok = Math.random() < 0.8;
        A.completeBoard(s, ok ? ans : { ...ans, wheels: (ans.wheels + 1) % 3 });
      }
    }
    // Minigame
    if (p.lineEvery > 0 && r.film && r.film.footage < r.film.required) {
      this.sinceLine += 1;
      if (this.lineBusy > 0) {
        this.lineBusy--;
        if (this.lineBusy === 0) {
          const g = Math.max(0, Math.min(1.5, p.lineGrade + (Math.random() - 0.5) * 0.4));
          A.applyLineResult(s, { attemptId: `sim${r.time}`, score: g * 3000, grade: g, perfects: 3 });
          this.mark('first line');
        }
      } else if (this.sinceLine >= p.lineEvery) {
        this.sinceLine = 0;
        this.lineBusy = 30;
      }
    }
    if (Math.floor(r.time) % 1 === 0) periodic(s, { mode: 'online', quiet: true });
    if (Math.floor(r.time) % p.decisionEvery === 0 || boot) this.manage();
    if (r.tracks.staff >= 1) this.mark('staff');
    if (isLocationOpen(s, 'team')) this.mark('team open');
    if (r.videos.length) this.mark('video released');
    if (r.stats.eventsHosted) this.mark('event hosted');
    if (legacyPreview(s).available) this.mark('legacy available');
  }
}

/** Spend Cred on the tree using a simple rotating priority (active players favor active nodes). */
export function spendCred(s: GameState, profile: Profile) {
  const pri =
    profile.name === 'idle'
      ? ['loyal', 'dayone', 'nightshift', 'weekend', 'office', 'network', 'seed', 'camp', 'seat', 'kept', 'autobuy', 'producer', 'buzz', 'scouting', 'founder', 'reputation', 'tongue', 'zone', 'rush', 'instinct']
      : ['loyal', 'tongue', 'dayone', 'office', 'network', 'seed', 'camp', 'seat', 'rush', 'zone', 'kept', 'instinct', 'autobuy', 'producer', 'buzz', 'scouting', 'nightshift', 'weekend', 'founder', 'reputation'];
  for (let guard = 0; guard < 500; guard++) {
    let bought = false;
    // buy the cheapest available among the top priorities
    const opts = pri
      .map((id) => LEGACY_NODES.find((n) => n.id === id)!)
      .filter((n) => !nodeLock(s, n.id) && (s.meta.nodes[n.id] ?? 0) < n.maxLevel)
      .map((n) => ({ n, cost: nodeCost(n.id, s.meta.nodes[n.id] ?? 0) }))
      .sort((a, b) => a.cost - b.cost);
    for (const o of opts) {
      if (o.cost <= s.meta.cred) {
        if (buyNode(s, o.n.id).ok) {
          bought = true;
          break;
        }
      }
    }
    if (!bought) break;
  }
}

export { legacyPreview, performLegacy, SKATER_BY_ID };
