// Availability rules for locations, products, tracks and skaters.
import type { GameState } from './state';
import { PRODUCTS, type ProductId } from './content/products';
import { TRACK_BY_ID, type TrackSystem } from './content/tracks';
import { SKATERS, type SkaterDef } from './content/skaters';
import type { AssignmentDef, EventTierDef, VideoTierDef } from './content/activities';

export type LocationId = 'district' | 'shop' | 'spot' | 'team' | 'venue' | 'workshop' | 'park' | 'warehouse' | 'factory' | 'hq' | 'legacy';

export interface LocationInfo {
  id: LocationId;
  name: string;
  short: string;
  blurb: string;
}

export const LOCATIONS: LocationInfo[] = [
  { id: 'district', name: 'The District', short: 'District', blurb: 'Your corner of town.' },
  { id: 'shop', name: 'The Shop', short: 'Shop', blurb: 'Serve customers, sign supplier contracts, upgrade the store.' },
  { id: 'team', name: 'Team HQ', short: 'Team', blurb: 'Sign, train and send skaters on demos, contests and tours.' },
  { id: 'spot', name: 'The Skate Spot', short: 'Spot', blurb: 'Fund filming projects, play Film a Line, release videos.' },
  { id: 'venue', name: 'Event Venue', short: 'Venue', blurb: 'Host recurring jams and contests.' },
  { id: 'workshop', name: 'Workshop', short: 'Brand', blurb: 'Design your own brand lines and signature products.' },
  { id: 'park', name: 'Skatepark', short: 'Park', blurb: 'Build facilities, sell admission, lessons and memberships.' },
  { id: 'warehouse', name: 'Warehouse', short: 'Distro', blurb: 'Distribute product lines to new regions.' },
  { id: 'factory', name: 'Factory', short: 'Factory', blurb: 'Allocate production capacity to your brand.' },
  { id: 'hq', name: 'Empire HQ', short: 'HQ', blurb: 'The capstone: build the Empire Tower.' },
  { id: 'legacy', name: 'Hall of Fame', short: 'Legacy', blurb: 'Legacy resets, permanent upgrades, achievements & stats.' },
];

export const TEAM_UNLOCK_EARNINGS = 3_000;
export const SPOT_UNLOCK_EARNINGS = 6_000;
export const VENUE_UNLOCK_EARNINGS = 20_000;

/** Returns null if unlocked, otherwise a human-readable requirement. */
export function locationLock(s: GameState, id: LocationId): string | null {
  const e = s.run.earnings;
  const L = s.meta.legacyCount;
  switch (id) {
    case 'district':
    case 'shop':
    case 'legacy':
      return null;
    case 'team':
      return e >= TEAM_UNLOCK_EARNINGS || L >= 1 ? null : `Earn $${TEAM_UNLOCK_EARNINGS.toLocaleString('en-US')} this run`;
    case 'spot':
      return e >= SPOT_UNLOCK_EARNINGS || L >= 1 ? null : `Earn $${SPOT_UNLOCK_EARNINGS.toLocaleString('en-US')} this run`;
    case 'venue':
      return e >= VENUE_UNLOCK_EARNINGS || L >= 1 ? null : `Earn $${VENUE_UNLOCK_EARNINGS.toLocaleString('en-US')} this run`;
    case 'workshop':
      return L >= 1 ? null : 'Unlocked by your 1st Legacy';
    case 'park':
      return L >= 2 ? null : 'Unlocked by your 2nd Legacy';
    case 'warehouse':
      return L >= 3 ? null : 'Unlocked by your 3rd Legacy';
    case 'factory':
      return L >= 4 ? null : 'Unlocked by your 4th Legacy';
    case 'hq':
      return L >= 5 ? null : 'Unlocked by your 5th Legacy';
  }
}

export const isLocationOpen = (s: GameState, id: LocationId) => locationLock(s, id) === null;

