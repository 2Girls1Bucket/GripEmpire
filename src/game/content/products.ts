// Shop product categories. Pure data — no UI code.
export type ProductId =
  | 'bushings'
  | 'bearings'
  | 'grip'
  | 'wheels'
  | 'trucks'
  | 'decks'
  | 'completes'
  | 'shoes'
  | 'apparel';

export interface Milestone {
  level: number;
  /** Multiplier on this category's income. */
  self: number;
  /** Multiplier on ALL product income (keeps older categories relevant). */
  global?: number;
  /** Multiplier on manual sale value. */
  sale?: number;
  /** Named, distinctive perk text (optional). */
  name?: string;
}

export interface ProductDef {
  id: ProductId;
  name: string;
  /** Supplier contract name (thematic "license"). */
  contract: string;
  flavor: string;
  /** One-time supplier contract price. Grants level 1. */
  unlockCost: number;
  /** Price of level 2 (levels follow baseCost * growth^(level-1)). */
  baseCost: number;
  growth: number;
  /** Net $/s per level before multipliers. */
  incomePerLevel: number;
  color: string;
  milestones: Milestone[];
}

const ladder = (specials: Milestone[]): Milestone[] => {
  const base: Milestone[] = [
    { level: 25, self: 2 },
    { level: 50, self: 2 },
    { level: 100, self: 3 },
    { level: 150, self: 2 },
    { level: 200, self: 3 },
    { level: 250, self: 2 },
    { level: 300, self: 3 },
    { level: 400, self: 3 },
    { level: 500, self: 4 },
  ];
  for (let l = 600; l <= 1500; l += 100) base.push({ level: l, self: 3 });
  for (const s of specials) {
    const i = base.findIndex((m) => m.level === s.level);
    if (i >= 0) base[i] = { ...base[i], ...s, self: s.self ?? base[i].self };
    else base.push(s);
  }
  return base.sort((a, b) => a.level - b.level);
};

