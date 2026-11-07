// Fictional sponsored skaters. Pure data.
import type { ProductId } from './products';

export type Specialty = 'tech' | 'transition' | 'charisma' | 'allround';

export type SkaterBonus =
  | { kind: 'products'; products: ProductId[]; pct: number } // +pct income on listed categories
  | { kind: 'allProducts'; pct: number }
  | { kind: 'sale'; pct: number } // manual sale value
  | { kind: 'footage'; pct: number } // auto footage rate
  | { kind: 'royalties'; pct: number }
  | { kind: 'events'; pct: number } // event revenue
  | { kind: 'tours'; pct: number } // tour & demo payouts
  | { kind: 'contests'; pct: number } // contest prizes
  | { kind: 'teamStats'; pct: number } // other skaters' stats
  | { kind: 'online'; pct: number } // online store share multiplier
  | { kind: 'park'; pct: number } // skatepark income
  | { kind: 'training'; pct: number }; // training cost reduction (as positive pct)

export interface Portrait {
  skin: string;
  hair: string;
  hairStyle: 'short' | 'long' | 'buzz' | 'curly' | 'mohawk' | 'bald' | 'bun';
  hat: 'none' | 'beanie' | 'cap' | 'capBack' | 'bucket';
  hatColor: string;
  shirt: string;
  bg: string;
  accessory?: 'glasses' | 'beard' | 'earring' | 'bandana';
}

export interface SkaterDef {
  id: string;
  name: string;
  nickname?: string;
  specialty: Specialty;
  bio: string;
  /** Base stats before training. */
  tech: number;
  flow: number;
  hype: number;
  bonus: SkaterBonus;
  signingFee: number;
  /** Base training cost (level 0 → 1). */
  trainBase: number;
  /** When this skater becomes available to scout. */
  unlock: { legacy?: number; teamSize?: number; runEarnings?: number; achievement?: string };
  /** Signature product category affinity. */
  signature: ProductId;
  portrait: Portrait;
}

export const SPECIALTY_INFO: Record<Specialty, { label: string; color: string; desc: string }> = {
  tech: { label: 'Technical Street', color: '#3dc6ff', desc: 'High Tech: best at filming, great for deck & grip lines.' },
  transition: { label: 'Transition', color: '#ff6b1a', desc: 'High Flow: wins contests and owns the park.' },
  charisma: { label: 'Charisma', color: '#ff4fa3', desc: 'High Hype: demos, merch and shop traffic.' },
  allround: { label: 'All-Rounder', color: '#c6ff3d', desc: 'Balanced stats and team-support perks.' },
};

