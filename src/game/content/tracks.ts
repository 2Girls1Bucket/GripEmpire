// Repeatable, run-funded upgrade tracks for every system.
// Cost of buying level L+1 = baseCost * growth^L. Value functions are pure.
import type { ProductId } from './products';

export type TrackSystem = 'shop' | 'team' | 'media' | 'events' | 'tour' | 'park' | 'distro' | 'factory' | 'brand';

export interface TrackDef {
  id: string;
  system: TrackSystem;
  name: string;
  desc: string;
  baseCost: number;
  growth: number;
  maxLevel?: number;
  /** Numeric effect at a given level (interpretation depends on the track). */
  value: (level: number) => number;
  /** Short text for the effect at a level. */
  show: (level: number) => string;
  /** Requirements to see/buy this track. */
  requires?: { product?: ProductId; legacy?: number; track?: [string, number] };
  /** Named tiers for flavor (index = level). */
  tierNames?: string[];
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const mult = (x: number) => `×${x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)}`;

export const TRACKS: TrackDef[] = [
  // ---------------- SHOP ----------------
  {
    id: 'staff',
    system: 'shop',
    name: 'Staff & Automation',
    desc: 'Hire people to serve customers while you do other things. Level 1 turns on passive shop income.',
    baseCost: 100,
    growth: 13,
    value: (l) => (l <= 0 ? 0 : Math.pow(1.25, l - 1)),
    show: (l) => (l <= 0 ? 'No staff: shop earns only from your own sales' : `Passive shop income ${mult(Math.pow(1.25, l - 1))}`),
    tierNames: [
      'Just you',
      'Your cousin (weekends)',
      'Part-time clerk',
      'Two clerks',
      'Shop crew',
      'Shift lead',
      'Store manager',
      'Regional staff',
      'Staffing agency',
      'Retail ops team',
      'Empire workforce',
    ],
  },
  {
    id: 'marketing',
    system: 'shop',
    name: 'Flyers & Marketing',
    desc: 'More foot traffic. Photocopied flyers, then local radio, then billboards.',
    baseCost: 500,
    growth: 7,
    value: (l) => Math.pow(1.15, l),
    show: (l) => `Product income ${mult(Math.pow(1.15, l))}`,
  },
  {
    id: 'displays',
    system: 'shop',
    name: 'Displays & Racks',
    desc: 'Wall racks, glass cases and a deck wall. Shoppers buy what they can see.',
    baseCost: 2_000,
    growth: 8,
    value: (l) => Math.pow(1.08, l),
    show: (l) => `Product income ${mult(Math.pow(1.08, l))}`,
  },
  {
    id: 'margins',
    system: 'shop',
    name: 'Supplier Margins',
    desc: 'Negotiate bulk pricing. Product levels get cheaper.',
    baseCost: 2_000,
    growth: 9,
    maxLevel: 12,
    value: (l) => Math.pow(0.9, l),
    show: (l) => `Product level costs ${mult(Math.pow(0.9, l))}`,
  },
  {
    id: 'checkout',
    system: 'shop',
    name: 'Checkout Counter',
    desc: 'A faster till, card reader and a sticker bowl. Each manual sale is worth more.',
    baseCost: 200,
    growth: 5,
    value: (l) => 1 + 0.15 * l,
    show: (l) => `Manual sales ${mult(1 + 0.15 * l)}, max streak +${l * 2}`,
  },
  {
    id: 'online',
    system: 'shop',
    name: 'Online Store',
    desc: 'A webshop with a shipping station. Online orders keep flowing while you are away (double offline efficiency).',
    baseCost: 60_000,
    growth: 6,
    requires: { product: 'wheels' },
    value: (l) => 0.1 * l,
    show: (l) => `Online sales = ${pct(0.1 * l)} of passive shop income`,
  },

  // ---------------- TEAM HQ ----------------
  {
    id: 'teamVan',
    system: 'team',
    name: 'Team Space',
    desc: 'A bigger van, then a team house. More team slots.',
    baseCost: 25_000,
    growth: 60,
    maxLevel: 2,
    value: (l) => l,
    show: (l) => `+${l} team slot${l === 1 ? '' : 's'}`,
    tierNames: ['Hatchback', 'Team van', 'Team house'],
  },
  {
    id: 'manager',
    system: 'team',
    name: 'Team Manager',
    desc: 'Someone to handle the calendar. Unlocks Repeat on assignments and filming queues.',
    baseCost: 40_000,
    growth: 1,
    maxLevel: 1,
    value: (l) => l,
    show: (l) => (l > 0 ? 'Repeat enabled' : 'Assignments must be restarted by hand'),
  },
  {
    id: 'coaching',
    system: 'team',
    name: 'Coaching Staff',
    desc: 'Physio, coach, and a guy with a stopwatch. Training is cheaper.',
    baseCost: 80_000,
    growth: 7,
    maxLevel: 10,
    value: (l) => Math.pow(0.88, l),
    show: (l) => `Training costs ${mult(Math.pow(0.88, l))}`,
  },

  // ---------------- TOUR ----------------
  {
    id: 'transport',
    system: 'tour',
    name: 'Transport',
    desc: 'Van → bus → sleeper coach → charter jet. Tours finish faster.',
    baseCost: 120_000,
    growth: 12,
    maxLevel: 6,
    value: (l) => Math.pow(0.88, l),
    show: (l) => `Tour duration ${mult(Math.pow(0.88, l))}`,
  },
  {
    id: 'tourPromo',
    system: 'tour',
    name: 'Tour Promotion',
    desc: 'Posters in every town. Bigger tour payouts.',
    baseCost: 90_000,
    growth: 4,
    value: (l) => 1 + 0.25 * l,
    show: (l) => `Tour & demo payouts ${mult(1 + 0.25 * l)}`,
  },
  {
    id: 'tourScale',
    system: 'tour',
    name: 'Tour Scale',
    desc: 'More stops, more fans, more merch tables.',
    baseCost: 150_000,
    growth: 4,
    value: (l) => 1 + 0.3 * l,
    show: (l) => `Fans from tours & demos ${mult(1 + 0.3 * l)}`,
  },

  // ---------------- MEDIA ----------------
  {
    id: 'camera',
    system: 'media',
    name: 'Camera Kit',
    desc: 'From a cracked phone to a cinema rig. Faster automated filming.',
    baseCost: 3_000,
    growth: 4,
    value: (l) => 1 + 0.3 * l,
    show: (l) => `Auto footage rate ${mult(1 + 0.3 * l)}`,
  },
  {
    id: 'lens',
    system: 'media',
    name: 'Fisheye & Lights',
    desc: 'Makes every trick look gnarlier. More footage from Film a Line, slightly wider timing windows.',
    baseCost: 5_000,
    growth: 6,
    maxLevel: 10,
    value: (l) => 1 + 0.2 * l,
    show: (l) => `Line footage ${mult(1 + 0.2 * l)}, timing +${l * 3}%`,
  },
  {
    id: 'editing',
    system: 'media',
    name: 'Editing Suite',
    desc: 'A laptop, then a real edit bay. Higher video quality → bigger royalties.',
    baseCost: 8_000,
    growth: 6,
    maxLevel: 12,
    value: (l) => 0.08 * l,
    show: (l) => `Video quality +${(0.08 * l).toFixed(2)}`,
  },

  // ---------------- EVENTS ----------------
  {
    id: 'venue',
    system: 'events',
    name: 'Venue Capacity',
    desc: 'Barriers, bleachers, then a whole arena. Raises max attendance.',
    baseCost: 15_000,
    growth: 4,
    value: (l) => 1 + 0.3 * l,
    show: (l) => `Capacity ${mult(1 + 0.3 * l)}`,
  },
  {
    id: 'eventPromo',
    system: 'events',
    name: 'Event Promotion',
    desc: 'Flyers, then local radio, then streaming ads. Raises demand (wasted if the venue is full).',
    baseCost: 12_000,
    growth: 4,
    value: (l) => 1 + 0.25 * l,
    show: (l) => `Demand ${mult(1 + 0.25 * l)}`,
  },
  {
    id: 'sponsors',
    system: 'events',
    name: 'Sponsor Deals',
    desc: 'Energy drinks and banner space. Bigger event checks.',
    baseCost: 30_000,
    growth: 4.5,
    value: (l) => l,
    show: (l) => `Event revenue +${l * 20}%`,
  },
  {
    id: 'vendors',
    system: 'events',
    name: 'Vendors',
    desc: 'Food trucks and merch tents. More money per event.',
    baseCost: 25_000,
    growth: 4,
    value: (l) => l,
    show: (l) => `Event revenue +${l * 15}%`,
  },
  {
    id: 'broadcast',
    system: 'events',
    name: 'Broadcast',
    desc: 'Livestream, then TV rights. Multiplies event revenue for City Jam and above.',
    baseCost: 4_000_000,
    growth: 5,
    value: (l) => l,
    show: (l) => `City Jam+ revenue +${l * 30}%`,
  },
  {
    id: 'eventCrew',
    system: 'events',
    name: 'Event Crew',
    desc: 'A crew that sets up and tears down. Events re-host automatically.',
    baseCost: 60_000,
    growth: 1,
    maxLevel: 1,
    value: (l) => l,
    show: (l) => (l > 0 ? 'Auto-host on' : 'Re-host each event by hand'),
  },

  // ---------------- SKATEPARK ----------------
  {
    id: 'admission',
    system: 'park',
    name: 'Admission',
    desc: 'Day passes. Money per visitor (only while visitors come).',
    baseCost: 1e9,
    growth: 4,
    value: (l) => 1 + 0.3 * l,
    show: (l) => `Visitor spend ${mult(1 + 0.3 * l)}`,
  },
  {
    id: 'lessons',
    system: 'park',
    name: 'Lessons',
    desc: 'Beginner camps and private lessons. More visitor spend, cheaper skater training.',
    baseCost: 2e9,
    growth: 5,
    value: (l) => l,
    show: (l) => `Visitor spend ${mult(1 + 0.25 * l)}, training ${mult(Math.pow(0.95, l))}`,
  },
  {
    id: 'memberships',
    system: 'park',
    name: 'Memberships',
    desc: 'Monthly members pay whether or not they show up. Steady income that runs at full speed offline.',
    baseCost: 3e9,
    growth: 5,
    value: (l) => l,
    show: (l) => `Members pay ${pct(0.04 * l)} of shop base income`,
  },

  // ---------------- DISTRIBUTION ----------------
  {
    id: 'warehouse',
    system: 'distro',
    name: 'Warehouse Bays',
    desc: 'More shelving, more distribution slots.',
    baseCost: 3e11,
    growth: 30,
    maxLevel: 4,
    value: (l) => 2 + l,
    show: (l) => `${2 + l} distribution slots`,
  },
  {
    id: 'logistics',
    system: 'distro',
    name: 'Logistics',
    desc: 'Better carriers and routing. Increases reach for every slotted line.',
    baseCost: 5e11,
    growth: 5,
    value: (l) => 1 + 0.25 * l,
    show: (l) => `Reach ${mult(1 + 0.25 * l)}`,
  },
  {
    id: 'fulfillment',
    system: 'distro',
    name: 'Fulfillment Center',
    desc: 'Same-day shipping. Boosts the online store share.',
    baseCost: 6e11,
    growth: 7,
    value: (l) => 0.1 * l,
    show: (l) => `Online share +${pct(0.1 * l)}`,
  },

  // ---------------- FACTORY ----------------
  {
    id: 'productionLines',
    system: 'factory',
    name: 'Production Lines',
    desc: 'Each new line adds capacity points to allocate.',
    baseCost: 5e12,
    growth: 9,
    maxLevel: 12,
    value: (l) => 3 + l,
    show: (l) => `${3 + l} capacity points`,
  },
  {
    id: 'rnd',
    system: 'factory',
    name: 'R&D Lab',
    desc: 'Material science for every brand line.',
    baseCost: 1e13,
    growth: 5,
    value: (l) => 1 + 0.25 * l,
    show: (l) => `Brand income ${mult(1 + 0.25 * l)}`,
  },
  {
    id: 'robotics',
    system: 'factory',
    name: 'Robotics',
    desc: 'Lights-out manufacturing keeps running while you are away.',
    baseCost: 2e13,
    growth: 8,
    maxLevel: 6,
    value: (l) => 0.05 * l,
    show: (l) => `Offline efficiency +${pct(0.05 * l)}`,
  },
];

export const TRACK_BY_ID: Record<string, TrackDef> = Object.fromEntries(TRACKS.map((t) => [t.id, t]));
export const tracksFor = (sys: TrackSystem) => TRACKS.filter((t) => t.system === sys);
