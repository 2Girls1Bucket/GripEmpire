// Game state shape and constructors. Run state resets on Legacy; meta state is permanent.
import { SCHEMA_VERSION } from './config';
import { PRODUCT_IDS, type ProductId } from './content/products';
import { TRACKS } from './content/tracks';
import type { BrandFocus } from './content/business';
import { SKATERS } from './content/skaters';
import { BUZZ_FANS, SEED_MONEY } from './content/legacy';

export interface SignedSkater {
  id: string;
  training: number;
}

export interface Job {
  uid: number;
  assignmentId: string;
  skaters: string[];
  elapsed: number;
  duration: number;
  repeat: boolean;
}

export interface FilmProject {
  tierId: string;
  footage: number;
  required: number;
  crew: string[];
  /** Best Film a Line grade (0–1.5) landed for this project; improves quality. */
  bestGrade: number;
  linesPlayed: number;
}

export interface Video {
  tierId: string;
  title: string;
  quality: number;
  /** Royalty $/s captured at release (before runtime royalty multipliers). */
  royaltyBase: number;
}

export interface EventRun {
  tierId: string;
  elapsed: number;
  duration: number;
  /** Optional active "hype the crowd" bonus for this cycle (0–0.3). */
  hypeBonus: number;
  /** Seconds until the next crowd moment can appear (active only). */
  momentIn: number;
  momentLeft: number;
}

export interface BrandLine {
  level: number;
  focus: BrandFocus;
  signature: string | null;
}

export type Opportunity =
  | { kind: 'rush'; expires: number }
  | { kind: 'bulk'; expires: number; accepted: boolean; need: number; progress: number; timeLeft: number; rewardSec: number; label: string }
  | { kind: 'board'; expires: number; style: 'street' | 'bowl' | 'cruiser'; customer: string; rewardSec: number };

export interface RunStats {
  serves: number;
  manualEarned: number;
  passiveEarned: number;
  jobEarned: number;
  eventEarned: number;
  minigameEarned: number;
  oppEarned: number;
  contestWins: number;
  toursDone: number;
  eventsHosted: number;
  videosReleased: number;
}

export interface RunState {
  cash: number;
  earnings: number;
  time: number;
  products: Record<ProductId, number>;
  tracks: Record<string, number>;
  team: SignedSkater[];
  jobs: Job[];
  nextUid: number;
  film: FilmProject | null;
  videos: Video[];
  videoCounts: Record<string, number>;
  fans: number;
  merchBoost: number;
  eventsUnlocked: string[];
  event: EventRun | null;
  eventHeadliner: string | null;
  autoHost: boolean;
  brand: Partial<Record<ProductId, BrandLine>>;
  facilities: string[];
  regions: string[];
  distroSlots: ProductId[];
  factory: Partial<Record<ProductId, number>>;
  accomplishments: string[];
  autoBuy: boolean;
  autoBuyReserve: number; // fraction of cash auto-buyer keeps (0–0.9)
  autoProduce: boolean;
  streak: number;
  sinceServe: number;
  rushLeft: number;
  opp: Opportunity | null;
  nextOppIn: number;
  lastLineAttempt: string;
  stats: RunStats;
}

export interface LifetimeStats {
  totalEarned: number;
  totalServes: number;
  playTime: number;
  minigameRuns: number;
  bestLineScore: number;
  perfectLandings: number;
  videosReleased: number;
  eventsHosted: number;
  toursDone: number;
  contestWins: number;
  skatersSigned: number;
  oppsCompleted: number;
  runDurations: number[];
  bestRunEarnings: number;
}

export interface MetaState {
  legacyCount: number;
  cred: number;
  credEarned: number;
  /** Sum of earnings of all completed runs (drives the Cred formula). */
  lifetimeRunEarnings: number;
  nodes: Record<string, number>;
  unlockedSkaters: string[];
  achievements: string[];
  stats: LifetimeStats;
  hqPhase: number;
  capstoneAt: number | null;
  seenTips: string[];
  founderId: string | null;
  /** True if the dev debug panel was ever used on this save. */
  tainted: boolean;
}

export interface GameState {
  version: number;
  createdAt: number;
  /** Wall-clock ms at which state was last advanced. */
  lastTick: number;
  run: RunState;
  meta: MetaState;
}

export const emptyRunStats = (): RunStats => ({
  serves: 0,
  manualEarned: 0,
  passiveEarned: 0,
  jobEarned: 0,
  eventEarned: 0,
  minigameEarned: 0,
  oppEarned: 0,
  contestWins: 0,
  toursDone: 0,
  eventsHosted: 0,
  videosReleased: 0,
});

export const createMeta = (): MetaState => ({
  legacyCount: 0,
  cred: 0,
  credEarned: 0,
  lifetimeRunEarnings: 0,
  nodes: {},
  unlockedSkaters: SKATERS.filter((s) => Object.keys(s.unlock).length === 0).map((s) => s.id),
  achievements: [],
  stats: {
    totalEarned: 0,
    totalServes: 0,
    playTime: 0,
    minigameRuns: 0,
    bestLineScore: 0,
    perfectLandings: 0,
    videosReleased: 0,
    eventsHosted: 0,
    toursDone: 0,
    contestWins: 0,
    skatersSigned: 0,
    oppsCompleted: 0,
    runDurations: [],
    bestRunEarnings: 0,
  },
  hqPhase: 0,
  capstoneAt: null,
  seenTips: [],
  founderId: null,
  tainted: false,
});

/** Fresh run, applying permanent Legacy head-starts from meta. */
export const createRun = (meta: MetaState): RunState => {
  const node = (id: string) => meta.nodes[id] ?? 0;
  const products = Object.fromEntries(PRODUCT_IDS.map((id) => [id, 0])) as Record<ProductId, number>;
  products.bushings = 1;
  const kept = node('kept');
  if (kept >= 1) products.bearings = 1;
  if (kept >= 2) products.grip = 1;
  if (kept >= 3) products.wheels = 1;
  const tracks: Record<string, number> = Object.fromEntries(TRACKS.map((t) => [t.id, 0]));
  tracks.staff = node('dayone');
  if (node('office') > 0) {
    tracks.manager = 1;
    tracks.eventCrew = 1;
  }
  return {
    cash: SEED_MONEY[node('seed')] ?? 0,
    earnings: 0,
    time: 0,
    products,
    tracks,
    team: [],
    jobs: [],
    nextUid: 1,
    film: null,
    videos: [],
    videoCounts: {},
    fans: BUZZ_FANS[node('buzz')] ?? 0,
    merchBoost: 0,
    eventsUnlocked: [],
    event: null,
    eventHeadliner: null,
    autoHost: true,
    brand: {},
    facilities: [],
    regions: [],
    distroSlots: [],
    factory: {},
    accomplishments: [],
    autoBuy: false,
    autoBuyReserve: 0.25,
    autoProduce: false,
    streak: 0,
    sinceServe: 999,
    rushLeft: 0,
    opp: null,
    nextOppIn: 75,
    lastLineAttempt: '',
    stats: emptyRunStats(),
  };
};

export const createGame = (now: number = Date.now()): GameState => {
  const meta = createMeta();
  return { version: SCHEMA_VERSION, createdAt: now, lastTick: now, run: createRun(meta), meta };
};
