// The economy calculation pipeline. Every income number in the game comes from here.
//
// Stacking rules (see DESIGN.md):
//  * Multipliers within one "bucket" (e.g. all skater bonuses of the same kind) ADD, buckets MULTIPLY.
//  * shopBase = Σ product income including permanent & run multipliers, EXCLUDING staffing and
//    EXCLUDING all temporary/active bonuses. Secondary systems pay out in "seconds of shopBase",
//    so no payout ever feeds on itself or on a temporary bonus.
//  * Temporary bonuses (rush, streak, crowd hype) are applied only at the moment of a manual/active reward.
import type { GameState, SignedSkater } from './state';
import { PRODUCTS, PRODUCT_BY_ID, type ProductDef, type ProductId } from './content/products';
import { TRACK_BY_ID } from './content/tracks';
import { SKATER_BY_ID, type SkaterDef } from './content/skaters';
import {
  ASSIGNMENT_BY_ID,
  CONTEST_PLACES,
  EVENT_BY_ID,
  VIDEO_BY_ID,
  type AssignmentDef,
  type EventTierDef,
  type VideoTierDef,
} from './content/activities';
import {
  BRAND_CAT_PER_LEVEL,
  BRAND_FOCUS,
  BRAND_LEVEL_COST_FRAC,
  BRAND_LEVEL_GROWTH,
  BRAND_LINES,
  DISTRO_REACH_MULT,
  FACILITIES,
  FACTORY_EXP_BRAND,
  FACTORY_EXP_CAT,
  HQ_PHASE_MULT,
  PARK_VISITOR_RATE,
  REGIONS,
  SPECIALTY_FIT,
} from './content/business';
import { CRED_INCOME_BONUS } from './content/legacy';
import { OFFLINE_BASE_CAP_HOURS, OFFLINE_BASE_EFFICIENCY } from './config';

/** Manual sale = (1 + SALE_SEC × shopBase) × saleMult. */
export const SALE_SEC = 0.12;
/** Auto filming footage per point of crew Tech per second. */
export const FOOTAGE_PER_TECH = 0.12;
export const STREAK_BASE_MAX = 20;
export const STREAK_PER_STACK = 0.02;
export const RUSH_MULT = 3;
export const RUSH_DURATION = 12;
export const TRAINING_GROWTH = 1.3;
export const TRAINING_MILESTONES = [10, 25, 50, 100, 150, 200, 300];
export const BRAND_INCOME_FRAC = 0.03;
export const MEMBERSHIP_FRAC = 0.04;

export interface SkaterCalc {
  id: string;
  tech: number;
  flow: number;
  hype: number;
  bonusScale: number;
}

export interface Derived {
  globalMult: number;
  fanMult: number;
  productMult: Record<ProductId, number>;
  productIncome: Record<ProductId, number>;
  costMult: Record<ProductId, number>;
  shopBase: number;
  staffFactor: number;
  shopPassive: number;
  onlineShare: number;
  online: number;
  royalties: number;
  brandIncome: number;
  brandByLine: Partial<Record<ProductId, { income: number; catMult: number; fans: number; sig: number }>>;
  brandFansPerSec: number;
  parkVisitors: number;
  parkIncome: number;
  members: number;
  passive: number;
  saleValue: number;
  saleMult: number;
  streakMax: number;
  teamSlots: number;
  skaters: Record<string, SkaterCalc>;
  footageRate: number;
  trainingMult: number;
  signingMult: number;
  tourPayMult: number;
  tourFansMult: number;
  contestMult: number;
  eventCapMult: number;
  eventDemandMult: number;
  eventVendorBonus: number;
  eventSponsorBonus: number;
  eventBroadcastBonus: number;
  eventBonusMult: number;
  distroReach: number;
  distroSlots: number;
  factoryPoints: number;
  offlineEff: number;
  offlineCapSec: number;
  oppFreq: number;
  oppReward: number;
  lineTiming: number;
  lineFootageMult: number;
}

export const node = (s: GameState, id: string) => s.meta.nodes[id] ?? 0;
export const trackLevel = (s: GameState, id: string) => s.run.tracks[id] ?? 0;
export const trackValue = (s: GameState, id: string) => TRACK_BY_ID[id].value(trackLevel(s, id));

export const milestoneMults = (def: ProductDef, level: number) => {
  let self = 1;
  let global = 1;
  let sale = 1;
  for (const m of def.milestones) {
    if (level < m.level) break;
    self *= m.self;
    if (m.global) global *= m.global;
    if (m.sale) sale *= m.sale;
  }
  return { self, global, sale };
};