export const SKATERS: SkaterDef[] = [
  {
    id: 'maya',
    name: 'Maya Okafor',
    nickname: 'Switch',
    specialty: 'tech',
    bio: 'Films every line twice — once regular, once switch. Quiet until the camera rolls.',
    tech: 8,
    flow: 3,
    hype: 4,
    bonus: { kind: 'products', products: ['grip', 'decks'], pct: 0.4 },
    signingFee: 2_000,
    trainBase: 800,
    unlock: {},
    signature: 'decks',
    portrait: { skin: '#7a4a2e', hair: '#1a1a1a', hairStyle: 'bun', hat: 'none', hatColor: '#000', shirt: '#3dc6ff', bg: '#16324a' },
  },
  {
    id: 'dusty',
    name: 'Dusty Ramirez',
    specialty: 'transition',
    bio: 'Bowl rat since age six. Carves so fast the coping smokes.',
    tech: 3,
    flow: 8,
    hype: 4,
    bonus: { kind: 'products', products: ['bearings', 'trucks'], pct: 0.4 },
    signingFee: 2_000,
    trainBase: 800,
    unlock: {},
    signature: 'trucks',
    portrait: { skin: '#c68a5a', hair: '#3a2414', hairStyle: 'long', hat: 'capBack', hatColor: '#ff6b1a', shirt: '#2d2d2d', bg: '#4a2410' },
  },
  {
    id: 'kenji',
    name: 'Kenji Mori',
    specialty: 'charisma',
    bio: 'Talks to every kid at the demo. Somehow sells forty tees while doing it.',
    tech: 4,
    flow: 4,
    hype: 8,
    bonus: { kind: 'allProducts', pct: 0.15 },
    signingFee: 2_000,
    trainBase: 800,
    unlock: {},
    signature: 'apparel',
    portrait: { skin: '#e8c19a', hair: '#111', hairStyle: 'short', hat: 'beanie', hatColor: '#ff4fa3', shirt: '#ffd23d', bg: '#4a1636' },
  },
  {
    id: 'lou',
    name: 'Lou Bennett',
    nickname: 'Tape',
    specialty: 'allround',
    bio: 'Fixes everyone\'s boards with gaffer tape. Makes the whole team skate better.',
    tech: 5,
    flow: 5,
    hype: 5,
    bonus: { kind: 'teamStats', pct: 0.1 },
    signingFee: 15_000,
    trainBase: 4_000,
    unlock: { teamSize: 2 },
    signature: 'bushings',
    portrait: { skin: '#f1d0b0', hair: '#b5651d', hairStyle: 'curly', hat: 'bucket', hatColor: '#c6ff3d', shirt: '#555', bg: '#2a3a10', accessory: 'glasses' },
  },
  {
    id: 'priya',
    name: 'Priya Sandhu',
    specialty: 'tech',
    bio: 'Ledge wizard. Has a 40-trick line on a single curb and a spreadsheet to prove it.',
    tech: 10,
    flow: 3,
    hype: 5,
    bonus: { kind: 'footage', pct: 0.5 },
    signingFee: 60_000,
    trainBase: 15_000,
    unlock: { runEarnings: 400_000 },
    signature: 'wheels',
    portrait: { skin: '#9a6440', hair: '#0d0d0d', hairStyle: 'long', hat: 'cap', hatColor: '#3dc6ff', shirt: '#fff', bg: '#10304a' },
  },
  {
    id: 'al',
    name: 'Al Kowalczyk',
    nickname: 'Big Al',
    specialty: 'transition',
    bio: 'Vert veteran with a mullet and a fan club. Crowds show up just to see him drop in.',
    tech: 3,
    flow: 11,
    hype: 7,
    bonus: { kind: 'events', pct: 0.5 },
    signingFee: 400_000,
    trainBase: 80_000,
    unlock: { legacy: 1 },
    signature: 'bearings',
    portrait: { skin: '#f0c8a0', hair: '#c9a24a', hairStyle: 'long', hat: 'none', hatColor: '#000', shirt: '#ff3d5a', bg: '#4a1010', accessory: 'beard' },
  },
  {
    id: 'zoe',
    name: 'Zoe Laurent',
    specialty: 'charisma',
    bio: 'Fashion-week regular who still skates handrails in her own colorways.',
    tech: 6,
    flow: 4,
    hype: 11,
    bonus: { kind: 'products', products: ['shoes', 'apparel'], pct: 0.6 },
    signingFee: 1_500_000,
    trainBase: 300_000,
    unlock: { legacy: 1 },
    signature: 'shoes',
    portrait: { skin: '#5a3420', hair: '#ff4fa3', hairStyle: 'buzz', hat: 'none', hatColor: '#000', shirt: '#111', bg: '#3a1040', accessory: 'earring' },
  },
  {
    id: 'tomas',
    name: 'Tomás Vega',
    specialty: 'allround',
    bio: 'Contest machine. Never the flashiest, always on the podium.',
    tech: 7,
    flow: 8,
    hype: 5,
    bonus: { kind: 'contests', pct: 0.6 },
    signingFee: 5_000_000,
    trainBase: 900_000,
    unlock: { legacy: 1 },
    signature: 'completes',
    portrait: { skin: '#b07850', hair: '#1a1a1a', hairStyle: 'short', hat: 'cap', hatColor: '#c6ff3d', shirt: '#2a6aff', bg: '#102a4a' },
  },
  {
    id: 'remy',
    name: 'Remy Castillo',
    specialty: 'tech',
    bio: 'Skater-filmer hybrid. Edits a part on the bus ride home.',
    tech: 12,
    flow: 5,
    hype: 6,
    bonus: { kind: 'royalties', pct: 0.6 },
    signingFee: 3e8,
    trainBase: 6e7,
    unlock: { legacy: 2 },
    signature: 'grip',
    portrait: { skin: '#d8a878', hair: '#2a1a0a', hairStyle: 'mohawk', hat: 'none', hatColor: '#000', shirt: '#ffd23d', bg: '#3a3010' },
  },
  {
    id: 'harper',
    name: 'Harper Quinn',
    nickname: 'Hurricane',
    specialty: 'transition',
    bio: 'Mega-ramp daredevil. Every tour stop sells out when the ramp goes up.',
    tech: 5,
    flow: 14,
    hype: 9,
    bonus: { kind: 'tours', pct: 0.7 },
    signingFee: 8e8,
    trainBase: 1.5e8,
    unlock: { legacy: 2 },
    signature: 'trucks',
    portrait: { skin: '#f4d4bc', hair: '#e04a1a', hairStyle: 'short', hat: 'beanie', hatColor: '#111', shirt: '#ff6b1a', bg: '#4a2a10', accessory: 'bandana' },
  },
  {
    id: 'ade',
    name: 'Ade Mensah',
    specialty: 'charisma',
    bio: 'Two million followers and a podcast. Every link in bio is a shop link.',
    tech: 7,
    flow: 6,
    hype: 14,
    bonus: { kind: 'online', pct: 0.8 },
    signingFee: 5e10,
    trainBase: 1e10,
    unlock: { legacy: 3 },
    signature: 'apparel',
    portrait: { skin: '#4a2a18', hair: '#0a0a0a', hairStyle: 'curly', hat: 'capBack', hatColor: '#3dffb0', shirt: '#9b6bff', bg: '#201040' },
  },
  {
    id: 'gus',
    name: 'Gus Pellegrini',
    nickname: 'Old Man Gus',
    specialty: 'allround',
    bio: 'Skated the first pool in town in 1978. Knows everybody, teaches everybody.',
    tech: 9,
    flow: 9,
    hype: 10,
    bonus: { kind: 'training', pct: 0.3 },
    signingFee: 1e12,
    trainBase: 2e11,
    unlock: { legacy: 4 },
    signature: 'bushings',
    portrait: { skin: '#e8c0a0', hair: '#ddd', hairStyle: 'bald', hat: 'cap', hatColor: '#ff3d5a', shirt: '#2d5a2d', bg: '#1a3a1a', accessory: 'beard' },
  },
];

