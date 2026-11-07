// Film a Line: pure game logic (no DOM). Timed pop + land inputs over a short line of obstacles.
export type ObstacleKind = 'ledge' | 'rail' | 'stairs' | 'gap' | 'kicker' | 'hammer';
export type Tier = 0 | 1 | 2;

export interface Obstacle {
  kind: ObstacleKind;
  x: number;
  done: boolean;
}

export const TRICK_NAMES: Record<ObstacleKind, [string, string, string]> = {
  ledge: ['50-50 Grind', 'Crooked Grind', 'Nollie Flip Crooks'],
  rail: ['Boardslide', 'Lipslide', 'Kickflip Boardslide'],
  stairs: ['Ollie', 'Kickflip', 'Tre Flip'],
  gap: ['Ollie', 'Heelflip', 'Hardflip'],
  kicker: ['Shove-it', 'Varial Flip', '360 Flip'],
  hammer: ['Kickflip', 'Tre Flip', 'Laser Flip'],
};
export const TIER_POINTS = [100, 250, 500];
/** Landing window half-widths in seconds, before forgiveness. */
export const TIER_WINDOW = [0.16, 0.11, 0.075];
const KIND_MULT: Record<ObstacleKind, number> = { ledge: 1, rail: 1.1, stairs: 1.3, gap: 1.5, kicker: 0.8, hammer: 3 };
const AIR_TIME: Record<ObstacleKind, number> = { ledge: 0.85, rail: 0.85, stairs: 1.0, gap: 1.1, kicker: 0.75, hammer: 1.25 };
const MUST_POP: ObstacleKind[] = ['stairs', 'gap', 'hammer'];

export const SPEED = 280;
export const POP_OFFSET = 70; // pop zone centre is this far before the obstacle
export const POP_HALF = 60; // px, before forgiveness
export const TARGET_SCORE = 10000; // score that earns grade 1.0

export type Landing = 'perfect' | 'good' | 'sloppy';

export type LineEvent =
  | { type: 'pop'; tier: Tier; quality: number }
  | { type: 'land'; quality: Landing; trick: string; points: number; combo: number }
  | { type: 'bail'; reason: string }
  | { type: 'skip'; kind: ObstacleKind }
  | { type: 'choice' }
  | { type: 'hammer' }
  | { type: 'done' };

export interface Air {
  tier: Tier;
  popQ: number;
  start: number;
  dur: number;
  obstacle: Obstacle;
  landPressed: boolean;
}

export interface LineState {
  t: number;
  x: number;
  speed: number;
  obs: Obstacle[];
  phase: 'roll' | 'air' | 'slam' | 'choice' | 'done';
  air: Air | null;
  slamLeft: number;
  choiceLeft: number;
  combo: number;
  score: number;
  lives: number;
  perfects: number;
  landed: number;
  bails: number;
  hammer: 'none' | 'going' | 'landed' | 'bailed';
  forgiveness: number;
  pointsMult: number;
  events: LineEvent[];
  log: string[];
}

/** Simple seeded RNG so lines are varied but testable. */
export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a ^= a << 13;
    a ^= a >>> 17;
    a ^= a << 5;
    return ((a >>> 0) % 100000) / 100000;
  };
}

export function createLine(seed: number, forgiveness = 1, pointsMult = 1, count = 9): LineState {
  const r = rng(seed);
  const kinds: ObstacleKind[] = ['ledge', 'rail', 'stairs', 'gap', 'kicker'];
  const obs: Obstacle[] = [];
  let x = 700;
  for (let i = 0; i < count; i++) {
    let k = kinds[Math.floor(r() * kinds.length)];
    if (i === 0) k = 'kicker';
    if (obs.length && obs[obs.length - 1].kind === k) k = kinds[(kinds.indexOf(k) + 1) % kinds.length];
    obs.push({ kind: k, x, done: false });
    x += 720 + Math.floor(r() * 220);
  }
  return {
    t: 0,
    x: 0,
    speed: SPEED,
    obs,
    phase: 'roll',
    air: null,
    slamLeft: 0,
    choiceLeft: 0,
    combo: 1,
    score: 0,
    lives: 3,
    perfects: 0,
    landed: 0,
    bails: 0,
    hammer: 'none',
    forgiveness: Math.max(0.5, Math.min(2.2, forgiveness)),
    pointsMult: Math.max(0.5, pointsMult),
    events: [],
    log: [],
  };
}

export const nextObstacle = (s: LineState) => s.obs.find((o) => !o.done) ?? null;
export const popHalf = (s: LineState) => POP_HALF * s.forgiveness;
export const landHalf = (s: LineState, tier: Tier) => TIER_WINDOW[tier] * s.forgiveness * (s.air?.obstacle.kind === 'hammer' ? 0.75 : 1);

function bail(s: LineState, reason: string) {
  s.bails++;
  s.lives--;
  s.combo = 1;
  s.air = null;
  s.events.push({ type: 'bail', reason });
  if (s.hammer === 'going') {
    s.hammer = 'bailed';
    finish(s);
    return;
  }
  s.phase = 'slam';
  s.slamLeft = 1.0;
}