export const nextMilestone = (def: ProductDef, level: number) => def.milestones.find((m) => m.level > level) ?? null;

/** Lifetime Cred bonus: sqrt(1 + 0.1 × Cred earned). Sublinear so prestige growth stays geometric. */
export const credMult = (credEarned: number) => Math.sqrt(1 + CRED_INCOME_BONUS * Math.max(0, credEarned));

export const fanMultFor = (fans: number) => Math.pow(1 + Math.max(0, fans) / 1000, 0.2);

export const trainingScale = (level: number) => {
  let ms = 0;
  for (const m of TRAINING_MILESTONES) if (level >= m) ms++;
  return (1 + 0.05 * level) * Math.pow(1.25, ms);
};

/** Business-bonus scale grows slower than stats (sqrt) so trained skaters can't snowball a single stream. */
export const bonusScale = (level: number) => Math.sqrt(trainingScale(level));

export const nextTrainingMilestone = (level: number) => TRAINING_MILESTONES.find((m) => m > level) ?? null;

function computeSkaters(team: SignedSkater[]): { calcs: Record<string, SkaterCalc>; bonus: Record<string, number>; productPct: Partial<Record<ProductId, number>> } {
  const bonus: Record<string, number> = {};
  const productPct: Partial<Record<ProductId, number>> = {};
  const raw = team
    .map((t) => ({ t, def: SKATER_BY_ID[t.id] }))
    .filter((x) => !!x.def)
    .map(({ t, def }) => ({ def, scale: trainingScale(t.training), bscale: bonusScale(t.training) }));
  for (const { def, bscale } of raw) {
    const b = def.bonus;
    const v = b.pct * bscale;
    if (b.kind === 'products') {
      for (const p of b.products) productPct[p] = (productPct[p] ?? 0) + v;
    } else {
      bonus[b.kind] = (bonus[b.kind] ?? 0) + v;
    }
  }
  const calcs: Record<string, SkaterCalc> = {};
  for (const { def, scale, bscale } of raw) {
    // Team-support bonus from OTHER skaters only.
    let support = 0;
    for (const o of raw) if (o.def.id !== def.id && o.def.bonus.kind === 'teamStats') support += o.def.bonus.pct * o.bscale;
    const k = scale * (1 + Math.min(support, 3));
    calcs[def.id] = { id: def.id, tech: def.tech * k, flow: def.flow * k, hype: def.hype * k, bonusScale: bscale };
  }
  return { calcs, bonus, productPct };
}

export function signatureMult(skaterId: string | null, product: ProductId, training: number): number {
  if (!skaterId) return 1;
  const def = SKATER_BY_ID[skaterId];
  if (!def) return 1;
  let base = 1.15;
  if (def.signature === product) base = 2;
  else if (SPECIALTY_FIT[def.specialty].includes(product)) base = 1.5;
  else if (def.specialty === 'allround') base = 1.3;
  return base * (1 + 0.02 * training);
}

