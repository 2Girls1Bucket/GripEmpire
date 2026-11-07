// Late-game business systems: your brand, skateparks, distribution, manufacturing, capstone.
import type { ProductId } from './products';
import type { Specialty } from './skaters';

// ---------------- BRAND ----------------
export type BrandFocus = 'quality' | 'volume' | 'hype';

export interface BrandLineDef {
  product: ProductId;
  name: string;
  /** Cost to design the line (gives level 1). */
  unlockCost: number;
}

export const BRAND_LINES: BrandLineDef[] = [
  { product: 'bushings', name: 'Empire Cushions', unlockCost: 60_000 },
  { product: 'bearings', name: 'Empire Spinners', unlockCost: 600_000 },
  { product: 'grip', name: 'Empire Grit', unlockCost: 6e6 },
  { product: 'wheels', name: 'Empire Formula', unlockCost: 8e7 },
  { product: 'trucks', name: 'Empire Kingpin', unlockCost: 1.5e9 },
  { product: 'decks', name: 'Empire Deck Co.', unlockCost: 3e10 },
  { product: 'completes', name: 'Empire Starter', unlockCost: 6e11 },
  { product: 'shoes', name: 'Empire Footwear', unlockCost: 1.2e13 },
  { product: 'apparel', name: 'Empire Threads', unlockCost: 2.5e14 },
];

/** Level L→L+1 cost = unlockCost * BRAND_LEVEL_COST_FRAC * growth^(L-1). */
export const BRAND_LEVEL_COST_FRAC = 0.35;
export const BRAND_LEVEL_GROWTH = 1.3;
/** Category multiplier per brand level (× focus × signature). */
export const BRAND_CAT_PER_LEVEL = 0.05;

export const BRAND_FOCUS: Record<BrandFocus, { label: string; desc: string; catMult: number; incomeMult: number; fansMult: number }> = {
  quality: { label: 'Quality', desc: 'Premium build. Strongly boosts the matching shop category.', catMult: 2, incomeMult: 0.4, fansMult: 0 },
  volume: { label: 'Volume', desc: 'Mass appeal. Big direct brand income, smaller shop boost.', catMult: 0.6, incomeMult: 1.8, fansMult: 0 },
  hype: { label: 'Hype', desc: 'Limited drops. Generates fans over time, moderate everything else.', catMult: 0.9, incomeMult: 0.6, fansMult: 1 },
};

/** Which specialties naturally fit a category (signature partnership). */
export const SPECIALTY_FIT: Record<Specialty, ProductId[]> = {
  tech: ['grip', 'decks', 'wheels'],
  transition: ['bearings', 'trucks', 'bushings'],
  charisma: ['shoes', 'apparel', 'completes'],
  allround: [],
};

// ---------------- SKATEPARK ----------------
export interface FacilityDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  visitors: number;
  perk: string;
}

export const FACILITIES: FacilityDef[] = [
  { id: 'miniramp', name: 'Mini Ramp', desc: 'Where every park starts.', cost: 1e9, visitors: 100, perk: 'Opens the park for business' },
  { id: 'plaza', name: 'Street Plaza', desc: 'Ledges, rails, and a manual pad.', cost: 4e9, visitors: 200, perk: 'Auto filming speed +30%' },
  { id: 'bowl', name: 'Concrete Bowl', desc: 'Deep end, pool coping, death box.', cost: 1.5e10, visitors: 300, perk: 'Contest prizes +40%, Transition skater training −25%' },
  { id: 'vert', name: 'Vert Ramp', desc: 'Thirteen feet of plywood terror.', cost: 6e10, visitors: 400, perk: 'Fans from tours & demos +60%' },
  { id: 'indoor', name: 'Indoor Hall', desc: 'Rain or shine. Hosts events too.', cost: 2.5e11, visitors: 600, perk: 'Hosted event capacity +50%' },
  { id: 'annex', name: 'Pro Shop Annex', desc: 'A second register right by the entrance.', cost: 1e12, visitors: 500, perk: 'All product income +25%' },
];

/** Park income/s = shopBase * PARK_VISITOR_RATE * visitors * spendMult. */
export const PARK_VISITOR_RATE = 0.00025;

// ---------------- DISTRIBUTION ----------------
export interface RegionDef {
  id: string;
  name: string;
  cost: number;
  reach: number;
}

export const REGIONS: RegionDef[] = [
  { id: 'local', name: 'Local Distro', cost: 2e11, reach: 1 },
  { id: 'regional', name: 'Regional Network', cost: 1.5e12, reach: 1.5 },
  { id: 'national', name: 'National Wholesale', cost: 1.2e13, reach: 2.5 },
  { id: 'continental', name: 'Continental Hub', cost: 1e14, reach: 4 },
  { id: 'global', name: 'Global Distribution', cost: 1e15, reach: 6 },
];

/** Slotted category income multiplier = 1 + DISTRO_REACH_MULT * totalReach * logistics. */
export const DISTRO_REACH_MULT = 0.1;

// ---------------- MANUFACTURING ----------------
/** A brand line with p capacity points gets brand income × (1+0.5p)^FACTORY_EXP_BRAND, category × (1+0.25p)^FACTORY_EXP_CAT. */
export const FACTORY_EXP_BRAND = 0.7;
export const FACTORY_EXP_CAT = 0.6;

// ---------------- CAPSTONE ----------------
export interface HQPhaseDef {
  name: string;
  desc: string;
  cost: number;
}

export const HQ_PHASES: HQPhaseDef[] = [
  { name: 'Break Ground', desc: 'Buy the old warehouse lot downtown.', cost: 1e17 },
  { name: 'The Bowl Atrium', desc: 'A full-size bowl in the lobby. Obviously.', cost: 5e17 },
  { name: 'Design Floors', desc: 'Studios for every product line.', cost: 3e18 },
  { name: 'Flagship Store', desc: 'The biggest skate shop in the world.', cost: 2e19 },
  { name: 'The Empire Tower', desc: 'Your logo on the skyline. The main progression ends here.', cost: 1e20 },
];
/** Each completed phase multiplies all income. */
export const HQ_PHASE_MULT = 1.5;
