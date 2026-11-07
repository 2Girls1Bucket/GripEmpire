// Legacy (prestige): reward formula, preview, reset, and the permanent tree.
import type { GameState } from './state';
import { createRun } from './state';
import { CRED_DIVISOR, CRED_EXPONENT, LEGACY_NODE_BY_ID, LEGACY_UNLOCKS, MIN_LEGACY_CRED } from './content/legacy';
import { refreshSkaterPool } from './unlocks';
import { feedback } from './feedback';
import type { Result } from './actions';
import { SKATER_BY_ID } from './content/skaters';

export interface AccomplishmentDef {
  id: string;
  text: string;
  check: (s: GameState) => boolean;
}

/** Per-run accomplishments. Each adds +5% to the Cred earned by this run. */
export const RUN_ACCOMPLISHMENTS: AccomplishmentDef[] = [
  { id: 'video', text: 'Release a video', check: (s) => s.run.videos.length > 0 },
  { id: 'event', text: 'Complete a hosted event', check: (s) => s.run.stats.eventsHosted > 0 },
  { id: 'tour', text: 'Complete a tour', check: (s) => s.run.stats.toursDone > 0 },
  { id: 'podium', text: 'Win a contest', check: (s) => s.run.stats.contestWins > 0 },
  { id: 'team4', text: 'Field 4 skaters at once', check: (s) => s.run.team.length >= 4 },
  { id: 'decks', text: 'Sign the deck contract', check: (s) => s.run.products.decks > 0 },
  { id: 'completes', text: 'Sign the completes contract', check: (s) => s.run.products.completes > 0 },
  { id: 'shoes', text: 'Sign the footwear contract', check: (s) => s.run.products.shoes > 0 },
  { id: 'apparel', text: 'Sign the apparel contract', check: (s) => s.run.products.apparel > 0 },
  { id: 'cityjam', text: 'Unlock the City Jam', check: (s) => s.run.eventsUnlocked.includes('cityjam') },
  { id: 'brand3', text: 'Run 3 brand lines', check: (s) => Object.keys(s.run.brand).length >= 3 },
  { id: 'park3', text: 'Build 3 park facilities', check: (s) => s.run.facilities.length >= 3 },
  { id: 'distro2', text: 'Open 2 distribution regions', check: (s) => s.run.regions.length >= 2 },
  { id: 'factory', text: 'Allocate 5+ factory points', check: (s) => Object.values(s.run.factory).reduce((a: number, b) => a + (b ?? 0), 0) >= 5 },
];
export const ACCOMPLISHMENT_BONUS = 0.05;

export function checkAccomplishments(s: GameState): string[] {
  const added: string[] = [];
  for (const a of RUN_ACCOMPLISHMENTS) {
    if (!s.run.accomplishments.includes(a.id) && a.check(s)) {
      s.run.accomplishments.push(a.id);
      added.push(a.id);
    }
  }
  return added;
}

const credTotal = (lifetime: number) => Math.pow(Math.max(0, lifetime) / CRED_DIVISOR, CRED_EXPONENT);

export interface LegacyPreview {
  gain: number;
  mult: number;
  available: boolean;
  /** Run earnings needed for the next whole Cred. */
  nextAt: number;
  /** Run earnings needed before Legacy becomes available at all. */
  minEarnings: number;
  runEarnings: number;
  unlocks: (typeof LEGACY_UNLOCKS)[number] | undefined;
  founderLevel: number;
}

export function legacyPreview(s: GameState): LegacyPreview {
  const prior = s.meta.lifetimeRunEarnings;
  const e = s.run.earnings;
  const mult = 1 + ACCOMPLISHMENT_BONUS * s.run.accomplishments.length;
  const base = credTotal(prior);
  const raw = credTotal(prior + e) - base;
  const gain = Math.max(0, Math.floor(raw * mult + 1e-9));
  const earningsFor = (cred: number) => CRED_DIVISOR * Math.pow(base + cred / mult, 1 / CRED_EXPONENT) - prior;
  return {
    gain,
    mult,
    available: gain >= MIN_LEGACY_CRED,
    nextAt: earningsFor(gain + 1),
    minEarnings: earningsFor(MIN_LEGACY_CRED),
    runEarnings: e,
    unlocks: LEGACY_UNLOCKS.find((u) => u.legacy === s.meta.legacyCount + 1),
    founderLevel: s.meta.nodes.founder ?? 0,
  };
}

export function performLegacy(s: GameState, founderId: string | null = null): Result & { gain?: number } {
  const p = legacyPreview(s);
  if (!p.available) return { ok: false, msg: `Earn at least ${MIN_LEGACY_CRED} Cred first` };
  const m = s.meta;
  m.cred += p.gain;
  m.credEarned += p.gain;
  m.lifetimeRunEarnings += s.run.earnings;
  m.legacyCount++;
  m.stats.runDurations.push(Math.round(s.run.time));
  m.stats.bestRunEarnings = Math.max(m.stats.bestRunEarnings, s.run.earnings);
  let carry: { id: string; training: number } | null = null;
  if (p.founderLevel > 0 && founderId) {
    const t = s.run.team.find((x) => x.id === founderId);
    if (t) carry = { id: t.id, training: Math.floor(t.training * 0.25 * p.founderLevel) };
  }
  m.founderId = carry?.id ?? null;
  s.run = createRun(m);
  if (carry && SKATER_BY_ID[carry.id]) s.run.team.push(carry);
  refreshSkaterPool(s);
  feedback.emit({ kind: 'achievement', text: `Legacy ${m.legacyCount}! +${p.gain} Cred`, big: true });
  return { ok: true, gain: p.gain };
}

export const nodeCost = (id: string, level: number) => {
  const n = LEGACY_NODE_BY_ID[id];
  return Math.floor(n.baseCost * Math.pow(n.costGrowth, level));
};

export function nodeLock(s: GameState, id: string): string | null {
  const n = LEGACY_NODE_BY_ID[id];
  if (!n) return 'Unknown';
  if (n.requires?.legacy && s.meta.legacyCount < n.requires.legacy) return `Requires Legacy ${n.requires.legacy}`;
  if (n.requires?.node && (s.meta.nodes[n.requires.node[0]] ?? 0) < n.requires.node[1])
    return `Requires ${LEGACY_NODE_BY_ID[n.requires.node[0]].name} ${n.requires.node[1]}`;
  return null;
}

export function buyNode(s: GameState, id: string): Result {
  const n = LEGACY_NODE_BY_ID[id];
  if (!n) return { ok: false, msg: 'Unknown upgrade' };
  const lock = nodeLock(s, id);
  if (lock) return { ok: false, msg: lock };
  const lvl = s.meta.nodes[id] ?? 0;
  if (lvl >= n.maxLevel) return { ok: false, msg: 'Maxed' };
  const cost = nodeCost(id, lvl);
  if (s.meta.cred < cost) return { ok: false, msg: 'Not enough Cred' };
  s.meta.cred -= cost;
  s.meta.nodes[id] = lvl + 1;
  return { ok: true };
}