export function computeDerived(s: GameState): Derived {
  const r = s.run;
  const m = s.meta;
  const N = (id: string) => m.nodes[id] ?? 0;
  const TV = (id: string) => trackValue(s, id);
  const TL = (id: string) => trackLevel(s, id);

  const { calcs, bonus, productPct } = computeSkaters(r.team);
  const B = (k: string) => bonus[k] ?? 0;

  const globalMult =
    credMult(m.credEarned) *
    Math.pow(1.25, N('reputation')) *
    (1 + 0.01 * m.achievements.length) *
    Math.pow(HQ_PHASE_MULT, m.hqPhase);
  const fanMult = fanMultFor(r.fans);

  // Global product milestones and sale milestones
  let msGlobal = 1;
  let msSale = 1;
  const msSelf: Partial<Record<ProductId, number>> = {};
  for (const def of PRODUCTS) {
    const lvl = r.products[def.id] ?? 0;
    const mm = milestoneMults(def, lvl);
    msSelf[def.id] = mm.self;
    msGlobal *= mm.global;
    msSale *= mm.sale;
  }

  // Distribution
  const distroReach = REGIONS.filter((x) => r.regions.includes(x.id)).reduce((a, x) => a + x.reach, 0) * TV('logistics');
  const distroSlots = TV('warehouse');
  const distroMult = (p: ProductId) => (r.distroSlots.includes(p) ? 1 + DISTRO_REACH_MULT * distroReach : 1);

  // Factory
  const factoryPoints = m.legacyCount >= 4 ? TV('productionLines') : 0;
  const fp = (p: ProductId) => (r.factory[p] ?? 0);

  // Brand lines (category multipliers first)
  const brandCat: Partial<Record<ProductId, number>> = {};
  const brandSig: Partial<Record<ProductId, number>> = {};
  for (const bl of BRAND_LINES) {
    const line = r.brand[bl.product];
    if (!line || line.level <= 0) continue;
    const tr = r.team.find((t) => t.id === line.signature)?.training ?? 0;
    const sig = line.signature && r.team.some((t) => t.id === line.signature) ? signatureMult(line.signature, bl.product, tr) : 1;
    brandSig[bl.product] = sig;
    brandCat[bl.product] = 1 + BRAND_CAT_PER_LEVEL * line.level * BRAND_FOCUS[line.focus].catMult * sig;
  }

  const hasFacility = (id: string) => r.facilities.includes(id);
  const marketing = TV('marketing');
  const displays = TV('displays');
  const loyal = Math.pow(1.25, N('loyal'));
  const annex = hasFacility('annex') ? 1.25 : 1;
  const allPct = 1 + B('allProducts');

  const productMult = {} as Record<ProductId, number>;
  const productIncome = {} as Record<ProductId, number>;
  const costMult = {} as Record<ProductId, number>;
  const marginMult = TV('margins') * Math.pow(0.85, N('network'));
  let shopBase = 0;
  for (const def of PRODUCTS) {
    const id = def.id;
    const lvl = r.products[id] ?? 0;
    const merch = id === 'shoes' || id === 'apparel' ? 1 + r.merchBoost : 1;
    const mult =
      (msSelf[id] ?? 1) *
      msGlobal *
      marketing *
      displays *
      fanMult *
      (allPct + (productPct[id] ?? 0)) *
      (brandCat[id] ?? 1) *
      distroMult(id) *
      Math.pow(1 + 0.25 * fp(id), FACTORY_EXP_CAT) *
      merch *
      loyal *
      annex;
    productMult[id] = mult;
    const inc = lvl * def.incomePerLevel * mult * globalMult;
    productIncome[id] = inc;
    shopBase += inc;
    costMult[id] = marginMult;
  }

  const staffFactor = TV('staff');
  const shopPassive = shopBase * staffFactor;

  const onlineShare = (TV('online') + (m.legacyCount >= 3 ? TV('fulfillment') : 0)) * (1 + B('online'));
  const online = shopPassive * onlineShare;

  const royalties = r.videos.reduce((a, v) => a + v.royaltyBase, 0) * (1 + B('royalties'));

  // Brand income
  let brandIncome = 0;
  let brandFansPerSec = 0;
  const brandByLine: Derived['brandByLine'] = {};
  const rnd = m.legacyCount >= 4 ? TV('rnd') : 1;
  BRAND_LINES.forEach((bl, idx) => {
    const line = r.brand[bl.product];
    if (!line || line.level <= 0) return;
    const f = BRAND_FOCUS[line.focus];
    const sig = brandSig[bl.product] ?? 1;
    const inc =
      productIncome[bl.product] * BRAND_INCOME_FRAC * line.level * f.incomeMult * sig * rnd * Math.pow(1 + 0.5 * fp(bl.product), FACTORY_EXP_BRAND) * distroMult(bl.product);
    const fans = 0.05 * line.level * f.fansMult * sig * Math.pow(idx + 1, 1.5);
    brandIncome += inc;
    brandFansPerSec += fans;
    brandByLine[bl.product] = { income: inc, catMult: brandCat[bl.product] ?? 1, fans, sig };
  });

  // Skatepark
  const parkOpen = m.legacyCount >= 2 && hasFacility('miniramp');
  const parkVisitors = parkOpen ? FACILITIES.filter((f) => hasFacility(f.id)).reduce((a, f) => a + f.visitors, 0) : 0;
  const parkSpend = TV('admission') * (1 + 0.25 * TL('lessons')) * (1 + B('park'));
  const parkIncome = parkOpen ? shopBase * PARK_VISITOR_RATE * parkVisitors * parkSpend : 0;
  const members = parkOpen ? shopBase * MEMBERSHIP_FRAC * TL('memberships') * (1 + B('park')) : 0;

  const passive = shopPassive + online + royalties + brandIncome + parkIncome + members;

  // Manual sales scale with the shop's passive capacity (never below shopBase), with a deliberately small
  // set of manual multipliers so active play stays ~2–4× unattended income rather than running away.
  const saleMult = TV('checkout') * msSale * (1 + B('sale')) * Math.pow(1.12, N('tongue'));
  const saleValue = (1 + SALE_SEC * shopBase * Math.max(1, staffFactor)) * saleMult;

  const teamSlots = 2 + TL('teamVan') + N('seat') + (m.legacyCount >= 2 ? 1 : 0);

  let crewTech = 0;
  if (r.film) for (const id of r.film.crew) crewTech += calcs[id]?.tech ?? 0;
  const footageRate = crewTech * FOOTAGE_PER_TECH * TV('camera') * (1 + B('footage')) * (hasFacility('plaza') ? 1.3 : 1);

  const trainingMult =
    TV('coaching') * Math.pow(0.8, N('camp')) * Math.pow(0.95, TL('lessons')) * (1 - Math.min(0.75, B('training')));

  return {
    globalMult,
    fanMult,
    productMult,
    productIncome,
    costMult,
    shopBase,
    staffFactor,
    shopPassive,
    onlineShare,
    online,
    royalties,
    brandIncome,
    brandByLine,
    brandFansPerSec,
    parkVisitors,
    parkIncome,
    members,
    passive,
    saleValue,
    saleMult,
    streakMax: 20 + 2 * TL('checkout') + 10 * N('zone'),
    teamSlots,
    skaters: calcs,
    footageRate,
    trainingMult,
    signingMult: Math.pow(0.6, N('scouting')),
    tourPayMult: TV('tourPromo') * (1 + B('tours')),
    tourFansMult: TV('tourScale') * (hasFacility('vert') ? 1.6 : 1),
    contestMult: (1 + B('contests')) * (hasFacility('bowl') ? 1.4 : 1),
    eventCapMult: TV('venue') * (hasFacility('indoor') ? 1.5 : 1),
    eventDemandMult: TV('eventPromo') * Math.pow(1 + r.fans / 1000, 0.12),
    eventVendorBonus: 0.15 * TL('vendors'),
    eventSponsorBonus: 0.2 * TL('sponsors'),
    eventBroadcastBonus: 0.3 * TL('broadcast'),
    eventBonusMult: 1 + B('events'),
    distroReach,
    distroSlots,
    factoryPoints,
    offlineEff: Math.min(1, OFFLINE_BASE_EFFICIENCY + 0.1 * N('nightshift') + (m.legacyCount >= 4 ? TV('robotics') : 0)),
    offlineCapSec: (OFFLINE_BASE_CAP_HOURS + 4 * N('weekend')) * 3600,
    oppFreq: 1 + 0.3 * N('rush'),
    oppReward: 1 + 0.25 * N('rush'),
    lineTiming: 1 + 0.03 * TL('lens') + 0.08 * N('instinct'),
    lineFootageMult: TV('lens') * (1 + 0.3 * N('instinct')),
  };
}