export const SKATER_BY_ID: Record<string, SkaterDef> = Object.fromEntries(SKATERS.map((s) => [s.id, s]));

export const describeBonus = (b: SkaterBonus, scale = 1): string => {
  const p = (x: number) => `+${Math.round(x * scale * 100)}%`;
  switch (b.kind) {
    case 'products':
      return `${p(b.pct)} ${b.products.map((x) => x[0].toUpperCase() + x.slice(1)).join(' & ')} income`;
    case 'allProducts':
      return `${p(b.pct)} all product income`;
    case 'sale':
      return `${p(b.pct)} manual sale value`;
    case 'footage':
      return `${p(b.pct)} auto filming speed`;
    case 'royalties':
      return `${p(b.pct)} video royalties`;
    case 'events':
      return `${p(b.pct)} hosted event revenue`;
    case 'tours':
      return `${p(b.pct)} tour & demo payouts`;
    case 'contests':
      return `${p(b.pct)} contest prizes`;
    case 'teamStats':
      return `${p(b.pct)} stats for every other teammate`;
    case 'online':
      return `${p(b.pct)} online store sales`;
    case 'park':
      return `${p(b.pct)} skatepark income`;
    case 'training':
      return `−${Math.round(Math.min(0.75, b.pct * scale) * 100)}% team training cost`;
  }
};
