// Team assignments, filming projects and hosted events. Pure data.
//
// Payouts are expressed in "seconds of shop base income" (see economy.shopBase):
// the shop's steady income before staffing and before any temporary bonus.
// This keeps every system relevant across the whole game without feeding back on itself.

export type AssignmentKind = 'demo' | 'contest' | 'tour';

export interface AssignmentDef {
  id: string;
  kind: AssignmentKind;
  name: string;
  desc: string;
  /** Seconds (before transport upgrades for tours). */
  duration: number;
  minSkaters: number;
  maxSkaters: number;
  /** Payout in seconds of shop base income at "normal" stat strength. */
  payoutSec: number;
  /** Fans gained at normal strength. */
  fans: number;
  /** Main stat used and the stat value considered "normal" for this tier. */
  stat: 'tech' | 'flow' | 'hype' | 'all';
  statNorm: number;
  /** Tour-only: permanent (run) merch boost to shoes & apparel income, per completion. */
  merchBoost?: number;
  requires?: { legacy?: number; transport?: number; unlockedEvent?: string };
}

export const ASSIGNMENTS: AssignmentDef[] = [
  {
    id: 'demo',
    kind: 'demo',
    name: 'Shop Demo',
    desc: 'A quick demo in the parking lot. Short, pays a little, wins local fans.',
    duration: 60,
    minSkaters: 1,
    maxSkaters: 2,
    payoutSec: 8,
    fans: 15,
    stat: 'hype',
    statNorm: 8,
  },
  {
    id: 'contestLocal',
    kind: 'contest',
    name: 'Bowl Jam (contest)',
    desc: 'Local contest. Placement depends on Flow vs the field. Podiums pay big.',
    duration: 180,
    minSkaters: 1,
    maxSkaters: 1,
    payoutSec: 30,
    fans: 40,
    stat: 'flow',
    statNorm: 8,
  },
  {
    id: 'contestCity',
    kind: 'contest',
    name: 'City Series (contest)',
    desc: 'Tougher field. Train your transition skaters.',
    duration: 360,
    minSkaters: 1,
    maxSkaters: 1,
    payoutSec: 80,
    fans: 200,
    stat: 'flow',
    statNorm: 25,
  },
  {
    id: 'contestPro',
    kind: 'contest',
    name: 'Pro Open (contest)',
    desc: 'The pros show up. A win here is career-making.',
    duration: 600,
    minSkaters: 1,
    maxSkaters: 1,
    payoutSec: 160,
    fans: 2_000,
    stat: 'flow',
    statNorm: 90,
    requires: { legacy: 1 },
  },
  {
    id: 'contestWorld',
    kind: 'contest',
    name: 'World Championship (contest)',
    desc: 'The biggest stage in skateboarding.',
    duration: 900,
    minSkaters: 1,
    maxSkaters: 1,
    payoutSec: 320,
    fans: 40_000,
    stat: 'flow',
    statNorm: 400,
    requires: { legacy: 4 },
  },
  {
    id: 'tourVan',
    kind: 'tour',
    name: 'Van Tour',
    desc: 'Four towns, one van, zero sleep. Pays out at the end and boosts shoe & apparel sales for the run.',
    duration: 480,
    minSkaters: 2,
    maxSkaters: 3,
    payoutSec: 80,
    fans: 300,
    stat: 'all',
    statNorm: 15,
    merchBoost: 0.05,
  },
  {
    id: 'tourRegional',
    kind: 'tour',
    name: 'Regional Tour',
    desc: 'Two weeks on the road. Needs a better ride (Transport 2).',
    duration: 900,
    minSkaters: 2,
    maxSkaters: 4,
    payoutSec: 180,
    fans: 2_500,
    stat: 'all',
    statNorm: 40,
    merchBoost: 0.08,
    requires: { transport: 2 },
  },
  {
    id: 'tourNational',
    kind: 'tour',
    name: 'National Tour',
    desc: 'Coast to coast. Unlocked by Legacy 3.',
    duration: 1500,
    minSkaters: 3,
    maxSkaters: 5,
    payoutSec: 350,
    fans: 30_000,
    stat: 'all',
    statNorm: 150,
    merchBoost: 0.12,
    requires: { legacy: 3, transport: 3 },
  },
  {
    id: 'tourWorld',
    kind: 'tour',
    name: 'World Tour',
    desc: 'Twelve countries. Your logo on every continent.',
    duration: 2400,
    minSkaters: 4,
    maxSkaters: 6,
    payoutSec: 600,
    fans: 400_000,
    stat: 'all',
    statNorm: 500,
    merchBoost: 0.2,
    requires: { legacy: 3, transport: 5 },
  },
];

export const ASSIGNMENT_BY_ID: Record<string, AssignmentDef> = Object.fromEntries(ASSIGNMENTS.map((a) => [a.id, a]));

/** Contest placement from score ratio (score / statNorm). Deterministic so results are predictable. */
export const CONTEST_PLACES = [
  { minRatio: 2.0, label: '1st place', mult: 3 },
  { minRatio: 1.4, label: '2nd place', mult: 2 },
  { minRatio: 1.0, label: '3rd place', mult: 1.4 },
  { minRatio: 0.6, label: 'Top 10', mult: 0.6 },
  { minRatio: 0, label: 'Early exit', mult: 0.25 },
];