// ---------------- COSTS ----------------
/** Cost to go from `level` to `level+1` (level ≥ 1). */
export const productLevelCost = (def: ProductDef, level: number, costMult: number) =>
  def.baseCost * Math.pow(def.growth, level - 1) * costMult;

/** Total cost of buying n levels starting at `level`. Geometric series. */
export const productBulkCost = (def: ProductDef, level: number, n: number, costMult: number) => {
  if (n <= 0) return 0;
  const first = productLevelCost(def, level, costMult);
  return (first * (Math.pow(def.growth, n) - 1)) / (def.growth - 1);
};

/** Maximum levels affordable with `cash`, verified so it can never overspend. */
export const productMaxAffordable = (def: ProductDef, level: number, cash: number, costMult: number) => {
  const first = productLevelCost(def, level, costMult);
  if (!(cash >= first) || !isFinite(first)) return 0;
  let n = Math.floor(Math.log(1 + (cash * (def.growth - 1)) / first) / Math.log(def.growth));
  n = Math.max(0, Math.min(n, 100_000));
  while (n > 0 && productBulkCost(def, level, n, costMult) > cash) n--;
  while (productBulkCost(def, level, n + 1, costMult) <= cash && n < 100_000) n++;
  return n;
};

export const trackCost = (id: string, level: number) => {
  const t = TRACK_BY_ID[id];
  return t.baseCost * Math.pow(t.growth, level);
};

export const trainingCost = (s: GameState, d: Derived, skater: SkaterDef, level: number) => {
  let mult = d.trainingMult;
  if (skater.specialty === 'transition' && s.run.facilities.includes('bowl')) mult *= 0.75;
  return skater.trainBase * Math.pow(TRAINING_GROWTH, level) * mult;
};