function finish(s: LineState) {
  if (s.phase === 'done') return;
  if (s.hammer === 'landed') s.score *= 1.5;
  if (s.hammer === 'bailed') s.score *= 0.8;
  s.score = Math.round(s.score);
  s.phase = 'done';
  s.events.push({ type: 'done' });
}

/** Player presses a trick button (tier 0/1/2). */
export function pressTrick(s: LineState, tier: Tier) {
  if (s.phase === 'air') {
    // Trick buttons double as "land" so one-button play works.
    pressLand(s);
    return;
  }
  if (s.phase !== 'roll') return;
  const o = nextObstacle(s);
  if (!o) return;
  const zone = o.x - POP_OFFSET;
  const dx = Math.abs(s.x - zone);
  const half = popHalf(s);
  let q: number;
  if (dx <= half) q = 1 - dx / half;
  else if (dx <= half * 1.6) q = 0; // near miss: a weak pop, still rideable
  else {
    // Way off: ignore nervous taps far from the zone; punish only clearly mistimed pops near it.
    if (dx < half * 2.4 && s.x < o.x) {
      s.events.push({ type: 'pop', tier, quality: 0 });
      bail(s, s.x < zone ? 'Popped way too early' : 'Popped way too late');
      o.done = true;
    }
    return;
  }
  s.air = { tier, popQ: q, start: s.t, dur: AIR_TIME[o.kind], obstacle: o, landPressed: false };
  s.phase = 'air';
  s.events.push({ type: 'pop', tier, quality: q });
}

/** Player presses land. */
export function pressLand(s: LineState) {
  if (s.phase !== 'air' || !s.air || s.air.landPressed) return;
  const a = s.air;
  const target = a.start + a.dur;
  const dt = Math.abs(s.t - target);
  const half = landHalf(s, a.tier);
  a.landPressed = true;
  if (dt > half) {
    bail(s, s.t < target ? 'Landed too early' : 'Landed too late');
    a.obstacle.done = true;
    return;
  }
  const frac = dt / half;
  const quality: Landing = frac <= 0.35 ? 'perfect' : frac <= 0.7 ? 'good' : 'sloppy';
  const landMult = quality === 'perfect' ? 1.5 : quality === 'good' ? 1 : 0.5;
  const base = TIER_POINTS[a.tier] * KIND_MULT[a.obstacle.kind] * (0.6 + 0.4 * a.popQ) * landMult * s.pointsMult;
  const points = Math.round(base * s.combo);
  s.score += points;
  s.landed++;
  if (quality === 'perfect') {
    s.perfects++;
    s.combo += 1;
  } else if (quality === 'good') s.combo += 0.5;
  else s.combo = 1;
  a.obstacle.done = true;
  s.events.push({ type: 'land', quality, trick: TRICK_NAMES[a.obstacle.kind][a.tier], points, combo: s.combo });
  s.air = null;
  s.phase = 'roll';
  if (a.obstacle.kind === 'hammer') {
    s.hammer = 'landed';
    finish(s);
  }
}

export function chooseBank(s: LineState) {
  if (s.phase === 'choice') finish(s);
}

export function chooseHammer(s: LineState) {
  if (s.phase !== 'choice') return;
  s.obs.push({ kind: 'hammer', x: s.x + 600, done: false });
  s.hammer = 'going';
  s.phase = 'roll';
  s.speed = SPEED;
  s.events.push({ type: 'hammer' });
}

export function update(s: LineState, dtIn: number) {
  if (s.phase === 'done') return;
  const dt = Math.min(0.05, Math.max(0, dtIn));
  s.t += dt;
  if (s.phase === 'choice') {
    s.x += 90 * dt;
    s.choiceLeft -= dt;
    if (s.choiceLeft <= 0) finish(s);
    return;
  }
  s.x += s.speed * dt;
  if (s.phase === 'slam') {
    s.slamLeft -= dt;
    s.x -= s.speed * dt * 0.7;
    if (s.slamLeft <= 0) {
      if (s.lives <= 0) {
        finish(s);
        return;
      }
      s.phase = 'roll';
    }
    return;
  }
  if (s.phase === 'air' && s.air) {
    const half = landHalf(s, s.air.tier);
    if (s.t > s.air.start + s.air.dur + half) {
      s.air.obstacle.done = true;
      bail(s, 'Never landed it');
    }
    return;
  }
  // rolling: missed pops
  const o = nextObstacle(s);
  if (o && s.x > o.x + 30) {
    o.done = true;
    if (MUST_POP.includes(o.kind)) bail(s, o.kind === 'gap' ? 'Rolled into the gap' : 'Rolled down the stairs');
    else {
      s.combo = 1;
      s.events.push({ type: 'skip', kind: o.kind });
    }
  }
  if (!nextObstacle(s) && s.phase === 'roll') {
    if (s.hammer === 'none') {
      s.phase = 'choice';
      s.choiceLeft = 5;
      s.events.push({ type: 'choice' });
    } else finish(s);
  }
}

export const gradeOf = (score: number) => Math.max(0, Math.min(1.5, score / TARGET_SCORE));
export const gradeLetter = (g: number) => (g >= 1.3 ? 'S' : g >= 1 ? 'A' : g >= 0.7 ? 'B' : g >= 0.4 ? 'C' : 'D');