export const PRODUCTS: ProductDef[] = [
  {
    id: 'bushings',
    name: 'Bushings',
    contract: 'Cousin Ray\'s Bushing Bin',
    flavor: 'Squishy urethane. Every board needs four. Nobody ever buys just one.',
    unlockCost: 0,
    baseCost: 5,
    growth: 1.16,
    incomePerLevel: 0.6,
    color: '#ff4fa3',
    milestones: ladder([
      { level: 25, self: 2, sale: 1.1, name: 'Duro Chart' },
      { level: 100, self: 3, global: 1.1, name: 'Squeak-Free Guarantee' },
      { level: 300, self: 3, global: 1.1, name: 'Bushing Whisperer' },
    ]),
  },
  {
    id: 'bearings',
    name: 'Bearings',
    contract: 'Spinwell Bearing Co. contract',
    flavor: 'Tiny steel balls of speed. Sold in eights with a little plastic tube.',
    unlockCost: 150,
    baseCost: 50,
    growth: 1.17,
    incomePerLevel: 2.5,
    color: '#3dc6ff',
    milestones: ladder([
      { level: 25, self: 2, sale: 1.1, name: 'Speed Rated' },
      { level: 100, self: 3, global: 1.1, name: 'Ceramic Line' },
      { level: 300, self: 3, global: 1.1, name: 'Swiss Precision' },
    ]),
  },
  {
    id: 'grip',
    name: 'Grip Tape',
    contract: 'Sandpaper Bros. distribution deal',
    flavor: 'Sheets of black grit. Customers love watching you razor it on.',
    unlockCost: 4_000,
    baseCost: 1_200,
    growth: 1.17,
    incomePerLevel: 9,
    color: '#c6ff3d',
    milestones: ladder([
      { level: 25, self: 2, sale: 1.1, name: 'Custom Grip Jobs' },
      { level: 100, self: 3, global: 1.1, name: 'Die-Cut Logos' },
      { level: 300, self: 3, global: 1.1, name: 'Clear Grip Revolution' },
    ]),
  },
  {
    id: 'wheels',
    name: 'Wheels',
    contract: 'Urethane Union wheel contract',
    flavor: 'Hard for street, soft for cruising. Kids argue about durometer for hours.',
    unlockCost: 1e5,
    baseCost: 3e4,
    growth: 1.18,
    incomePerLevel: 32,
    color: '#ffd23d',
    milestones: ladder([
      { level: 25, self: 2, sale: 1.1, name: 'Conical Shapes' },
      { level: 100, self: 3, global: 1.1, name: 'Urethane Lab' },
      { level: 300, self: 3, global: 1.1, name: 'Flatspot Warranty' },
    ]),
  },
  {
    id: 'trucks',
    name: 'Trucks',
    contract: 'Kingpin Metalworks contract',
    flavor: 'Aluminium axles. Grind them to dust, come back for more.',
    unlockCost: 2.5e6,
    baseCost: 7.5e5,
    growth: 1.18,
    incomePerLevel: 110,
    color: '#b8c0cc',
    milestones: ladder([
      { level: 25, self: 2, sale: 1.1, name: 'Hollow Kingpins' },
      { level: 100, self: 3, global: 1.1, name: 'Forged Baseplates' },
      { level: 300, self: 3, global: 1.1, name: 'Titanium Axles' },
    ]),
  },
  {
    id: 'decks',
    name: 'Decks',
    contract: 'Seven-Ply Woodshop deal',
    flavor: 'Maple and wild graphics. The wall of decks is why people walk in.',
    unlockCost: 6e7,
    baseCost: 1.8e7,
    growth: 1.19,
    incomePerLevel: 380,
    color: '#ff6b1a',
    milestones: ladder([
      { level: 25, self: 2, sale: 1.1, name: 'Shop Deck Wall' },
      { level: 100, self: 3, global: 1.1, name: 'Artist Series' },
      { level: 300, self: 3, global: 1.1, name: 'Pressed In-House' },
    ]),
  },
  {
    id: 'completes',
    name: 'Completes',
    contract: 'Ready2Roll assembly contract',
    flavor: 'Fully built boards for first-timers and their parents\' credit cards.',
    unlockCost: 1.5e9,
    baseCost: 4.5e8,
    growth: 1.19,
    incomePerLevel: 1_300,
    color: '#9b6bff',
    milestones: ladder([
      { level: 25, self: 2, sale: 1.1, name: 'Starter Packs' },
      { level: 100, self: 3, global: 1.1, name: 'Holiday Rush' },
      { level: 300, self: 3, global: 1.1, name: 'Every Kid\'s First Board — all products +15%' },
    ]),
  },
  {
    id: 'shoes',
    name: 'Shoes',
    contract: 'Vulc & Cup footwear deal',
    flavor: 'Suede toe caps that last two weeks of kickflips. Perfect business model.',
    unlockCost: 4e10,
    baseCost: 1.2e10,
    growth: 1.2,
    incomePerLevel: 4_500,
    color: '#3dffb0',
    milestones: ladder([
      { level: 25, self: 2, sale: 1.1, name: 'Suede Reinforcement' },
      { level: 100, self: 3, global: 1.1, name: 'Pro Model Wall' },
      { level: 300, self: 3, global: 1.1, name: 'Cult Classic Colorways' },
    ]),
  },
  {
    id: 'apparel',
    name: 'Apparel',
    contract: 'Screenprint Collective deal',
    flavor: 'Tees, hoodies, beanies. Logos travel further than boards ever will.',
    unlockCost: 1e12,
    baseCost: 3e11,
    growth: 1.2,
    incomePerLevel: 15_000,
    color: '#ff3d5a',
    milestones: ladder([
      { level: 25, self: 2, sale: 1.1, name: 'Limited Drops' },
      { level: 100, self: 3, global: 1.1, name: 'Streetwear Crossover' },
      { level: 300, self: 3, global: 1.1, name: 'Global Icon' },
    ]),
  },
];

/** Human-readable milestone effect, derived from data so text never drifts from numbers. */
export const describeMilestone = (m: Milestone): string => {
  const parts = [`×${m.self} ${'income'}`];
  if (m.global) parts.push(`all products +${Math.round((m.global - 1) * 100)}%`);
  if (m.sale) parts.push(`manual sales +${Math.round((m.sale - 1) * 100)}%`);
  return (m.name ? m.name + ': ' : '') + parts.join(', ');
};

export const PRODUCT_IDS = PRODUCTS.map((p) => p.id);
export const PRODUCT_BY_ID: Record<ProductId, ProductDef> = Object.fromEntries(
  PRODUCTS.map((p) => [p.id, p]),
) as Record<ProductId, ProductDef>;
