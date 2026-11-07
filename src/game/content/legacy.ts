// Legacy (prestige) permanent upgrade tree and per-Legacy system unlocks.

export type LegacyBranch = 'shop' | 'active' | 'team' | 'auto' | 'offline' | 'start' | 'empire';

export interface LegacyNodeDef {
  id: string;
  branch: LegacyBranch;
  name: string;
  desc: string;
  maxLevel: number; // Infinity allowed for endless sinks
  baseCost: number;
  costGrowth: number;
  show: (level: number) => string;
  requires?: { legacy?: number; node?: [string, number] };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export const LEGACY_NODES: LegacyNodeDef[] = [
  // SHOP ECONOMICS
  { id: 'loyal', branch: 'shop', name: 'Loyal Customers', desc: 'Regulars who never shop anywhere else.', maxLevel: 10, baseCost: 2, costGrowth: 2, show: (l) => `Product income ×${Math.pow(1.25, l).toFixed(2)}` },
  { id: 'network', branch: 'shop', name: 'Supplier Network', desc: 'You know every rep by name.', maxLevel: 5, baseCost: 4, costGrowth: 2.5, show: (l) => `Product costs ×${Math.pow(0.85, l).toFixed(2)}` },
  { id: 'kept', branch: 'shop', name: 'Kept Contracts', desc: 'Suppliers remember you. Start runs with contracts already signed.', maxLevel: 3, baseCost: 8, costGrowth: 4, show: (l) => (l === 0 ? 'No contracts kept' : `Start with ${['Bearings', 'Bearings & Grip', 'Bearings, Grip & Wheels'][l - 1]}`), requires: { node: ['network', 1] } },

  // ACTIVE PLAY
  { id: 'tongue', branch: 'active', name: 'Silver Tongue', desc: 'You could sell grip tape to a bowl skater.', maxLevel: 8, baseCost: 2, costGrowth: 2, show: (l) => `Manual sales ×${Math.pow(1.12, l).toFixed(2)}` },
  { id: 'zone', branch: 'active', name: 'In The Zone', desc: 'Longer sales streaks.', maxLevel: 3, baseCost: 5, costGrowth: 3, show: (l) => `Max streak +${l * 10} (each stack +2%)` },
  { id: 'rush', branch: 'active', name: 'Rush Hour', desc: 'Customer rushes, bulk orders and board orders show up more often and pay more.', maxLevel: 3, baseCost: 6, costGrowth: 3, show: (l) => `Opportunities ${pct(1 + 0.3 * l)} as often, rewards ×${(1 + 0.25 * l).toFixed(2)}` },
  { id: 'instinct', branch: 'active', name: 'Film Instinct', desc: 'You can feel when a line is going to work.', maxLevel: 3, baseCost: 4, costGrowth: 3, show: (l) => `Film a Line timing +${l * 8}%, footage ×${(1 + 0.3 * l).toFixed(1)}` },

  // TEAM
  { id: 'scouting', branch: 'team', name: 'Scouting Network', desc: 'Agents in every city. Cheaper signings.', maxLevel: 3, baseCost: 3, costGrowth: 3, show: (l) => `Signing fees ×${Math.pow(0.6, l).toFixed(2)}` },
  { id: 'camp', branch: 'team', name: 'Training Camp', desc: 'A summer camp that never closes.', maxLevel: 5, baseCost: 4, costGrowth: 2.5, show: (l) => `Training costs ×${Math.pow(0.8, l).toFixed(2)}` },
  { id: 'seat', branch: 'team', name: 'Extra Seat', desc: 'One more spot on the team.', maxLevel: 1, baseCost: 20, costGrowth: 1, show: (l) => `+${l} team slot`, requires: { legacy: 1 } },
  { id: 'founder', branch: 'team', name: 'Founding Skater', desc: 'At Legacy, keep one skater signed with part of their training.', maxLevel: 3, baseCost: 40, costGrowth: 2.5, show: (l) => (l === 0 ? 'Nobody stays' : `Keep 1 skater with ${l * 25}% of training levels`), requires: { legacy: 3 } },

  // AUTOMATION
  { id: 'dayone', branch: 'auto', name: 'Day-One Staff', desc: 'Your crew is waiting on opening day.', maxLevel: 3, baseCost: 3, costGrowth: 3, show: (l) => `Start runs at Staff level ${l}` },
  { id: 'office', branch: 'auto', name: 'Back Office', desc: 'Team Manager and Event Crew are hired from the start of each run.', maxLevel: 1, baseCost: 12, costGrowth: 1, show: (l) => (l ? 'Repeat & auto-host from day one' : 'Hire them each run'), requires: { legacy: 1 } },
  { id: 'autobuy', branch: 'auto', name: 'Shop Manager', desc: 'Automatically buys the best-value product level when cash allows (toggle in the shop).', maxLevel: 1, baseCost: 25, costGrowth: 1, show: (l) => (l ? 'Auto-buyer available' : 'Locked'), requires: { legacy: 2 } },
  { id: 'producer', branch: 'auto', name: 'Producer', desc: 'Automatically funds and starts the next filming project and releases finished ones.', maxLevel: 1, baseCost: 30, costGrowth: 1, show: (l) => (l ? 'Auto-producer available' : 'Locked'), requires: { legacy: 2 } },

  // OFFLINE
  { id: 'nightshift', branch: 'offline', name: 'Night Shift', desc: 'Someone minds the shop after hours.', maxLevel: 5, baseCost: 3, costGrowth: 2.2, show: (l) => `Offline efficiency ${pct(0.3 + 0.1 * l)}` },
  { id: 'weekend', branch: 'offline', name: 'Long Weekend', desc: 'The shop runs while you are at the beach.', maxLevel: 4, baseCost: 3, costGrowth: 2.2, show: (l) => `Offline cap ${8 + 4 * l}h` },

  // STARTING RESOURCES
  { id: 'seed', branch: 'start', name: 'Seed Money', desc: 'Start every run with savings.', maxLevel: 5, baseCost: 2, costGrowth: 2.6, show: (l) => (l === 0 ? 'Start with $0' : `Start with $${[500, 25e3, 1e6, 5e7, 3e9][l - 1].toLocaleString('en-US')}`) },
  { id: 'buzz', branch: 'start', name: 'Old Buzz', desc: 'People still talk about your last run.', maxLevel: 4, baseCost: 4, costGrowth: 3, show: (l) => `Start runs with ${[0, 500, 5_000, 50_000, 500_000][l].toLocaleString('en-US')} fans` },

  // EMPIRE (endless sink)
  { id: 'reputation', branch: 'empire', name: 'Reputation', desc: 'Pure respect. Endless.', maxLevel: Infinity, baseCost: 40, costGrowth: 2, show: (l) => `All income ×${Math.pow(1.25, l).toFixed(2)}`, requires: { legacy: 2 } },
];

export const LEGACY_NODE_BY_ID: Record<string, LegacyNodeDef> = Object.fromEntries(LEGACY_NODES.map((n) => [n.id, n]));

export const SEED_MONEY = [0, 500, 25e3, 1e6, 5e7, 3e9];
export const BUZZ_FANS = [0, 500, 5_000, 50_000, 500_000];

export const BRANCH_INFO: Record<LegacyBranch, { label: string; color: string }> = {
  shop: { label: 'Shop Economics', color: '#ffd23d' },
  active: { label: 'Active Play', color: '#ff4fa3' },
  team: { label: 'Team & Scouting', color: '#3dc6ff' },
  auto: { label: 'Automation', color: '#c6ff3d' },
  offline: { label: 'Offline', color: '#9b6bff' },
  start: { label: 'Head Start', color: '#ff6b1a' },
  empire: { label: 'Empire', color: '#3dffb0' },
};

/** What each Legacy count permanently unlocks (availability, not ownership). */
export const LEGACY_UNLOCKS: { legacy: number; title: string; items: string[] }[] = [
  { legacy: 1, title: 'Your Own Brand', items: ['Workshop: design brand lines & signature products', 'Pro Open contest, Regional Contest event, Brand Video tier', 'Scout Big Al, Zoe Laurent and Tomás Vega'] },
  { legacy: 2, title: 'Skateparks', items: ['Skatepark: facilities, admission, lessons, memberships', '+1 team slot (up to 6)', 'Scout Remy Castillo and Harper Quinn', 'Shop Manager & Producer automation in the tree'] },
  { legacy: 3, title: 'Going National', items: ['Warehouse: distribution slots & regions', 'National and World tours', 'Feature Documentary tier', 'Scout Ade Mensah', 'Founding Skater carryover in the tree'] },
  { legacy: 4, title: 'Manufacturing & Majors', items: ['Factory: allocate production capacity to brand lines', 'National Championship & World Finals events', 'World Championship contest', 'Scout Old Man Gus'] },
  { legacy: 5, title: 'The Empire', items: ['Empire HQ: the five-phase capstone project'] },
];

/** Cred formula: total Cred potential from lifetime run earnings E is (E / CRED_DIVISOR)^CRED_EXPONENT. */
export const CRED_DIVISOR = 2.5e6;
export const CRED_EXPONENT = 0.3;
/** Minimum Cred a Legacy must grant. */
export const MIN_LEGACY_CRED = 5;
/** Lifetime Cred earned (spent or not) gives all income ×sqrt(1 + CRED_INCOME_BONUS × Cred). */
export const CRED_INCOME_BONUS = 0.1;