/** A contract is offered once the previous category is contracted. */
export function productOffered(s: GameState, id: ProductId): boolean {
  const i = PRODUCTS.findIndex((p) => p.id === id);
  if (i <= 0) return true;
  return (s.run.products[PRODUCTS[i - 1].id] ?? 0) > 0;
}

const SYSTEM_LOCATION: Record<TrackSystem, LocationId> = {
  shop: 'shop',
  team: 'team',
  tour: 'team',
  media: 'spot',
  events: 'venue',
  brand: 'workshop',
  park: 'park',
  distro: 'warehouse',
  factory: 'factory',
};

export function trackLock(s: GameState, id: string): string | null {
  const t = TRACK_BY_ID[id];
  if (!t) return 'Unknown';
  const loc = locationLock(s, SYSTEM_LOCATION[t.system]);
  if (loc) return loc;
  const rq = t.requires;
  if (rq?.product && (s.run.products[rq.product] ?? 0) <= 0) return `Requires the ${rq.product} contract`;
  if (rq?.legacy && s.meta.legacyCount < rq.legacy) return `Requires Legacy ${rq.legacy}`;
  if (rq?.track && (s.run.tracks[rq.track[0]] ?? 0) < rq.track[1]) return `Requires ${TRACK_BY_ID[rq.track[0]].name} ${rq.track[1]}`;
  if (t.system === 'tour' && s.run.team.length < 1) return 'Sign a skater first';
  return null;
}

export function skaterUnlockMet(s: GameState, def: SkaterDef): boolean {
  const u = def.unlock;
  if (u.legacy !== undefined && s.meta.legacyCount < u.legacy) return false;
  if (u.teamSize !== undefined && s.run.team.length < u.teamSize) return false;
  if (u.runEarnings !== undefined && s.run.earnings < u.runEarnings) return false;
  return true;
}

export function skaterUnlockText(def: SkaterDef): string {
  const u = def.unlock;
  if (u.legacy) return `Scouted after Legacy ${u.legacy}`;
  if (u.teamSize) return `Scouted once you have ${u.teamSize} skaters`;
  if (u.runEarnings) return `Scouted after earning $${u.runEarnings.toLocaleString('en-US')} in a run`;
  return 'Available';
}

/** Permanently add newly scouted skaters to meta availability. Returns new ids. */
export function refreshSkaterPool(s: GameState): string[] {
  const added: string[] = [];
  for (const def of SKATERS) {
    if (!s.meta.unlockedSkaters.includes(def.id) && skaterUnlockMet(s, def)) {
      s.meta.unlockedSkaters.push(def.id);
      added.push(def.id);
    }
  }
  return added;
}

export function assignmentLock(s: GameState, a: AssignmentDef): string | null {
  const rq = a.requires;
  if (rq?.legacy && s.meta.legacyCount < rq.legacy) return `Requires Legacy ${rq.legacy}`;
  if (rq?.transport && (s.run.tracks.transport ?? 0) < rq.transport) return `Requires Transport ${rq.transport}`;
  return null;
}

export function videoLock(s: GameState, v: VideoTierDef): string | null {
  if (v.requires?.legacy && s.meta.legacyCount < v.requires.legacy) return `Requires Legacy ${v.requires.legacy}`;
  return null;
}

export function eventLock(s: GameState, e: EventTierDef): string | null {
  if (e.requires?.legacy && s.meta.legacyCount < e.requires.legacy) return `Requires Legacy ${e.requires.legacy}`;
  return null;
}

/** Skaters busy on a job, filming, or headlining. */
export function busySkaters(s: GameState): Map<string, string> {
  const m = new Map<string, string>();
  for (const j of s.run.jobs) for (const id of j.skaters) m.set(id, 'job');
  if (s.run.film) for (const id of s.run.film.crew) m.set(id, 'filming');
  if (s.run.eventHeadliner) m.set(s.run.eventHeadliner, 'headlining');
  return m;
}