export const signingCost = (d: Derived, skater: SkaterDef) => skater.signingFee * d.signingMult;

export const videoFundCost = (s: GameState, tier: VideoTierDef) => tier.fundCost * Math.pow(tier.fundGrowth, s.run.videoCounts[tier.id] ?? 0);

export const brandLevelCost = (unlockCost: number, level: number) => unlockCost * BRAND_LEVEL_COST_FRAC * Math.pow(BRAND_LEVEL_GROWTH, level - 1);

// ---------------- ACTIVITY ESTIMATES ----------------
export interface JobEstimate {
  payout: number;
  fans: number;
  duration: number;
  place?: string;
  strength: number;
  ratio: number;
}

export function estimateJob(s: GameState, d: Derived, a: AssignmentDef, skaterIds: string[]): JobEstimate {
  const stats = skaterIds.map((id) => d.skaters[id]).filter(Boolean);
  let strength = 0;
  for (const st of stats) {
    if (a.stat === 'all') strength += (st.tech + st.flow + st.hype) / 3;
    else strength += st[a.stat] + (a.kind === 'contest' ? st.tech * 0.25 : 0);
  }
  const ratio = strength / a.statNorm;
  let payout: number;
  let fans: number;
  let place: string | undefined;
  let duration = a.duration;
  if (a.kind === 'contest') {
    const pl = CONTEST_PLACES.find((p) => ratio >= p.minRatio) ?? CONTEST_PLACES[CONTEST_PLACES.length - 1];
    place = pl.label;
    payout = a.payoutSec * d.shopBase * pl.mult * d.contestMult;
    fans = a.fans * pl.mult;
  } else {
    const factor = Math.max(0.2, Math.min(2.5, Math.pow(Math.max(ratio, 0.01), 0.6)));
    payout = a.payoutSec * d.shopBase * factor * d.tourPayMult;
    fans = a.fans * factor * d.tourFansMult;
    if (a.kind === 'tour') duration = a.duration * trackValue(s, 'transport');
  }
  return { payout, fans, duration, place, strength, ratio };
}

export interface EventEstimate {
  attendance: number;
  demand: number;
  capacity: number;
  /** Revenue split for display (sums to total). */
  tickets: number;
  vendors: number;
  sponsors: number;
  broadcast: number;
  total: number;
  fans: number;
}

/** Event revenue = shopBase × revenueSec × (attendance / base demand) × (1 + vendor + sponsor + broadcast bonuses). */
export function estimateEvent(s: GameState, d: Derived, t: EventTierDef, hypeBonus = 0): EventEstimate {
  const head = s.run.eventHeadliner ? d.skaters[s.run.eventHeadliner] : undefined;
  const headMult = head ? 1 + 0.02 * head.hype : 1;
  const demand = t.demand * d.eventDemandMult * headMult;
  const capacity = t.capacity * d.eventCapMult;
  const attendance = Math.min(demand, capacity);
  const k = d.shopBase * t.revenueSec * (attendance / t.demand) * d.eventBonusMult * (1 + hypeBonus);
  const bc = t.broadcast ? d.eventBroadcastBonus : 0;
  const tickets = k;
  const vendors = k * d.eventVendorBonus;
  const sponsors = k * d.eventSponsorBonus;
  const broadcast = k * bc;
  return { attendance, demand, capacity, tickets, vendors, sponsors, broadcast, total: tickets + vendors + sponsors + broadcast, fans: attendance * t.fansPerAttendee };
}

export function videoQuality(s: GameState, d: Derived, tier: VideoTierDef, crew: string[], bestGrade: number) {
  const techs = crew.map((id) => d.skaters[id]?.tech ?? 0);
  const avg = techs.length ? techs.reduce((a, b) => a + b, 0) / techs.length : 0;
  return 0.5 + 0.5 * Math.min(1.5, avg / tier.techNorm) + trackValue(s, 'editing') + 0.4 * Math.min(1.5, bestGrade);
}

export const productById = (id: ProductId) => PRODUCT_BY_ID[id];
export const assignmentById = (id: string) => ASSIGNMENT_BY_ID[id];
export const eventById = (id: string) => EVENT_BY_ID[id];
export const videoById = (id: string) => VIDEO_BY_ID[id];

/** Clamp any number into a safe finite non-negative value. */
export const safe = (x: number) => (Number.isFinite(x) && x > 0 ? Math.min(x, 1e300) : 0);