// ---------------- VIDEO PROJECTS ----------------
export interface VideoTierDef {
  id: string;
  name: string;
  desc: string;
  /** Funding cost for the first project of this tier (in $). Repeats cost more. */
  fundCost: number;
  fundGrowth: number;
  footage: number;
  /** Royalty rate as a fraction of shop base income captured at release, × quality. */
  royaltyFrac: number;
  fans: number;
  /** Average Tech the crew needs for full base quality. */
  techNorm: number;
  maxCrew: number;
  requires?: { legacy?: number; product?: string };
}

export const VIDEO_TIERS: VideoTierDef[] = [
  {
    id: 'clip',
    name: 'Phone Clip',
    desc: 'A 30-second clip for the shop account.',
    fundCost: 400,
    fundGrowth: 2,
    footage: 50,
    royaltyFrac: 0.03,
    fans: 25,
    techNorm: 5,
    maxCrew: 1,
  },
  {
    id: 'shopvid',
    name: 'Shop Video',
    desc: 'A proper shop video with a premiere night.',
    fundCost: 12_000,
    fundGrowth: 2.5,
    footage: 260,
    royaltyFrac: 0.08,
    fans: 250,
    techNorm: 9,
    maxCrew: 2,
  },
  {
    id: 'mixtape',
    name: 'Team Mixtape',
    desc: 'Everyone gets a section. Hard drives full of slams.',
    fundCost: 400_000,
    fundGrowth: 3,
    footage: 900,
    royaltyFrac: 0.14,
    fans: 2_000,
    techNorm: 18,
    maxCrew: 3,
  },
  {
    id: 'fulllength',
    name: 'Full-Length',
    desc: 'Two years of filming condensed into a classic.',
    fundCost: 3e7,
    fundGrowth: 3,
    footage: 2_800,
    royaltyFrac: 0.25,
    fans: 20_000,
    techNorm: 45,
    maxCrew: 3,
  },
  {
    id: 'brandvid',
    name: 'Brand Video',
    desc: 'Your own brand\'s debut video. Requires Legacy 1.',
    fundCost: 5e9,
    fundGrowth: 3.5,
    footage: 7_000,
    royaltyFrac: 0.4,
    fans: 200_000,
    techNorm: 110,
    maxCrew: 4,
    requires: { legacy: 1 },
  },
  {
    id: 'feature',
    name: 'Feature Documentary',
    desc: 'A streaming-service documentary about your empire. Requires Legacy 3.',
    fundCost: 5e12,
    fundGrowth: 4,
    footage: 18_000,
    royaltyFrac: 0.7,
    fans: 3_000_000,
    techNorm: 350,
    maxCrew: 5,
    requires: { legacy: 3 },
  },
];

export const VIDEO_BY_ID: Record<string, VideoTierDef> = Object.fromEntries(VIDEO_TIERS.map((v) => [v.id, v]));

// ---------------- HOSTED EVENTS ----------------
export interface EventTierDef {
  id: string;
  name: string;
  desc: string;
  unlockCost: number;
  /** Cycle length in seconds. */
  duration: number;
  /** Base demand (people) and base capacity (people). */
  demand: number;
  capacity: number;
  /** Revenue per cycle at full base attendance, in seconds of shop base income. */
  revenueSec: number;
  fansPerAttendee: number;
  broadcast: boolean;
  requires?: { legacy?: number };
}

export const EVENT_TIERS: EventTierDef[] = [
  {
    id: 'jam',
    name: 'Parking-Lot Jam',
    desc: 'Cones, a boombox and a flat bar behind the shop.',
    unlockCost: 6_000,
    duration: 90,
    demand: 60,
    capacity: 50,
    revenueSec: 8,
    fansPerAttendee: 0.5,
    broadcast: false,
  },
  {
    id: 'besttrick',
    name: 'Best Trick Contest',
    desc: 'A handrail, a cash prize, and a lot of yelling.',
    unlockCost: 150_000,
    duration: 180,
    demand: 300,
    capacity: 250,
    revenueSec: 20,
    fansPerAttendee: 0.6,
    broadcast: false,
  },
  {
    id: 'cityjam',
    name: 'City Jam',
    desc: 'Downtown plaza takeover with sponsors and a DJ.',
    unlockCost: 6_000_000,
    duration: 300,
    demand: 1_500,
    capacity: 1_200,
    revenueSec: 40,
    fansPerAttendee: 0.8,
    broadcast: true,
  },
  {
    id: 'regional',
    name: 'Regional Contest',
    desc: 'Riders from five states. Bleachers. Requires Legacy 1.',
    unlockCost: 2e9,
    duration: 480,
    demand: 8_000,
    capacity: 6_000,
    revenueSec: 75,
    fansPerAttendee: 1,
    broadcast: true,
    requires: { legacy: 1 },
  },
  {
    id: 'national',
    name: 'National Championship',
    desc: 'Arena show with TV rights. Requires Legacy 4.',
    unlockCost: 5e12,
    duration: 720,
    demand: 40_000,
    capacity: 30_000,
    revenueSec: 130,
    fansPerAttendee: 1.5,
    broadcast: true,
    requires: { legacy: 4 },
  },
  {
    id: 'worldfinals',
    name: 'World Finals',
    desc: 'The sport\'s biggest weekend, hosted by you. Requires Legacy 4.',
    unlockCost: 2e14,
    duration: 1_080,
    demand: 200_000,
    capacity: 150_000,
    revenueSec: 220,
    fansPerAttendee: 2,
    broadcast: true,
    requires: { legacy: 4 },
  },
];

export const EVENT_BY_ID: Record<string, EventTierDef> = Object.fromEntries(EVENT_TIERS.map((e) => [e.id, e]));
